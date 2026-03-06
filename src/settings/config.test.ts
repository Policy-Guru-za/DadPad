import { afterEach, describe, expect, it, vi } from "vitest";
import { readAppSettings, writeAppSettings } from "./config";

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

describe("settings config", () => {
  afterEach(() => {
    invokeMock.mockReset();
  });

  it("defaults missing smart structuring to true when reading settings", async () => {
    invokeMock.mockResolvedValue({
      openaiApiKey: " sk-test ",
      model: "  ",
      temperature: 9,
      streaming: false,
      tokenProtection: true,
    });

    const settings = await readAppSettings();

    expect(settings).toEqual({
      openaiApiKey: "sk-test",
      model: "gpt-5-nano-2025-08-07",
      temperature: 2,
      streaming: false,
      tokenProtection: true,
      smartStructuring: true,
    });
  });

  it("writes normalized smart structuring settings", async () => {
    invokeMock.mockResolvedValue(undefined);

    const saved = await writeAppSettings({
      openaiApiKey: " sk-test ",
      model: " ",
      temperature: -1,
      streaming: true,
      tokenProtection: false,
      smartStructuring: false,
    });

    expect(saved).toEqual({
      openaiApiKey: "sk-test",
      model: "gpt-5-nano-2025-08-07",
      temperature: 0,
      streaming: true,
      tokenProtection: false,
      smartStructuring: false,
    });
    expect(invokeMock).toHaveBeenCalledWith("write_config", {
      config: {
        openaiApiKey: "sk-test",
        model: "gpt-5-nano-2025-08-07",
        temperature: 0,
        streaming: true,
        tokenProtection: false,
        smartStructuring: false,
      },
    });
  });
});
