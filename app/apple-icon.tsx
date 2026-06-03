import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #d946ef 0%, #8b5cf6 100%)",
          borderRadius: 40
        }}
      >
        <svg width="110" height="110" viewBox="0 0 32 32" fill="none">
          <path
            d="M16 6 v14 m-6-6 l6 6 l6-6"
            stroke="white"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M8 26 h16" stroke="white" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
