import type { Metadata } from "next";
import {
  HOMEPAGE_TITLE,
  SITE_DESCRIPTION,
  SITE_NAME,
  getPublicOrigin,
} from "@/lib/site";
import "./globals.css";

const publicOrigin = getPublicOrigin();

export const metadata: Metadata = {
  metadataBase: new URL(publicOrigin),
  title: {
    default: HOMEPAGE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: HOMEPAGE_TITLE,
    description: SITE_DESCRIPTION,
    url: publicOrigin,
  },
  twitter: {
    card: "summary_large_image",
    title: HOMEPAGE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-page text-ink selection:bg-accent/30 selection:text-ink">
        {children}
      </body>
    </html>
  );
}
