import type { MetadataRoute } from "next";
import { POSTS } from "@/lib/blog";

const SITE_URL = "https://tuvideodown.com";

const PRIMARY_ROUTES = ["", "/shorts", "/youtube", "/tiktok", "/instagram", "/facebook", "/twitter"];
const CONTENT_ROUTES = ["/blog", "/sobre", "/contacto"];
const LEGAL_ROUTES = ["/privacy", "/terms"];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    ...PRIMARY_ROUTES.map((path) => ({
      url: `${SITE_URL}${path}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: path === "" ? 1.0 : 0.8
    })),
    ...CONTENT_ROUTES.map((path) => ({
      url: `${SITE_URL}${path}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.6
    })),
    ...POSTS.map((p) => ({
      url: `${SITE_URL}/blog/${p.slug}`,
      lastModified: new Date(p.date),
      changeFrequency: "monthly" as const,
      priority: 0.7
    })),
    ...LEGAL_ROUTES.map((path) => ({
      url: `${SITE_URL}${path}`,
      lastModified: now,
      changeFrequency: "yearly" as const,
      priority: 0.2
    }))
  ];
}
