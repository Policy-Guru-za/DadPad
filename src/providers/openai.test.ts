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

  it("retries once without temperature when model rejects that parameter", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () =>
          JSON.stringify({
            error: {
              message: "Unsupported parameter: 'temperature' is not supported with this model.",
            },
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        body: {},
        json: async () => ({
          response: {
            output: [{ content: [{ text: "Fallback worked." }] }],
          },
        }),
      });

    vi.stubGlobal("fetch", fetchMock);

    const result = await streamTransformWithOpenAI({
      apiKey: "test-key",
      inputText: "source",
      mode: "polish",
      streaming: false,
      temperature: 0.2,
      timeoutMs: 5_000,
      onDelta: () => undefined,
    });

    expect(result.outputText).toBe("Fallback worked.");
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstRequestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<
      string,
      unknown
    >;
    const secondRequestBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)) as Record<
      string,
      unknown
    >;

    expect(firstRequestBody.temperature).toBe(0.2);
    expect(secondRequestBody.temperature).toBeUndefined();
  });
});
