import { notFound, redirect } from "next/navigation";
import { ProjectCaptionEditor } from "@/components/ProjectCaptionEditor";
import {
  DEFAULT_CAPTION_STYLE,
  hydrateEditorCues,
  normalizeCaptionStyle,
} from "@/lib/caption-editor";
import {
  createSupabaseServerClient,
  getVerifiedUser,
} from "@/lib/supabase/server";
import { MEDIA_BUCKET } from "@/lib/uploads";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Caption Editor — Subtide Studio",
  description: "Edit word-synced captions and styles for your private clip.",
};

interface EditorPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProjectEditorPage({ params }: EditorPageProps) {
  const { id: projectId } = await params;

  const user = await getVerifiedUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/projects/${projectId}/editor`)}`);
  }

  const supabase = await createSupabaseServerClient();
  const { data: project, error } = await supabase
    .from("projects")
    .select(
      "id, user_id, title, status, media_kind, duration_ms, preview_object_key, active_revision_id, media_assets(id, object_key, mime_type, duration_ms, status), caption_revisions!caption_revisions_project_id_fkey(id, revision_number, style, cues, words, created_at)"
    )
    .eq("id", projectId)
    .maybeSingle();

  if (error || !project || project.user_id !== user.id) {
    notFound();
  }

  const assets = Array.isArray(project.media_assets) ? project.media_assets : [];
  const primaryAsset = assets[0] as
    | { id: string; object_key: string; mime_type: string; duration_ms: number | null }
    | undefined;

  const mediaObjectKey = project.preview_object_key || primaryAsset?.object_key;
  if (!mediaObjectKey) {
    notFound();
  }

  const { data: signed } = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUrl(mediaObjectKey, 300);

  if (!signed?.signedUrl) {
    notFound();
  }

  const revisions = Array.isArray(project.caption_revisions)
    ? (project.caption_revisions as Array<{
        id: string;
        revision_number: number;
        style?: unknown;
        cues?: unknown;
      }>)
    : [];

  const activeRevision =
    revisions.find((r) => r.id === project.active_revision_id) ??
    revisions.sort((a, b) => b.revision_number - a.revision_number)[0] ??
    null;

  const initialCues = hydrateEditorCues(activeRevision?.cues);
  const initialStyle = activeRevision?.style
    ? normalizeCaptionStyle(activeRevision.style as Partial<typeof DEFAULT_CAPTION_STYLE>)
    : DEFAULT_CAPTION_STYLE;

  const isAudio =
    project.media_kind === "audio" ||
    primaryAsset?.mime_type?.startsWith("audio/");

  const durationMs =
    project.duration_ms ?? primaryAsset?.duration_ms ?? 15000;

  return (
    <ProjectCaptionEditor
      userEmail={user.email ?? "Signed in"}
      projectId={project.id}
      projectTitle={project.title}
      mediaKind={isAudio ? "audio" : "video"}
      previewUrl={signed.signedUrl}
      durationMs={durationMs}
      initialRevisionId={activeRevision?.id ?? null}
      initialRevisionNumber={activeRevision?.revision_number ?? 0}
      initialCues={initialCues}
      initialStyle={initialStyle}
    />
  );
}
