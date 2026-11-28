"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, CheckCircle2, KeyRound, Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Choose a password with at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: updateErr } = await supabase.auth.updateUser({ password });
      if (updateErr) {
        setError(
          updateErr.message ||
            "Could not update password. Request a fresh reset link and try again."
        );
        return;
      }
      setDone(true);
      setTimeout(() => {
        router.push("/projects");
        router.refresh();
      }, 900);
    } catch {
      setError("Network error while updating password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="cc-panel-enter w-full max-w-md rounded-2xl border border-ink/12 bg-panel p-6 shadow-[0_24px_70px_rgba(0,0,0,0.6)] sm:p-7">
      <div className="flex items-center gap-2 text-xs font-medium text-accent">
        <KeyRound className="h-3.5 w-3.5" />
        <span>Password Recovery</span>
      </div>

      <h1 className="mt-2.5 text-2xl font-bold tracking-tight text-ink">
        Set a new password
      </h1>
      <p className="mt-1.5 text-sm text-ink-secondary">
        Choose a new password for your ClipCaptions account.
      </p>

      {error && (
        <div
          role="alert"
          data-testid="reset-password-error"
          className="cc-panel-enter mt-4 flex items-start gap-2.5 rounded-xl border border-rose-400/35 bg-rose-500/10 p-3 text-xs text-rose-200"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {done ? (
        <div
          data-testid="reset-password-success"
          className="cc-panel-enter mt-5 flex items-start gap-2.5 rounded-xl border border-accent/40 bg-accent-soft p-3.5 text-xs text-accent-hover"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Password updated. Redirecting to your projects...</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="new-password"
              className="block text-xs font-medium text-ink-secondary"
            >
              New password
            </label>
            <input
              id="new-password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="mt-1.5 w-full rounded-xl border border-ink/12 bg-page px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="confirm-password"
              className="block text-xs font-medium text-ink-secondary"
            >
              Confirm new password
            </label>
            <input
              id="confirm-password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your new password"
              className="mt-1.5 w-full rounded-xl border border-ink/12 bg-page px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-accent focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            data-testid="reset-password-submit"
            className="cc-card-interactive inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-page hover:bg-accent-hover disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>Update password</span>
          </button>
        </form>
      )}

      <div className="mt-5 border-t border-ink/10 pt-4 text-center text-xs text-ink-muted">
        <Link href="/login" className="font-medium text-accent hover:underline">
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
