import type { MetadataRoute } from "next";

const SITE_URL = "https://tuvideodown.com";

const ROUTES = ["", "/youtube", "/tiktok", "/instagram", "/facebook", "/twitter"];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return ROUTES.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: path === "" ? 1.0 : 0.8
  }));
}
