const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

export const DEFAULT_OPENAI_MODEL = "gpt-5-nano-2025-08-07";

const BASE_SYSTEM_PROMPT = `You are a rewriting engine. Rewrite the user's text according to the requested mode.

Non-negotiable constraints:
- Preserve the original meaning, facts, and intent. Do not invent new information.
- Keep the approximate length unless the mode explicitly asks for brevity. Light tightening is allowed; modest lengthening is allowed if it improves clarity and flow.
- Preserve exactly (character-for-character) any: names, numbers, dates, times, currency amounts, percentages, addresses, URLs, email addresses, phone numbers, order/reference IDs, and quoted text.
- Fix grammar, spelling, punctuation, and paragraphing.
- Break up run-on sentences. Use natural paragraph breaks.
- Remove obvious filler words (e.g., "um", "uh", "like", "you know") and unintentional verbatim repetition.
- Homophones / wrong-word fixes: only change a word if the intended meaning is highly confident from context. If uncertain, leave it unchanged.
- Do not alter placeholders of the form __PZPTOK###__.
- Output only the rewritten text. No preamble, no labels, no explanations.

If the input contains multiple distinct topics, keep them separated with clear paragraphs.`;

const POLISH_MODE_INSTRUCTION = `Mode: POLISH
Rewrite into a clear, elegant, well-structured version suitable for general professional communication.
Actively improve sentence structure and paragraph flow.
It should read like a competent human wrote it carefully, not like a transcript.
Preserve the original level of assertiveness.
Keep approximate length: you may slightly tighten, and you may modestly expand if it makes the writing more elegant or easier to read.`;

const DIRECT_MODE_INSTRUCTION = `Mode: DIRECT
Rewrite to be concise and direct.
Prefer short sentences.
Remove filler and softening language that doesn't add meaning.
Make requests and next steps explicit.
Use bullet points when it improves clarity.
Shorten meaningfully, but do not remove essential information.`;

const USER_WRAPPER_PREFIX = `Rewrite the text below.

[BEGIN TEXT]
`;

const USER_WRAPPER_SUFFIX = `
[END TEXT]`;

type ProviderErrorCode = "auth" | "rate_limit" | "timeout" | "network" | "server" | "unknown";

export class OpenAIProviderError extends Error {
  readonly code: ProviderErrorCode;

  constructor(code: ProviderErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "OpenAIProviderError";
  }
}

export type OpenAITransformMode = "polish" | "direct";

export type StreamTransformArgs = {
  apiKey: string;
  inputText: string;
  mode: OpenAITransformMode;
  model?: string;
  temperature?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
  onDelta: (delta: string) => void;
};

export type StreamTransformResult = {
  outputText: string;
  responseId?: string;
};

type SSEEvent = {
  data: string;
};

function mergeAbortSignals(signals: Array<AbortSignal | undefined>): AbortSignal | undefined {
  const activeSignals = signals.filter((signal): signal is AbortSignal => Boolean(signal));
  if (activeSignals.length === 0) {
    return undefined;
  }

  const controller = new AbortController();

  const onAbort = (signal: AbortSignal): void => {
    if (!controller.signal.aborted) {
      controller.abort(signal.reason);
    }
  };

  for (const signal of activeSignals) {
    if (signal.aborted) {
      onAbort(signal);
      return controller.signal;
    }

    signal.addEventListener("abort", () => onAbort(signal), { once: true });
  }

  return controller.signal;
}

function parseSSEEvents(raw: string): SSEEvent[] {
  const normalized = raw.replace(/\r\n/g, "\n");
  const chunks = normalized.split("\n\n");
  const events: SSEEvent[] = [];

  for (const chunk of chunks) {
    if (!chunk.trim()) {
      continue;
    }

    const lines = chunk.split("\n");
    const dataLines = lines
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart());

    if (dataLines.length === 0) {
      continue;
    }

    events.push({ data: dataLines.join("\n") });
  }

  return events;
}

async function readEventStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: SSEEvent) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffered = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffered += decoder.decode(value, { stream: true });

    const split = buffered.split(/\r?\n\r?\n/);
    buffered = split.pop() ?? "";

    for (const block of split) {
      const events = parseSSEEvents(block);
      for (const event of events) {
        onEvent(event);
      }
    }
  }

  buffered += decoder.decode();
  if (!buffered.trim()) {
    return;
  }

  const events = parseSSEEvents(buffered);
  for (const event of events) {
    onEvent(event);
  }
}

function extractDelta(payload: unknown): string {
  if (typeof payload !== "object" || payload === null) {
    return "";
  }

  const typed = payload as {
    type?: string;
    delta?: string;
  };

  if (typed.type === "response.output_text.delta" && typeof typed.delta === "string") {
    return typed.delta;
  }

  return "";
}

