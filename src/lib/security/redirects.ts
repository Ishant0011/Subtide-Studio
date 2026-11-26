/**
 * Strict internal redirect allowlist preventing protocol-relative (`//`),
 * backslash (`/\`), control-character, or external-origin open redirects.
 * Edge-runtime safe (no Node.js built-ins).
 */
export function sanitizeNextPath(
  raw: string | null | undefined,
  fallback = "/projects"
): string {
  if (!raw || typeof raw !== "string") return fallback;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/")) return fallback;
  if (trimmed.startsWith("//") || trimmed.startsWith("/\\")) return fallback;
  if (trimmed.includes("\\")) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) return fallback;
  try {
    const parsed = new URL(trimmed, "http://clipcaptions.local");
    if (parsed.origin !== "http://clipcaptions.local") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
