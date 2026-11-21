import Link from "next/link";
import { Captions, FolderKanban } from "lucide-react";
import { AccountMenu } from "@/components/AccountMenu";

interface PublicHeaderProps {
  userEmail: string | null;
}

export function PublicHeader({ userEmail }: PublicHeaderProps) {
  return (
    <header className="relative z-20 border-b border-[#F5F1E8]/8">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3.5 sm:px-6 sm:py-4">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[#49E6B3]/35 bg-[#102E28] text-[#49E6B3]">
            <Captions className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight text-[#F5F1E8] sm:text-base">
            Subtide Studio
          </span>
        </Link>

        {userEmail ? (
          <div className="flex items-center gap-2">
            <Link
              href="/projects"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#49E6B3]/35 bg-[#102E28] px-3 py-1.5 text-xs font-semibold text-[#49E6B3] transition hover:bg-[#49E6B3] hover:text-[#070B10] sm:px-3.5 sm:py-2"
            >
              <FolderKanban className="h-3.5 w-3.5" />
              <span>Projects</span>
            </Link>
            <AccountMenu userEmail={userEmail} />
          </div>
        ) : (
          <nav
            aria-label="Account navigation"
            className="flex items-center gap-2"
          >
            <Link
              href="/login?mode=signin"
              className="rounded-xl border border-[#F5F1E8]/12 bg-[#0D131C] px-3 py-1.5 text-xs font-medium text-[#F5F1E8] transition hover:border-[#49E6B3]/50 hover:text-[#49E6B3] sm:px-3.5 sm:py-2"
            >
              Sign in
            </Link>
            <Link
              href="/login?mode=signup"
              className="rounded-xl bg-[#49E6B3] px-3 py-1.5 text-xs font-semibold text-[#070B10] transition hover:bg-[#2FD49F] sm:px-3.5 sm:py-2"
            >
              Sign up
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
