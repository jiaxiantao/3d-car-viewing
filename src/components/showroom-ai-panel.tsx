"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import {
  explainAiTransportError,
  requestShowroomAssistant,
} from "@/lib/showroom-ai-client";
import type { ShowroomAiHistoryItem, ShowroomAiScene } from "@/lib/showroom-ai-command";
import {
  DEFAULT_AI_BASE_URL,
  DEFAULT_AI_MODEL,
  clearShowroomAiSettings,
  parseAiBaseUrl,
  parseAiModel,
  readShowroomAiSettingsSnapshot,
  saveShowroomAiSettings,
  settingsFromSnapshot,
  showroomAiUsesProxy,
  subscribeShowroomAiSettings,
  type ShowroomAiSettings,
} from "@/lib/showroom-ai-config";

type ServerAiStatus = {
  hasServerKey: boolean;
  baseUrl: string | null;
  model: string | null;
};

type ChatLine = ShowroomAiHistoryItem & {
  id: number;
};

const SUGGESTIONS = ["换成夜晚公路，打开车灯", "迎宾模式", "珍珠白，切到驾舱"];

type ShowroomAiPanelProps = {
  scene: ShowroomAiScene;
  onApply: (commands: unknown[]) => { applied: string[]; skipped: string[] };
};

export function ShowroomAiPanel({ scene, onApply }: ShowroomAiPanelProps) {
  const usesProxy = showroomAiUsesProxy();
  const settingsSnapshot = useSyncExternalStore(
    subscribeShowroomAiSettings,
    readShowroomAiSettingsSnapshot,
    () => "",
  );
  const settings = settingsFromSnapshot(settingsSnapshot);
  const [draftSource, setDraftSource] = useState(settingsSnapshot);
  const [draft, setDraft] = useState<ShowroomAiSettings>(settings);
  if (draftSource !== settingsSnapshot) {
    setDraftSource(settingsSnapshot);
    setDraft(settings);
  }
  const [settingsPreference, setSettingsPreference] = useState<"auto" | "open" | "closed">("auto");
  const [serverStatus, setServerStatus] = useState<ServerAiStatus | null>(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [open, setOpen] = useState(false);
  const commandRef = useRef<HTMLTextAreaElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const onApplyRef = useRef(onApply);

  useEffect(() => {
    onApplyRef.current = onApply;
  }, [onApply]);

  useEffect(() => {
    if (!usesProxy) {
      return;
    }
    const controller = new AbortController();
    fetch("/api/showroom-ai", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as ServerAiStatus;
        setServerStatus(payload);
      })
      .catch(() => {
        setServerStatus(null);
      });
    return () => controller.abort();
  }, [usesProxy]);

  useEffect(() => {
    if (!open) {
      return;
    }
    commandRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    const node = transcriptRef.current;
    if (!node) {
      return;
    }
    node.scrollTop = node.scrollHeight;
  }, [lines, error, open]);

  function updateDraft(patch: Partial<ShowroomAiSettings>) {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  }

  function saveDraft() {
    if (draft.baseUrl.trim()) {
      const base = parseAiBaseUrl(draft.baseUrl);
      if (!base.ok) {
        setError(base.reason);
        return;
      }
    }
    if (draft.model.trim()) {
      const model = parseAiModel(draft.model);
      if (!model.ok) {
        setError(model.reason);
        return;
      }
    }
    if (!draft.apiKey.trim() && !serverStatus?.hasServerKey) {
      setError("请填写 API Key，或在服务器配置 AI_API_KEY。");
      return;
    }
    saveShowroomAiSettings(draft);
    setSettingsPreference("closed");
    setError(null);
  }

  function forgetSettings() {
    clearShowroomAiSettings();
    setSettingsPreference("open");
  }

  async function submit(text: string) {
    const content = text.trim();
    if (!content || pending) {
      return;
    }
    setPending(true);
    setError(null);
    const history = lines.map(({ role, content: line }) => ({ role, content: line }));
    const userLine: ChatLine = { id: Date.now(), role: "user", content };
    setLines((current) => [...current, userLine].slice(-8));
    setMessage("");
    try {
      const turn = await requestShowroomAssistant({
        message: content,
        history,
        scene,
        settings,
      });
      const applied = onApplyRef.current(turn.commands);
      const reply = [
        turn.reply,
        applied.applied.length > 0 ? `已调整：${applied.applied.join("、")}` : "",
        applied.skipped.join(" "),
      ]
        .filter(Boolean)
        .join(" ");
      setLines((current) =>
        [
          ...current,
          {
            id: Date.now() + 1,
            role: "assistant" as const,
            content: reply || "模型没有改动展厅。",
          },
        ].slice(-8),
      );
    } catch (cause) {
      setLines((current) => current.filter((line) => line.id !== userLine.id));
      setMessage(content);
      setError(explainAiTransportError(cause, usesProxy ? "proxy" : "direct"));
    } finally {
      setPending(false);
    }
  }

  const configured = Boolean(settings.apiKey.trim() || serverStatus?.hasServerKey);
  const settingsOpen =
    settingsPreference === "open" || (settingsPreference === "auto" && !configured);
  const statusLabel = configured
    ? `模型 ${settings.model || serverStatus?.model || DEFAULT_AI_MODEL}`
    : "尚未配置 API Key";

  return (
    <div className="pointer-events-none fixed right-3 bottom-3 z-50 flex flex-col items-end sm:right-4 sm:bottom-4">
      {open ? (
    <section
      id="showroom-ai-panel"
      aria-label="AI 看车"
      className="pointer-events-auto flex max-h-[min(40rem,calc(100vh-1.5rem))] w-[min(24rem,calc(100vw-1.5rem))] flex-col gap-3 overflow-hidden rounded-3xl border border-white/12 bg-slate-950/95 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.5)] backdrop-blur-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-white">AI 看车</h2>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            用一句话控制车型、车漆、场地和部件。只会改这辆车已经具备的操作，密钥只保存在这台浏览器里。
            {usesProxy
              ? ""
              : " 当前是静态站点，浏览器会直接请求接口，该接口必须允许跨域（Access-Control-Allow-Origin）。"}
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <button
            type="button"
            onClick={() => setSettingsPreference(settingsOpen ? "closed" : "open")}
            className="rounded-full border border-white/15 px-2.5 py-1 text-[11px] text-slate-100 transition hover:bg-white/10"
            aria-expanded={settingsOpen}
          >
            {settingsOpen ? "收起配置" : "配置"}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-expanded
            aria-controls="showroom-ai-panel"
            className="rounded-full border border-white/15 px-2.5 py-1 text-[11px] text-slate-100 transition hover:bg-white/10"
          >
            收起
          </button>
        </div>
      </div>
      <p className="text-[11px] text-slate-500">{statusLabel}</p>

      {serverStatus?.hasServerKey ? (
        <p className="text-xs text-cyan-200/80">
          服务器已配置 {serverStatus.model ?? "远程模型"}
          {serverStatus.baseUrl ? `（${serverStatus.baseUrl}）` : ""}
          。页面里的 API Key 会覆盖它。
        </p>
      ) : null}

      <div ref={transcriptRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
      {settingsOpen ? (
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            saveDraft();
          }}
        >
          <label className="grid gap-1 text-xs text-slate-300">
            API Key
            <span className="flex gap-2">
              <input
                value={draft.apiKey}
                onChange={(event) => updateDraft({ apiKey: event.target.value })}
                type={showKey ? "text" : "password"}
                autoComplete="off"
                spellCheck={false}
                placeholder="可留空，改用服务器 AI_API_KEY"
                className="min-w-0 flex-1 rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-200/60"
              />
              <button
                type="button"
                onClick={() => setShowKey((value) => !value)}
                className="rounded-xl border border-white/15 px-3 text-xs text-slate-200"
              >
                {showKey ? "隐藏" : "显示"}
              </button>
            </span>
          </label>
          <label className="grid gap-1 text-xs text-slate-300">
            接口地址
            <input
              value={draft.baseUrl}
              onChange={(event) => updateDraft({ baseUrl: event.target.value })}
              type="url"
              autoComplete="off"
              spellCheck={false}
              placeholder={serverStatus?.baseUrl || DEFAULT_AI_BASE_URL}
              className="rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-200/60"
            />
          </label>
          <label className="grid gap-1 text-xs text-slate-300">
            模型名称
            <input
              value={draft.model}
              onChange={(event) => updateDraft({ model: event.target.value })}
              type="text"
              autoComplete="off"
              spellCheck={false}
              placeholder={serverStatus?.model || DEFAULT_AI_MODEL}
              className="rounded-xl border border-white/15 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-200/60"
            />
          </label>
          <p className="text-xs leading-5 text-slate-500">
            接口需要兼容 OpenAI Chat Completions，并支持 tools。地址填到版本前缀，例如
            https://api.openai.com/v1 。也可以把 AI_API_KEY、AI_BASE_URL、AI_MODEL 写在服务器的
            .env 里，不要加 NEXT_PUBLIC_ 前缀。
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm">
              保存配置
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={forgetSettings}>
              清除本机密钥
            </Button>
          </div>
        </form>
      ) : null}

      {lines.length > 0 ? (
        <ol className="grid gap-2" aria-live="polite">
          {lines.map((line) => (
            <li
              key={line.id}
              className={
                line.role === "user"
                  ? "justify-self-end max-w-[90%] rounded-2xl bg-cyan-200/15 px-3 py-2 text-xs text-cyan-50"
                  : "justify-self-start max-w-[90%] rounded-2xl bg-white/5 px-3 py-2 text-xs text-slate-200"
              }
            >
              {line.content}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-xs text-slate-500">例如：换成 YU7，珍珠白，夜晚公路。</p>
      )}
      </div>

      <form
        className="grid gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(message);
        }}
      >
        <label className="sr-only" htmlFor="showroom-ai-command">
          看车指令
        </label>
        <textarea
          ref={commandRef}
          id="showroom-ai-command"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void submit(message);
            }
          }}
          rows={2}
          disabled={pending}
          placeholder={configured ? "例如：换成 YU7，珍珠白，夜晚公路" : "先保存 API Key，或配置服务器 AI_API_KEY"}
          className="resize-none rounded-2xl border border-white/15 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-200/60 disabled:opacity-60"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" size="sm" disabled={pending || !message.trim()}>
            {pending ? "思考中…" : "发送"}
          </Button>
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              disabled={pending}
              onClick={() => {
                if (!configured) {
                  setMessage(suggestion);
                  setSettingsPreference("open");
                  return;
                }
                void submit(suggestion);
              }}
              className="rounded-full border border-white/12 px-3 py-1 text-xs text-slate-300 transition hover:bg-white/10 disabled:opacity-40"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </form>

      {error ? (
        <p role="alert" className="text-xs text-rose-200">
          {error}
        </p>
      ) : null}

    </section>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          aria-controls="showroom-ai-panel"
          className="pointer-events-auto rounded-full border border-cyan-200/40 bg-slate-950/90 px-4 py-2.5 text-sm font-medium text-white shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-md transition hover:border-cyan-200 hover:bg-slate-900"
        >
          AI 看车
        </button>
      )}
    </div>
  );
}
