import { describe, expect, it, vi } from "vitest";
import { DEFAULT_OPENAI_MODEL } from "../src/providers/openaiPrompting";
import { loadRuntimeConfig } from "./eval-modes";

describe("loadRuntimeConfig", () => {
  it("falls back to env and defaults when disk config is unreadable", () => {
    const onWarning = vi.fn();

    const config = loadRuntimeConfig({
      env: {
        OPENAI_API_KEY: " env-key ",
      },
      readConfig: () => {
        throw new Error("decrypt failed");
      },
      onWarning,
    });

    expect(config).toEqual({
      openaiApiKey: "env-key",
      model: DEFAULT_OPENAI_MODEL,
      temperature: 0.2,
    });
    expect(onWarning).toHaveBeenCalledOnce();
    expect(onWarning.mock.calls[0]?.[0]).toContain("Ignoring unreadable PolishPad config");
  });

  it("skips disk reads when env provides the full runtime config", () => {
    const readConfig = vi.fn(() => {
      throw new Error("disk config should not be read");
    });

    const config = loadRuntimeConfig({
      env: {
        OPENAI_API_KEY: "env-key",
        OPENAI_MODEL: "gpt-test",
        OPENAI_TEMPERATURE: "0.7",
      },
      readConfig,
      onWarning: vi.fn(),
    });

    expect(readConfig).not.toHaveBeenCalled();
    expect(config).toEqual({
      openaiApiKey: "env-key",
      model: "gpt-test",
      temperature: 0.7,
    });
  });
});
