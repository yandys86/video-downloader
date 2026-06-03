import { ImageResponse } from "next/og";

export const alt =
  "TuVideoDown - Descarga videos de YouTube, TikTok, Instagram, X y Facebook";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px 80px",
          backgroundColor: "#0b0b14",
          backgroundImage:
            "linear-gradient(135deg, #1a0b2e 0%, #0b0b14 50%, #0b2a2e 100%)",
          color: "white",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
        }}
      >
        {/* Logo + brand row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
            marginBottom: "32px"
          }}
        >
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 18,
              backgroundImage: "linear-gradient(135deg, #d946ef 0%, #8b5cf6 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <svg width="48" height="48" viewBox="0 0 32 32" fill="none">
              <path
                d="M16 6 v14 m-6-6 l6 6 l6-6"
                stroke="white"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M8 26 h16"
                stroke="white"
                strokeWidth="2.6"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 56,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              backgroundImage:
                "linear-gradient(90deg, #f0abfc 0%, #c4b5fd 50%, #67e8f9 100%)",
              backgroundClip: "text",
              color: "transparent"
            }}
          >
            TuVideoDown
          </div>
        </div>

        {/* Headline (kept short so it fits in 2 lines max) */}
        <div
          style={{
            display: "flex",
            fontSize: 64,
            fontWeight: 800,
            textAlign: "center",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            maxWidth: 960
          }}
        >
          Descarga videos de YouTube, TikTok, Instagram y mas
        </div>

        {/* Subhead */}
        <div
          style={{
            display: "flex",
            marginTop: 40,
            fontSize: 26,
            color: "rgba(255,255,255,0.7)",
            textAlign: "center"
          }}
        >
          Gratis · Sin instalar nada · iPhone, Android, Mac, PC
        </div>

        {/* Platform pills */}
        <div
          style={{
            marginTop: 44,
            display: "flex",
            gap: 14,
            flexWrap: "wrap",
            justifyContent: "center"
          }}
        >
          {["YouTube", "TikTok", "Instagram", "Twitter / X", "Facebook"].map(
            (p) => (
              <div
                key={p}
                style={{
                  display: "flex",
                  padding: "8px 20px",
                  borderRadius: 9999,
                  border: "1px solid rgba(255,255,255,0.15)",
                  backgroundColor: "rgba(255,255,255,0.04)",
                  color: "rgba(255,255,255,0.85)",
                  fontSize: 22
                }}
              >
                {p}
              </div>
            )
          )}
        </div>
      </div>
    ),
    { ...size }
  );
}
