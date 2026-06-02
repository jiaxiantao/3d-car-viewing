import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";

import type { AssetCarRig } from "@/lib/asset-car-rig";

type ShowroomDebugPanelProps = {
  assetRig: AssetCarRig | null;
};

export function ShowroomDebugPanel({ assetRig }: ShowroomDebugPanelProps) {
  const [fps, setFps] = useState(0);
  const [open, setOpen] = useState(true);
  const lastTimeRef = useRef(0);
  const frameCountRef = useRef(0);

  useFrame(({ clock }) => {
    const elapsed = clock.elapsedTime;
    if (lastTimeRef.current === 0) {
      lastTimeRef.current = elapsed;
      return;
    }
    frameCountRef.current += 1;
    const delta = elapsed - lastTimeRef.current;
    if (delta >= 0.5) {
      setFps(frameCountRef.current / delta);
      frameCountRef.current = 0;
      lastTimeRef.current = elapsed;
    }
  });

  if (!open) {
    return null;
  }

  const caps = assetRig?.capabilities;
  const debug = assetRig?.debug;

  return (
    <Html
      style={{
        pointerEvents: "none",
      }}
      fullscreen
    >
      <div
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          pointerEvents: "auto",
          fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          fontSize: 11,
          lineHeight: 1.4,
          padding: "8px 10px",
          borderRadius: 8,
          background: "rgba(15, 23, 42, 0.92)",
          border: "1px solid rgba(148, 163, 184, 0.45)",
          color: "#e5e7eb",
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.85)",
          minWidth: 170,
          maxWidth: 460,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 4,
            gap: 8,
          }}
        >
          <span style={{ opacity: 0.8 }}>Dev · Showroom</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "#22c55e", fontVariantNumeric: "tabular-nums" }}>
              {fps.toFixed(0)} fps
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                border: "none",
                padding: 0,
                margin: 0,
                width: 18,
                height: 18,
                borderRadius: 999,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(15, 23, 42, 0.9)",
                color: "#9ca3af",
                cursor: "pointer",
              }}
              aria-label="关闭调试面板"
            >
              ×
            </button>
          </div>
        </div>
        {caps ? (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "auto auto",
                columnGap: 8,
                rowGap: 2,
              }}
            >
            <span style={{ opacity: 0.7 }}>Doors</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>
              L:{caps.leftDoor ? "✓" : "—"} · R:{caps.rightDoor ? "✓" : "—"}
            </span>
            <span style={{ opacity: 0.7 }}>Trunk</span>
            <span>{caps.trunk ? "✓" : "—"}</span>
            <span style={{ opacity: 0.7 }}>Sunroof</span>
            <span>{caps.sunroof ? "✓" : "—"}</span>
            <span style={{ opacity: 0.7 }}>Lights</span>
            <span>
              H:{caps.headLights ? "✓" : "—"} · T:{caps.tailLights ? "✓" : "—"}
            </span>
            <span style={{ opacity: 0.7 }}>Wheels</span>
            <span>
              real:{caps.wheels ? "✓" : "—"} / synth:{caps.wheelsSynthetic ? "✓" : "—"}
            </span>
            </div>
            {debug ? (
              <div style={{ marginTop: 8, borderTop: "1px solid rgba(148,163,184,0.22)", paddingTop: 8 }}>
                <div style={{ opacity: 0.72, marginBottom: 6 }}>
                  Profile: <span style={{ color: "#cbd5e1" }}>{debug.profileId ?? "unknown"}</span>
                </div>
                <div
                  style={{
                    maxHeight: 260,
                    overflow: "auto",
                    paddingRight: 4,
                    display: "grid",
                    rowGap: 8,
                  }}
                >
                  {debug.parts.map((part) => (
                    <div
                      key={part.key}
                      style={{
                        border: "1px solid rgba(148,163,184,0.2)",
                        borderRadius: 6,
                        padding: "6px 7px",
                        background: "rgba(15,23,42,0.36)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                        <span style={{ color: "#cbd5e1" }}>{part.label}</span>
                        <span style={{ opacity: 0.78, fontVariantNumeric: "tabular-nums" }}>
                          {part.interactive ? "可交互 ✓" : "不可交互 —"} · {part.count}
                        </span>
                      </div>
                      {part.items.length > 0 ? (
                        <div style={{ marginTop: 4, display: "grid", rowGap: 2 }}>
                          {part.items.slice(0, 8).map((item) => (
                            <div
                              key={item}
                              title={item}
                              style={{
                                opacity: 0.84,
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              • {item}
                            </div>
                          ))}
                          {part.items.length > 8 ? (
                            <div style={{ opacity: 0.6 }}>... 还有 {part.items.length - 8} 项</div>
                          ) : null}
                        </div>
                      ) : (
                        <div style={{ marginTop: 4, opacity: 0.58 }}>未命中</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div style={{ opacity: 0.7 }}>Asset rig: scanning…</div>
        )}
      </div>
    </Html>
  );
}

