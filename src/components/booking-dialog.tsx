"use client";

import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { CarSpec } from "@/lib/car-specs";

type BookingDialogProps = {
  spec: CarSpec | null;
  paintLabel: string | null;
  onClose: () => void;
};

const PHONE_RX = /^1[3-9]\d{9}$/;

/**
 * Mount-only modal — the parent renders this conditionally so each open mounts a
 * fresh component, which keeps the form state simple without `useEffect` resets.
 */
export function BookingDialog({ spec, paintLabel, onClose }: BookingDialogProps) {
  const titleId = useId();
  const formId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", close);
    const initialBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => {
      dialogRef.current?.focus();
    });
    return () => {
      window.removeEventListener("keydown", close);
      document.body.style.overflow = initialBodyOverflow;
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (name.trim().length < 2) {
      nextErrors.name = "请输入真实姓名（至少 2 个字）";
    }
    if (!PHONE_RX.test(phone.trim())) {
      nextErrors.phone = "请输入有效的 11 位手机号";
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    setSubmitted(true);
  };

  return (
    <div
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-8 backdrop-blur"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative w-full max-w-md rounded-3xl border border-white/10 bg-slate-950/95 p-6 text-slate-100 shadow-2xl outline-none focus:ring-2 focus:ring-cyan-200/50"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭对话框"
          className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition hover:bg-white/10 hover:text-slate-100"
        >
          <span aria-hidden className="block h-4 w-4 leading-4">×</span>
        </button>

        {submitted ? (
          <div className="space-y-4 py-2">
            <h2 id={titleId} className="text-xl font-semibold">已收到您的预约</h2>
            <p className="text-sm leading-6 text-slate-300">
              我们将在 24 小时内联系您安排试驾。如有紧急需求，可拨打 400-000-0000。
            </p>
            <div className="rounded-2xl bg-white/5 p-4 text-xs text-slate-400">
              意向车型：<span className="text-slate-100">{spec?.label ?? "—"}</span>
              <br />
              车漆：<span className="text-slate-100">{paintLabel ?? "—"}</span>
              <br />
              联系姓名：<span className="text-slate-100">{name}</span>
              <br />
              联系电话：<span className="text-slate-100">{phone}</span>
            </div>
            <Button onClick={onClose}>知道了</Button>
          </div>
        ) : (
          <form id={formId} onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <h2 id={titleId} className="text-xl font-semibold">
                预约试驾 / 获取报价
              </h2>
              <p className="text-xs text-slate-400">
                我们会根据您的位置匹配最近的展厅，留下姓名与电话即可。
              </p>
            </div>
            <div className="rounded-2xl bg-white/5 p-3 text-xs text-slate-300">
              意向车型：<span className="text-slate-100">{spec?.label ?? "—"}</span>
              <span className="mx-2 text-slate-600">·</span>
              当前车漆：<span className="text-slate-100">{paintLabel ?? "—"}</span>
              {spec ? (
                <>
                  <span className="mx-2 text-slate-600">·</span>
                  起售价：<span className="text-slate-100">{spec.priceFromWan} 万元起</span>
                </>
              ) : null}
            </div>

            <label className="block space-y-1 text-sm">
              <span className="text-slate-200">姓名</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="请输入您的姓名"
                aria-invalid={Boolean(errors.name)}
                className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-200/40 focus:outline-none focus:ring-2 focus:ring-cyan-200/30"
              />
              {errors.name ? <span className="text-xs text-rose-300">{errors.name}</span> : null}
            </label>

            <label className="block space-y-1 text-sm">
              <span className="text-slate-200">手机号</span>
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 11))}
                inputMode="numeric"
                placeholder="11 位中国大陆手机号"
                aria-invalid={Boolean(errors.phone)}
                className="w-full rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-200/40 focus:outline-none focus:ring-2 focus:ring-cyan-200/30"
              />
              {errors.phone ? <span className="text-xs text-rose-300">{errors.phone}</span> : null}
            </label>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                取消
              </Button>
              <Button type="submit">提交预约</Button>
            </div>
            <p className="text-[11px] leading-5 text-slate-500">
              提示：本演示项目不会真实上传任何信息，提交后仅在本页展示成功反馈。
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
