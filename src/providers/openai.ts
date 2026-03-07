import {
  buildInstructions,
  buildUserInput,
  DEFAULT_OPENAI_MODEL,
  getMaxOutputTokens,
  getModelRequestControls,
  isMarkdownTransformMode,
  type OpenAITransformMode,
} from "./openaiPrompting";
import { deriveMarkdownIntent } from "../agentPrompts/markdown";
import { deriveStructureIntent } from "../structuring/plainText";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const MAX_OUTPUT_TOKENS_CEILING = 16_384;

export { DEFAULT_OPENAI_MODEL };
export type { OpenAITransformMode };

type ProviderErrorCode = "auth" | "rate_limit" | "timeout" | "network" | "server" | "unknown";

export class OpenAIProviderError extends Error {
  readonly code: ProviderErrorCode;

  constructor(code: ProviderErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "OpenAIProviderError";
  }
}

export type StreamTransformArgs = {
  apiKey: string;
  inputText: string;
  mode: OpenAITransformMode;
  model?: string;
  temperature?: number;
  streaming?: boolean;
  smartStructuring?: boolean;
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

type StreamPartKind = "output_text" | "refusal";

type StreamPartState = {
  kind: StreamPartKind;
  text: string;
};

type StreamAssembly = Map<number, Map<number, StreamPartState>>;

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

function asInteger(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return undefined;
  }

  return value;
}

function extractEventType(payload: unknown): string | undefined {
  const root = asObject(payload);
  if (!root) {
    return undefined;
  }

  return asString(root.type);
}

function isTerminalStreamEventType(eventType: string | undefined): boolean {
  if (!eventType) {
    return false;
  }

  return (
    eventType === "response.completed" ||
    eventType === "response.done" ||
    eventType === "response.output_text.done" ||
    eventType === "response.content_part.done" ||
    eventType === "response.output_item.done" ||
    eventType === "response.refusal.done"
  );
}

function isTerminalResponseStatus(status: string | undefined): boolean {
  if (!status) {
    return false;
  }

  return (
    status === "completed" ||
    status === "incomplete" ||
    status === "failed" ||
    status === "cancelled"
  );
}

function extractResponseId(payload: unknown): string | undefined {
  const root = asObject(payload);
  if (!root) {
    return undefined;
  }

  const response = asObject(root.response);
  return asString(root.response_id) ?? asString(response?.id) ?? asString(root.id);
}

function extractResponseStatus(payload: unknown): string | undefined {
  const root = asObject(payload);
  if (!root) {
    return undefined;
  }

  const response = asObject(root.response);
  return asString(response?.status) ?? asString(root.status);
}

function getAssemblyPart(
  assembly: StreamAssembly,
  outputIndex: number,
  contentIndex: number,
  kind: StreamPartKind,
): StreamPartState {
  let contentMap = assembly.get(outputIndex);
  if (!contentMap) {
    contentMap = new Map<number, StreamPartState>();
    assembly.set(outputIndex, contentMap);
  }

  let part = contentMap.get(contentIndex);
  if (!part || part.kind !== kind) {
    part = { kind, text: "" };
    contentMap.set(contentIndex, part);
  }

  return part;
}

function setAssemblyPart(
  assembly: StreamAssembly,
  outputIndex: number,
  contentIndex: number,
  kind: StreamPartKind,
  text: string,
): void {
  const part = getAssemblyPart(assembly, outputIndex, contentIndex, kind);
  part.text = text;
}

function appendAssemblyPart(
  assembly: StreamAssembly,
  outputIndex: number,
  contentIndex: number,
  kind: StreamPartKind,
  text: string,
): void {
  const part = getAssemblyPart(assembly, outputIndex, contentIndex, kind);
  part.text += text;
}

function extractTextPart(value: unknown): StreamPartState | null {
  const part = asObject(value);
  if (!part) {
    return null;
  }

  const partType = asString(part.type);
  if ((partType === "output_text" || !partType) && typeof part.text === "string") {
    return { kind: "output_text", text: part.text };
  }

  if (partType === "refusal") {
    if (typeof part.refusal === "string") {
      return { kind: "refusal", text: part.refusal };
    }

    if (typeof part.text === "string") {
      return { kind: "refusal", text: part.text };
    }
  }

  return null;
}

function collectTextFromContentParts(content: unknown[]): string {
  let combined = "";

  for (const contentItem of content) {
    const extracted = extractTextPart(contentItem);
    if (!extracted || extracted.kind !== "output_text") {
      continue;
    }

    combined += extracted.text;
  }

  return combined;
}

