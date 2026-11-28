import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { ProjectsList } from "@/components/ProjectsList";
import { PRIVATE_PAGE_ROBOTS } from "@/lib/site";
import {
  createSupabaseServerClient,
  getVerifiedUser,
} from "@/lib/supabase/server";
import { MEDIA_BUCKET, type ProjectWithMedia } from "@/lib/uploads";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Projects",
  description: "Your private ClipCaptions projects, processing stages, and caption editors.",
  robots: PRIVATE_PAGE_ROBOTS,
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
      "id, user_id, title, status, media_kind, duration_ms, preview_object_key, preview_mime_type, preview_width, preview_height, active_revision_id, last_error_code, last_error_message, created_at, updated_at, media_assets(id, project_id, user_id, bucket_id, object_key, original_filename, mime_type, expected_size_bytes, verified_size_bytes, status, media_kind, duration_ms, width, height, rotation_deg, has_audio, completed_at, created_at, updated_at), ingest_jobs(id, project_id, media_asset_id, user_id, status, stage_message, attempt_count, max_attempts, error_code, error_message, started_at, completed_at, created_at, updated_at), caption_revisions!caption_revisions_project_id_fkey(id, project_id, user_id, revision_number, source, speech_status, language, style, words, cues, created_at)"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const rawProjects = (data ?? []) as ProjectWithMedia[];
  const projects = await Promise.all(
    rawProjects.map(async (project) => {
      const primaryAsset = project.media_assets?.[0] ?? null;
      const isAudio =
        project.media_kind === "audio" ||
        primaryAsset?.mime_type?.startsWith("audio/");
      if (isAudio) {
        return { ...project, thumbnail_url: null };
      }

      const key =
        project.preview_object_key ||
        (primaryAsset?.status === "uploaded" ? primaryAsset.object_key : null);
      if (!key) {
        return { ...project, thumbnail_url: null };
      }

      const { data: signed } = await supabase.storage
        .from(MEDIA_BUCKET)
        .createSignedUrl(key, 300);

      return { ...project, thumbnail_url: signed?.signedUrl ?? null };
    })
  );

  return (
    <div className="min-h-screen bg-page text-ink">
      <AppHeader userEmail={user.email ?? "Signed in"} activeNav="projects" />

      <main className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-8">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              Projects
            </h1>
            <p className="mt-1 text-sm text-ink-secondary">
              Pick up where you left off, track transcription status, and export
              captioned MP4s up to 4K.
            </p>
          </div>

          <Link
            href="/upload"
            data-testid="new-project-header-btn"
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-page transition hover:bg-accent-hover"
          >
            <Plus className="h-4 w-4" />
            <span>New project</span>
          </Link>
        </div>

        <ProjectsList initialProjects={projects} />
      </main>
    </div>
  );
}