function parseResponseError(status: number, bodyText: string): OpenAIProviderError {
  let parsedMessage = "";

  try {
    const parsed = JSON.parse(bodyText) as { error?: { message?: string } };
    parsedMessage = parsed.error?.message ?? "";
  } catch {
    parsedMessage = "";
  }

  const fallbackMessage = bodyText || "OpenAI request failed.";
  const message = parsedMessage || fallbackMessage;

  if (status === 401) {
    return new OpenAIProviderError("auth", "OpenAI API key is invalid or missing.");
  }
  if (status === 429) {
    return new OpenAIProviderError(
      "rate_limit",
      "OpenAI rate limit reached. Please wait and try again.",
    );
  }
  if (status >= 500) {
    return new OpenAIProviderError("server", message);
  }

  return new OpenAIProviderError("unknown", message);
}

function parseUnknownProviderError(error: unknown): Error {
  if (error instanceof OpenAIProviderError) {
    return error;
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return error;
  }

  if (error instanceof DOMException && error.name === "TimeoutError") {
    return new OpenAIProviderError("timeout", "OpenAI request timed out.");
  }

  if (error instanceof TypeError) {
    return new OpenAIProviderError(
      "network",
      "Network error while contacting OpenAI. Check your connection.",
    );
  }

  if (error instanceof Error) {
    return error;
  }

  return new OpenAIProviderError("unknown", "Unexpected error while contacting OpenAI.");
}

function getStreamErrorMessage(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const typed = payload as {
    type?: string;
    error?: { message?: string };
    message?: string;
  };

  const directErrorMessage = typed.error?.message;
  if (typeof directErrorMessage === "string" && directErrorMessage.trim()) {
    return directErrorMessage;
  }

  if ((typed.type === "error" || typed.type === "response.error") && typeof typed.message === "string") {
    return typed.message;
  }

  return null;
}

function getModeInstruction(mode: OpenAITransformMode): string {
  if (mode === "direct") {
    return DIRECT_MODE_INSTRUCTION;
  }

  return POLISH_MODE_INSTRUCTION;
}

export function getMaxOutputTokens(mode: OpenAITransformMode, inputText: string): number {
  const inputTokens = Math.max(1, Math.round(inputText.length / 4));

  if (mode === "direct") {
    return Math.min(8192, Math.round(inputTokens * 0.8) + 96);
  }

  return Math.min(8192, Math.round(inputTokens * 1.3) + 128);
}

export async function streamTransformWithOpenAI({
  apiKey,
  inputText,
  mode,
  model = DEFAULT_OPENAI_MODEL,
  temperature = 0.2,
  signal,
  timeoutMs = 30_000,
  onDelta,
}: StreamTransformArgs): Promise<StreamTransformResult> {
  const timeoutController = new AbortController();
  const timeoutId = window.setTimeout(() => {
    timeoutController.abort(new DOMException("Timed out", "TimeoutError"));
  }, timeoutMs);

  const mergedSignal = mergeAbortSignals([signal, timeoutController.signal]);
  const maxOutputTokens = getMaxOutputTokens(mode, inputText);
  let outputText = "";
  let responseId: string | undefined;
  let sawDoneEvent = false;
  let sawDeltaEvent = false;

  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: mergedSignal,
      body: JSON.stringify({
        model,
        temperature,
        stream: true,
        max_output_tokens: maxOutputTokens,
        instructions: `${BASE_SYSTEM_PROMPT}\n\n${getModeInstruction(mode)}`,
        input: `${USER_WRAPPER_PREFIX}${inputText}${USER_WRAPPER_SUFFIX}`,
      }),
    });

    if (!response.ok) {
      const bodyText = await response.text();
      throw parseResponseError(response.status, bodyText);
    }

    if (!response.body) {
      throw new OpenAIProviderError("unknown", "OpenAI returned no response body.");
    }

    await readEventStream(response.body, (event) => {
      if (event.data === "[DONE]") {
        sawDoneEvent = true;
        return;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(event.data);
      } catch {
        throw new OpenAIProviderError(
          "unknown",
          "OpenAI stream returned malformed JSON. Original text preserved.",
        );
      }

      const streamErrorMessage = getStreamErrorMessage(parsed);
      if (streamErrorMessage) {
        throw new OpenAIProviderError("server", streamErrorMessage);
      }

      if (typeof parsed === "object" && parsed !== null) {
        const asObject = parsed as { response?: { id?: string } };
        if (typeof asObject.response?.id === "string") {
          responseId = asObject.response.id;
        }
      }

      const delta = extractDelta(parsed);
      if (!delta) {
        return;
      }

      sawDeltaEvent = true;
      outputText += delta;
      onDelta(delta);
    });

    if (!sawDoneEvent) {
      throw new OpenAIProviderError(
        "unknown",
        "OpenAI stream ended unexpectedly before completion. Original text preserved.",
      );
    }

    if (!sawDeltaEvent || !outputText.trim()) {
      throw new OpenAIProviderError(
        "unknown",
        "OpenAI returned empty output. Original text preserved.",
      );
    }

    return { outputText, responseId };
  } catch (error) {
    throw parseUnknownProviderError(error);
  } finally {
    window.clearTimeout(timeoutId);
  }
}
