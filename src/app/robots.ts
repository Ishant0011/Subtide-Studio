import type { MetadataRoute } from "next";
import { getPublicOrigin } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const origin = getPublicOrigin();

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/studio"],
        disallow: ["/projects", "/projects/", "/upload", "/login", "/api/", "/auth/"],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
  };
}
