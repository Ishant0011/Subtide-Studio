# ClipCaptions Security & Owner-Only Administration (OWASP ASVS Baseline)

This document records the security architecture, OWASP ASVS verification controls, credential leak-prevention gates, and operational runbooks for **ClipCaptions**.

---

## 1. Security Surface Inventory

| Surface | Location | Authorization & Controls |
| --- | --- | --- |
| Owner Security Console (UI) | `src/app/admin/page.tsx` | Server-only `requireOwnerAdmin()` + middleware auth check + `Cache-Control: no-store, private` + `noindex, nofollow` |
| Owner Overview API | `GET /api/admin/overview` | `requireOwnerAdmin()` (immutable `OWNER_ADMIN_USER_ID` UUID + verified `AAL2` MFA) + durable Postgres rate limit (`admin_read`) + redacted audit log |
| Owner Session Revocation API | `POST /api/admin/sessions/revoke` | Same-origin CSRF check + `requireOwnerAdmin({ requireFreshMfaSeconds: 900 })` + durable rate limit (`admin_write`) + redacted audit log |
| Email Auth Endpoints | `POST /api/auth/signin`, `POST /api/auth/signup` | Same-origin CSRF check + durable Postgres rate limits (`auth_signin`, `auth_signup`) + redacted failed-login audit events |
| OAuth Callback & Sign-Out | `GET /auth/callback`, `POST /auth/signout` | Strict internal redirect allowlist (`sanitizeNextPath`), CSRF same-origin check on sign-out, optional `?scope=global`, `no-store` |
| Upload & Processing APIs | `POST /api/uploads/init`, `POST /api/uploads/complete`, `POST /api/projects/[id]/process` | Server-verified `auth.getUser()`, CSRF check, UUID param validation, durable Postgres rate limits, owner-scoped RLS + server-assigned object keys |
| Caption & Preset APIs | `GET/PATCH /api/projects*`, `POST /api/projects/[id]/revisions`, `GET/POST/PATCH/DELETE /api/presets*` | Server-verified `auth.getUser()`, CSRF check, bounded JSON bodies, UUID validation, server-side caption bounds + optimistic concurrency (`409`), owner-only RLS |
| Export & Signed Media APIs | `GET/POST /api/projects/[id]/exports`, `GET /api/exports/[exportId]/download`, `GET /api/media/[assetId]/signed-url` | Owner-only RLS check, durable export rate limit, short-lived (60s) signed URLs on private `media` bucket, `Cache-Control: no-store, private` |
| Postgres Security RPCs | `supabase/migrations/*.sql` | All privileged RPCs (`security definer`, `set search_path = public`) revoked from `public`, `anon`, and `authenticated` and granted exclusively to `service_role` |
| Private Storage Bucket | `storage.buckets` (`id = 'media'`, `public = false`) | Strict `<user_id>/...` path prefix policies; TUS uploads restricted to server-allocated `pending` keys |
| Background Media Worker | `worker/src/{index,media,render,transcribe,security}.ts` | Separate Node process with `SUPABASE_SERVICE_ROLE_KEY` & worker-only `DEEPGRAM_API_KEY`; minimal sanitized env passed to `ffmpeg`/`ffprobe`; `-protocol_whitelist file,pipe`; non-root Docker `USER node`; `finally` temp-dir cleanup |

---

## 2. Owner-Only Admin Access Design

1. **Single Immutable Owner Identity**: Configured exclusively via server-only environment variable `OWNER_ADMIN_USER_ID` (never `NEXT_PUBLIC_`). Must be a valid Supabase `auth.users.id` UUID.
2. **Fail Closed**: If `OWNER_ADMIN_USER_ID` is missing or malformed, `requireOwnerAdmin()` denies every request (`403 admin_not_configured`) and records a redacted audit event.
3. **Zero Privilege Escalation Paths**: Admin access is never granted via sign-up, OAuth login, email address matching, or user-editable profile/JWT metadata.
4. **Mandatory MFA (AAL2) & Fresh Re-Auth**:
   - All admin reads and pages require `supabase.auth.mfa.getAuthenticatorAssuranceLevel()` to report `currentLevel === "aal2"`.
   - Sensitive admin writes (`POST /api/admin/sessions/revoke`) additionally require a fresh MFA verification timestamp in `amr` within 15 minutes (`requireFreshMfaSeconds: 900`).
5. **Server-Only Module Isolation**: `src/lib/supabase/admin.ts`, `src/lib/security/admin-guard.ts`, `src/lib/security/audit.ts`, and `src/lib/security/rate-limit.ts` all import `"server-only"` so any accidental client-component import fails the Next.js build immediately.

---

## 3. OWASP ASVS Verification Checklist

- **V2 Authentication**:
  - Server verifies sessions via `supabase.auth.getUser()` (never trusts cookie/JWT without server validation).
  - Owner administration requires AAL2 MFA + fresh MFA window for sensitive actions.
  - Durable Postgres rate limiting protects email sign-in and sign-up (`check_and_increment_rate_limit`).
  - Logout supports local and global session revocation (`POST /auth/signout?scope=global`, `POST /api/admin/sessions/revoke`).
