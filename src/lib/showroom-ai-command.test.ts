import { describe, expect, it } from "vitest";

import {
  buildShowroomAiSystemPrompt,
  foldShowroomCommands,
  planShowroomControl,
  readChatCompletion,
  type ShowroomAiScene,
} from "@/lib/showroom-ai-command";
import { resolveShowroomAiCredentials, scrubSecret } from "@/lib/showroom-ai-config";

function scene(overrides: Partial<ShowroomAiScene> = {}): ShowroomAiScene {
  return {
    model: "su7-ultra",
    paintId: "factory",
    camera: "overview",
    venue: "studio",
    light: "day",
    leftDoorOpen: false,
    rightDoorOpen: false,
    trunkOpen: false,
    sunroofOpen: false,
    lightsOn: false,
    hazardOn: false,
    engineOn: false,
    braking: false,
    autoTour: false,
    reduceMotion: false,
    speedKph: 0,
    steeringAngle: 0,
    body: {
      leftDoor: true,
      rightDoor: true,
      trunk: true,
      sunroof: true,
    },
    ...overrides,
  };
}

describe("planShowroomControl", () => {
  it("applies a color outside the swatch card as a custom paint", () => {
    const named = planShowroomControl({ paint: "银色" }, scene());
    expect(named.patch.paintId).toBe("custom-c5c9ce");
    expect(named.applied).toContain("车漆：银色");

    const hex = planShowroomControl(
      { paint: "pearl-white", customColor: "#C5C9CE" },
      scene(),
    );
    expect(hex.patch.paintId).toBe("custom-c5c9ce");
  });

  it("maps a Chinese car, paint, venue, and light onto showroom ids", () => {
    const result = planShowroomControl(
      { model: "小米 YU7", paint: "珍珠白", venue: "公路", light: "夜晚", lights: true },
      scene(),
    );
    expect(result.patch).toMatchObject({
      model: "yu7",
      paintId: "pearl-white",
      venue: "road",
      lighting: "night",
      lightsOn: true,
    });
    expect(result.skipped).toEqual([]);
  });

  it("expands the drive preset and lets a later field override it", () => {
    const result = planShowroomControl({ preset: "试驾", light: "夜晚" }, scene());
    expect(result.patch.venue).toBe("road");
    expect(result.patch.camera).toBe("cockpit");
    expect(result.patch.engineOn).toBe(true);
    expect(result.patch.speedKph).toBe(45);
    expect(result.patch.steeringAngle).toBe(0);
    expect(result.patch.lighting).toBe("night");
    expect(result.applied).toContain("试驾模式");
  });

  it("does not open body parts the current model cannot move", () => {
    const result = planShowroomControl(
      { preset: "welcome", leftDoor: true },
      scene({
        model: "offroad",
        body: { leftDoor: false, rightDoor: false, trunk: false, sunroof: true },
      }),
    );
    expect(result.patch.leftDoorOpen).toBe(false);
    expect(result.patch.rightDoorOpen).toBe(false);
    expect(result.patch.lightsOn).toBe(true);
    expect(result.skipped.some((item) => item.includes("左门"))).toBe(true);
  });

  it("keeps the tour off when reduced motion is requested", () => {
    const result = planShowroomControl({ autoTour: true }, scene({ reduceMotion: true }));
    expect(result.patch.autoTour).toBe(false);
    expect(result.skipped[0]).toMatch(/减少动态效果/);
  });

  it("leaves the showroom alone when the requested view is already active", () => {
    const result = planShowroomControl(
      { camera: "驾驶室仓位" },
      scene({ camera: "cockpit" }),
    );
    expect(result.patch.camera).toBeUndefined();
    expect(result.applied).toEqual([]);
    expect(result.skipped[0]).toMatch(/驾舱/);
  });

  it("does not reapply the drive preset when the car is already in it", () => {
    const driving = scene({
      venue: "road",
      camera: "cockpit",
      lightsOn: true,
      engineOn: true,
      speedKph: 45,
    });
    const result = planShowroomControl({ preset: "drive" }, driving);
    expect(result.applied).toEqual([]);
    expect(result.skipped[0]).toMatch(/试驾/);
    expect(result.patch).toEqual({});
  });

  it("stops an active tour when the camera changes", () => {
    const result = planShowroomControl({ camera: "驾舱" }, scene({ autoTour: true }));
    expect(result.patch.camera).toBe("cockpit");
    expect(result.patch.autoTour).toBe(false);
    expect(result.applied).toContain("已停止环车巡检");
  });
});