function collectTextFromOutputItems(output: unknown[]): string {
  let combined = "";

  for (const item of output) {
    const itemObject = asObject(item);
    if (!itemObject) {
      continue;
    }

    const content = Array.isArray(itemObject.content) ? itemObject.content : [];
    combined += collectTextFromContentParts(content);
  }

  return combined;
}

function ingestOutputItem(
  assembly: StreamAssembly,
  itemValue: unknown,
  outputIndex: number,
): void {
  const item = asObject(itemValue);
  if (!item) {
    return;
  }

  const content = Array.isArray(item.content) ? item.content : [];
  content.forEach((contentItem, contentIndex) => {
    const extracted = extractTextPart(contentItem);
    if (!extracted) {
      return;
    }

    setAssemblyPart(assembly, outputIndex, contentIndex, extracted.kind, extracted.text);
  });
}

function ingestOutputArray(assembly: StreamAssembly, outputValue: unknown): void {
  const output = Array.isArray(outputValue) ? outputValue : [];
  output.forEach((itemValue, outputIndex) => {
    ingestOutputItem(assembly, itemValue, outputIndex);
  });
}

function buildAssemblyText(assembly: StreamAssembly, kind: StreamPartKind): string {
  const outputIndexes = Array.from(assembly.keys()).sort((left, right) => left - right);
  let combined = "";

  for (const outputIndex of outputIndexes) {
    const contentMap = assembly.get(outputIndex);
    if (!contentMap) {
      continue;
    }

    const contentIndexes = Array.from(contentMap.keys()).sort((left, right) => left - right);
    for (const contentIndex of contentIndexes) {
      const part = contentMap.get(contentIndex);
      if (!part || part.kind !== kind) {
        continue;
      }

      combined += part.text;
    }
  }

  return combined;
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

  const rootText = root.text;
  if (typeof rootText === "string") {
    return rootText;
  }

  const part = asObject(root.part);
  if (part && typeof part.text === "string") {
    return part.text;
  }

  const item = asObject(root.item);
  if (item) {
    const itemContent = Array.isArray(item.content) ? item.content : [];
    const itemText = collectTextFromContentParts(itemContent);
    if (itemText) {
      return itemText;
    }
  }

  const rootOutput = Array.isArray(root.output) ? root.output : [];
  const rootOutputText = collectTextFromOutputItems(rootOutput);
  if (rootOutputText) {
    return rootOutputText;
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
  return collectTextFromOutputItems(output);
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
    response?: { error?: { message?: string } };
  };

  const directErrorMessage = typed.error?.message;
  if (typeof directErrorMessage === "string" && directErrorMessage.trim()) {
    return directErrorMessage;
  }

  const nestedErrorMessage = typed.response?.error?.message;
  if (typeof nestedErrorMessage === "string" && nestedErrorMessage.trim()) {
    return nestedErrorMessage;
  }

  if ((typed.type === "error" || typed.type === "response.error") && typeof typed.message === "string") {
    return typed.message;
  }

  return null;
}

function expandMaxOutputTokens(current: number): number {
  return Math.min(MAX_OUTPUT_TOKENS_CEILING, Math.max(current + 256, Math.round(current * 1.75)));
}

function buildPartialLengthMessage(mode: OpenAITransformMode): string {
  return isMarkdownTransformMode(mode)
    ? "OpenAI stopped before completing the Markdown conversion. Original text preserved."
    : "OpenAI stopped before completing the rewrite. Original text preserved.";
}

function buildUnexpectedStreamEndMessage(mode: OpenAITransformMode): string {
  return isMarkdownTransformMode(mode)
    ? "OpenAI stream ended before completing the Markdown conversion. Original text preserved."
    : "OpenAI stream ended before completing the rewrite. Original text preserved.";
}

