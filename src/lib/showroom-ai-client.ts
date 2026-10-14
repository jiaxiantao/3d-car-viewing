import {
  buildChatCompletionRequest,
  coerceShowroomAiScene,
  readChatCompletion,
  sanitizeAiHistory,
  sanitizeAiUserMessage,
  type ShowroomAiHistoryItem,
  type ShowroomAiScene,
  type ShowroomAiTurn,
} from "@/lib/showroom-ai-command";
import {
  resolveShowroomAiCredentials,
  scrubSecret,
  showroomAiUsesProxy,
  type ShowroomAiCredentialInput,
  type ShowroomAiCredentials,
} from "@/lib/showroom-ai-config";

const REQUEST_TIMEOUT_MS = 45_000;

export type ShowroomAiRequest = {
  message: string;
  history: ShowroomAiHistoryItem[];
  scene: ShowroomAiScene;
  settings: ShowroomAiCredentialInput;
};

export function explainAiTransportError(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      return "模型请求超时，请稍后再试。";
    }
    if (error.message === "Failed to fetch" || error.message.includes("NetworkError")) {
      return "无法连接模型接口。若是在线静态站点，该接口需要允许浏览器跨域；本地 pnpm dev 会经本站转发。";
    }
    return error.message;
  }
  return "模型请求失败。";
}

export async function postChatCompletion(
  credentials: ShowroomAiCredentials,
  body: unknown,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${credentials.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credentials.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new Error(scrubSecret(explainAiTransportError(error), credentials.apiKey));
  }

  const text = await response.text();
  const safeText = scrubSecret(text, credentials.apiKey);
  let payload: unknown = null;
  if (safeText) {
    try {
      payload = JSON.parse(safeText) as unknown;
    } catch {
      payload = null;
    }
  }
  if (!response.ok) {
    try {
      if (payload) {
        readChatCompletion(payload);
      }
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : "模型接口拒绝了请求。");
    }
    throw new Error(
      response.status === 401
        ? "API Key 被拒绝，请检查密钥和接口地址。"
        : `模型接口返回 ${response.status}。`,
    );
  }
  if (!payload) {
    throw new Error("模型返回了无法解析的内容。");
  }
  return payload;
}

export async function requestShowroomAssistant(input: ShowroomAiRequest): Promise<ShowroomAiTurn> {
  const message = sanitizeAiUserMessage(input.message);
  if (!message) {
    throw new Error("请先输入想让展厅做的事。");
  }
  const scene = coerceShowroomAiScene(input.scene);
  if (!scene) {
    throw new Error("当前展厅状态无法发送给模型。");
  }
  const history = sanitizeAiHistory(input.history);

  if (showroomAiUsesProxy()) {
    const response = await fetch("/api/showroom-ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        history,
        scene,
        settings: {
          apiKey: input.settings.apiKey?.trim() ?? "",
          baseUrl: input.settings.baseUrl?.trim() ?? "",
          model: input.settings.model?.trim() ?? "",
        },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const payload = (await response.json().catch(() => null)) as { error?: string } | ShowroomAiTurn | null;
    if (!response.ok) {
      const reason =
        payload && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : "模型请求失败。";
      throw new Error(reason);
    }
    if (!payload || !("commands" in payload)) {
      throw new Error("模型返回了无法解析的内容。");
    }
    return payload;
  }

  const resolved = resolveShowroomAiCredentials(input.settings);
  if (!resolved.ok) {
    throw new Error(resolved.reason);
  }
  const payload = await postChatCompletion(
    resolved.credentials,
    buildChatCompletionRequest({
      model: resolved.credentials.model,
      message,
      history,
      scene,
    }),
  );
  return readChatCompletion(payload);
}
