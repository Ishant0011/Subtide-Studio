"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  RefreshCw,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { EnabledOAuthProviders } from "@/lib/supabase/env";

export type AuthFormMode = "signin" | "magic" | "signup" | "forgot";

interface AuthFormProps {
  nextPath: string;
  initialMode?: AuthFormMode;
  initialError?: string | null;
  supabaseConfigured: boolean;
  enabledProviders: EnabledOAuthProviders;
}

export function AuthForm({
  nextPath,
  initialMode = "signin",
  initialError,
  supabaseConfigured,
  enabledProviders,
}: AuthFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthFormMode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "discord" | null>(
    null
  );
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showResendHelper, setShowResendHelper] = useState(false);

  const hasSocialProviders = enabledProviders.google || enabledProviders.discord;

  function switchMode(nextMode: AuthFormMode) {
    setMode(nextMode);
    setError(null);
    setNotice(null);
    if (nextMode !== "signin" && nextMode !== "signup") {
      setShowResendHelper(false);
    }
  }

  async function handleOAuth(provider: "google" | "discord") {
    if (!supabaseConfigured) {
      setError(
        "Supabase environment variables are not configured. Copy .env.example to .env.local to sign in."
      );
      return;
    }

    setError(null);
    setNotice(null);
    setOauthLoading(provider);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        },
      });
      if (oauthError) {
        setError(oauthError.message);
        setOauthLoading(null);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not start social sign-in."
      );
      setOauthLoading(null);
    }
  }

  async function handleResendConfirmation() {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) {
      setError("Enter your email address above first to resend confirmation.");
      return;
    }
    setResending(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/auth/resend-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, nextPath }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        setError(data.error || "Could not resend confirmation email.");
        return;
      }
      setNotice(
        data.message ||
          "If an unconfirmed account exists for that email, we sent a fresh confirmation link."
      );
    } catch {
      setError("Network error while resending confirmation email.");
    } finally {
      setResending(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseConfigured) {
      setError(
        "Supabase environment variables are not configured. Copy .env.example to .env.local to sign in."
      );
      return;
    }

    setError(null);
    setNotice(null);
    setLoading(true);

    try {
      if (mode === "signin") {
        const res = await fetch("/api/auth/signin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            password,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          setError(data.error || "Invalid email or password.");
          setShowResendHelper(true);
          return;
        }
        router.push(nextPath);
        router.refresh();
      } else if (mode === "magic") {
        const res = await fetch("/api/auth/magic-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            nextPath,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
        };
        if (!res.ok) {
          setError(data.error || "Could not send sign-in link.");
          return;
        }
        setNotice(
          data.message ||
            "Check your inbox for a one-time sign-in link."
        );
      } else if (mode === "forgot") {
        const res = await fetch("/api/auth/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
        };
        if (!res.ok) {
          setError(data.error || "Could not send password reset email.");
          return;
        }
        setNotice(
          data.message ||
            "If an account exists for that email, we sent a password reset link."
        );
      } else {
        const res = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            password,
            nextPath,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          hasSession?: boolean;
        };
        if (!res.ok) {
          setError(data.error || "Could not create account.");
          return;
        }

        if (data.hasSession) {
          router.push(nextPath);
          router.refresh();
        } else {
          setNotice(
            "Account created. Check your inbox to confirm your email, then sign in."
          );
          setShowResendHelper(true);
        }
      }
    } catch {
      setError("Network error while authenticating. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const heading =
    mode === "signup"
      ? "Create your account"
      : mode === "magic"
        ? "Email me a sign-in link"
        : mode === "forgot"
          ? "Reset your password"
          : "Sign in to ClipCaptions";

  const subcopy =
    mode === "signup"
      ? "Start uploading MP4, MOV, MP3, and WAV clips to your private workspace."
      : mode === "magic"
        ? "We will email you a one-time link — no password required."
        : mode === "forgot"
          ? "Enter your account email and we will send a password reset link."
          : nextPath.startsWith("/upload")
            ? "You'll land directly on Upload right after signing in."
            : "Access your private projects, caption revisions, and MP4 exports.";

  return (
    <div
      data-testid="auth-form-card"
      className="cc-panel-enter w-full max-w-md rounded-2xl border border-ink/12 bg-panel p-5 shadow-[0_24px_70px_rgba(0,0,0,0.6)] sm:p-7"
    >
      <div className="flex items-center gap-2 text-xs font-medium text-accent">
        <Lock className="h-3.5 w-3.5" />
        <span>
          {nextPath.startsWith("/upload")
            ? "Sign in to upload a clip"
            : "Private Workspace Access"}
        </span>
      </div>

      <h1 className="mt-2.5 text-2xl font-bold tracking-tight text-ink">
        {heading}
      </h1>
      <p className="mt-1.5 text-sm text-ink-secondary">{subcopy}</p>

      {/* OAuth Providers (rendered only when explicitly enabled for this environment) */}
      {hasSocialProviders && mode !== "forgot" && (
        <div className="mt-5 space-y-2.5" data-testid="auth-social-providers">
          {enabledProviders.google && (
            <button
              type="button"
              data-testid="auth-google-btn"
              disabled={loading || oauthLoading !== null}
              onClick={() => void handleOAuth("google")}
              className="cc-card-interactive inline-flex w-full items-center justify-center gap-2.5 rounded-xl border border-ink/18 bg-elevated px-4 py-2.5 text-sm font-semibold text-ink hover:border-accent/55 hover:bg-track disabled:opacity-60"
            >
              {oauthLoading === "google" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#EA4335"
                    d="M12 10.2v3.9h5.5c-.2 1.2-1.5 3.6-5.5 3.6-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.9 1.5l2.6-2.5C16.8 3.1 14.6 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10c5.8 0 9.6-4.1 9.6-9.8 0-.7-.1-1.2-.2-1.7H12z"
                  />
                </svg>
              )}
              <span>Continue with Google</span>
            </button>
          )}

          {enabledProviders.discord && (
            <button
              type="button"
              data-testid="auth-discord-btn"
              disabled={loading || oauthLoading !== null}
              onClick={() => void handleOAuth("discord")}
              className="cc-card-interactive inline-flex w-full items-center justify-center gap-2.5 rounded-xl border border-ink/15 bg-inset px-4 py-2.5 text-sm font-medium text-ink hover:border-accent/55 hover:bg-elevated disabled:opacity-60"
            >
              {oauthLoading === "discord" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#5865F2"
                    d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.6 1.2a18.2 18.2 0 0 0-5.6 0L8.6 3a19.8 19.8 0 0 0-4.9 1.4C.6 9-.2 13.5.2 17.9a20 20 0 0 0 6 3l1.3-2.1a13 13 0 0 1-2-.9l.5-.4a14.1 14.1 0 0 0 12 0l.5.4a13 13 0 0 1-2 .9l1.3 2.1a20 20 0 0 0 6-3c.5-5.1-.8-9.5-3.5-13.5zM8.5 15.2c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.1 1.1 2.1 2.4-.9 2.4-2.1 2.4zm7 0c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.1 1.1 2.1 2.4-.9 2.4-2.1 2.4z"
                  />
                </svg>
              )}
              <span>Continue with Discord</span>
            </button>
          )}

          <div className="relative flex items-center py-1">
            <div className="flex-grow border-t border-ink/10" />
            <span className="mx-3 text-[11px] text-ink-muted">
              or continue with email
            </span>
            <div className="flex-grow border-t border-ink/10" />
          </div>
        </div>
      )}

      {/* Primary Email Method Switcher (easy to reach on desktop & mobile) */}
      <div
        role="tablist"
        aria-label="Email authentication method"
        className="mt-5 grid grid-cols-3 gap-1 rounded-xl border border-ink/10 bg-page p-1"
      >
        <button
          type="button"
          role="tab"
          data-testid="auth-tab-signin"
          aria-selected={mode === "signin"}
          onClick={() => switchMode("signin")}
          className={`rounded-lg px-2 py-2 text-xs font-semibold transition ${
            mode === "signin"
              ? "bg-accent-soft text-accent-hover ring-1 ring-accent/35"
              : "text-ink-secondary hover:text-ink"
          }`}
        >
          Password
        </button>
        <button
          type="button"
          role="tab"
          data-testid="auth-tab-magic"
          aria-selected={mode === "magic"}
          onClick={() => switchMode("magic")}
          className={`rounded-lg px-2 py-2 text-xs font-semibold transition ${
            mode === "magic"
              ? "bg-accent-soft text-accent-hover ring-1 ring-accent/35"
              : "text-ink-secondary hover:text-ink"
          }`}
        >
          Email link
        </button>
        <button
          type="button"
          role="tab"
          data-testid="auth-tab-signup"
          aria-selected={mode === "signup"}
          onClick={() => switchMode("signup")}
          className={`rounded-lg px-2 py-2 text-xs font-semibold transition ${
            mode === "signup"
              ? "bg-accent-soft text-accent-hover ring-1 ring-accent/35"
              : "text-ink-secondary hover:text-ink"
          }`}
        >
          Create
        </button>
      </div>

      {!supabaseConfigured && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Supabase is not configured yet. Copy{" "}
            <code className="font-mono">.env.example</code> to{" "}
            <code className="font-mono">.env.local</code> to sign in.
          </span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          data-testid="auth-error-banner"
          className="cc-panel-enter mt-4 flex items-start gap-2.5 rounded-xl border border-rose-400/35 bg-rose-500/10 p-3 text-xs text-rose-200"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div
          role="status"
          data-testid="auth-notice-banner"
          className="cc-panel-enter mt-4 flex items-start gap-2.5 rounded-xl border border-accent/40 bg-accent-soft p-3 text-xs text-accent-hover"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <form
        key={mode}
        onSubmit={handleSubmit}
        className="cc-panel-enter mt-5 space-y-4"
      >
        <div>
          <label
            htmlFor="auth-email"
            className="block text-xs font-medium text-ink-secondary"
          >
            Email address
          </label>
          <input
            id="auth-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@studio.dev"
            className="mt-1.5 w-full rounded-xl border border-ink/12 bg-page px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
          />
        </div>

        {(mode === "signin" || mode === "signup") && (
          <div>
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="auth-password"
                className="block text-xs font-medium text-ink-secondary"
              >
                Password
              </label>
              {mode === "signin" && (
                <button
                  type="button"
                  data-testid="auth-forgot-link"
                  onClick={() => switchMode("forgot")}
                  className="text-xs font-medium text-accent hover:text-accent-hover hover:underline"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <input
              id="auth-password"
              type="password"
              required
              minLength={6}
              autoComplete={
                mode === "signin" ? "current-password" : "new-password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              className="mt-1.5 w-full rounded-xl border border-ink/12 bg-page px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
            />
          </div>
        )}

        <button
          type="submit"
          data-testid="auth-submit-btn"
          disabled={loading || oauthLoading !== null}
          className="cc-card-interactive inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-page hover:bg-accent-hover disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : mode === "magic" ? (
            <Mail className="h-4 w-4" />
          ) : mode === "forgot" ? (
            <KeyRound className="h-4 w-4" />
          ) : null}
          <span>
            {mode === "signin"
              ? "Sign in"
              : mode === "signup"
                ? "Create account"
                : mode === "magic"
                  ? "Email me a sign-in link"
                  : "Send password reset link"}
          </span>
        </button>

        {/* Secondary direct shortcut to passwordless link from Password tab */}
        {mode === "signin" && (
          <button
            type="button"
            data-testid="auth-shortcut-magic-btn"
            onClick={() => switchMode("magic")}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-ink/12 bg-inset px-4 py-2.5 text-xs font-semibold text-ink-secondary transition hover:border-ink/25 hover:text-ink"
          >
            <Mail className="h-3.5 w-3.5 text-accent" />
            <span>Email me a sign-in link instead</span>
          </button>
        )}

        {mode === "forgot" && (
          <button
            type="button"
            onClick={() => switchMode("signin")}
            className="w-full text-center text-xs font-medium text-ink-secondary hover:text-ink"
          >
            Back to password sign-in
          </button>
        )}
      </form>

      {/* Resend Confirmation Helper (shown on Create tab or after sign-in error) */}
      {(showResendHelper || mode === "signup") && (
        <div
          data-testid="auth-resend-confirmation-box"
          className="cc-panel-enter mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-ink/10 bg-inset px-3.5 py-2.5 text-xs"
        >
          <span className="text-ink-secondary">
            Need a fresh confirmation email?
          </span>
          <button
            type="button"
            data-testid="auth-resend-confirmation-btn"
            disabled={resending}
            onClick={() => void handleResendConfirmation()}
            className="inline-flex items-center gap-1 font-semibold text-accent hover:text-accent-hover disabled:opacity-60"
          >
            {resending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            <span>Resend confirmation</span>
          </button>
        </div>
      )}

      <div className="mt-6 border-t border-ink/10 pt-4 text-center text-xs text-ink-muted">
        Want to try the studio first?{" "}
        <Link
          href="/studio"
          className="font-medium text-accent hover:text-accent-hover hover:underline"
        >
          Open the public sample
        </Link>
      </div>
    </div>
  );
}
