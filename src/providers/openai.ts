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

const CASUAL_MODE_INSTRUCTION = `Mode: CASUAL
Rewrite to sound casual, friendly, and conversational.
Use a relaxed tone and contractions where natural.
Keep it clean and readable (not slangy, not childish).
Keep approximate length; light tightening allowed.`;

const PROFESSIONAL_MODE_INSTRUCTION = `Mode: PROFESSIONAL
Rewrite to sound professional, neutral, and polished for a workplace email.
Clear, calm, and well-structured.
Not stiff and not overly verbose.
Keep approximate length; light tightening allowed.`;

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

export type OpenAITransformMode = "polish" | "casual" | "professional" | "direct";

export type StreamTransformArgs = {
  apiKey: string;
  inputText: string;
  mode: OpenAITransformMode;
  model?: string;
  temperature?: number;
  streaming?: boolean;
  maxOutputTokens?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
  onDelta: (delta: string) => void;
};

export type StreamTransformResult = {
  outputText: string;
  responseId?: string;
  finishReason?: string;
  truncatedByProvider: boolean;
  maxOutputTokens: number;
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

function asObject(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function extractFinalOutputText(payload: unknown): string {
  const root = asObject(payload);
  if (!root) {
    return "";
  }

  const directText = root.output_text;
  if (typeof directText === "string") {
    return directText;
  }
  if (Array.isArray(directText)) {
    return directText.filter((value): value is string => typeof value === "string").join("");
  }

  const response = asObject(root.response);
  if (!response) {
    return "";
  }

  const responseOutputText = response.output_text;
  if (typeof responseOutputText === "string") {
    return responseOutputText;
  }
  if (Array.isArray(responseOutputText)) {
    return responseOutputText
      .filter((value): value is string => typeof value === "string")
      .join("");
  }

  const output = Array.isArray(response.output) ? response.output : [];
  let combined = "";
  for (const item of output) {
    const itemObject = asObject(item);
    if (!itemObject) {
      continue;
    }

    const content = Array.isArray(itemObject.content) ? itemObject.content : [];
    for (const contentItem of content) {
      const contentObject = asObject(contentItem);
      if (!contentObject) {
        continue;
      }

      const textValue = contentObject.text;
      if (typeof textValue === "string") {
        combined += textValue;
      }
    }
  }

  return combined;
}

function extractFinishReason(payload: unknown): string | undefined {
  const root = asObject(payload);
  if (!root) {
    return undefined;
  }

  const reasons: Array<string | undefined> = [];
  reasons.push(asString(root.finish_reason));
  reasons.push(asString(root.stop_reason));

  const response = asObject(root.response);
  if (response) {
    reasons.push(asString(response.finish_reason));
    reasons.push(asString(response.stop_reason));

    const incompleteDetails = asObject(response.incomplete_details);
    if (incompleteDetails) {
      reasons.push(asString(incompleteDetails.reason));
    }

    const output = Array.isArray(response.output) ? response.output : [];
    for (const item of output) {
      const itemObject = asObject(item);
      if (!itemObject) {
        continue;
      }

      reasons.push(asString(itemObject.finish_reason));
      const itemIncompleteDetails = asObject(itemObject.incomplete_details);
      if (itemIncompleteDetails) {
        reasons.push(asString(itemIncompleteDetails.reason));
      }

      const content = Array.isArray(itemObject.content) ? itemObject.content : [];
      for (const contentItem of content) {
        const contentObject = asObject(contentItem);
        if (!contentObject) {
          continue;
        }

        reasons.push(asString(contentObject.finish_reason));
        const contentIncompleteDetails = asObject(contentObject.incomplete_details);
        if (contentIncompleteDetails) {
          reasons.push(asString(contentIncompleteDetails.reason));
        }
      }
    }
  }

  const rootIncompleteDetails = asObject(root.incomplete_details);
  if (rootIncompleteDetails) {
    reasons.push(asString(rootIncompleteDetails.reason));
  }

  return reasons.find((value): value is string => Boolean(value));
}

function isLengthTruncationReason(reason: string | undefined): boolean {
  if (!reason) {
    return false;
  }

  const normalized = reason.toLowerCase();
  return normalized === "length" || normalized === "max_output_tokens" || normalized === "max_tokens";
}

function parseResponseError(status: number, bodyText: string): OpenAIProviderError {
  const parsedMessage = extractErrorMessage(bodyText);
  const message = parsedMessage || bodyText || "OpenAI request failed.";

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

function extractErrorMessage(bodyText: string): string {
  try {
    const parsed = JSON.parse(bodyText) as { error?: { message?: string } };
    return parsed.error?.message ?? "";
  } catch {
    return "";
  }
}

function shouldRetryWithoutTemperature(
  status: number,
  bodyText: string,
  usedTemperature: boolean,
): boolean {
  if (!usedTemperature || status < 400 || status >= 500) {
    return false;
  }

  const message = (extractErrorMessage(bodyText) || bodyText).toLowerCase();
  return message.includes("unsupported parameter") && message.includes("temperature");
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
  if (mode === "casual") {
    return CASUAL_MODE_INSTRUCTION;
  }

  if (mode === "professional") {
    return PROFESSIONAL_MODE_INSTRUCTION;
  }

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
  streaming = true,
  maxOutputTokens: maxOutputTokensOverride,
  signal,
  timeoutMs = 30_000,
  onDelta,
}: StreamTransformArgs): Promise<StreamTransformResult> {
  const timeoutController = new AbortController();
  const timeoutId = window.setTimeout(() => {
    timeoutController.abort(new DOMException("Timed out", "TimeoutError"));
  }, timeoutMs);

  const mergedSignal = mergeAbortSignals([signal, timeoutController.signal]);
  const maxOutputTokens =
    typeof maxOutputTokensOverride === "number" && Number.isFinite(maxOutputTokensOverride)
      ? Math.min(8192, Math.max(1, Math.round(maxOutputTokensOverride)))
      : getMaxOutputTokens(mode, inputText);
  let outputText = "";
  let responseId: string | undefined;
  let finishReason: string | undefined;
  let truncatedByProvider = false;
  let sawDoneEvent = false;
  let sawDeltaEvent = false;
  let includeTemperature = typeof temperature === "number" && Number.isFinite(temperature);

  try {
    const makeRequest = async (withTemperature: boolean): Promise<Response> =>
      fetch(OPENAI_RESPONSES_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        signal: mergedSignal,
        body: JSON.stringify({
          model,
          ...(withTemperature ? { temperature } : {}),
          stream: streaming,
          max_output_tokens: maxOutputTokens,
          instructions: `${BASE_SYSTEM_PROMPT}\n\n${getModeInstruction(mode)}`,
          input: `${USER_WRAPPER_PREFIX}${inputText}${USER_WRAPPER_SUFFIX}`,
        }),
      });

    let response = await makeRequest(includeTemperature);
    if (!response.ok) {
      const bodyText = await response.text();
      if (shouldRetryWithoutTemperature(response.status, bodyText, includeTemperature)) {
        includeTemperature = false;
        response = await makeRequest(false);
      } else {
        throw parseResponseError(response.status, bodyText);
      }
    }

    if (!response.ok) {
      const bodyText = await response.text();
      throw parseResponseError(response.status, bodyText);
    }

    if (!response.body) {
      throw new OpenAIProviderError("unknown", "OpenAI returned no response body.");
    }

    if (!streaming) {
      let parsed: unknown;
      try {
        parsed = await response.json();
      } catch {
        throw new OpenAIProviderError(
          "unknown",
          "OpenAI returned malformed JSON. Original text preserved.",
        );
      }

      const finishReasonFromPayload = extractFinishReason(parsed);
      if (finishReasonFromPayload) {
        finishReason = finishReasonFromPayload;
        if (isLengthTruncationReason(finishReasonFromPayload)) {
          truncatedByProvider = true;
        }
      }

      const outputTextFromPayload = extractFinalOutputText(parsed);
      if (!outputTextFromPayload.trim()) {
        throw new OpenAIProviderError(
          "unknown",
          "OpenAI returned empty output. Original text preserved.",
        );
      }

      outputText = outputTextFromPayload;
      onDelta(outputTextFromPayload);

      if (typeof parsed === "object" && parsed !== null) {
        const parsedObject = parsed as { id?: string; response?: { id?: string } };
        if (typeof parsedObject.response?.id === "string") {
          responseId = parsedObject.response.id;
        } else if (typeof parsedObject.id === "string") {
          responseId = parsedObject.id;
        }
      }

      return { outputText, responseId, finishReason, truncatedByProvider, maxOutputTokens };
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

      const eventFinishReason = extractFinishReason(parsed);
      if (eventFinishReason) {
        finishReason = eventFinishReason;
        if (isLengthTruncationReason(eventFinishReason)) {
          truncatedByProvider = true;
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

    return { outputText, responseId, finishReason, truncatedByProvider, maxOutputTokens };
  } catch (error) {
    throw parseUnknownProviderError(error);
  } finally {
    window.clearTimeout(timeoutId);
  }
}