- **V3 Session Management**:
  - Supabase SSR cookies (`HttpOnly`, `SameSite=Lax`, `Secure` on HTTPS).
  - `Cache-Control: no-store, no-cache, must-revalidate, private` applied on all `/api/*`, `/admin/*`, `/projects/*`, and `/upload/*` responses.
- **V4 Access Control**:
  - Strict owner-only RLS (`ENABLE` + `FORCE ROW LEVEL SECURITY`) on `projects`, `media_assets`, `ingest_jobs`, `caption_revisions`, `export_jobs`, `caption_presets`, `security_audit_events`, and `rate_limit_buckets`.
  - Cross-account requests to projects, uploads, presets, media signed URLs, and export downloads return `404`.
  - All state-changing API routes enforce same-origin CSRF checks (`Origin`/`Referer`/`Sec-Fetch-Site`).
- **V5 Validation & Sanitization**:
  - Strict UUID validation on all dynamic route parameters (`[id]`, `[assetId]`, `[exportId]`).
  - Bounded JSON request body sizes via `readBoundedJson()`.
  - Strict internal redirect allowlist (`sanitizeNextPath`) rejecting `//`, `/\`, `\`, external schemes, and control chars.
  - JSON-LD output escapes `<` as `\u003c`.
- **V7 Error Handling & Logging**:
  - API responses return generic client-safe errors (never raw database, storage, or provider errors).
  - `security_audit_events` and worker structured logs automatically redact JWTs, `sb_secret_*`, `Bearer`/`Token` headers, signed URL query tokens, and runtime env secrets.
- **V12 Files & Resources**:
  - Private `media` bucket (`public = false`) with 60-second signed URLs.
  - Worker enforces 3-minute duration, stream count, dimension, runtime, and output byte bounds.
  - FFmpeg/FFprobe run with a minimal allowlisted environment (no `SUPABASE_SERVICE_ROLE_KEY` or `DEEPGRAM_API_KEY`) and `-protocol_whitelist file,pipe` to block network SSRF.
- **V14 Configuration & Headers**:
  - Restrictive CSP (`frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `Cross-Origin-Opener-Policy: same-origin`, HSTS in production, and `poweredByHeader: false`.

---

## 4. Credential Leak-Prevention Gate & CI Checks

1. **Local / Pre-commit Redacted Scanner**:
   ```bash
   pnpm security:scan
   ```
   Scans staged changes, tracked files, Git commit history, Docker ignore hygiene, and generated `.next/static/` browser chunks without printing raw secret values.
2. **Required CI Workflow**: `.github/workflows/security-gate.yml` runs on every push and PR to `main`:
   - Full-history redacted secret scan (`node scripts/security-secret-scan.mjs`)
   - High/critical dependency audit (`pnpm audit --audit-level=high`)
   - Web & worker lint, typecheck, and build
   - Post-build `.next/static/` browser bundle leak check (`--static-only`)

---

## 5. Production & Dashboard Controls (Owner Verification Required)

The following external platform controls live outside Git and must be enabled and verified by the project owner in their respective dashboards before public release:

1. **GitHub Repository Settings**:
   - Enable **Secret Scanning** and **Push Protection** under *Settings → Code security and analysis*.
   - Add a **Branch Protection Rule** on `main` requiring the `Secret Scan, Dependency Audit & Build Checks` status check to pass before merge.
2. **Owner Account & MFA**:
   - Enroll hardware-backed WebAuthn or TOTP MFA on the dedicated owner account in Supabase Auth, GitHub, Vercel/hosting, and Deepgram dashboards.
   - Set `OWNER_ADMIN_USER_ID` strictly in the production server environment (never in `NEXT_PUBLIC_*` or client code).
3. **Environment Separation & Least-Privilege Credentials**:
   - Use completely separate Supabase projects, service-role keys, OAuth client secrets, and Deepgram keys between dev/staging and production.
   - Restrict Deepgram API keys to worker-only environment variables and scope them to transcription-only permissions.
4. **Emergency Revocation & Secret Rotation Runbook**:
   - **Compromised Owner Session**: Trigger `POST /api/admin/sessions/revoke` with `{ "scope": "global" }` (or revoke via Supabase Auth dashboard), rotate owner password and MFA factors.
   - **Compromised Service Role / Deepgram Key**: Immediately roll the key in Supabase / Deepgram dashboard, update production host & worker env secrets, redeploy/restart web and worker processes, and audit `public.security_audit_events`.
5. **Backups & Restoration Verification**:
   - Confirm automated daily Postgres backups and Point-in-Time Recovery (PITR) are enabled in the production Supabase project.
   - Perform and document a staging restore drill verifying table data, RLS policies, and storage bucket access before public launch.
