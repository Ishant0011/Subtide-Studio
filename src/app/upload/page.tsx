import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { UploadWorkspace } from "@/components/UploadWorkspace";
import { getVerifiedUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Upload — Subtide Studio",
  description:
    "Upload portrait MP4 or MOV clips directly to your private Subtide Studio library.",
};

export default async function UploadPage() {
  const user = await getVerifiedUser();
  if (!user) {
    redirect("/login?next=/upload");
  }

  return (
    <div className="min-h-screen bg-[#070B10] text-[#F5F1E8]">
      <AppHeader userEmail={user.email ?? "Signed in"} activeNav="upload" />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mx-auto mb-7 max-w-2xl">
          <h1 className="text-2xl font-bold tracking-tight text-[#F5F1E8] sm:text-3xl">
            New Project · Upload a Clip
          </h1>
          <p className="mt-1 text-sm text-[#B6B0A4]">
            Uploading creates a private project automatically. Track processing
            status in <strong className="font-semibold text-[#F5F1E8]">Projects</strong>{" "}
            and click <strong className="font-semibold text-[#F5F1E8]">Open editor</strong>{" "}
            when captions are ready. MP4, MOV, MP3, and WAV up to 150 MB and 3
            minutes are supported.
          </p>
        </div>

        <UploadWorkspace />
      </main>
    </div>
  );
}
