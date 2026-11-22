import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { UploadWorkspace } from "@/components/UploadWorkspace";
import { PRIVATE_PAGE_ROBOTS } from "@/lib/site";
import { getVerifiedUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Upload",
  description:
    "Upload MP4, MOV, MP3, or WAV clips directly to your private ClipCaptions workspace.",
  robots: PRIVATE_PAGE_ROBOTS,
};

export default async function UploadPage() {
  const user = await getVerifiedUser();
  if (!user) {
    redirect("/login?next=/upload");
  }

  return (
    <div className="min-h-screen bg-page text-ink">
      <AppHeader userEmail={user.email ?? "Signed in"} activeNav="upload" />

      <main className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-8">
        <div className="mx-auto mb-7 max-w-2xl">
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Upload a Clip
          </h1>
          <p className="mt-1 text-sm text-ink-secondary">
            Choose a video or audio clip to create a private project. ClipCaptions
            normalizes your preview, transcribes word timestamps, and surfaces{" "}
            <strong className="font-semibold text-ink">Open editor</strong>{" "}
            as soon as it&apos;s ready.
          </p>
        </div>

        <UploadWorkspace />
      </main>
    </div>
  );
}
