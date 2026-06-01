export type Platform =
  | "youtube"
  | "tiktok"
  | "instagram"
  | "twitter"
  | "facebook"
  | "unknown";

export interface PlatformInfo {
  platform: Platform;
  label: string;
  icon: string;
}

const PATTERNS: Array<{ platform: Platform; label: string; icon: string; re: RegExp }> = [
  { platform: "youtube",   label: "YouTube",   icon: "YT",  re: /(?:youtube\.com|youtu\.be)/i },
  { platform: "tiktok",    label: "TikTok",    icon: "TT",  re: /tiktok\.com/i },
  { platform: "instagram", label: "Instagram", icon: "IG",  re: /instagram\.com/i },
  { platform: "twitter",   label: "Twitter/X", icon: "X",   re: /(?:twitter\.com|x\.com)/i },
  { platform: "facebook",  label: "Facebook",  icon: "FB",  re: /(?:facebook\.com|fb\.watch)/i }
];

export function detectPlatform(url: string): PlatformInfo {
  const trimmed = (url || "").trim();
  for (const p of PATTERNS) {
    if (p.re.test(trimmed)) {
      return { platform: p.platform, label: p.label, icon: p.icon };
    }
  }
  return { platform: "unknown", label: "Desconocida", icon: "?" };
}

export function isSupportedUrl(url: string): boolean {
  try {
    const u = new URL(url.trim());
    return !!u.hostname && detectPlatform(url).platform !== "unknown";
  } catch {
    return false;
  }
}

export function safeFilename(name: string, ext = "mp4"): string {
  const cleaned = (name || "video")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return `${cleaned || "video"}.${ext}`;
}
