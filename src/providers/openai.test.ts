import { afterEach, describe, expect, it, vi } from "vitest";
import { streamTransformWithOpenAI } from "./openai";

function createSseBody(events: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(`data: ${event}\n\n`));
      }
      controller.close();
    },
  });
}

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

  it("accepts terminal response.completed stream event even without [DONE]", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: createSseBody([
        JSON.stringify({ type: "response.output_text.delta", delta: "Hello" }),
        JSON.stringify({
          type: "response.completed",
          response: { id: "resp_123", finish_reason: "stop" },
        }),
      ]),
    });
    vi.stubGlobal("fetch", fetchMock);

    const deltas: string[] = [];
    const result = await streamTransformWithOpenAI({
      apiKey: "test-key",
      inputText: "source",
      mode: "polish",
      timeoutMs: 5_000,
      onDelta: (delta) => {
        deltas.push(delta);
      },
    });

    expect(result.outputText).toBe("Hello");
    expect(result.responseId).toBe("resp_123");
    expect(deltas).toEqual(["Hello"]);
  });

  it("marks output as truncated when stream ends with deltas but no terminal event", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: createSseBody([JSON.stringify({ type: "response.output_text.delta", delta: "Partial" })]),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await streamTransformWithOpenAI({
      apiKey: "test-key",
      inputText: "source",
      mode: "polish",
      timeoutMs: 5_000,
      onDelta: () => undefined,
    });

    expect(result.outputText).toBe("Partial");
    expect(result.truncatedByProvider).toBe(true);
  });

  it("uses terminal payload output when stream contains no delta events", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: createSseBody([
        JSON.stringify({
          type: "response.completed",
          response: {
            id: "resp_terminal",
            output: [{ content: [{ text: "Terminal output text." }] }],
          },
        }),
      ]),
    });
    vi.stubGlobal("fetch", fetchMock);

    const deltas: string[] = [];
    const result = await streamTransformWithOpenAI({
      apiKey: "test-key",
      inputText: "source",
      mode: "polish",
      timeoutMs: 5_000,
      onDelta: (delta) => {
        deltas.push(delta);
      },
    });

    expect(result.outputText).toBe("Terminal output text.");
    expect(result.responseId).toBe("resp_terminal");
    expect(deltas).toEqual(["Terminal output text."]);
  });

  it("fails safe when stream has no output deltas", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: createSseBody([JSON.stringify({ type: "response.completed" })]),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      streamTransformWithOpenAI({
        apiKey: "test-key",
        inputText: "source",
        mode: "polish",
        timeoutMs: 5_000,
        onDelta: () => undefined,
      }),
    ).rejects.toThrow("OpenAI returned empty output");
  });
});
