#!/usr/bin/env node
/**
 * Redacted Credential Leak-Prevention Scanner for ClipCaptions.
 *
 * Scans:
 *  1. Staged Git changes (`git diff --cached`)
 *  2. Tracked working tree files (`git ls-files`)
 *  3. Git commit history (`git log -p`)
 *  4. Generated browser assets (`.next/static/`) for leaked server secrets/env names
 *  5. Docker build context (`worker/Dockerfile`, `.dockerignore`, `worker/.dockerignore`)
 *
 * NEVER prints raw secret values — outputs only file/scope, rule ID, line number,
 * and a short SHA-256 fingerprint prefix.
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

const ROOT = process.cwd();
const args = new Set(process.argv.slice(2));
const skipHistory = args.has("--no-history");
const scanStaticOnly = args.has("--static-only");

const SECRET_RULES = [
  { id: "private-key-block", re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP |)PRIVATE KEY-----/g },
  { id: "supabase-secret-key", re: /\bsb_secret_[A-Za-z0-9_-]{16,}\b/g },
  { id: "supabase-service-jwt", re: /\beyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{20,}\b/g },
  { id: "github-pat", re: /\b(?:ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|gho_[A-Za-z0-9]{30,})\b/g },
  { id: "aws-access-key", re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { id: "stripe-secret", re: /\b(?:sk_live|rk_live)_[A-Za-z0-9]{20,}\b/g },
  { id: "google-api-key", re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { id: "synthetic-canary", re: /\bCC_CANARY_SECRET_[A-Za-z0-9_-]{6,}\b/g },
  {
    id: "assigned-service-role-key",
    re: /\bSUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*["']?[A-Za-z0-9._-]{20,}["']?/g,
  },
  {
    id: "assigned-deepgram-key",
    re: /\bDEEPGRAM_API_KEY\s*[:=]\s*["']?[A-Za-z0-9._-]{20,}["']?/g,
  },
  {
    id: "assigned-gemini-key",
    re: /\bGEMINI_API_KEY\s*[:=]\s*["']?[A-Za-z0-9._-]{20,}["']?/g,
  },
];

const BROWSER_BUNDLE_FORBIDDEN = [
  { id: "browser-bundle-service-role-ref", re: /\bSUPABASE_SERVICE_ROLE_KEY\b/g },
  { id: "browser-bundle-deepgram-ref", re: /\bDEEPGRAM_API_KEY\b/g },
  { id: "browser-bundle-gemini-ref", re: /\bGEMINI_API_KEY\b/g },
  { id: "browser-bundle-owner-admin-ref", re: /\bOWNER_ADMIN_USER_ID\b/g },
  ...SECRET_RULES,
];

// Exclude this scanner itself and docs/test placeholders that describe rules
const SKIP_SCAN_PATHS = new Set([
  "scripts/security-secret-scan.mjs",
  "src/lib/security/redact.ts",
  "worker/src/security.ts",
]);

const BINARY_EXTS = new Set([
  ".mp4",
  ".mov",
  ".mp3",
  ".wav",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".ico",
  ".ttf",
  ".woff",
  ".woff2",
  ".pdf",
  ".zip",
]);

function fingerprint(value) {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 10);
}

function loadLocalSecretValues() {
  const values = [];
  const envFile = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envFile)) return values;
  try {
    const content = fs.readFileSync(envFile, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const m = line.match(
        /^\s*(SUPABASE_SERVICE_ROLE_KEY|DEEPGRAM_API_KEY|GEMINI_API_KEY|OWNER_ADMIN_USER_ID)\s*=\s*(.+)\s*$/
      );
      if (m) {
        const val = m[2].trim().replace(/^['"]|['"]$/g, "");
        if (val.length >= 16) {
          values.push({ name: m[1], value: val });
        }
      }
    }
  } catch {
    // ignore unreadable local env
  }
  return values;
}

const findings = [];

function scanText(scope, fileLabel, text, rules, literalSecrets = []) {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const rule of rules) {
      rule.re.lastIndex = 0;
      let match;
      while ((match = rule.re.exec(line)) !== null) {
        const matched = match[0];
        // Ignore obvious doc/example placeholders
        if (
          /your-|example|placeholder|replace-with-|REDACTED|00000000-0000/i.test(
            matched
          )
        ) {
          continue;
        }
        findings.push({
          scope,
          file: fileLabel,
          line: i + 1,
          rule: rule.id,
          fingerprint: fingerprint(matched),
        });
      }
    }

    for (const secret of literalSecrets) {
      if (line.includes(secret.value)) {
        findings.push({
          scope,
          file: fileLabel,
          line: i + 1,
          rule: `literal-env-secret:${secret.name}`,
          fingerprint: fingerprint(secret.value),
        });
      }
    }
  }
}

function walkFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(full));
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

const literalSecrets = loadLocalSecretValues();

// 1. Scan generated browser bundles (.next/static)
const nextStaticDir = path.join(ROOT, ".next", "static");
let staticFilesScanned = 0;
if (fs.existsSync(nextStaticDir)) {
  for (const fullPath of walkFiles(nextStaticDir)) {
    const ext = path.extname(fullPath).toLowerCase();
    if (BINARY_EXTS.has(ext)) continue;
    const rel = path.relative(ROOT, fullPath).replace(/\\/g, "/");
    const content = fs.readFileSync(fullPath, "utf8");
    scanText("next-static", rel, content, BROWSER_BUNDLE_FORBIDDEN, literalSecrets);
    staticFilesScanned++;
  }
}

if (!scanStaticOnly) {
  // 2. Scan tracked working tree files
  let tracked = [];
  try {
    tracked = execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" })
      .split(/\r?\n/)
      .filter(Boolean);
  } catch {
    tracked = [];
  }

  for (const rel of tracked) {
    const normRel = rel.replace(/\\/g, "/");
    if (SKIP_SCAN_PATHS.has(normRel)) continue;
    const ext = path.extname(normRel).toLowerCase();
    if (BINARY_EXTS.has(ext)) continue;
    const full = path.join(ROOT, rel);
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) continue;
    const content = fs.readFileSync(full, "utf8");
    scanText("working-tree", normRel, content, SECRET_RULES, literalSecrets);
  }

  // 3. Verify no .env.local or secret files are staged or tracked
  for (const rel of tracked) {
    const base = path.basename(rel);
    if (
      (base === ".env" || base.startsWith(".env.")) &&
      base !== ".env.example"
    ) {
      findings.push({
        scope: "git-tracked",
        file: rel,
        line: 0,
        rule: "tracked-env-file",
        fingerprint: fingerprint(rel),
      });
    }
  }

  // 4. Scan staged changes (`git diff --cached`)
  try {
    const staged = execFileSync("git", ["diff", "--cached", "--unified=0"], {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    });
    if (staged) {
      let currentFile = "staged-diff";
      for (const line of staged.split(/\r?\n/)) {
        if (line.startsWith("+++ b/")) {
          currentFile = line.slice(6).trim();
          continue;
        }
        if (SKIP_SCAN_PATHS.has(currentFile)) continue;
        if (line.startsWith("+") && !line.startsWith("+++")) {
          scanText("staged", currentFile, line.slice(1), SECRET_RULES, literalSecrets);
        }
      }
    }
  } catch {
    // ignore when not in git repo
  }

  // 5. Verify Dockerfiles & .dockerignore hygiene
  for (const dockerIgnoreRel of [".dockerignore", "worker/.dockerignore"]) {
    const full = path.join(ROOT, dockerIgnoreRel);
    if (!fs.existsSync(full)) {
      findings.push({
        scope: "docker-hygiene",
        file: dockerIgnoreRel,
        line: 0,
        rule: "missing-dockerignore",
        fingerprint: fingerprint(dockerIgnoreRel),
      });
    } else {
      const content = fs.readFileSync(full, "utf8");
      if (!/^\.env/m.test(content)) {
        findings.push({
          scope: "docker-hygiene",
          file: dockerIgnoreRel,
          line: 0,
          rule: "dockerignore-missing-dotenv",
          fingerprint: fingerprint(dockerIgnoreRel),
        });
      }
    }
  }

  // 6. Scan available Git history (`git log -p`)
  if (!skipHistory) {
    try {
      const history = execFileSync(
        "git",
        ["log", "--all", "-p", "--no-color", "--unified=0"],
        { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
      );
      let currentCommit = "";
      let currentFile = "";
      for (const line of history.split(/\r?\n/)) {
        if (line.startsWith("commit ")) {
          currentCommit = line.slice(7, 19).trim();
          continue;
        }
        if (line.startsWith("+++ b/")) {
          currentFile = line.slice(6).trim();
          continue;
        }
        if (SKIP_SCAN_PATHS.has(currentFile)) continue;
        if (line.startsWith("+") && !line.startsWith("+++")) {
          scanText(
            `git-history:${currentCommit}`,
            currentFile || "unknown",
            line.slice(1),
            SECRET_RULES,
            literalSecrets
          );
        }
      }
    } catch {
      // ignore if shallow/no git
    }
  }
}

const summary = {
  ok: findings.length === 0,
  staticFilesScanned,
  findingsCount: findings.length,
  findings: findings.slice(0, 50),
};

console.log(JSON.stringify(summary, null, 2));
if (findings.length > 0) {
  process.exit(1);
}
