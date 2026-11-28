import Link from "next/link";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { ClipCaptionsLockup } from "@/components/ClipCaptionsLogo";
import { ResetPasswordForm } from "@/components/ResetPasswordForm";
import { PRIVATE_PAGE_ROBOTS } from "@/lib/site";
import { getVerifiedUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Reset password",
  description: "Set a new password for your ClipCaptions account.",
  robots: PRIVATE_PAGE_ROBOTS,
};

export default async function ResetPasswordPage() {
  const user = await getVerifiedUser();

  return (
    <div className="relative min-h-screen overflow-x-clip bg-page text-ink">
      <header className="relative z-10 border-b border-ink/10 bg-page/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Link href="/" aria-label="ClipCaptions home">
            <ClipCaptionsLockup markSize={30} />
          </Link>

          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink/12 bg-panel px-3 py-1.5 text-xs font-medium text-ink-secondary transition hover:border-accent/50 hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Sign in</span>
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex max-w-6xl justify-center px-4 py-10 sm:px-6 sm:py-16">
        {user ? (
          <ResetPasswordForm />
        ) : (
          <div className="cc-panel-enter w-full max-w-md rounded-2xl border border-ink/12 bg-panel p-6 text-center shadow-[0_24px_70px_rgba(0,0,0,0.6)] sm:p-7">
            <div className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-xl border border-amber-400/35 bg-amber-400/10 text-amber-200">
              <AlertCircle className="h-5 w-5" />
            </div>
            <h1 className="mt-4 text-xl font-bold text-ink">
              Reset link expired or missing
            </h1>
            <p className="mt-2 text-xs leading-relaxed text-ink-secondary">
              Password reset links expire quickly for security. Request a new
              link from the sign-in screen.
            </p>
            <Link
              href="/login?mode=forgot"
              className="mt-5 inline-flex items-center justify-center rounded-xl bg-accent px-4 py-2.5 text-xs font-semibold text-page transition hover:bg-accent-hover"
            >
              Request a new reset link
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
