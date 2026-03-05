import { afterEach, describe, expect, it, vi } from "vitest";
import { streamTransformWithOpenAI } from "./openai";

describe("streamTransformWithOpenAI", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("preserves whitespace when assembling non-stream content chunks", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: {},
      json: async () => ({
        response: {
          output: [
            {
              content: [{ text: "Hello " }, { text: "world" }, { text: "\n" }, { text: "  next" }],
            },
          ],
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const deltas: string[] = [];
    const result = await streamTransformWithOpenAI({
      apiKey: "test-key",
      inputText: "source",
      mode: "polish",
      streaming: false,
      timeoutMs: 5_000,
      onDelta: (delta) => {
        deltas.push(delta);
      },
    });

    expect(result.outputText).toBe("Hello world\n  next");
    expect(deltas).toEqual(["Hello world\n  next"]);
  });
});
