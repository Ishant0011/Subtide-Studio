import Link from "next/link";
import { FolderKanban, Play, Upload } from "lucide-react";
import { AccountMenu } from "@/components/AccountMenu";
import { ClipCaptionsLockup } from "@/components/ClipCaptionsLogo";

interface AppHeaderProps {
  userEmail: string;
  activeNav: "projects" | "upload";
}

export function AppHeader({ userEmail, activeNav }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-[#F5F1E8]/10 bg-[#070B10]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2.5 px-4 py-2.5 sm:flex-nowrap sm:gap-3 sm:px-6 sm:py-3">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <Link
            href="/"
            aria-label="ClipCaptions home"
            className="rounded-lg transition hover:opacity-95"
          >
            <ClipCaptionsLockup markSize={30} compact />
          </Link>

          <nav
            aria-label="Workspace navigation"
            className="flex items-center gap-1"
          >
            <Link
              href="/projects"
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition sm:px-3 ${
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
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition sm:px-3 ${
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
              className="hidden items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-[#B6B0A4] transition hover:bg-[#0D131C] hover:text-[#F5F1E8] sm:inline-flex"
            >
              <Play className="h-3.5 w-3.5" />
              <span>Sample</span>
            </Link>
          </nav>
        </div>

        <AccountMenu userEmail={userEmail} />
      </div>
    </header>
  );
}
