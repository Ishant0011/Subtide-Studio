/**
 * Redacts potential secrets, JWTs, bearer/token headers, and signed-URL query tokens
 * before writing anything to server logs or audit event metadata.
 */

const SECRET_PATTERNS: Array<{ re: RegExp; replacement: string }> = [
  // JWTs (header.payload.signature)
  { re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, replacement: "[REDACTED_JWT]" },
  // Supabase secret/service keys
  { re: /\bsb_secret_[A-Za-z0-9_-]{12,}\b/g, replacement: "[REDACTED_SB_SECRET]" },
  // Authorization headers
  { re: /\b(Bearer|Token)\s+[A-Za-z0-9._~+/=-]{8,}/gi, replacement: "$1 [REDACTED_TOKEN]" },
  // Signed URL tokens / API keys in query strings
  { re: /([?&](?:token|apikey|api_key|key|signature|sig|access_token|refresh_token)=)[^&\s"']+/gi, replacement: "$1[REDACTED]" },
  // Common provider key prefixes (OpenAI/Stripe/GitHub/AWS/Deepgram-like)
  { re: /\b(?:sk_live_|sk_test_|ghp_|gho_|github_pat_|AKIA|AIza)[A-Za-z0-9_-]{12,}\b/g, replacement: "[REDACTED_KEY]" },
  // Synthetic canary pattern for automated leak-prevention verification
  { re: /\bCC_CANARY_SECRET_[A-Za-z0-9_-]{6,}\b/g, replacement: "[REDACTED_CANARY]" },
];

const SENSITIVE_KEY_RE =
  /(secret|token|password|passwd|authorization|cookie|api[-_]?key|service[-_]?role|private[-_]?key|signed[-_]?url)/i;

export function redactSensitiveText(input: string, maxLength = 300): string {
  let out = String(input ?? "");
  for (const { re, replacement } of SECRET_PATTERNS) {
    out = out.replace(re, replacement);
  }
  // Redact explicit runtime env secret values if somehow present in a message
  if (typeof process !== "undefined" && process.env) {
    const runtimeSecrets = [
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      process.env.DEEPGRAM_API_KEY,
    ];
    for (const secret of runtimeSecrets) {
      if (secret && secret.length >= 12 && out.includes(secret)) {
        out = out.split(secret).join("[REDACTED_ENV_SECRET]");
      }
    }
  }
  return out.length > maxLength ? `${out.slice(0, maxLength)}...` : out;
}

export function sanitizeAuditMetadata(
  input: Record<string, unknown> | undefined,
  depth = 0
): Record<string, unknown> {
  if (!input || depth > 3) return {};
  const clean: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(input)) {
    if (SENSITIVE_KEY_RE.test(key)) {
      clean[key] = "[REDACTED]";
      continue;
    }
    if (typeof val === "string") {
      clean[key] = redactSensitiveText(val, 240);
    } else if (typeof val === "number" || typeof val === "boolean" || val === null) {
      clean[key] = val;
    } else if (Array.isArray(val)) {
      clean[key] = val.slice(0, 20).map((item) =>
        typeof item === "string" ? redactSensitiveText(item, 120) : item
      );
    } else if (typeof val === "object") {
      clean[key] = sanitizeAuditMetadata(val as Record<string, unknown>, depth + 1);
    }
  }
  return clean;
}
