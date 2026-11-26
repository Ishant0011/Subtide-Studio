"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Loader2, Lock } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { EnabledOAuthProviders } from "@/lib/supabase/env";

interface AuthFormProps {
  nextPath: string;
  initialMode?: "signin" | "signup";
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
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "discord" | null>(
    null
  );
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [notice, setNotice] = useState<string | null>(null);

  const hasSocialProviders = enabledProviders.google || enabledProviders.discord;

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabaseConfigured) {
      setError(
        "Supabase environment variables are not configured. Copy .env.example to .env.local and start local Supabase."
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
          setError(data.error || "Sign-in failed.");
          return;
        }
        router.push(nextPath);
        router.refresh();
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
          setMode("signin");
        }
      }
    } catch {
      setError("Network error while authenticating. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-ink/12 bg-panel p-6 shadow-[0_24px_70px_rgba(0,0,0,0.6)] sm:p-7">
      <div className="flex items-center gap-2 text-xs font-medium text-accent">
        <Lock className="h-3.5 w-3.5" />
        <span>
          {nextPath.startsWith("/upload")
            ? "Sign in to upload a clip"
            : "Private Workspace Access"}
        </span>
      </div>

      <h1 className="mt-2.5 text-2xl font-bold tracking-tight text-ink">
        {mode === "signin" ? "Sign in to ClipCaptions" : "Create your account"}
      </h1>
      <p className="mt-1.5 text-sm text-ink-secondary">
        {mode === "signin"
          ? nextPath.startsWith("/upload")
            ? "You'll land directly on Upload right after signing in."
            : "Access your private projects, caption revisions, and exports."
          : "Start uploading MP4, MOV, MP3, and WAV clips to your private workspace."}
      </p>

      {/* Mode Switcher */}
      <div
        role="tablist"
        aria-label="Authentication mode"
        className="mt-5 grid grid-cols-2 rounded-xl border border-ink/10 bg-page p-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signin"}
          onClick={() => {
            setMode("signin");
            setError(null);
            setNotice(null);
          }}
          className={`rounded-lg py-2 text-xs font-semibold transition ${
            mode === "signin"
              ? "bg-accent-soft text-accent-hover"
              : "text-ink-secondary hover:text-ink"
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signup"}
          onClick={() => {
            setMode("signup");
            setError(null);
            setNotice(null);
          }}
          className={`rounded-lg py-2 text-xs font-semibold transition ${
            mode === "signup"
              ? "bg-accent-soft text-accent-hover"
              : "text-ink-secondary hover:text-ink"
          }`}
        >
          Sign up
        </button>
      </div>

      {!supabaseConfigured && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Supabase is not configured yet. Copy{" "}
            <code className="font-mono">.env.example</code> to{" "}
            <code className="font-mono">.env.local</code> and start local
            Supabase to sign in.
          </span>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-400/35 bg-rose-500/10 p-3 text-xs text-rose-200"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-accent/40 bg-accent-soft p-3 text-xs text-accent-hover">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* OAuth Providers (rendered only when explicitly enabled for the environment) */}
      {hasSocialProviders && (
        <div className="mt-5 space-y-2.5">
          {enabledProviders.google && (
            <button
              type="button"
              disabled={loading || oauthLoading !== null}
              onClick={() => void handleOAuth("google")}
              className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl border border-ink/15 bg-elevated px-4 py-2.5 text-sm font-medium text-ink transition hover:border-accent/55 hover:bg-track disabled:opacity-60"
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
              disabled={loading || oauthLoading !== null}
              onClick={() => void handleOAuth("discord")}
              className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl border border-ink/15 bg-elevated px-4 py-2.5 text-sm font-medium text-ink transition hover:border-accent/55 hover:bg-track disabled:opacity-60"
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

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
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

        <div>
          <label
            htmlFor="auth-password"
            className="block text-xs font-medium text-ink-secondary"
          >
            Password
          </label>
          <input
            id="auth-password"
            type="password"
            required
            minLength={6}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            className="mt-1.5 w-full rounded-xl border border-ink/12 bg-page px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading || oauthLoading !== null}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-page transition hover:bg-accent-hover disabled:opacity-60"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          <span>{mode === "signin" ? "Sign in" : "Create account"}</span>
        </button>
      </form>

      <div className="mt-6 border-t border-ink/10 pt-4 text-center text-xs text-ink-muted">
        Want to try the studio first?{" "}
        <Link href="/studio" className="font-medium text-accent hover:text-accent-hover hover:underline">
          Open the public sample
        </Link>
      </div>
    </div>
  );
}
