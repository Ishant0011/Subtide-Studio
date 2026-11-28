import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AuthForm } from "@/components/AuthForm";
import { ClipCaptionsLockup } from "@/components/ClipCaptionsLogo";
import { sanitizeNextPath } from "@/lib/security/http";
import { PRIVATE_PAGE_ROBOTS } from "@/lib/site";
import {
  getEnabledOAuthProviders,
  isSupabaseConfigured,
} from "@/lib/supabase/env";
import { getVerifiedUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign in",
  description:
    "Sign in or create an account to access your private ClipCaptions projects and uploads.",
  robots: PRIVATE_PAGE_ROBOTS,
};

interface LoginPageProps {
  searchParams: Promise<{ next?: string; error?: string; mode?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = sanitizeNextPath(params.next, "/projects");

  const initialMode =
    params.mode === "signup"
      ? "signup"
      : params.mode === "magic"
        ? "magic"
        : params.mode === "forgot"
          ? "forgot"
          : "signin";

  const initialError =
    params.error === "auth_cancelled"
      ? "Sign-in was cancelled before completing. Choose any option below to try again."
      : params.error === "auth_link_expired"
        ? "That email link has expired or was already used. Request a fresh link below."
        : params.error === "auth_callback_failed"
          ? "Sign-in callback failed. Please try signing in again."
          : null;

  const user = await getVerifiedUser();
  if (user) {
    redirect(nextPath);
  }

  return (
    <div className="relative min-h-screen overflow-x-clip bg-page text-ink">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 h-[340px] w-[620px] -translate-x-1/2 rounded-full bg-accent/10 blur-[140px]"
      />

      <header className="relative z-10 border-b border-ink/10 bg-page/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Link href="/" aria-label="ClipCaptions home">
            <ClipCaptionsLockup markSize={30} />
          </Link>

          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink/12 bg-panel px-3 py-1.5 text-xs font-medium text-ink-secondary transition hover:border-accent/50 hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Home</span>
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex max-w-6xl justify-center px-4 py-10 sm:px-6 sm:py-16">
        <AuthForm
          nextPath={nextPath}
          initialMode={initialMode}
          initialError={initialError}
          supabaseConfigured={isSupabaseConfigured()}
          enabledProviders={getEnabledOAuthProviders()}
        />
      </main>
    </div>
  );
}