function buildNoTextTerminalMessage(
  mode: OpenAITransformMode,
  responseStatus: string | undefined,
  finishReason: string | undefined,
): string {
  if (isLengthTruncationReason(finishReason)) {
    return isMarkdownTransformMode(mode)
      ? "OpenAI used the output budget before producing Markdown output. Original text preserved."
      : "OpenAI used the output budget before producing the rewrite. Original text preserved.";
  }

  if (responseStatus === "cancelled") {
    return isMarkdownTransformMode(mode)
      ? "OpenAI cancelled the response before producing Markdown output. Original text preserved."
      : "OpenAI cancelled the response before producing the rewrite. Original text preserved.";
  }

  if (responseStatus === "incomplete") {
    if (isMarkdownTransformMode(mode)) {
      return finishReason
        ? `OpenAI ended the response before producing Markdown output (${finishReason}). Original text preserved.`
        : "OpenAI ended the response before producing Markdown output. Original text preserved.";
    }
    return finishReason
      ? `OpenAI ended the response before producing the rewrite (${finishReason}). Original text preserved.`
      : "OpenAI ended the response before producing the rewrite. Original text preserved.";
  }

  if (responseStatus === "failed") {
    return isMarkdownTransformMode(mode)
      ? "OpenAI failed before producing Markdown output. Original text preserved."
      : "OpenAI failed before producing the rewrite. Original text preserved.";
  }

  return isMarkdownTransformMode(mode)
    ? "OpenAI returned empty Markdown output. Original text preserved."
    : "OpenAI returned empty rewrite output. Original text preserved.";
}

