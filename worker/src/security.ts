/**
 * Worker subprocess isolation and log/error redaction helpers.
 * Ensures FFmpeg/FFprobe never inherit service secrets (SUPABASE_SERVICE_ROLE_KEY,
 * DEEPGRAM_API_KEY, etc.) and that provider/media errors never leak credentials.
 */

const ALLOWED_TOOL_ENV_KEYS = [
  "PATH",
  "Path",
  "PATHEXT",
  "SYSTEMROOT",
  "SystemRoot",
  "WINDIR",
  "TEMP",
  "TMP",
  "TMPDIR",
  "HOME",
  "USERPROFILE",
  "LANG",
  "LC_ALL",
  "FONTCONFIG_PATH",
  "FONTCONFIG_FILE",
];

export function buildMinimalToolEnv(): NodeJS.ProcessEnv {
  const clean: Record<string, string> = {};
  for (const key of ALLOWED_TOOL_ENV_KEYS) {
    const val = process.env[key];
    if (typeof val === "string" && val.length > 0) {
      clean[key] = val;
    }
  }
  return clean as NodeJS.ProcessEnv;
}

const REDACT_PATTERNS: Array<{ re: RegExp; replacement: string }> = [
  { re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, replacement: "[REDACTED_JWT]" },
  { re: /\bsb_secret_[A-Za-z0-9_-]{12,}\b/g, replacement: "[REDACTED_SB_SECRET]" },
  { re: /\b(Bearer|Token)\s+[A-Za-z0-9._~+/=-]{8,}/gi, replacement: "$1 [REDACTED_TOKEN]" },
  { re: /([?&](?:token|apikey|api_key|key|signature|sig)=)[^&\s"']+/gi, replacement: "$1[REDACTED]" },
  { re: /\b(?:sk_live_|sk_test_|ghp_|gho_|github_pat_|AKIA|AIza)[A-Za-z0-9_-]{12,}\b/g, replacement: "[REDACTED_KEY]" },
  { re: /\bCC_CANARY_SECRET_[A-Za-z0-9_-]{6,}\b/g, replacement: "[REDACTED_CANARY]" },
];

export function redactWorkerText(input: string, maxLen = 300): string {
  let out = String(input ?? "");
  for (const { re, replacement } of REDACT_PATTERNS) {
    out = out.replace(re, replacement);
  }
  const runtimeSecrets = [
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.DEEPGRAM_API_KEY,
  ];
  for (const secret of runtimeSecrets) {
    if (secret && secret.length >= 12 && out.includes(secret)) {
      out = out.split(secret).join("[REDACTED_ENV_SECRET]");
    }
  }
  return out.length > maxLen ? `${out.slice(0, maxLen)}...` : out;
}

export function sanitizeLogMeta(
  meta?: Record<string, unknown>
): Record<string, unknown> {
  if (!meta) return {};
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (/(secret|token|key|password|authorization)/i.test(k)) {
      clean[k] = "[REDACTED]";
    } else if (typeof v === "string") {
      clean[k] = redactWorkerText(v, 240);
    } else {
      clean[k] = v;
    }
  }
  return clean;
}
