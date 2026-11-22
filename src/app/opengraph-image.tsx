import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "ClipCaptions — Add automatic captions to your videos.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#070B10",
          color: "#F5F1E8",
          padding: "64px 72px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Top lockup */}
        <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "14px",
              border: "3px solid #49E6B3",
              backgroundColor: "#0D131C",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: "8px",
              padding: "10px",
            }}
          >
            <div style={{ display: "flex", gap: "6px" }}>
              <div
                style={{
                  width: "20px",
                  height: "6px",
                  borderRadius: "4px",
                  backgroundColor: "#F5F1E8",
                }}
              />
              <div
                style={{
                  width: "10px",
                  height: "6px",
                  borderRadius: "4px",
                  backgroundColor: "rgba(245,241,232,0.7)",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              <div
                style={{
                  width: "18px",
                  height: "6px",
                  borderRadius: "4px",
                  backgroundColor: "#49E6B3",
                }}
              />
              <div
                style={{
                  width: "12px",
                  height: "6px",
                  borderRadius: "4px",
                  backgroundColor: "#F5F1E8",
                }}
              />
            </div>
          </div>
          <div style={{ fontSize: "34px", fontWeight: 700, display: "flex" }}>
            <span>Clip</span>
            <span style={{ color: "#49E6B3" }}>Captions</span>
          </div>
        </div>

        {/* Main headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div
            style={{
              fontSize: "64px",
              fontWeight: 800,
              lineHeight: 1.08,
              letterSpacing: "-0.03em",
              maxWidth: "960px",
            }}
          >
            Add automatic captions to your videos.
          </div>
          <div
            style={{
              fontSize: "26px",
              color: "#B6B0A4",
              maxWidth: "880px",
            }}
          >
            Upload, edit word-synced captions, and export burned-in MP4, UTF-8
            SRT, or transparent ProRes 4444 MOV.
          </div>
        </div>

        {/* Bottom workflow pills */}
        <div style={{ display: "flex", gap: "16px", fontSize: "20px" }}>
          {["1. Upload", "2. Edit & Style", "3. Export MP4 · SRT · Alpha MOV"].map(
            (item) => (
              <div
                key={item}
                style={{
                  borderRadius: "999px",
                  border: "1px solid rgba(73,230,179,0.4)",
                  backgroundColor: "#102E28",
                  color: "#49E6B3",
                  padding: "10px 22px",
                  fontWeight: 600,
                }}
              >
                {item}
              </div>
            )
          )}
        </div>
      </div>
    ),
    { ...size }
  );
}
