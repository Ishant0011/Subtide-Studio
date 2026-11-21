import Link from "next/link";
import { redirect } from "next/navigation";
import { Upload } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { ProjectsList } from "@/components/ProjectsList";
import {
  createSupabaseServerClient,
  getVerifiedUser,
} from "@/lib/supabase/server";
import type { ProjectWithMedia } from "@/lib/uploads";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Projects — Subtide Studio",
  description: "Your private Subtide Studio projects and uploaded clips.",
};

export default async function ProjectsPage() {
  const user = await getVerifiedUser();
  if (!user) {
    redirect("/login?next=/projects");
  }

  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("projects")
    .select(
      "id, user_id, title, status, media_kind, duration_ms, preview_object_key, preview_mime_type, preview_width, preview_height, active_revision_id, last_error_code, last_error_message, created_at, updated_at, media_assets(id, project_id, user_id, bucket_id, object_key, original_filename, mime_type, expected_size_bytes, verified_size_bytes, status, media_kind, duration_ms, width, height, rotation_deg, has_audio, completed_at, created_at, updated_at), ingest_jobs(id, project_id, media_asset_id, user_id, status, stage_message, attempt_count, max_attempts, error_code, error_message, started_at, completed_at, created_at, updated_at), caption_revisions!caption_revisions_project_id_fkey(id, project_id, user_id, revision_number, source, speech_status, language, words, cues, created_at)"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const projects = (data ?? []) as ProjectWithMedia[];

  return (
    <div className="min-h-screen bg-[#070B10] text-[#F5F1E8]">
      <AppHeader userEmail={user.email ?? "Signed in"} activeNav="projects" />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#F5F1E8] sm:text-3xl">
              Your Projects
            </h1>
            <p className="mt-1 text-sm text-[#B6B0A4]">
              Private clips uploaded to your account with live processing stages
              and word-synced previews.
            </p>
          </div>

          <Link
            href="/upload"
            className="inline-flex items-center gap-2 rounded-xl bg-[#49E6B3] px-4 py-2.5 text-sm font-semibold text-[#070B10] shadow-[0_8px_24px_rgba(73,230,179,0.22)] transition hover:bg-[#2FD49F]"
          >
            <Upload className="h-4 w-4" />
            <span>Upload clip</span>
          </Link>
        </div>

        <ProjectsList initialProjects={projects} />
      </main>
    </div>
  );
}
