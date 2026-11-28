export const SITE_NAME = "ClipCaptions";
export const HOMEPAGE_TITLE = "ClipCaptions | Add Captions to Video";
export const HOMEPAGE_HEADLINE = "Add animated captions to your videos.";
export const HOMEPAGE_SUBHEADLINE =
  "Turn speech into timed captions, fix the words, choose a look, and download your video.";
export const SITE_DESCRIPTION =
  "Turn speech into timed captions, fix the words, choose a look, and download your video with ClipCaptions.";

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
