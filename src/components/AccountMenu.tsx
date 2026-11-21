"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, FolderKanban, LogOut, Upload, User } from "lucide-react";

interface AccountMenuProps {
  userEmail: string;
}

export function AccountMenu({ userEmail }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 rounded-xl border border-[#F5F1E8]/12 bg-[#0D131C] px-2.5 py-1.5 text-xs font-medium text-[#F5F1E8] transition hover:border-[#49E6B3]/50 sm:px-3"
      >
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#102E28] text-[#49E6B3]">
          <User className="h-3 w-3" />
        </span>
        <span
          data-testid="user-email"
          className="hidden max-w-[160px] truncate sm:inline"
        >
          {userEmail}
        </span>
        <span className="sm:hidden">Account</span>
        <ChevronDown
          className={`h-3.5 w-3.5 text-[#7D7A72] transition ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account options"
          className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-[#F5F1E8]/12 bg-[#0D131C] p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.65)]"
        >
          <div className="border-b border-[#F5F1E8]/8 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-[#7D7A72]">
              Signed in as
            </p>
            <p className="mt-0.5 truncate text-xs font-medium text-[#F5F1E8]">
              {userEmail}
            </p>
          </div>

          <div className="py-1">
            <Link
              href="/projects"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[#B6B0A4] transition hover:bg-[#131C28] hover:text-[#F5F1E8]"
            >
              <FolderKanban className="h-3.5 w-3.5 text-[#49E6B3]" />
              <span>Projects</span>
            </Link>

            <Link
              href="/upload"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-[#B6B0A4] transition hover:bg-[#131C28] hover:text-[#F5F1E8]"
            >
              <Upload className="h-3.5 w-3.5 text-[#49E6B3]" />
              <span>Upload clip</span>
            </Link>
          </div>

          <div className="border-t border-[#F5F1E8]/8 pt-1">
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-medium text-rose-200 transition hover:bg-rose-500/10"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign out</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
