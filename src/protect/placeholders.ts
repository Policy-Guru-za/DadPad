export const PROTECTED_CONTENT_MISMATCH_MESSAGE =
  "Protected content mismatch. Original text preserved.";

const PLACEHOLDER_TOKEN_PREFIX = "__PZPTOK";

type MatchPattern = {
  name: string;
  regex: RegExp;
};

type ProtectedSpan = {
  start: number;
  end: number;
  text: string;
  kind: string;
};

export type PlaceholderMappingEntry = {
  token: string;
  original: string;
  kind: string;
  replacements: number;
};

export type PlaceholderMapping = PlaceholderMappingEntry[];

export type PlaceholderValidation =
  | { ok: true }
  | {
      ok: false;
      error: string;
    };

const MATCH_PATTERNS: MatchPattern[] = [
  {
    name: "markdown_link",
    regex: /\[[^\]\n]+\]\((?:[^()\n]|\([^()\n]*\))*\)/g,
  },
  {
    name: "fenced_code",
    regex: /```[\s\S]*?```/g,
  },
  {
    name: "inline_code",
    regex: /`[^`\n]+`/g,
  },
  {
    name: "url",
    regex: /\bhttps?:\/\/[^\s<>"'`]+/g,
  },
  {
    name: "email",
    regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  },
  {
    name: "phone",
    regex: /(?:\+?\d[\d()\-\s]{7,}\d)/g,
  },
  {
    name: "id",
    regex: /\b(?:\d{6,}|(?=[A-Za-z0-9-]{6,}\b)(?=[A-Za-z0-9-]*[A-Za-z])(?=[A-Za-z0-9-]*\d)[A-Za-z0-9-]+)\b/g,
  },
];

function markConsumed(consumed: boolean[], start: number, end: number): void {
  for (let index = start; index < end; index += 1) {
    consumed[index] = true;
  }
}

function isConsumed(consumed: boolean[], start: number, end: number): boolean {
  for (let index = start; index < end; index += 1) {
    if (consumed[index]) {
      return true;
    }
  }

  return false;
}

function collectProtectedSpans(text: string): ProtectedSpan[] {
  const spans: ProtectedSpan[] = [];
  const consumed = Array.from({ length: text.length }, () => false);

  for (const pattern of MATCH_PATTERNS) {
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    let match = regex.exec(text);

    while (match) {
      const matchedText = match[0];
      const start = match.index;
      const end = start + matchedText.length;

      if (matchedText.length > 0 && !isConsumed(consumed, start, end)) {
        spans.push({
          start,
          end,
          text: matchedText,
          kind: pattern.name,
        });
        markConsumed(consumed, start, end);
      }

      match = regex.exec(text);
    }
  }

  spans.sort((left, right) => left.start - right.start);
  return spans;
}

function toToken(index: number): string {
  return `${PLACEHOLDER_TOKEN_PREFIX}${String(index).padStart(3, "0")}__`;
}

export function encodeProtectedSpans(text: string): {
  encodedText: string;
  mapping: PlaceholderMapping;
} {
  const spans = collectProtectedSpans(text);

  if (spans.length === 0) {
    return {
      encodedText: text,
      mapping: [],
    };
  }

  let cursor = 0;
  let encodedText = "";
  const mapping: PlaceholderMapping = [];

  spans.forEach((span, index) => {
    const token = toToken(index + 1);
    encodedText += text.slice(cursor, span.start);
    encodedText += token;
    cursor = span.end;

    mapping.push({
      token,
      original: span.text,
      kind: span.kind,
      replacements: 0,
    });
  });

  encodedText += text.slice(cursor);

  return {
    encodedText,
    mapping,
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function decodePlaceholders(text: string, mapping: PlaceholderMapping): string {
  let decodedText = text;

  for (const entry of mapping) {
    const tokenRegex = new RegExp(escapeRegExp(entry.token), "g");
    const matches = decodedText.match(tokenRegex);
    entry.replacements = matches?.length ?? 0;

    if (entry.replacements > 0) {
      decodedText = decodedText.replace(tokenRegex, entry.original);
    }
  }

  return decodedText;
}

export function validatePlaceholders(
  _decodedText: string,
  mapping: PlaceholderMapping,
): PlaceholderValidation {
  for (const entry of mapping) {
    if (entry.replacements === 0) {
      return {
        ok: false,
        error: `${PROTECTED_CONTENT_MISMATCH_MESSAGE} Missing or altered token ${entry.token}.`,
      };
    }
  }

  return { ok: true };
}
