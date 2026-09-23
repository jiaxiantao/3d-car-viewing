"use client";

import { Html } from "@react-three/drei";

const LOADER_OVERLAY_STYLES = `
@keyframes showroom-loader-spin {
  to { transform: rotate(360deg); }
}
@keyframes showroom-loader-bar-indeterminate {
  0% { transform: translateX(-120%); }
  100% { transform: translateX(320%); }
}
`;

export function ShowroomAssetLoadingOverlay({
  visible,
  displayProgress,
}: {
  visible: boolean;
  displayProgress: number;
}) {
  if (!visible) {
    return null;
  }

  const percent = Math.round(Math.min(100, Math.max(displayProgress, 0.08) * 100));
  const showIndeterminateBar = displayProgress < 0.2;

  return (
    <Html
      fullscreen
      zIndexRange={[200, 0]}
      style={{
        pointerEvents: "none",
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: LOADER_OVERLAY_STYLES }} />
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(2, 6, 23, 0.5)",
          backdropFilter: "blur(2px)",
        }}
      >
        <div
          role="status"
          aria-live="polite"
          aria-busy="true"
          style={{
            display: "flex",
            minWidth: 220,
            flexDirection: "column",
            alignItems: "center",
            gap: 16,
            borderRadius: 16,
            border: "1px solid rgba(34, 211, 238, 0.25)",
            background: "rgba(2, 6, 23, 0.92)",
            padding: "24px 32px",
            boxShadow: "0 12px 40px rgba(0, 0, 0, 0.45)",
          }}
        >
          <div
            aria-hidden
            style={{
              width: 44,
              height: 44,
              borderRadius: "50%",
              border: "2px solid rgba(34, 211, 238, 0.25)",
              borderTopColor: "rgb(34, 211, 238)",
              animation: "showroom-loader-spin 0.75s linear infinite",
            }}
          />
          <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: "#f1f5f9" }}>
            正在加载车模资源…
          </p>
          <div
            style={{
              width: "100%",
              height: 6,
              overflow: "hidden",
              borderRadius: 999,
              background: "rgb(30, 41, 59)",
            }}
          >
            {showIndeterminateBar ? (
              <div
                style={{
                  width: "38%",
                  height: "100%",
                  borderRadius: 999,
                  background: "rgb(34, 211, 238)",
                  animation: "showroom-loader-bar-indeterminate 1.15s ease-in-out infinite",
                }}
              />
            ) : (
              <div
                style={{
                  width: `${percent}%`,
                  height: "100%",
                  borderRadius: 999,
                  background: "rgb(34, 211, 238)",
                  transition: "width 160ms ease-out",
                }}
              />
            )}
          </div>
          <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>{percent}%</p>
        </div>
      </div>
    </Html>
  );
}
