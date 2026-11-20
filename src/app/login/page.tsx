import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Captions } from "lucide-react";
import { AuthForm } from "@/components/AuthForm";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getVerifiedUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign in — Subtide Studio",
  description: "Sign in to access your private Subtide Studio projects and uploads.",
};

interface LoginPageProps {
  searchParams: Promise<{ next?: string; error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath =
    params.next && params.next.startsWith("/") && !params.next.startsWith("//")
      ? params.next
      : "/projects";

  const user = await getVerifiedUser();
  if (user) {
    redirect(nextPath);
  }

  return (
    <div className="min-h-screen bg-[#070B10] text-[#F5F1E8]">
      <header className="border-b border-[#F5F1E8]/8">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[#49E6B3]/35 bg-[#102E28] text-[#49E6B3]">
              <Captions className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold tracking-tight text-[#F5F1E8]">
              Subtide Studio
            </span>
          </Link>

          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#F5F1E8]/10 bg-[#0D131C] px-3 py-1.5 text-xs font-medium text-[#B6B0A4] transition hover:border-[#49E6B3]/40 hover:text-[#F5F1E8]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Home</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl justify-center px-4 py-12 sm:px-6 sm:py-16">
        <AuthForm
          nextPath={nextPath}
          initialError={
            params.error === "auth_callback_failed"
              ? "Sign-in callback failed. Please try signing in again."
              : null
          }
          supabaseConfigured={isSupabaseConfigured()}
        />
      </main>
    </div>
  );
}