describe("foldShowroomCommands", () => {
  it("lets a later tool call override an earlier one", () => {
    const result = foldShowroomCommands(
      [{ paint: "熔岩红" }, { paint: "曜石黑", venue: "hall" }],
      scene(),
    );
    expect(result.patch.paintId).toBe("obsidian-black");
    expect(result.patch.venue).toBe("hall");
  });
});

describe("readChatCompletion", () => {
  it("reads OpenAI tool call arguments", () => {
    const turn = readChatCompletion({
      choices: [
        {
          message: {
            content: "已切到夜晚公路。",
            tool_calls: [
              {
                function: {
                  name: "control_showroom",
                  arguments: JSON.stringify({ venue: "road", light: "night" }),
                },
              },
            ],
          },
        },
      ],
    });
    expect(turn.reply).toBe("已切到夜晚公路。");
    expect(turn.commands).toEqual([{ venue: "road", light: "night" }]);
  });

  it("accepts a raw control object when the model skipped tools", () => {
    const turn = readChatCompletion({
      choices: [{ message: { content: '{"preset":"welcome"}' } }],
    });
    expect(turn.reply).toBe("");
    expect(turn.commands).toEqual([{ preset: "welcome" }]);
  });

  it("reads text parts and a fenced JSON command", () => {
    const parts = readChatCompletion({
      choices: [{ message: { content: [{ type: "text", text: "已打开车灯。" }] } }],
    });
    expect(parts.reply).toBe("已打开车灯。");

    const fenced = readChatCompletion({
      choices: [{ message: { content: "```json\n{\"camera\":\"cockpit\"}\n```" } }],
    });
    expect(fenced.commands).toEqual([{ camera: "cockpit" }]);
  });

  it("surfaces provider errors without requiring a choice", () => {
    expect(() => readChatCompletion({ error: { message: "invalid api key" } })).toThrow(
      /invalid api key/,
    );
  });
});

describe("resolveShowroomAiCredentials", () => {
  it("uses the server key when the page leaves the field blank", () => {
    const resolved = resolveShowroomAiCredentials(
      { apiKey: "  ", baseUrl: "", model: "" },
      { apiKey: "server-key", baseUrl: "https://example.com/v1", model: "demo-model" },
    );
    expect(resolved).toEqual({
      ok: true,
      credentials: {
        apiKey: "server-key",
        baseUrl: "https://example.com/v1",
        model: "demo-model",
      },
    });
  });

  it("prefers the key entered in the page", () => {
    const resolved = resolveShowroomAiCredentials(
      { apiKey: "page-key", baseUrl: "https://proxy.example/v1/", model: "page-model" },
      { apiKey: "server-key", baseUrl: "https://example.com/v1", model: "demo-model" },
    );
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.credentials.apiKey).toBe("page-key");
      expect(resolved.credentials.baseUrl).toBe("https://proxy.example/v1");
    }
  });

  it("rejects public http endpoints and cloud metadata hosts", () => {
    expect(resolveShowroomAiCredentials({ apiKey: "page-key", baseUrl: "http://example.com/v1" }).ok).toBe(
      false,
    );
    expect(
      resolveShowroomAiCredentials({
        apiKey: "page-key",
        baseUrl: "http://169.254.169.254/latest",
      }).ok,
    ).toBe(false);
    const local = resolveShowroomAiCredentials({
      apiKey: "ollama",
      baseUrl: "http://127.0.0.1:11434/v1",
      model: "qwen2.5",
    });
    expect(local.ok).toBe(true);
  });

  it("removes the key if a provider echoes it", () => {
    expect(scrubSecret("bad key sk-test in body", "sk-test")).toBe("bad key *** in body");
  });
});

describe("buildShowroomAiSystemPrompt", () => {
  it("tells the model which parts of the current car stay closed", () => {
    const prompt = buildShowroomAiSystemPrompt(
      scene({
        model: "offroad",
        wheels: false,
        body: { leftDoor: false, rightDoor: false, trunk: false, sunroof: false },
      }),
    );
    expect(prompt).toContain("巴博斯 G900不能单独打开左门、右门、后备箱、天窗");
    expect(prompt).toContain("不要把这些部件设为打开");
  });
});
