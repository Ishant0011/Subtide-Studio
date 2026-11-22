import Link from "next/link";
import { FolderKanban, Play } from "lucide-react";
import { AccountMenu } from "@/components/AccountMenu";
import { ClipCaptionsLockup } from "@/components/ClipCaptionsLogo";

interface PublicHeaderProps {
  userEmail: string | null;
}

export function PublicHeader({ userEmail }: PublicHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-ink/10 bg-page/90 backdrop-blur-md">
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
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-ink-secondary transition hover:bg-panel hover:text-ink"
            >
              <Play className="h-3.5 w-3.5 text-accent" />
              <span>Sample Studio</span>
            </Link>
            <Link
              href="/#workflow"
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-ink-secondary transition hover:bg-panel hover:text-ink"
            >
              How it works
            </Link>
            <Link
              href="/#exports"
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-ink-secondary transition hover:bg-panel hover:text-ink"
            >
              Exports
            </Link>
          </nav>
        </div>

        {userEmail ? (
          <div className="flex items-center gap-2">
            <Link
              href="/projects"
              className="inline-flex items-center gap-1.5 rounded-xl border border-accent/40 bg-accent-soft px-3 py-1.5 text-xs font-semibold text-accent-hover transition hover:bg-accent hover:text-page sm:px-3.5 sm:py-2"
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
              className="rounded-xl border border-ink/15 bg-panel px-2.5 py-1.5 text-xs font-medium text-ink transition hover:border-accent/55 hover:text-accent-hover sm:px-3.5 sm:py-2"
            >
              Sign in
            </Link>
            <Link
              href="/login?mode=signup"
              data-testid="header-signup-link"
              className="rounded-xl bg-accent px-2.5 py-1.5 text-xs font-semibold text-page transition hover:bg-accent-hover sm:px-3.5 sm:py-2"
            >
              Sign up
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
