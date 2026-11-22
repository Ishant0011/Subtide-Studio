import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AuthForm } from "@/components/AuthForm";
import { ClipCaptionsLockup } from "@/components/ClipCaptionsLogo";
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
  const nextPath =
    params.next && params.next.startsWith("/") && !params.next.startsWith("//")
      ? params.next
      : "/projects";

  const initialMode = params.mode === "signup" ? "signup" : "signin";

  const user = await getVerifiedUser();
  if (user) {
    redirect(nextPath);
  }

  return (
    <div className="min-h-screen bg-[#070B10] text-[#F5F1E8]">
      <header className="border-b border-[#F5F1E8]/10 bg-[#070B10]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Link href="/" aria-label="ClipCaptions home">
            <ClipCaptionsLockup markSize={30} />
          </Link>

          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#F5F1E8]/12 bg-[#0D131C] px-3 py-1.5 text-xs font-medium text-[#B6B0A4] transition hover:border-[#49E6B3]/45 hover:text-[#F5F1E8]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Home</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl justify-center px-4 py-10 sm:px-6 sm:py-16">
        <AuthForm
          nextPath={nextPath}
          initialMode={initialMode}
          initialError={
            params.error === "auth_callback_failed"
              ? "Sign-in callback failed. Please try signing in again."
              : null
          }
          supabaseConfigured={isSupabaseConfigured()}
          enabledProviders={getEnabledOAuthProviders()}
        />
      </main>
    </div>
  );
}
