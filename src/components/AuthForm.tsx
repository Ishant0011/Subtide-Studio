"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Loader2, Lock } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface AuthFormProps {
  nextPath: string;
  initialError?: string | null;
  supabaseConfigured: boolean;
}

export function AuthForm({
  nextPath,
  initialError,
  supabaseConfigured,
}: AuthFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [notice, setNotice] = useState<string | null>(null);

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
      const supabase = createSupabaseBrowserClient();

      if (mode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) {
          setError(signInError.message);
          return;
        }
        router.push(nextPath);
        router.refresh();
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
          },
        });
        if (signUpError) {
          setError(signUpError.message);
          return;
        }

        if (data.session) {
          router.push(nextPath);
          router.refresh();
        } else {
          setNotice(
            "Account created. Check your inbox to confirm your email, then sign in."
          );
          setMode("signin");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl border border-[#F5F1E8]/12 bg-[#0D131C] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.6)] sm:p-7">
      <div className="flex items-center gap-2 text-xs font-medium text-[#49E6B3]">
        <Lock className="h-3.5 w-3.5" />
        <span>Private Workspace Access</span>
      </div>

      <h1 className="mt-2.5 text-2xl font-bold tracking-tight text-[#F5F1E8]">
        {mode === "signin" ? "Sign in to Subtide Studio" : "Create your account"}
      </h1>
      <p className="mt-1.5 text-sm text-[#B6B0A4]">
        {mode === "signin"
          ? "Access your private projects and resumable video uploads."
          : "Start uploading portrait MP4 and MOV clips to your private library."}
      </p>

      {/* Mode Switcher */}
      <div
        role="tablist"
        aria-label="Authentication mode"
        className="mt-5 grid grid-cols-2 rounded-xl border border-[#F5F1E8]/10 bg-[#070B10] p-1"
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
              ? "bg-[#131C28] text-[#49E6B3]"
              : "text-[#B6B0A4] hover:text-[#F5F1E8]"
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
              ? "bg-[#131C28] text-[#49E6B3]"
              : "text-[#B6B0A4] hover:text-[#F5F1E8]"
          }`}
        >
          Create account
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
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-[#49E6B3]/35 bg-[#102E28] p-3 text-xs text-[#49E6B3]">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div>
          <label
            htmlFor="auth-email"
            className="block text-xs font-medium text-[#B6B0A4]"
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
            className="mt-1.5 w-full rounded-xl border border-[#F5F1E8]/12 bg-[#070B10] px-3.5 py-2.5 text-sm text-[#F5F1E8] placeholder:text-[#7D7A72] focus:border-[#49E6B3] focus:outline-none"
          />
        </div>

        <div>
          <label
            htmlFor="auth-password"
            className="block text-xs font-medium text-[#B6B0A4]"
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
            className="mt-1.5 w-full rounded-xl border border-[#F5F1E8]/12 bg-[#070B10] px-3.5 py-2.5 text-sm text-[#F5F1E8] placeholder:text-[#7D7A72] focus:border-[#49E6B3] focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#49E6B3] px-4 py-3 text-sm font-semibold text-[#070B10] transition hover:bg-[#2FD49F] disabled:opacity-60"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          <span>{mode === "signin" ? "Sign in" : "Create account"}</span>
        </button>
      </form>

      <div className="mt-6 border-t border-[#F5F1E8]/10 pt-4 text-center text-xs text-[#7D7A72]">
        Want to try the studio first?{" "}
        <Link href="/studio" className="font-medium text-[#49E6B3] hover:underline">
          Open the public sample
        </Link>
      </div>
    </div>
  );
}
