import Link from "next/link";
import { Captions, FolderKanban, LogOut, Play, Upload } from "lucide-react";

interface AppHeaderProps {
  userEmail: string;
  activeNav: "projects" | "upload";
}

export function AppHeader({ userEmail, activeNav }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-[#F5F1E8]/10 bg-[#070B10]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[#49E6B3]/35 bg-[#102E28] text-[#49E6B3]">
              <Captions className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold tracking-tight text-[#F5F1E8]">
              Subtide Studio
            </span>
          </Link>

          <nav aria-label="Workspace navigation" className="flex items-center gap-1">
            <Link
              href="/projects"
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                activeNav === "projects"
                  ? "bg-[#102E28] text-[#49E6B3] ring-1 ring-[#49E6B3]/35"
                  : "text-[#B6B0A4] hover:bg-[#0D131C] hover:text-[#F5F1E8]"
              }`}
            >
              <FolderKanban className="h-3.5 w-3.5" />
              <span>Projects</span>
            </Link>

            <Link
              href="/upload"
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                activeNav === "upload"
                  ? "bg-[#102E28] text-[#49E6B3] ring-1 ring-[#49E6B3]/35"
                  : "text-[#B6B0A4] hover:bg-[#0D131C] hover:text-[#F5F1E8]"
              }`}
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Upload</span>
            </Link>

            <Link
              href="/studio"
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-[#B6B0A4] transition hover:bg-[#0D131C] hover:text-[#F5F1E8]"
            >
              <Play className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sample Studio</span>
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-2.5">
          <span
            data-testid="user-email"
            className="hidden max-w-[200px] truncate rounded-full border border-[#F5F1E8]/10 bg-[#0D131C] px-3 py-1 text-xs text-[#B6B0A4] md:inline-block"
          >
            {userEmail}
          </span>

          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#F5F1E8]/12 bg-[#0D131C] px-3 py-1.5 text-xs font-medium text-[#B6B0A4] transition hover:border-[#F5F1E8]/25 hover:text-[#F5F1E8]"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign out</span>
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
