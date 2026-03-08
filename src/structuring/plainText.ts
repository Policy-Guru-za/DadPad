import type { OpenAITransformMode } from "../providers/openaiPrompting";

export type StructureTargetShape = "paragraphs" | "bullets" | "hybrid";
export type StructureContentType = "message" | "email" | "note" | "mixed";

export type StructureIntent = {
  enabled: boolean;
  targetShape: StructureTargetShape;
  isolateRequest: boolean;
  isolateClosing: boolean;
  preserveExistingLists: boolean;
  preserveExistingParagraphs: boolean;
  inferredContentType: StructureContentType;
};

const BULLET_LINE_REGEX = /^\s*(?:[-*•]|\d+[.)])\s+\S/m;
const BLANK_LINE_REGEX = /\n\s*\n/;
const GREETING_REGEX = /^\s*(?:hi|hello|hey|dear)\b/im;
const SIGN_OFF_REGEX =
  /\b(?:best|best regards|kind regards|regards|sincerely|thank you|thanks),?\s*$/im;
const REQUEST_REGEX =
  /\b(?:can you|could you|would you|please|need you to|send|share|provide|review|confirm|approve|reply|respond|let me know|tell me|update|outline|schedule|move)\b/gi;
const CLOSING_REGEX =
  /\b(?:thank you|thanks|appreciate it|appreciated|look forward|hope this|let me know if you have any questions)\b/i;
const MULTI_ITEM_REQUEST_REGEX =
  /\b(?:send|share|provide|review|confirm|approve|reply|respond|update|outline|schedule|move|let me know|tell me)\b.*(?:,\s*|\band\b|\bor\b).*\b(?:send|share|provide|review|confirm|approve|reply|respond|update|outline|schedule|move|let me know|tell me)\b/i;
const EXPLICIT_LIST_SHAPE_REGEX =
  /\b(?:one|two|three|four|five|six|\d+)\s+(?:things|items|steps|options|issues|dates|reasons)\b|:\s*(?:the|a|an|\w+)/i;

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n/g, "\n");
}

function isStructuredListRemainder(marker: string, remainder: string): boolean {
  const content = remainder.trimStart();
  if (!content) {
    return false;
  }

  const firstChar = content[0] ?? "";
  if (marker === "-" || marker === "*" || marker === "•") {
    return firstChar !== "-" && firstChar !== "*" && firstChar !== "•" && firstChar !== "." && !/\d/.test(firstChar);
  }

  return firstChar !== "." && !/\d/.test(firstChar);
}

function splitListMarker(line: string): {
  indentation: string;
  marker: string;
  remainder: string;
} | null {
  const match = line.match(/^(\s*)([-*•]|\d+[.)])(.*)$/);
  if (!match) {
    return null;
  }

  const [, indentation, marker, remainder] = match;
  return {
    indentation,
    marker,
    remainder,
  };
}

function normalizeListMarkerSpacing(line: string): string {
  const parts = splitListMarker(line);
  if (!parts || !isStructuredListRemainder(parts.marker, parts.remainder)) {
    return line;
  }

  return `${parts.indentation}${parts.marker} ${parts.remainder.trimStart()}`;
}

export function isStructuredListItemLine(line: string): boolean {
  const parts = splitListMarker(line);
  return parts !== null && isStructuredListRemainder(parts.marker, parts.remainder);
}

function countSentenceLikeSegments(value: string): number {
  const matches = value.match(/[^.!?\n]+[.!?]?/g);
  if (!matches) {
    return 0;
  }

  return matches.map((segment) => segment.trim()).filter(Boolean).length;
}

function countRequestSignals(value: string): number {
  const matches = value.match(REQUEST_REGEX);
  return matches?.length ?? 0;
}

function inferContentType(value: string, preserveExistingLists: boolean): StructureContentType {
  if ((GREETING_REGEX.test(value) || SIGN_OFF_REGEX.test(value)) && preserveExistingLists) {
    return "mixed";
  }

  if (GREETING_REGEX.test(value) || SIGN_OFF_REGEX.test(value)) {
    return "email";
  }

  if (preserveExistingLists && BLANK_LINE_REGEX.test(value)) {
    return "mixed";
  }

  if (preserveExistingLists) {
    return "note";
  }

  return value.length >= 220 ? "message" : "note";
}

function inferTargetShape(
  value: string,
  mode: OpenAITransformMode,
  preserveExistingLists: boolean,
): StructureTargetShape {
  const sentenceCount = countSentenceLikeSegments(value);
  const hasIntentionalParagraphs = BLANK_LINE_REGEX.test(value);
  const denseSingleBlock = !hasIntentionalParagraphs && value.length >= 180 && sentenceCount >= 2;
  const hasMultipleRequests = MULTI_ITEM_REQUEST_REGEX.test(value);
  const hasExplicitListShape = EXPLICIT_LIST_SHAPE_REGEX.test(value);

  if (preserveExistingLists) {
    return hasIntentionalParagraphs ? "hybrid" : "bullets";
  }

  if (hasExplicitListShape) {
    return mode === "direct" || mode === "professional" ? "bullets" : "hybrid";
  }

  if (hasMultipleRequests) {
    if (denseSingleBlock && value.length >= 260) {
      return "paragraphs";
    }

    if (mode === "polish" || mode === "casual") {
      return "paragraphs";
    }

    if (denseSingleBlock || sentenceCount >= 3) {
      return "hybrid";
    }

    return mode === "direct" || mode === "professional" ? "bullets" : "paragraphs";
  }

  if (denseSingleBlock || hasIntentionalParagraphs || sentenceCount >= 3) {
    return "paragraphs";
  }

  return "paragraphs";
}

export function deriveStructureIntent(
  inputText: string,
  mode: OpenAITransformMode,
  enabled = true,
): StructureIntent {
  if (!enabled) {
    return {
      enabled: false,
      targetShape: "paragraphs",
      isolateRequest: false,
      isolateClosing: false,
      preserveExistingLists: false,
      preserveExistingParagraphs: false,
      inferredContentType: "message",
    };
  }

  const normalized = normalizeLineEndings(inputText);
  const preserveExistingLists = BULLET_LINE_REGEX.test(normalized);
  const preserveExistingParagraphs = BLANK_LINE_REGEX.test(normalized);
  const tail = normalized.slice(Math.max(0, normalized.length - 220));
  const isolateRequest = countRequestSignals(normalized) >= 1;
  const isolateClosing = CLOSING_REGEX.test(tail);

  return {
    enabled: true,
    targetShape: inferTargetShape(normalized, mode, preserveExistingLists),
    isolateRequest,
    isolateClosing,
    preserveExistingLists,
    preserveExistingParagraphs,
    inferredContentType: inferContentType(normalized, preserveExistingLists),
  };
}

export function normalizeStructuredPlainText(outputText: string): string {
  let normalized = normalizeLineEndings(outputText).replace(/[ \t]+$/gm, "");
  normalized = normalized.replace(/^(?:[ \t]*\n)+/, "");
  normalized = normalized.replace(/(?:\n[ \t]*)+$/, "");
  normalized = normalized.replace(/\n(?:[ \t]*\n){2,}/g, "\n\n");
  normalized = normalized
    .split("\n")
    .map((line) => normalizeListMarkerSpacing(line))
    .join("\n");
  return normalized;
}
