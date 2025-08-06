import { ImageResponse } from "next/og";
import {
  PROJECT_TITLE,
  PROJECT_DESCRIPTION,
  PROJECT_AVATAR_URL,
} from "~/lib/constants";

export const alt = PROJECT_TITLE;
export const contentType = "image/png";
export const size = {
  width: 1200,
  height: 630,
};

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          backgroundColor: "#1a1a1a",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Background gradient with dark theme suitable for token burning */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "linear-gradient(135deg, #2D1B69 0%, #1A1A2E 50%, #16213E 100%)",
            opacity: 0.95,
          }}
        />

        {/* Subtle pattern overlay for depth with burning theme */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage:
              "radial-gradient(circle at 30% 70%, rgba(255, 69, 0, 0.2) 0%, transparent 50%), radial-gradient(circle at 70% 30%, rgba(255, 140, 0, 0.15) 0%, transparent 50%)",
          }}
        />

        {/* Main content container - centered in safe zone */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
            padding: "60px",
            position: "relative",
            zIndex: 10,
          }}
        >
          {/* Token burning visual element */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: "48px",
              position: "relative",
            }}
          >
            {/* Glow effect for burning theme */}
            <div
              style={{
                position: "absolute",
                width: "160px",
                height: "160px",
                borderRadius: "20px",
                background:
                  "radial-gradient(circle, rgba(255, 140, 0, 0.4) 0%, rgba(255, 69, 0, 0.2) 50%, transparent 70%)",
                filter: "blur(20px)",
              }}
            />
            {/* Token container with burning aesthetic */}
            <div
              style={{
                width: "140px",
                height: "140px",
                borderRadius: "20px",
                overflow: "hidden",
                border: "4px solid rgba(255, 215, 0, 0.8)",
                backgroundColor: "#1a1a2e",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                boxShadow: "0 12px 40px rgba(255, 69, 0, 0.3)",
              }}
            >
              {/* Token symbol */}
              <div
                style={{
                  fontSize: "64px",
                  fontWeight: "900",
                  color: "#FFD700",
                  fontFamily: "system-ui, -apple-system, sans-serif",
                  textShadow: "0 2px 8px rgba(0, 0, 0, 0.5)",
                }}
              >
                T
              </div>
            </div>
          </div>

          {/* Project title with high contrast */}
          <h1
            style={{
              fontSize: PROJECT_TITLE.length > 25 ? "65px" : "72px",
              fontWeight: "900",
              color: "#ffffff",
              textAlign: "center",
              marginBottom: "40px",
              lineHeight: 1.1,
              letterSpacing: "-2px",
              textShadow: "0 6px 20px rgba(0, 0, 0, 0.4)",
              maxWidth: "1100px",
              fontFamily: "system-ui, -apple-system, sans-serif",
              whiteSpace: PROJECT_TITLE.length > 40 ? "normal" : "nowrap",
              paddingLeft: "20px",
              paddingRight: "20px",
            }}
          >
            {PROJECT_TITLE}
          </h1>

          {/* Project description */}
          <p
            style={{
              fontSize: "36px",
              fontWeight: "600",
              color: "rgba(255, 255, 255, 0.95)",
              textAlign: "center",
              marginBottom: "56px",
              lineHeight: 1.3,
              textShadow: "0 3px 12px rgba(0, 0, 0, 0.4)",
              maxWidth: "800px",
              fontFamily: "system-ui, -apple-system, sans-serif",
            }}
          >
            {PROJECT_DESCRIPTION}
          </p>

          {/* Token burning branding element */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              padding: "20px 40px",
              backgroundColor: "rgba(255, 69, 0, 0.15)",
              borderRadius: "100px",
              border: "3px solid rgba(255, 215, 0, 0.6)",
              backdropFilter: "blur(10px)",
              boxShadow: "0 8px 32px rgba(255, 69, 0, 0.2)",
            }}
          >
            {/* Token burn icon */}
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                backgroundColor: "rgba(255, 215, 0, 0.8)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "18px",
                fontWeight: "900",
                color: "#1a1a2e",
              }}
            >
              T
            </div>
            <span
              style={{
                fontSize: "26px",
                fontWeight: "700",
                color: "#FFD700",
                fontFamily: "system-ui, -apple-system, sans-serif",
                letterSpacing: "-0.5px",
              }}
            >
              Token Burner
            </span>
          </div>
        </div>

        {/* Bottom gradient fade for depth */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "200px",
            background:
              "linear-gradient(to top, rgba(0, 0, 0, 0.4) 0%, transparent 100%)",
          }}
        />
      </div>
    ),
    {
      ...size,
    },
  );
}
