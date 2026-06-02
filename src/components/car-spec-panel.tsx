"use client";

import { Button } from "@/components/ui/button";
import type { CarSpec } from "@/lib/car-specs";
import type { ShowroomPaintOption } from "@/lib/showroom-paint-options";

type CarSpecPanelProps = {
  spec: CarSpec;
  paint: ShowroomPaintOption;
  onBookNow: () => void;
  onShare: () => void;
  shareCopied?: boolean;
};

export function CarSpecPanel({
  spec,
  paint,
  onBookNow,
  onShare,
  shareCopied = false,
}: CarSpecPanelProps) {
  const accentStyle = { backgroundColor: spec.accentColor };
  return (
    <section
      aria-label="车型信息卡"
      className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 shadow-[0_18px_60px_-30px_rgba(34,211,238,0.4)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.32em] text-cyan-200/70">
            <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={accentStyle} />
            {spec.englishName}
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
            {spec.label}
            <span className="ml-2 text-xs font-medium text-slate-400">/ {spec.tagline}</span>
          </h2>
          <p className="text-sm text-slate-400">
            起售价
            <span className="mx-2 text-3xl font-semibold text-white tabular-nums">
              {spec.priceFromWan}
            </span>
            <span className="text-slate-300">万元起</span>
            <span className="mx-3 text-slate-600">·</span>
            当前车漆：
            <span className="ml-1 inline-flex items-center gap-1.5 text-slate-200">
              <span
                aria-hidden
                className="inline-block h-3 w-3 rounded-full ring-1 ring-white/40"
                style={{
                  background: paint.secondary
                    ? `linear-gradient(135deg, ${paint.primary}, ${paint.secondary})`
                    : paint.primary,
                }}
              />
              {paint.label}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={onBookNow} aria-label="预约试驾或获取报价">
            预约试驾
          </Button>
          <Button variant="outline" onClick={onShare} aria-live="polite">
            {shareCopied ? "已复制链接" : "分享配置"}
          </Button>
        </div>
      </div>

      <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {spec.highlights.map((item) => (
          <li
            key={item.label}
            className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center"
          >
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{item.label}</p>
            <p className="mt-1 flex items-baseline justify-center gap-1 text-lg font-semibold text-white tabular-nums">
              {item.value}
              {item.unit ? (
                <span className="text-xs font-medium text-slate-300">{item.unit}</span>
              ) : null}
            </p>
          </li>
        ))}
      </ul>

      <ul className="mt-4 grid gap-1.5 text-xs text-slate-300 sm:grid-cols-3">
        {spec.bullets.map((bullet) => (
          <li key={bullet} className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={accentStyle}
            />
            {bullet}
          </li>
        ))}
      </ul>
    </section>
  );
}
