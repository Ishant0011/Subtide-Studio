import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Subtide Studio — Caption your clips. Keep your style.",
  description:
    "Style word-synced captions for short-form portrait video clips with Clean, Boxed, and Word Highlight presets.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#070B10] text-[#F5F1E8] selection:bg-[#49E6B3]/30 selection:text-[#F5F1E8]">
        {children}
      </body>
    </html>
  );
}
