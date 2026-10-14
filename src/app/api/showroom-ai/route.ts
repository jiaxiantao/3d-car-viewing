import {
  buildChatCompletionRequest,
  coerceShowroomAiScene,
  readChatCompletion,
  sanitizeAiHistory,
  sanitizeAiUserMessage,
} from "@/lib/showroom-ai-command";
import {
  parseAiBaseUrl,
  parseAiModel,
  readServerAiDefaults,
  resolveShowroomAiCredentials,
  scrubSecret,
} from "@/lib/showroom-ai-config";
import { postChatCompletion } from "@/lib/showroom-ai-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ProxyBody = {
  message?: unknown;
  history?: unknown;
  scene?: unknown;
  settings?: {
    apiKey?: unknown;
    baseUrl?: unknown;
    model?: unknown;
  };
};

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export async function GET() {
  const server = readServerAiDefaults();
  const base = server.baseUrl?.trim() ? parseAiBaseUrl(server.baseUrl) : null;
  const model = server.model?.trim() ? parseAiModel(server.model) : null;
  return Response.json({
    hasServerKey: Boolean(server.apiKey?.trim()),
    baseUrl: base && base.ok ? base.baseUrl : null,
    model: model && model.ok ? model.model : null,
  });
}

export async function POST(request: Request) {
  let body: ProxyBody;
  try {
    const text = await request.text();
    if (text.length > 32_000) {
      return Response.json({ error: "请求过长。" }, { status: 400 });
    }
    body = JSON.parse(text) as ProxyBody;
  } catch {
    return Response.json({ error: "请求格式无效。" }, { status: 400 });
  }

  const message = sanitizeAiUserMessage(body.message);
  if (!message) {
    return Response.json({ error: "请先输入想让展厅做的事。" }, { status: 400 });
  }
  const scene = coerceShowroomAiScene(body.scene);
  if (!scene) {
    return Response.json({ error: "当前展厅状态无效。" }, { status: 400 });
  }

  const settings = body.settings ?? {};
  const resolved = resolveShowroomAiCredentials(
    {
      apiKey: asText(settings.apiKey),
      baseUrl: asText(settings.baseUrl),
      model: asText(settings.model),
    },
    readServerAiDefaults(),
  );
  if (!resolved.ok) {
    return Response.json({ error: resolved.reason }, { status: 400 });
  }

  try {
    const payload = await postChatCompletion(
      resolved.credentials,
      buildChatCompletionRequest({
        model: resolved.credentials.model,
        message,
        history: sanitizeAiHistory(body.history),
        scene,
      }),
    );
    return Response.json(readChatCompletion(payload));
  } catch (error) {
    const reason = scrubSecret(
      error instanceof Error ? error.message : "模型请求失败。",
      resolved.credentials.apiKey,
    );
    return Response.json({ error: reason }, { status: 502 });
  }
}
