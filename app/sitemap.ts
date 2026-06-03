import type { MetadataRoute } from "next";

const SITE_URL = "https://tuvideodown.com";

const PRIMARY_ROUTES = ["", "/youtube", "/tiktok", "/instagram", "/facebook", "/twitter"];
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
    ...LEGAL_ROUTES.map((path) => ({
      url: `${SITE_URL}${path}`,
      lastModified: now,
      changeFrequency: "yearly" as const,
      priority: 0.2
    }))
  ];
}
