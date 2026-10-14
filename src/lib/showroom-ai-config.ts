/**
 * Bring-your-own OpenAI-compatible model settings.
 * The API key stays out of the client bundle: local UI storage, or server env.
 */

export const DEFAULT_AI_BASE_URL = "https://api.openai.com/v1";
export const DEFAULT_AI_MODEL = "gpt-4o-mini";
export const SHOWROOM_AI_SETTINGS_KEY = "3d-car-viewing:ai-settings";

const MODEL_PATTERN = /^[A-Za-z0-9_.:/@+-]{1,128}$/;

export type ShowroomAiSettings = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

export type ShowroomAiCredentialInput = {
  apiKey?: string | null;
  baseUrl?: string | null;
  model?: string | null;
};

export type ShowroomAiCredentials = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

export function blankAiSettings(): ShowroomAiSettings {
  return {
    apiKey: "",
    baseUrl: "",
    model: "",
  };
}

const SETTINGS_EVENT = "showroom-ai-settings";

function notifyShowroomAiSettings(): void {
  window.dispatchEvent(new Event(SETTINGS_EVENT));
}

export function saveShowroomAiSettings(settings: ShowroomAiSettings): void {
  if (typeof window === "undefined") {
    return;
  }
  const next: ShowroomAiSettings = {
    apiKey: settings.apiKey.trim(),
    baseUrl: settings.baseUrl.trim(),
    model: settings.model.trim(),
  };
  window.localStorage.setItem(SHOWROOM_AI_SETTINGS_KEY, JSON.stringify(next));
  notifyShowroomAiSettings();
}

export function clearShowroomAiSettings(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(SHOWROOM_AI_SETTINGS_KEY);
  notifyShowroomAiSettings();
}

export function subscribeShowroomAiSettings(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(SETTINGS_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(SETTINGS_EVENT, onChange);
  };
}

export function readShowroomAiSettingsSnapshot(): string {
  return window.localStorage.getItem(SHOWROOM_AI_SETTINGS_KEY) ?? "";
}

export function settingsFromSnapshot(raw: string): ShowroomAiSettings {
  if (!raw) {
    return blankAiSettings();
  }
  try {
    const parsed = JSON.parse(raw) as Partial<ShowroomAiSettings>;
    return {
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
      baseUrl: typeof parsed.baseUrl === "string" ? parsed.baseUrl.trim() : "",
      model: typeof parsed.model === "string" ? parsed.model.trim() : "",
    };
  } catch {
    return blankAiSettings();
  }
}

function isLocalHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function isPrivateLanHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) {
    return true;
  }
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) {
    return true;
  }
  const match = /^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(host);
  if (!match) {
    return false;
  }
  const second = Number(match[1]);
  return second >= 16 && second <= 31;
}

export function parseAiBaseUrl(
  value: string,
): { ok: true; baseUrl: string } | { ok: false; reason: string } {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return { ok: false, reason: "接口地址不是合法的 URL。" };
  }
  if (url.username || url.password) {
    return { ok: false, reason: "接口地址不能包含账号或密码。" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, reason: "接口地址只支持 http 或 https。" };
  }
  const hostname = url.hostname.toLowerCase();
  if (
    hostname === "169.254.169.254" ||
    hostname.endsWith(".metadata.google.internal") ||
    hostname === "metadata.google.internal"
  ) {
    return { ok: false, reason: "该地址不能作为模型接口。" };
  }
  const local = isLocalHost(hostname) || isPrivateLanHost(hostname);
  if (url.protocol === "http:" && !local) {
    return { ok: false, reason: "远程模型请使用 https。http 仅用于本机或局域网。" };
  }
  const path = url.pathname.replace(/\/+$/, "");
  return { ok: true, baseUrl: `${url.origin}${path}` };
}

export function parseAiModel(
  value: string,
): { ok: true; model: string } | { ok: false; reason: string } {
  const model = value.trim();
  if (!MODEL_PATTERN.test(model)) {
    return { ok: false, reason: "模型名称只支持字母、数字和 . _ : / @ + - 。" };
  }
  return { ok: true, model };
}

function nonempty(value: string | null | undefined): string | undefined {
  const next = value?.trim();
  return next ? next : undefined;
}

/**
 * Client fields win when present. Blank client fields fall back to server env.
 */
export function resolveShowroomAiCredentials(
  client: ShowroomAiCredentialInput,
  server: ShowroomAiCredentialInput = {},
): { ok: true; credentials: ShowroomAiCredentials } | { ok: false; reason: string } {
  const apiKey = nonempty(client.apiKey) ?? nonempty(server.apiKey);
  if (!apiKey || apiKey.length > 512 || /[\r\n]/.test(apiKey)) {
    return {
      ok: false,
      reason: "缺少 API Key。在下方填写，或在服务器环境变量 AI_API_KEY 中配置。",
    };
  }
  const baseResult = parseAiBaseUrl(
    nonempty(client.baseUrl) ?? nonempty(server.baseUrl) ?? DEFAULT_AI_BASE_URL,
  );
  if (!baseResult.ok) {
    return baseResult;
  }
  const modelResult = parseAiModel(
    nonempty(client.model) ?? nonempty(server.model) ?? DEFAULT_AI_MODEL,
  );
  if (!modelResult.ok) {
    return modelResult;
  }
  return {
    ok: true,
    credentials: {
      apiKey,
      baseUrl: baseResult.baseUrl,
      model: modelResult.model,
    },
  };
}

export function scrubSecret(text: string, secret: string): string {
  if (!secret) {
    return text;
  }
  return text.split(secret).join("***");
}

export function showroomAiUsesProxy(): boolean {
  return process.env.NEXT_PUBLIC_SHOWROOM_AI_PROXY === "1";
}

export function readServerAiDefaults(): ShowroomAiCredentialInput {
  return {
    apiKey: process.env.AI_API_KEY,
    baseUrl: process.env.AI_BASE_URL,
    model: process.env.AI_MODEL,
  };
}