export async function streamTransformWithOpenAI({
  apiKey,
  inputText,
  mode,
  model = DEFAULT_OPENAI_MODEL,
  temperature = 0.2,
  streaming = true,
  smartStructuring = true,
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
      ? Math.min(MAX_OUTPUT_TOKENS_CEILING, Math.max(1, Math.round(maxOutputTokensOverride)))
      : getMaxOutputTokens(mode, inputText);
  const modelRequestControls = getModelRequestControls(model, mode);
  const structureIntent = isMarkdownTransformMode(mode)
    ? undefined
    : deriveStructureIntent(inputText, mode, smartStructuring);
  const markdownIntent = isMarkdownTransformMode(mode)
    ? deriveMarkdownIntent(inputText)
    : undefined;
  let currentMaxOutputTokens = maxOutputTokens;
  let includeTemperature = typeof temperature === "number" && Number.isFinite(temperature);
  let retriedForNoTextLengthLimit = false;

  try {
    while (true) {
      let outputText = "";
      let responseSnapshotText = "";
      let responseId: string | undefined;
      let responseStatus: string | undefined;
      let finishReason: string | undefined;
      let truncatedByProvider = false;
      let sawDeltaEvent = false;
      let sawExplicitStreamTermination = false;
      const streamAssembly: StreamAssembly = new Map();

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
            ...modelRequestControls,
            stream: streaming,
            max_output_tokens: currentMaxOutputTokens,
            instructions: buildInstructions(mode, markdownIntent ?? structureIntent),
            input: buildUserInput(mode, inputText),
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

        responseStatus = extractResponseStatus(parsed);
        const finishReasonFromPayload = extractFinishReason(parsed);
        if (finishReasonFromPayload) {
          finishReason = finishReasonFromPayload;
        }

        const outputTextFromPayload = extractFinalOutputText(parsed);
        if (!outputTextFromPayload.trim()) {
          const canRetryForNoTextLengthLimit =
            isLengthTruncationReason(finishReason) &&
            !retriedForNoTextLengthLimit &&
            currentMaxOutputTokens < MAX_OUTPUT_TOKENS_CEILING;
          if (canRetryForNoTextLengthLimit) {
            currentMaxOutputTokens = expandMaxOutputTokens(currentMaxOutputTokens);
            retriedForNoTextLengthLimit = true;
            continue;
          }

          throw new OpenAIProviderError(
            "unknown",
            buildNoTextTerminalMessage(mode, responseStatus, finishReason),
          );
        }

        outputText = outputTextFromPayload;
        if (isLengthTruncationReason(finishReason)) {
          throw new OpenAIProviderError("unknown", buildPartialLengthMessage(mode));
        }
        onDelta(outputTextFromPayload);
        responseId = extractResponseId(parsed);

        return {
          outputText,
          responseId,
          finishReason,
          truncatedByProvider,
          maxOutputTokens: currentMaxOutputTokens,
        };
      }

      await readEventStream(response.body, (event) => {
        if (event.data === "[DONE]") {
          sawExplicitStreamTermination = true;
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

        const nextResponseId = extractResponseId(parsed);
        if (nextResponseId) {
          responseId = nextResponseId;
        }

        const nextResponseStatus = extractResponseStatus(parsed);
        if (nextResponseStatus) {
          responseStatus = nextResponseStatus;
          if (isTerminalResponseStatus(nextResponseStatus)) {
            sawExplicitStreamTermination = true;
          }
        }

        const eventType = extractEventType(parsed);
        if (isTerminalStreamEventType(eventType)) {
          sawExplicitStreamTermination = true;
        }
        const root = asObject(parsed);
        if (root) {
          const outputIndex = asInteger(root.output_index) ?? 0;
          const contentIndex = asInteger(root.content_index) ?? 0;

          if (eventType === "response.output_text.delta" && typeof root.delta === "string") {
            sawDeltaEvent = true;
            outputText += root.delta;
            appendAssemblyPart(
              streamAssembly,
              outputIndex,
              contentIndex,
              "output_text",
              root.delta,
            );
            onDelta(root.delta);
          }

          if (eventType === "response.output_text.done" && typeof root.text === "string") {
            setAssemblyPart(streamAssembly, outputIndex, contentIndex, "output_text", root.text);
          }

          if (eventType === "response.refusal.delta" && typeof root.delta === "string") {
            appendAssemblyPart(streamAssembly, outputIndex, contentIndex, "refusal", root.delta);
          }

          if (eventType === "response.refusal.done") {
            const refusalText = asString(root.refusal) ?? asString(root.text);
            if (refusalText) {
              setAssemblyPart(streamAssembly, outputIndex, contentIndex, "refusal", refusalText);
            }
          }

          if (
            eventType === "response.content_part.added" ||
            eventType === "response.content_part.done"
          ) {
            const extracted = extractTextPart(root.part);
            if (extracted) {
              setAssemblyPart(
                streamAssembly,
                outputIndex,
                contentIndex,
                extracted.kind,
                extracted.text,
              );
            }
          }

          if (
            eventType === "response.output_item.added" ||
            eventType === "response.output_item.done"
          ) {
            ingestOutputItem(streamAssembly, root.item, outputIndex);
          }

          if (eventType === "response.completed") {
            const response = asObject(root.response);
            if (response) {
              ingestOutputArray(streamAssembly, response.output);
            }

            const snapshotText = extractFinalOutputText(parsed);
            if (snapshotText.trim()) {
              responseSnapshotText = snapshotText;
            }
          }
        }

        const eventFinishReason = extractFinishReason(parsed);
        if (eventFinishReason) {
          finishReason = eventFinishReason;
        }
      });

      const assembledOutputText = buildAssemblyText(streamAssembly, "output_text");
      const refusalText = buildAssemblyText(streamAssembly, "refusal");

      if (responseSnapshotText.trim()) {
        const hadRenderedPreview = outputText.length > 0;
        outputText = responseSnapshotText;
        sawDeltaEvent = true;
        if (!hadRenderedPreview) {
          onDelta(responseSnapshotText);
        }
      } else if (assembledOutputText.trim()) {
        const hadRenderedPreview = outputText.length > 0;
        outputText = assembledOutputText;
        sawDeltaEvent = true;
        if (!hadRenderedPreview) {
          onDelta(assembledOutputText);
        }
      } else if (refusalText.trim()) {
        throw new OpenAIProviderError(
          "unknown",
          isMarkdownTransformMode(mode)
            ? `OpenAI refused to format this text as Markdown. ${refusalText}`
            : `OpenAI refused to rewrite this text. ${refusalText}`,
        );
      }

      if (!sawDeltaEvent || !outputText.trim()) {
        const canRetryForNoTextLengthLimit =
          isLengthTruncationReason(finishReason) &&
          !retriedForNoTextLengthLimit &&
          currentMaxOutputTokens < MAX_OUTPUT_TOKENS_CEILING;
        if (canRetryForNoTextLengthLimit) {
          currentMaxOutputTokens = expandMaxOutputTokens(currentMaxOutputTokens);
          retriedForNoTextLengthLimit = true;
          continue;
        }

        throw new OpenAIProviderError(
          "unknown",
          buildNoTextTerminalMessage(mode, responseStatus, finishReason),
        );
      }

      if (isLengthTruncationReason(finishReason)) {
        throw new OpenAIProviderError("unknown", buildPartialLengthMessage(mode));
      }

      if (!sawExplicitStreamTermination) {
        throw new OpenAIProviderError("unknown", buildUnexpectedStreamEndMessage(mode));
      }

      return {
        outputText,
        responseId,
        finishReason,
        truncatedByProvider,
        maxOutputTokens: currentMaxOutputTokens,
      };
    }
  } catch (error) {
    throw parseUnknownProviderError(error);
  } finally {
    window.clearTimeout(timeoutId);
  }
}
