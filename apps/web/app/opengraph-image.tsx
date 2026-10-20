import { ImageResponse } from "next/og";

export const alt = "Get-On: Get your business online in minutes.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          backgroundColor: "#FFFBF5",
          color: "#1F1A17",
          padding: 88,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              borderRadius: 10,
              backgroundColor: "#0B6B4F",
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M7 17L17 7" />
              <path d="M7 7H17V17" />
            </svg>
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: -0.5 }}>Get-On</div>
        </div>

        <div
          style={{
            marginTop: 48,
            fontSize: 76,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: -1.5,
            maxWidth: 940,
          }}
        >
          Get your business online in minutes.
        </div>

        <div style={{ marginTop: 26, fontSize: 26, color: "#6B6158" }}>
          No technical skills needed. Free web address included.
        </div>
      </div>
    ),
    size,
  );
}
