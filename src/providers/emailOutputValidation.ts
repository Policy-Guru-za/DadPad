export const EMAIL_OUTPUT_VALIDATION_MESSAGE =
  "Email polish added content beyond structure-only rules. Original text restored.";

const SUBJECT_LINE_REGEX = /^\s*subject\s*:/im;
const BULLET_LINE_REGEX = /^\s*(?:[-*•]|\d+[.)])\s+\S/m;
const INVENTED_CONTENT_PATTERNS = [
  {
    outputPattern: /^\s*(?:dear|hi|hello|hey)\b[^\n]*$/im,
    sourcePattern: /^\s*(?:dear|hi|hello|hey)\b/im,
    label: "invented greeting",
  },
  {
    outputPattern:
      /^\s*(?:kind regards|best regards|regards|many thanks|thanks|thank you|sincerely|yours sincerely|yours faithfully|best)\b[^\n]*$/im,
    sourcePattern:
      /\b(?:kind regards|best regards|regards|many thanks|thanks|thank you|sincerely|yours sincerely|yours faithfully|best)\b/i,
    label: "invented sign-off",
  },
  {
    outputPattern: /\bi hope (?:you'?re|you are) well\b/i,
    sourcePattern: /\bi hope (?:you'?re|you are) well\b/i,
    label: "invented courtesy opener",
  },
  {
    outputPattern: /\bplease let me know if you have any questions\b/i,
    sourcePattern: /\bplease let me know if you have any questions\b/i,
    label: "invented closing filler",
  },
  {
    outputPattern: /^\s*(?:summary|discussion|recommendations?|next steps?|action items?)\s*:/im,
    sourcePattern: /^\s*(?:summary|discussion|recommendations?|next steps?|action items?)\s*:/im,
    label: "invented heading",
  },
] as const;

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "from",
  "had",
  "has",
  "have",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "of",
  "on",
  "or",
  "our",
  "that",
  "the",
  "their",
  "them",
  "there",
  "they",
  "this",
  "to",
  "us",
  "was",
  "we",
  "were",
  "will",
  "with",
  "you",
  "your",
]);

export type EmailOutputValidationResult =
  | { ok: true }
  | { ok: false; error: string };

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n/g, "\n");
}

function countSentenceLikeSegments(value: string): number {
  const matches = value.match(/[^.!?\n]+[.!?]?/g);
  if (!matches) {
    return 0;
  }

  return matches.map((segment) => segment.trim()).filter(Boolean).length;
}

function normalizeWord(word: string): string {
  return word.replace(/[’]/g, "'").toLowerCase().replace(/^'+|'+$/g, "");
}

function collectSignificantWords(value: string): string[] {
  const matches = value.match(/[\p{L}\p{N}']+/gu) ?? [];
  return matches
    .map((match) => normalizeWord(match))
    .filter((word) => word.length >= 4)
    .filter((word) => !STOP_WORDS.has(word))
    .filter((word) => !/^\d+$/.test(word));
}

function toSignificantCharacterCount(value: string): number {
  return value.replace(/[^\p{L}\p{N}]/gu, "").length;
}

function levenshteinWithinLimit(left: string, right: string, limit: number): boolean {
  if (Math.abs(left.length - right.length) > limit) {
    return false;
  }

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = new Array<number>(right.length + 1).fill(0);

  for (let row = 1; row <= left.length; row += 1) {
    current[0] = row;
    let rowMin = current[0];

    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      current[column] = Math.min(
        previous[column] + 1,
        current[column - 1] + 1,
        previous[column - 1] + cost,
      );
      rowMin = Math.min(rowMin, current[column]);
    }

    if (rowMin > limit) {
      return false;
    }

    for (let column = 0; column <= right.length; column += 1) {
      previous[column] = current[column];
    }
  }

  return previous[right.length] <= limit;
}

function buildInputWordBuckets(inputWords: Iterable<string>): Map<number, string[]> {
  const buckets = new Map<number, string[]>();

  for (const word of inputWords) {
    const bucket = buckets.get(word.length) ?? [];
    bucket.push(word);
    buckets.set(word.length, bucket);
  }

  return buckets;
}

function isLikelyCorrection(word: string, inputBuckets: Map<number, string[]>): boolean {
  for (let length = word.length - 2; length <= word.length + 2; length += 1) {
    const bucket = inputBuckets.get(length);
    if (!bucket) {
      continue;
    }

    if (bucket.some((candidate) => levenshteinWithinLimit(word, candidate, 2))) {
      return true;
    }
  }

  return false;
}

function buildValidationError(reason: string): EmailOutputValidationResult {
  return {
    ok: false,
    error: `${EMAIL_OUTPUT_VALIDATION_MESSAGE} ${reason}`,
  };
}

export function validateEmailOutput(
  inputText: string,
  outputText: string,
): EmailOutputValidationResult {
  const normalizedInput = normalizeLineEndings(inputText).trim();
  const normalizedOutput = normalizeLineEndings(outputText).trim();

  if (!normalizedOutput) {
    return buildValidationError("The formatter returned empty text.");
  }

  if (!SUBJECT_LINE_REGEX.test(normalizedInput) && SUBJECT_LINE_REGEX.test(normalizedOutput)) {
    return buildValidationError("An invented subject line was detected.");
  }

  if (!BULLET_LINE_REGEX.test(normalizedInput) && BULLET_LINE_REGEX.test(normalizedOutput)) {
    return buildValidationError("Bullets were introduced even though the source was prose.");
  }

  for (const { outputPattern, sourcePattern, label } of INVENTED_CONTENT_PATTERNS) {
    if (!sourcePattern.test(normalizedInput) && outputPattern.test(normalizedOutput)) {
      return buildValidationError(`${label} was detected.`);
    }
  }

  const inputSentenceCount = countSentenceLikeSegments(normalizedInput);
  const outputSentenceCount = countSentenceLikeSegments(normalizedOutput);
  const allowedSentenceIncrease = Math.max(2, Math.ceil(inputSentenceCount * 0.5));
  if (
    /[.!?]/.test(normalizedInput) &&
    inputSentenceCount > 0 &&
    outputSentenceCount > inputSentenceCount + allowedSentenceIncrease
  ) {
    return buildValidationError("Too many new sentence boundaries were introduced.");
  }

  const inputCharacterCount = toSignificantCharacterCount(normalizedInput);
  const outputCharacterCount = toSignificantCharacterCount(normalizedOutput);
  if (outputCharacterCount > inputCharacterCount * 1.35 + 24) {
    return buildValidationError("The formatter expanded the message too much.");
  }

  const inputWords = new Set(collectSignificantWords(normalizedInput));
  const outputWords = Array.from(new Set(collectSignificantWords(normalizedOutput)));
  const inputBuckets = buildInputWordBuckets(inputWords);
  const addedWords = outputWords.filter(
    (word) => !inputWords.has(word) && !isLikelyCorrection(word, inputBuckets),
  );
  const allowedAddedWords = Math.max(4, Math.ceil(inputWords.size * 0.15));

  if (addedWords.length > allowedAddedWords) {
    return buildValidationError(
      `Too many new content words were introduced (${addedWords.slice(0, 6).join(", ")}).`,
    );
  }

  return { ok: true };
}
