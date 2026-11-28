export const SITE_NAME = "ClipCaptions";
export const HOMEPAGE_TITLE = "ClipCaptions | Add Captions to Video";
export const HOMEPAGE_HEADLINE = "Make every word land.";
export const HOMEPAGE_SUBHEADLINE =
  "Add automatic captions to your videos. Fix the words, make the style yours, and export.";
export const SITE_DESCRIPTION =
  "Add automatic captions to your videos. Edit word-synced transcripts, switch between 12 caption styles, and export burned-in MP4, UTF-8 SRT, or transparent ProRes 4444 MOV.";

export function getPublicOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "http://localhost:3000";

  return raw.replace(/\/+$/, "");
}

export const PRIVATE_PAGE_ROBOTS = {
  index: false,
  follow: false,
  nocache: true,
  googleBot: {
    index: false,
    follow: false,
  },
} as const;
