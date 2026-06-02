import { useEffect, useRef, useState } from "react";

import type { AssetCarRig } from "@/lib/asset-car-rig";

type ShowroomDebugPanelProps = {
  assetRig: Pick<AssetCarRig, "capabilities" | "debug"> | null;
};

export function ShowroomDebugPanel({ assetRig }: ShowroomDebugPanelProps) {
  const [fps, setFps] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const lastTimeRef = useRef<number>(0);
  const frameCountRef = useRef(0);

  useEffect(() => {
    let raf = 0;
    const tick = (now: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = now;
      } else {
        frameCountRef.current += 1;
        const deltaMs = now - lastTimeRef.current;
        if (deltaMs >= 500) {
          setFps((frameCountRef.current * 1000) / deltaMs);
          frameCountRef.current = 0;
          lastTimeRef.current = now;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const caps = assetRig?.capabilities;
  const debug = assetRig?.debug;

  return (
    <div
      className="rounded-xl border border-slate-700/70 bg-slate-950/85 p-3 text-xs text-slate-200 shadow-xl"
      style={{ fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif" }}
    >
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          style={{
            width: "100%",
            border: "1px solid rgba(148, 163, 184, 0.22)",
            borderRadius: 8,
            padding: "6px 8px",
            background: "rgba(15, 23, 42, 0.45)",
            color: "inherit",
            cursor: "pointer",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
            marginBottom: expanded ? 8 : 0,
          }}
          aria-expanded={expanded}
        >
          <span style={{ opacity: 0.8 }}>Dev · Showroom</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "#22c55e", fontVariantNumeric: "tabular-nums" }}>
              {fps.toFixed(0)} fps
            </span>
            <span style={{ color: "#9ca3af" }}>{expanded ? "收起 ▲" : "展开 ▼"}</span>
          </div>
        </button>
        {expanded ? caps ? (
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
        ) : null}
    </div>
  );
}

