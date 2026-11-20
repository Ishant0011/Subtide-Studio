"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Film,
  Loader2,
  Pencil,
  Upload,
  X,
} from "lucide-react";
import { formatBytes, type ProjectWithMedia } from "@/lib/uploads";

interface ProjectsListProps {
  initialProjects: ProjectWithMedia[];
}

export function ProjectsList({ initialProjects }: ProjectsListProps) {
  const [projects, setProjects] = useState<ProjectWithMedia[]>(initialProjects);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>("");
  const [loadingAssetId, setLoadingAssetId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function saveTitle(projectId: string) {
    const trimmed = draftTitle.trim();
    if (!trimmed) return;
    setSavingId(projectId);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not rename project.");
        return;
      }
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, title: data.project.title } : p))
      );
      setEditingId(null);
    } catch {
      setError("Network error while renaming project.");
    } finally {
      setSavingId(null);
    }
  }

  async function openPreview(assetId: string, title: string) {
    setLoadingAssetId(assetId);
    setError(null);
    try {
      const res = await fetch(`/api/media/${assetId}/signed-url`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not load private media preview.");
        return;
      }
      setPreviewUrl(data.signedUrl);
      setPreviewTitle(title);
    } catch {
      setError("Network error while requesting signed media URL.");
    } finally {
      setLoadingAssetId(null);
    }
  }

  return (
    <div>
      {error && (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-rose-400/35 bg-rose-500/10 px-4 py-3 text-xs text-rose-200"
        >
          {error}
        </div>
      )}

      {projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#F5F1E8]/15 bg-[#0D131C]/70 px-6 py-14 text-center">
          <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[#49E6B3]/30 bg-[#102E28] text-[#49E6B3]">
            <Film className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-[#F5F1E8]">
            No private clips uploaded yet
          </h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-[#B6B0A4]">
            Upload an MP4 or MOV clip (up to 150 MB, 3-minute processing limit)
            using resumable TUS upload to start building your library.
          </p>
          <Link
            href="/upload"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#49E6B3] px-5 py-2.5 text-sm font-semibold text-[#070B10] transition hover:bg-[#2FD49F]"
          >
            <Upload className="h-4 w-4" />
            <span>Upload your first clip</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {projects.map((project) => {
            const primaryAsset = project.media_assets?.[0] ?? null;
            const isReady =
              project.status === "ready" && primaryAsset?.status === "uploaded";
            const isEditing = editingId === project.id;

            return (
              <article
                key={project.id}
                data-testid={`project-card-${project.id}`}
                className="flex flex-col justify-between rounded-2xl border border-[#F5F1E8]/10 bg-[#0D131C] p-5 transition hover:border-[#F5F1E8]/20"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    {isEditing ? (
                      <div className="flex flex-1 items-center gap-2">
                        <input
                          type="text"
                          value={draftTitle}
                          onChange={(e) => setDraftTitle(e.target.value)}
                          maxLength={120}
                          aria-label="Project title"
                          className="w-full rounded-lg border border-[#49E6B3]/50 bg-[#070B10] px-2.5 py-1.5 text-sm text-[#F5F1E8] focus:outline-none"
                        />
                        <button
                          type="button"
                          disabled={savingId === project.id}
                          onClick={() => void saveTitle(project.id)}
                          className="rounded-lg bg-[#49E6B3] px-3 py-1.5 text-xs font-semibold text-[#070B10]"
                        >
                          {savingId === project.id ? "..." : "Save"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="rounded-lg border border-[#F5F1E8]/12 px-2 py-1.5 text-xs text-[#B6B0A4]"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-semibold tracking-tight text-[#F5F1E8]">
                          {project.title}
                        </h2>
                        <button
                          type="button"
                          aria-label={`Rename ${project.title}`}
                          onClick={() => {
                            setEditingId(project.id);
                            setDraftTitle(project.title);
                          }}
                          className="rounded-md p-1 text-[#7D7A72] transition hover:bg-[#131C28] hover:text-[#F5F1E8]"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    <span
                      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        isReady
                          ? "border border-[#49E6B3]/35 bg-[#102E28] text-[#49E6B3]"
                          : "border border-[#F5F1E8]/12 bg-[#131C28] text-[#B6B0A4]"
                      }`}
                    >
                      {isReady ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <Clock className="h-3 w-3" />
                      )}
                      <span>{isReady ? "Uploaded" : project.status}</span>
                    </span>
                  </div>

                  {primaryAsset && (
                    <dl className="mt-4 grid grid-cols-2 gap-2.5 rounded-xl border border-[#F5F1E8]/8 bg-[#070B10]/70 p-3 text-xs">
                      <div>
                        <dt className="text-[#7D7A72]">File</dt>
                        <dd className="mt-0.5 truncate font-medium text-[#F5F1E8]">
                          {primaryAsset.original_filename}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[#7D7A72]">Verified size</dt>
                        <dd className="mt-0.5 font-mono tabular-nums text-[#F5F1E8]">
                          {formatBytes(
                            primaryAsset.verified_size_bytes ??
                              primaryAsset.expected_size_bytes
                          )}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[#7D7A72]">Format</dt>
                        <dd className="mt-0.5 font-mono text-[#B6B0A4]">
                          {primaryAsset.mime_type}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[#7D7A72]">Created</dt>
                        <dd className="mt-0.5 tabular-nums text-[#B6B0A4]">
                          {new Date(project.created_at).toLocaleDateString()}
                        </dd>
                      </div>
                    </dl>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#F5F1E8]/8 pt-3.5">
                  <span className="text-[11px] text-[#7D7A72]">
                    Phase 3 transcription & export coming next
                  </span>

                  {primaryAsset && isReady && (
                    <button
                      type="button"
                      disabled={loadingAssetId === primaryAsset.id}
                      onClick={() => void openPreview(primaryAsset.id, project.title)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#49E6B3]/35 bg-[#102E28] px-3 py-1.5 text-xs font-semibold text-[#49E6B3] transition hover:bg-[#49E6B3] hover:text-[#070B10] disabled:opacity-60"
                    >
                      {loadingAssetId === primaryAsset.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ExternalLink className="h-3.5 w-3.5" />
                      )}
                      <span>Preview clip</span>
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Owner-only Signed Media Preview Modal */}
      {previewUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Preview ${previewTitle}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-2xl border border-[#F5F1E8]/15 bg-[#0D131C] p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="truncate text-sm font-semibold text-[#F5F1E8]">
                {previewTitle}
              </h3>
              <button
                type="button"
                aria-label="Close preview"
                onClick={() => setPreviewUrl(null)}
                className="rounded-lg border border-[#F5F1E8]/12 p-1.5 text-[#B6B0A4] hover:text-[#F5F1E8]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <video
              src={previewUrl}
              controls
              playsInline
              className="max-h-[70vh] w-full rounded-xl bg-[#070B10]"
            />
          </div>
        </div>
      )}
    </div>
  );
}
