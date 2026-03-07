import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildInstructions,
  buildUserInput,
  MARKDOWN_PRESET_SPECS,
  MODE_PROMPT_SPECS,
  type OpenAITransformMode,
  type RewriteTransformMode,
} from "./openaiPrompting";
import { streamTransformWithOpenAI } from "./openai";
import {
  MARKDOWN_INSUFFICIENT_STRUCTURE_MESSAGE,
  deriveMarkdownIntent,
} from "../agentPrompts/markdown";
import { deriveStructureIntent } from "../structuring/plainText";

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

  it("builds distinct instructions for every mode from the centralized prompt map", () => {
    const modes: RewriteTransformMode[] = ["polish", "casual", "professional", "direct"];
    const instructionSet = new Set(
      modes.map((mode) =>
        buildInstructions(
          mode,
          deriveStructureIntent("Please send the latest draft and confirm the timing.", mode),
        ),
      ),
    );
    expect(instructionSet.size).toBe(modes.length);

    for (const mode of modes) {
      expect(buildInstructions(mode)).toContain(`Mode: ${MODE_PROMPT_SPECS[mode].label}`);
    }
  });

  it("injects strong mode-specific tone rules and prohibitions", () => {
    expect(buildInstructions("polish")).toContain(
      "Keep the tone neutral and polished, not especially chatty, corporate, or terse.",
    );
    expect(buildInstructions("polish")).toContain(
      'Tone reference: "Could you send that over when you have a chance? Thanks."',
    );
    expect(buildInstructions("casual")).toContain(
      "Prefer everyday wording, contractions, and natural phrasing over corporate or formal wording.",
    );
    expect(buildInstructions("casual")).toContain(
      'Prefer casual choices like "can you", "just checking", and "thanks" over more formal workplace phrasing when natural.',
    );
    expect(buildInstructions("professional")).toContain(
      'Prefer professional choices like "could you please", "I’d like to", "please confirm", and "thank you" when natural.',
    );
    expect(buildInstructions("professional")).toContain(
      "Do not add a greeting, sign-off, signature, subject line, or sender name unless it is already present in the input.",
    );
    expect(buildInstructions("direct")).toContain(
      "Prefer imperative or plainly stated requests when that does not change the meaning.",
    );
    expect(buildInstructions("direct")).toContain(
      "When the input is already short or clean, still compress and simplify instead of only correcting punctuation or swapping synonyms.",
    );
  });

  it("builds distinct Markdown instructions for every markdown preset", () => {
    const source =
      "Review src/App.tsx, keep https://example.com/spec intact, and confirm what remains unclear.";
    const modes: OpenAITransformMode[] = ["agent-universal", "agent-codex", "agent-claude"];
    const intent = deriveMarkdownIntent(source);
    const instructionSet = new Set(modes.map((mode) => buildInstructions(mode, intent)));

    expect(instructionSet.size).toBe(modes.length);
    expect(buildInstructions("agent-universal", intent)).toContain(
      MARKDOWN_PRESET_SPECS.universal.styleRules[0],
    );
    expect(buildInstructions("agent-codex", intent)).toContain(
      MARKDOWN_PRESET_SPECS.codex.styleRules[0],
    );
    expect(buildInstructions("agent-claude", intent)).toContain(
      MARKDOWN_PRESET_SPECS.claude.styleRules[0],
    );
    expect(buildInstructions("agent-universal", intent)).toContain(
      "This input requires visible Markdown structure. Do not return prose only.",
    );
  });

  it("keeps the markdown family separate from the rewrite prompt family and avoids scaffold templates", () => {
    const instructions = buildInstructions(
      "agent-codex",
      deriveMarkdownIntent(
        "Use docs/POLISHPAD-UI-RESKIN-PROMPT.md and keep `pnpm test` unchanged.",
      ),
    );

    expect(instructions).not.toContain("You are a rewriting engine.");
    expect(instructions).toContain("You convert the user's existing text into visibly structured Markdown");
    expect(instructions).not.toContain("coding-agent prompt");
    expect(instructions).not.toContain("Preset:");
    expect(instructions).not.toContain("Section order:");
    expect(instructions).not.toContain("Keep section order fixed");
    expect(instructions).toContain("Keep every referenced file path exactly as written.");
    expect(instructions).toContain("Preserve inline code spans exactly as written.");
    expect(instructions).toContain(
      "If headings help, only use grounded neutral headings from this set: `## Task`, `## Context`, `## References`, `## Files`, `## Requirements`, `## Constraints`, `## Deliverable`, `## Questions`, `## Validation`.",
    );
  });

  it("wraps markdown source input with the neutral Markdown formatter wrapper", () => {
    expect(buildUserInput("agent-universal", "source")).toBe(
      "Format the following text as clean Markdown. Preserve the original wording and intent as closely as possible.\n\n[BEGIN TEXT]\nsource\n[END TEXT]",
    );
    expect(buildUserInput("polish", "source")).toBe(
      "Rewrite the text below.\n\n[BEGIN TEXT]\nsource\n[END TEXT]",
    );
  });

  it("adds structure guidance only when smart structuring is enabled", () => {
    const enabledInstructions = buildInstructions(
      "professional",
      deriveStructureIntent(
        "We are close to finalising the plan, but a few items still need alignment across design, finance, and operations before we send the final note. Please confirm the scope, share the budget, and agree next steps for the launch review.",
        "professional",
      ),
    );
    const disabledInstructions = buildInstructions("professional");

    expect(enabledInstructions).toContain("Structure guidance:");
    expect(enabledInstructions).toContain(
      "Preferred shape for this input: a short lead-in paragraph plus bullets or compact follow-on paragraphs.",
    );
    expect(enabledInstructions).toContain("Bullets are acceptable for deliverables, options, or action items when they improve clarity.");
    expect(disabledInstructions).not.toContain("Structure guidance:");
  });

  it("keeps mode-specific structure behavior distinct", () => {
    const sample = "Please send the final draft, confirm Monday works, and share the budget.";

    const polishInstructions = buildInstructions("polish", deriveStructureIntent(sample, "polish"));
    const casualInstructions = buildInstructions("casual", deriveStructureIntent(sample, "casual"));
    const professionalInstructions = buildInstructions(
      "professional",
      deriveStructureIntent(sample, "professional"),
    );
    const directInstructions = buildInstructions("direct", deriveStructureIntent(sample, "direct"));

    expect(polishInstructions).toContain("Use bullets only when multiple concrete asks or deliverables clearly make the message easier to scan.");
    expect(casualInstructions).toContain(
      "Use bullets rarely; keep the output feeling like a natural message, not a memo.",
    );
    expect(professionalInstructions).toContain(
      "Bullets are acceptable for deliverables, options, or action items when they improve clarity.",
    );
    expect(directInstructions).toContain(
      "When there are 2 or more asks, steps, or deliverables, prefer bullets over dense prose.",
    );
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

  it("uses GPT-5 rewrite controls to minimize hidden reasoning spend", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: {},
      json: async () => ({
        response: {
          output: [{ content: [{ text: "Polished." }] }],
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await streamTransformWithOpenAI({
      apiKey: "test-key",
      inputText: "source",
      mode: "polish",
      model: "gpt-5-nano-2025-08-07",
      streaming: false,
      timeoutMs: 5_000,
      onDelta: () => undefined,
    });

    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<
      string,
      unknown
    >;
    expect(requestBody.reasoning).toEqual({ effort: "minimal" });
    expect(requestBody.text).toEqual({ verbosity: "medium" });
  });

  it("uses lower verbosity for direct mode than for the other rewrite modes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: {},
      json: async () => ({
        response: {
          output: [{ content: [{ text: "Direct." }] }],
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await streamTransformWithOpenAI({
      apiKey: "test-key",
      inputText: "source",
      mode: "direct",
      model: "gpt-5-nano-2025-08-07",
      streaming: false,
      timeoutMs: 5_000,
      onDelta: () => undefined,
    });

    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<
      string,
      unknown
    >;
    expect(requestBody.text).toEqual({ verbosity: "low" });
  });

  it("uses GPT-5 prompt controls and the larger token budget path for markdown modes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: {},
      json: async () => ({
        response: {
          output: [{ content: [{ text: "## Objective\nShip it." }] }],
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await streamTransformWithOpenAI({
      apiKey: "test-key",
      inputText: "x".repeat(100),
      mode: "agent-codex",
      model: "gpt-5-nano-2025-08-07",
      streaming: false,
      timeoutMs: 5_000,
      onDelta: () => undefined,
    });

    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<
      string,
      unknown
    >;
    expect(requestBody.text).toEqual({ verbosity: "medium" });
    expect(requestBody.max_output_tokens).toBe(306);
    expect(requestBody.instructions).toContain(
      "For dense prose with multiple tasks, constraints, references, deliverables, or questions, do not return plain prose only. Introduce visible Markdown structure.",
    );
    expect(requestBody.instructions).not.toContain("Preset:");
    expect(String(requestBody.input)).toContain("[BEGIN TEXT]");
  });

  it("uses larger default output budgets for polish-style rewrites", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: {},
      json: async () => ({
        response: {
          output: [{ content: [{ text: "Polished." }] }],
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await streamTransformWithOpenAI({
      apiKey: "test-key",
      inputText: "x".repeat(100),
      mode: "professional",
      model: "gpt-5-nano-2025-08-07",
      streaming: false,
      timeoutMs: 5_000,
      onDelta: () => undefined,
    });

    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<
      string,
      unknown
    >;
    expect(requestBody.max_output_tokens).toBe(306);
  });

  it("uses a smaller but still over-provisioned budget for direct mode", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: {},
      json: async () => ({
        response: {
          output: [{ content: [{ text: "Direct." }] }],
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await streamTransformWithOpenAI({
      apiKey: "test-key",
      inputText: "x".repeat(100),
      mode: "direct",
      model: "gpt-5-nano-2025-08-07",
      streaming: false,
      timeoutMs: 5_000,
      onDelta: () => undefined,
    });

    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<
      string,
      unknown
    >;
    expect(requestBody.max_output_tokens).toBe(227);
  });

  it("uses an unambiguous internal label for polish mode and forbids translation", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: {},
      json: async () => ({
        response: {
          output: [{ content: [{ text: "Polished." }] }],
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await streamTransformWithOpenAI({
      apiKey: "test-key",
      inputText: "source",
      mode: "polish",
      model: "gpt-5-nano-2025-08-07",
      streaming: false,
      timeoutMs: 5_000,
      onDelta: () => undefined,
    });

    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<
      string,
      unknown
    >;
    expect(requestBody.instructions).toContain("Mode: REFINE");
    expect(requestBody.instructions).toContain(
      "Preserve the original language of the input. Do not translate unless the input explicitly asks for translation.",
    );
  });

  it("omits structure guidance from the provider request when smart structuring is disabled", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: {},
      json: async () => ({
        response: {
          output: [{ content: [{ text: "Polished." }] }],
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await streamTransformWithOpenAI({
      apiKey: "test-key",
      inputText: "source",
      mode: "professional",
      model: "gpt-5-nano-2025-08-07",
      streaming: false,
      smartStructuring: false,
      timeoutMs: 5_000,
      onDelta: () => undefined,
    });

    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<
      string,
      unknown
    >;
    expect(requestBody.instructions).not.toContain("Structure guidance:");
  });

  it("tells professional mode not to invent email scaffolding", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: {},
      json: async () => ({
        response: {
          output: [{ content: [{ text: "Professional." }] }],
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await streamTransformWithOpenAI({
      apiKey: "test-key",
      inputText: "source",
      mode: "professional",
      model: "gpt-5-nano-2025-08-07",
      streaming: false,
      timeoutMs: 5_000,
      onDelta: () => undefined,
    });

    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<
      string,
      unknown
    >;
    expect(requestBody.instructions).toContain(
      'Do not add greetings, sign-offs, signatures, subject lines, placeholder names like "[Your Name]", or extra calls to action unless they already exist in the input.',
    );
    expect(requestBody.instructions).toContain(
      "Do not add a greeting, sign-off, signature, subject line, or sender name unless it is already present in the input.",
    );
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
    expect(result.truncatedByProvider).toBe(false);
    expect(deltas).toEqual(["Hello"]);
  });

  it("fails safe when a delta-only stream ends before terminal markers", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: createSseBody([JSON.stringify({ type: "response.output_text.delta", delta: "Complete." })]),
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
    ).rejects.toThrow("OpenAI stream ended before completing the rewrite. Original text preserved.");
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

  it("uses response.output_text.done text when no delta events are present", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: createSseBody([
        JSON.stringify({
          type: "response.output_text.done",
          text: "Done event output.",
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

    expect(result.outputText).toBe("Done event output.");
    expect(deltas).toEqual(["Done event output."]);
  });

  it("uses response.content_part.done text when no delta events are present", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: createSseBody([
        JSON.stringify({
          type: "response.content_part.done",
          part: {
            type: "output_text",
            text: "Part event output.",
          },
        }),
      ]),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await streamTransformWithOpenAI({
      apiKey: "test-key",
      inputText: "source",
      mode: "polish",
      timeoutMs: 5_000,
      onDelta: () => undefined,
    });

    expect(result.outputText).toBe("Part event output.");
  });

  it("uses response.output_item.done content text when no delta events are present", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: createSseBody([
        JSON.stringify({
          type: "response.output_item.done",
          item: {
            type: "message",
            content: [{ type: "output_text", text: "Item event output." }],
          },
        }),
      ]),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await streamTransformWithOpenAI({
      apiKey: "test-key",
      inputText: "source",
      mode: "polish",
      timeoutMs: 5_000,
      onDelta: () => undefined,
    });

    expect(result.outputText).toBe("Item event output.");
  });

  it("assembles multiple indexed content parts into the final output", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: createSseBody([
        JSON.stringify({
          type: "response.content_part.done",
          output_index: 0,
          content_index: 0,
          part: { type: "output_text", text: "Hello " },
        }),
        JSON.stringify({
          type: "response.content_part.done",
          output_index: 0,
          content_index: 1,
          part: { type: "output_text", text: "world." },
        }),
      ]),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await streamTransformWithOpenAI({
      apiKey: "test-key",
      inputText: "source",
      mode: "polish",
      timeoutMs: 5_000,
      onDelta: () => undefined,
    });

    expect(result.outputText).toBe("Hello world.");
  });

  it("prefers canonical done text over preview deltas for the same part", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: createSseBody([
        JSON.stringify({
          type: "response.output_text.delta",
          output_index: 0,
          content_index: 0,
          delta: "Polished text.\n",
        }),
        JSON.stringify({
          type: "response.output_text.done",
          output_index: 0,
          content_index: 0,
          text: "Polished text.",
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

    expect(deltas).toEqual(["Polished text.\n"]);
    expect(result.outputText).toBe("Polished text.");
  });

  it("surfaces refusal events as explicit provider errors", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: createSseBody([
        JSON.stringify({
          type: "response.refusal.done",
          refusal: "I cannot help with that.",
        }),
      ]),
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
    ).rejects.toThrow("OpenAI refused to rewrite this text.");
  });

  it("surfaces markdown-mode refusals with markdown-specific language", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: createSseBody([
        JSON.stringify({
          type: "response.refusal.done",
          refusal: "I cannot do that.",
        }),
      ]),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      streamTransformWithOpenAI({
        apiKey: "test-key",
        inputText: "source",
        mode: "agent-universal",
        timeoutMs: 5_000,
        onDelta: () => undefined,
      }),
    ).rejects.toThrow("OpenAI refused to format this text as Markdown.");
  });

  it("retries once with stricter instructions when markdown output is prose-only and too similar", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        body: createSseBody([
          JSON.stringify({
            type: "response.output_text.done",
            text: "Please read agents.md, compare it to the build loop, identify gaps, preserve file paths, and return a patch plus open questions.",
          }),
          JSON.stringify({
            type: "response.completed",
            response: {
              id: "resp_md_retry_1",
              status: "completed",
              output: [
                {
                  content: [
                    {
                      type: "output_text",
                      text: "Please read agents.md, compare it to the build loop, identify gaps, preserve file paths, and return a patch plus open questions.",
                    },
                  ],
                },
              ],
            },
          }),
        ]),
      })
      .mockResolvedValueOnce({
        ok: true,
        body: createSseBody([
          JSON.stringify({
            type: "response.output_text.delta",
            delta: "## Task\n- Read `agents.md`.\n",
          }),
          JSON.stringify({
            type: "response.output_text.done",
            text: "## Task\n- Read `agents.md`.\n- Compare it to the build loop.\n\n## Constraints\n- Preserve file paths.\n\n## Deliverable\n- Return a patch.\n\n## Questions\n- Capture open questions.",
          }),
          JSON.stringify({
            type: "response.completed",
            response: {
              id: "resp_md_retry_2",
              status: "completed",
              output: [
                {
                  content: [
                    {
                      type: "output_text",
                      text: "## Task\n- Read `agents.md`.\n- Compare it to the build loop.\n\n## Constraints\n- Preserve file paths.\n\n## Deliverable\n- Return a patch.\n\n## Questions\n- Capture open questions.",
                    },
                  ],
                },
              ],
            },
          }),
        ]),
      });
    vi.stubGlobal("fetch", fetchMock);

    const deltas: string[] = [];
    const onRetrying = vi.fn();
    const result = await streamTransformWithOpenAI({
      apiKey: "test-key",
      inputText:
        "Please read agents.md, compare it to the build loop, identify gaps, preserve file paths, and return a patch plus open questions.",
      mode: "agent-codex",
      timeoutMs: 5_000,
      onRetrying,
      onDelta: (delta) => {
        deltas.push(delta);
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onRetrying).toHaveBeenCalledTimes(1);
    expect(result.outputText).toContain("## Task");
    expect(deltas).toEqual([
      "## Task\n- Read `agents.md`.\n",
    ]);

    const secondRequestBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)) as Record<
      string,
      unknown
    >;
    expect(String(secondRequestBody.instructions)).toContain("Retry override:");
    expect(String(secondRequestBody.instructions)).toContain(
      "This input requires visible Markdown syntax.",
    );
  });

  it("retries when an existing markdown input is flattened into prose", async () => {
    const source = "## Task\n- Read agents.md\n- Run `pnpm test`";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        body: createSseBody([
          JSON.stringify({
            type: "response.output_text.done",
            text: "Read agents.md and run `pnpm test`.",
          }),
          JSON.stringify({
            type: "response.completed",
            response: {
              id: "resp_md_existing_1",
              status: "completed",
              output: [
                {
                  content: [
                    {
                      type: "output_text",
                      text: "Read agents.md and run `pnpm test`.",
                    },
                  ],
                },
              ],
            },
          }),
        ]),
      })
      .mockResolvedValueOnce({
        ok: true,
        body: createSseBody([
          JSON.stringify({
            type: "response.output_text.delta",
            delta: "## Task\n- Read agents.md\n",
          }),
          JSON.stringify({
            type: "response.output_text.done",
            text: "## Task\n- Read agents.md\n- Run `pnpm test`",
          }),
          JSON.stringify({
            type: "response.completed",
            response: {
              id: "resp_md_existing_2",
              status: "completed",
              output: [
                {
                  content: [
                    {
                      type: "output_text",
                      text: "## Task\n- Read agents.md\n- Run `pnpm test`",
                    },
                  ],
                },
              ],
            },
          }),
        ]),
      });
    vi.stubGlobal("fetch", fetchMock);

    const deltas: string[] = [];
    const onRetrying = vi.fn();
    const result = await streamTransformWithOpenAI({
      apiKey: "test-key",
      inputText: source,
      mode: "agent-codex",
      timeoutMs: 5_000,
      onRetrying,
      onDelta: (delta) => {
        deltas.push(delta);
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(onRetrying).toHaveBeenCalledTimes(1);
    expect(result.outputText).toBe("## Task\n- Read agents.md\n- Run `pnpm test`");
    expect(deltas).toEqual(["## Task\n- Read agents.md\n"]);

    const firstRequestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<
      string,
      unknown
    >;
    expect(String(firstRequestBody.instructions)).toContain(
      "This input requires visible Markdown structure. Do not return prose only.",
    );
  });

  it("fails safe when markdown retry still does not produce visible structure", async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: true,
        body: createSseBody([
          JSON.stringify({
            type: "response.output_text.done",
            text: "Please read agents.md, compare it to the build loop, identify gaps, preserve file paths, and return a patch plus open questions.",
          }),
          JSON.stringify({
            type: "response.completed",
            response: {
              status: "completed",
              output: [
                {
                  content: [
                    {
                      type: "output_text",
                      text: "Please read agents.md, compare it to the build loop, identify gaps, preserve file paths, and return a patch plus open questions.",
                    },
                  ],
                },
              ],
            },
          }),
        ]),
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      streamTransformWithOpenAI({
        apiKey: "test-key",
        inputText:
          "Please read agents.md, compare it to the build loop, identify gaps, preserve file paths, and return a patch plus open questions.",
        mode: "agent-universal",
        timeoutMs: 5_000,
        onDelta: () => undefined,
      }),
    ).rejects.toThrow(MARKDOWN_INSUFFICIENT_STRUCTURE_MESSAGE);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries once with more room when the stream exhausts the output budget before any text arrives", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        body: createSseBody([
          JSON.stringify({
            type: "response.incomplete",
            response: {
              id: "resp_retry_1",
              status: "incomplete",
              incomplete_details: { reason: "max_output_tokens" },
              output: [],
            },
          }),
        ]),
      })
      .mockResolvedValueOnce({
        ok: true,
        body: createSseBody([
          JSON.stringify({
            type: "response.output_text.done",
            text: "Recovered after retry.",
          }),
          JSON.stringify({
            type: "response.completed",
            response: {
              id: "resp_retry_2",
              status: "completed",
              output: [{ content: [{ text: "Recovered after retry." }] }],
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
      maxOutputTokens: 100,
      onDelta: (delta) => {
        deltas.push(delta);
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstRequestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as Record<
      string,
      unknown
    >;
    const secondRequestBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)) as Record<
      string,
      unknown
    >;
    expect(firstRequestBody.max_output_tokens).toBe(100);
    expect(secondRequestBody.max_output_tokens).toBe(356);
    expect(result.outputText).toBe("Recovered after retry.");
    expect(result.maxOutputTokens).toBe(356);
    expect(deltas).toEqual(["Recovered after retry."]);
  });

  it("surfaces explicit budget exhaustion when no text is produced even after the limit cannot expand further", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: createSseBody([
        JSON.stringify({
          type: "response.incomplete",
          response: {
            id: "resp_incomplete",
            status: "incomplete",
            incomplete_details: { reason: "max_output_tokens" },
            output: [],
          },
        }),
      ]),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      streamTransformWithOpenAI({
        apiKey: "test-key",
        inputText: "source",
        mode: "polish",
        timeoutMs: 5_000,
        maxOutputTokens: 16384,
        onDelta: () => undefined,
      }),
    ).rejects.toThrow("OpenAI used the output budget before producing the rewrite.");
  });

  it("fails safe instead of returning clipped text when OpenAI stops for length after partial output", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: createSseBody([
        JSON.stringify({
          type: "response.output_text.delta",
          delta: "Partial rewrite",
        }),
        JSON.stringify({
          type: "response.completed",
          response: {
            id: "resp_partial",
            finish_reason: "length",
            output: [{ content: [{ text: "Partial rewrite" }] }],
          },
        }),
      ]),
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
    ).rejects.toThrow("OpenAI stopped before completing the rewrite. Original text preserved.");
  });

  it("surfaces explicit cancelled-state errors instead of empty output", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: createSseBody([
        JSON.stringify({
          type: "response.cancelled",
          response: {
            id: "resp_cancelled",
            status: "cancelled",
            output: [],
          },
        }),
      ]),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      streamTransformWithOpenAI({
        apiKey: "test-key",
        inputText: "source",
        mode: "polish",
        timeoutMs: 5_000,
        maxOutputTokens: 16384,
        onDelta: () => undefined,
      }),
    ).rejects.toThrow("OpenAI cancelled the response before producing the rewrite.");
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
    ).rejects.toThrow("OpenAI returned empty rewrite output");
  });
});
