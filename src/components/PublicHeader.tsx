import Link from "next/link";
import { FolderKanban, Play } from "lucide-react";
import { AccountMenu } from "@/components/AccountMenu";
import { ClipCaptionsLockup } from "@/components/ClipCaptionsLogo";

interface PublicHeaderProps {
  userEmail: string | null;
}

export function PublicHeader({ userEmail }: PublicHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-[#F5F1E8]/10 bg-[#070B10]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:px-6 sm:py-3.5">
        <div className="flex items-center gap-5">
          <Link
            href="/"
            aria-label="ClipCaptions home"
            className="rounded-lg transition hover:opacity-95"
          >
            <ClipCaptionsLockup markSize={32} />
          </Link>

          <nav
            aria-label="Primary navigation"
            className="hidden items-center gap-1 md:flex"
          >
            <Link
              href="/studio"
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-[#B6B0A4] transition hover:bg-[#0D131C] hover:text-[#F5F1E8]"
            >
              <Play className="h-3.5 w-3.5 text-[#49E6B3]" />
              <span>Sample Studio</span>
            </Link>
            <Link
              href="/#workflow"
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-[#B6B0A4] transition hover:bg-[#0D131C] hover:text-[#F5F1E8]"
            >
              How it works
            </Link>
            <Link
              href="/#exports"
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-[#B6B0A4] transition hover:bg-[#0D131C] hover:text-[#F5F1E8]"
            >
              Exports
            </Link>
          </nav>
        </div>

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
            className="flex shrink-0 items-center gap-1.5 sm:gap-2"
          >
            <Link
              href="/login?mode=signin"
              data-testid="header-signin-link"
              className="rounded-xl border border-[#F5F1E8]/15 bg-[#0D131C] px-2.5 py-1.5 text-xs font-medium text-[#F5F1E8] transition hover:border-[#49E6B3]/50 hover:text-[#49E6B3] sm:px-3.5 sm:py-2"
            >
              Sign in
            </Link>
            <Link
              href="/login?mode=signup"
              data-testid="header-signup-link"
              className="rounded-xl bg-[#49E6B3] px-2.5 py-1.5 text-xs font-semibold text-[#070B10] transition hover:bg-[#2FD49F] sm:px-3.5 sm:py-2"
            >
              Sign up
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
