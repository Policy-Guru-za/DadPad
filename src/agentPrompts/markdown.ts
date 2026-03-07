export type MarkdownIntent = {
  hasExistingParagraphs: boolean;
  hasListStructure: boolean;
  hasReferencedFiles: boolean;
  hasUrls: boolean;
  hasCodeBlocks: boolean;
  hasInlineCode: boolean;
  hasExplicitConstraints: boolean;
  hasDeliverableLanguage: boolean;
  hasOpenQuestions: boolean;
  hasAttachmentReferences: boolean;
  hasSectionCues: boolean;
  hasMultipleActionItems: boolean;
  hasConstraintCluster: boolean;
  hasReferenceCluster: boolean;
  hasExistingMarkdownSyntax: boolean;
  shouldRequireVisibleStructure: boolean;
};

export const MARKDOWN_SCAFFOLD_DRIFT_MESSAGE =
  "Markdown conversion introduced unsupported prompt scaffolding. Original text preserved.";
export const MARKDOWN_INSUFFICIENT_STRUCTURE_MESSAGE =
  "Markdown conversion did not produce visible Markdown structure. Original text preserved.";

const FILE_PATH_REGEX =
  /(?:^|[\s(])(?:\/[\w./-]+|(?:[\w.-]+\/)+[\w./-]+(?:\.[A-Za-z0-9_-]+)?)(?=$|[\s),.:;])/gm;
const URL_REGEX = /\bhttps?:\/\/\S+/gi;
const CODE_FENCE_REGEX = /```[\s\S]*?```/g;
const INLINE_CODE_REGEX = /`[^`\n]+`/g;
const CONSTRAINT_REGEX =
  /\b(?:must|must not|should|should not|do not|don't|never|only|exactly|without|avoid|required|requirement|constraint|non-negotiable|preserve)\b/gi;
const DELIVERABLE_REGEX =
  /\b(?:write|draft|prepare|produce|generate|return|output|deliver|email|summary|plan|patch|markdown|report|analysis|review|commit|update)\b/gi;
const OPEN_QUESTION_REGEX =
  /\?|(?:\b(?:unclear|unsure|open questions?|unknown|not sure|need to know|missing information)\b)/i;
const ATTACHMENT_REGEX =
  /\b(?:attached|attachment|attached files?|attached screenshots?|screenshot|screenshots|screen shot|see attached)\b/gi;
const LIST_REGEX = /^\s*(?:[-*•]|\d+[.)])\s+\S/m;
const PARAGRAPH_REGEX = /\n\s*\n/;
const SECTION_CUE_REGEX = /^\s*(?:#{1,6}\s+\S+|[A-Z][A-Za-z0-9 /_-]{1,40}:)\s*$/m;
const EXISTING_MARKDOWN_SYNTAX_REGEX =
  /^\s*(?:#{1,6}\s+\S|[-*+]\s+\S|\d+[.)]\s+\S|\[[ xX]\]\s+\S|>\s+\S|```)/m;
const ACTION_ITEM_REGEX =
  /\b(?:read|review|inspect|analy(?:s|z)e|compare|identify|update|edit|change|fix|preserve|keep|use|implement|create|add|remove|write|draft|prepare|produce|deliver|return|output|commit|run|test|verify|confirm|check|document|refactor|support|ensure|avoid)\b/gi;
const STEP_CONNECTOR_REGEX =
  /\b(?:first|second|third|next|then|also|finally|after that|with that in mind)\b/gi;
const VISIBLE_MARKDOWN_SYNTAX_REGEX =
  /^\s*(?:#{1,6}\s+\S|[-*+]\s+\S|\d+[.)]\s+\S|\[[ xX]\]\s+\S|>\s+\S|```)/m;
const CONTEXT_SIGNAL_REGEX =
  /\b(?:context|background|overview|situation|current state|why)\b/i;
const REFERENCE_SIGNAL_REGEX =
  /\b(?:reference|references|refer to|docs?|documentation|source material|links?)\b/i;
const VALIDATION_SIGNAL_REGEX =
  /\b(?:validation|validate|verification|verify|check|checks|test|tests|smoke test|acceptance criteria|success criteria)\b/i;

type ScaffoldMarker = {
  output: RegExp;
  sourceEquivalent: RegExp;
};

type GroundedHeadingRule = {
  label: string;
  output: RegExp;
  sourceEquivalent: RegExp;
  isGrounded: (sourceText: string, semanticSourceText: string, intent: MarkdownIntent) => boolean;
};

const UNSUPPORTED_SCAFFOLD_HEADINGS = [
  "Objective",
  "Inputs and References",
  "Success Criteria",
  "Open Questions",
  "Repository Context",
  "Requested Changes",
  "Acceptance Criteria",
  "Notes",
  "Expected Output",
] as const;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildHeadingLabelPattern(label: string): string {
  return label
    .trim()
    .split(/\s+/)
    .map((part) => escapeRegex(part))
    .join("\\s+");
}

function createFixedHeadingMarker(label: string): ScaffoldMarker {
  const labelPattern = buildHeadingLabelPattern(label);

  return {
    output: new RegExp(`^\\s*#{1,6}\\s*${labelPattern}(?:\\s*[:\\-]\\s*.*)?\\s*$`, "im"),
    sourceEquivalent: new RegExp(
      `^\\s*(?:#{1,6}\\s*)?${labelPattern}(?:\\s*[:\\-]\\s*.*)?\\s*$`,
      "im",
    ),
  };
}

function createGroundedHeadingRule(
  label: string,
  isGrounded: GroundedHeadingRule["isGrounded"],
): GroundedHeadingRule {
  const marker = createFixedHeadingMarker(label);

  return {
    label,
    output: marker.output,
    sourceEquivalent: marker.sourceEquivalent,
    isGrounded,
  };
}

const UNSUPPORTED_SCAFFOLD_MARKERS: ScaffoldMarker[] = [
  {
    output: /convert the (?:provided )?source material/i,
    sourceEquivalent: /convert the (?:provided )?source material/i,
  },
  {
    output: /^preset:/im,
    sourceEquivalent: /^preset:/im,
  },
  {
    output: /^(?:here(?:'s| is)|below is) the markdown version\b/im,
    sourceEquivalent: /^(?:here(?:'s| is)|below is) the markdown version\b/im,
  },
  ...UNSUPPORTED_SCAFFOLD_HEADINGS.map((heading) => createFixedHeadingMarker(heading)),
];

const GROUNDED_NEUTRAL_HEADING_RULES: GroundedHeadingRule[] = [
  createGroundedHeadingRule(
    "Task",
    (_sourceText, semanticSourceText, intent) =>
      intent.hasMultipleActionItems ||
      intent.hasDeliverableLanguage ||
      countMatches(ACTION_ITEM_REGEX, semanticSourceText) > 0,
  ),
  createGroundedHeadingRule(
    "Context",
    (_sourceText, semanticSourceText, intent) =>
      intent.hasExistingParagraphs ||
      countWords(semanticSourceText) >= 20 ||
      containsPattern(CONTEXT_SIGNAL_REGEX, semanticSourceText),
  ),
  createGroundedHeadingRule(
    "References",
    (_sourceText, semanticSourceText, intent) =>
      intent.hasReferenceCluster ||
      intent.hasReferencedFiles ||
      intent.hasUrls ||
      intent.hasAttachmentReferences ||
      intent.hasCodeBlocks ||
      intent.hasInlineCode ||
      containsPattern(REFERENCE_SIGNAL_REGEX, semanticSourceText),
  ),
  createGroundedHeadingRule("Files", (_sourceText, _semanticSourceText, intent) => intent.hasReferencedFiles),
  createGroundedHeadingRule(
    "Requirements",
    (_sourceText, semanticSourceText, intent) =>
      intent.hasConstraintCluster || containsPattern(/\brequirements?\b/i, semanticSourceText),
  ),
  createGroundedHeadingRule(
    "Constraints",
    (_sourceText, _semanticSourceText, intent) => intent.hasExplicitConstraints,
  ),
  createGroundedHeadingRule(
    "Deliverable",
    (_sourceText, semanticSourceText, intent) =>
      intent.hasDeliverableLanguage || containsPattern(/\bdeliverables?\b/i, semanticSourceText),
  ),
  createGroundedHeadingRule("Questions", (_sourceText, _semanticSourceText, intent) => intent.hasOpenQuestions),
  createGroundedHeadingRule(
    "Validation",
    (_sourceText, semanticSourceText) => containsPattern(VALIDATION_SIGNAL_REGEX, semanticSourceText),
  ),
];

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n/g, "\n");
}

function containsPattern(regex: RegExp, value: string): boolean {
  return new RegExp(regex.source, regex.flags).test(value);
}

function stripUrls(value: string): string {
  return value.replace(new RegExp(URL_REGEX.source, URL_REGEX.flags), " ");
}

function countWords(value: string): number {
  const trimmed = value.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function countMatches(regex: RegExp, value: string): number {
  return Array.from(value.matchAll(new RegExp(regex.source, regex.flags))).length;
}

function collapseExteriorBlankLinesPreservingFences(value: string): string {
  const lines = value.split("\n");
  const output: string[] = [];
  let insideFence = false;
  let blankRun = 0;

  for (const rawLine of lines) {
    const trimmedRaw = rawLine.trim();
    const isFenceLine = /^```/.test(trimmedRaw);
    const line =
      insideFence || isFenceLine
        ? rawLine
        : rawLine.replace(/[ \t]+$/g, (match) => (match.length >= 2 ? match : ""));
    const trimmed = line.trim();

    if (isFenceLine) {
      if (!insideFence && blankRun > 0) {
        output.push("");
        blankRun = 0;
      }

      output.push(line);
      insideFence = !insideFence;
      continue;
    }

    if (!insideFence && trimmed.length === 0) {
      blankRun += 1;
      continue;
    }

    if (!insideFence && blankRun > 0) {
      output.push("");
      blankRun = 0;
    }

    output.push(line);
  }

  return output.join("\n");
}

function normalizeForSimilarity(value: string): string {
  return normalizeLineEndings(value)
    .toLowerCase()
    .replace(/[`*_~>#-]+/g, " ")
    .replace(/[^\p{L}\p{N}\s./:_-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toBigrams(value: string): string[] {
  if (value.length < 2) {
    return value.length === 0 ? [] : [value];
  }

  const bigrams: string[] = [];
  for (let index = 0; index < value.length - 1; index += 1) {
    bigrams.push(value.slice(index, index + 2));
  }

  return bigrams;
}

function calculateDiceSimilarity(left: string, right: string): number {
  if (left === right) {
    return 1;
  }

  if (!left || !right) {
    return 0;
  }

  const leftBigrams = toBigrams(left);
  const rightBigrams = toBigrams(right);
  const rightCounts = new Map<string, number>();

  for (const bigram of rightBigrams) {
    rightCounts.set(bigram, (rightCounts.get(bigram) ?? 0) + 1);
  }

  let intersection = 0;
  for (const bigram of leftBigrams) {
    const count = rightCounts.get(bigram) ?? 0;
    if (count > 0) {
      intersection += 1;
      rightCounts.set(bigram, count - 1);
    }
  }

  return (2 * intersection) / (leftBigrams.length + rightBigrams.length);
}

export function hasVisibleMarkdownSyntax(value: string): boolean {
  return VISIBLE_MARKDOWN_SYNTAX_REGEX.test(normalizeLineEndings(value));
}

export function deriveMarkdownIntent(inputText: string): MarkdownIntent {
  const normalized = normalizeLineEndings(inputText);
  const semanticNormalized = stripUrls(normalized);
  const actionItemCount = countMatches(ACTION_ITEM_REGEX, semanticNormalized);
  const constraintCount = countMatches(CONSTRAINT_REGEX, semanticNormalized);
  const referenceSignalCount = [
    countMatches(FILE_PATH_REGEX, normalized) > 0,
    countMatches(URL_REGEX, normalized) > 0,
    countMatches(CODE_FENCE_REGEX, normalized) > 0,
    countMatches(INLINE_CODE_REGEX, normalized) > 0,
    countMatches(ATTACHMENT_REGEX, normalized) > 0,
  ].filter(Boolean).length;
  const hasExistingParagraphs = PARAGRAPH_REGEX.test(normalized);
  const hasListStructure = LIST_REGEX.test(normalized);
  const hasReferencedFiles = countMatches(FILE_PATH_REGEX, normalized) > 0;
  const hasUrls = countMatches(URL_REGEX, normalized) > 0;
  const hasCodeBlocks = countMatches(CODE_FENCE_REGEX, normalized) > 0;
  const hasInlineCode = countMatches(INLINE_CODE_REGEX, normalized) > 0;
  const hasExplicitConstraints = constraintCount > 0;
  const hasDeliverableLanguage = countMatches(DELIVERABLE_REGEX, semanticNormalized) > 0;
  const hasOpenQuestions = containsPattern(OPEN_QUESTION_REGEX, semanticNormalized);
  const hasAttachmentReferences = countMatches(ATTACHMENT_REGEX, normalized) > 0;
  const hasSectionCues = SECTION_CUE_REGEX.test(normalized);
  const hasExistingMarkdownSyntax = EXISTING_MARKDOWN_SYNTAX_REGEX.test(normalized);
  const hasMultipleActionItems =
    actionItemCount >= 2 ||
    countMatches(STEP_CONNECTOR_REGEX, semanticNormalized) >= 2 ||
    (countMatches(STEP_CONNECTOR_REGEX, semanticNormalized) >= 1 && actionItemCount >= 1);
  const hasConstraintCluster = constraintCount >= 2;
  const hasReferenceCluster = referenceSignalCount >= 2;
  const wordCount = countWords(normalized);
  const isVeryShortSimpleInstruction =
    wordCount <= 18 &&
    !hasExistingParagraphs &&
    !hasListStructure &&
    !hasSectionCues &&
    !hasMultipleActionItems &&
    !hasConstraintCluster &&
    !hasReferenceCluster &&
    !hasOpenQuestions;
  const complexityScore = [
    hasExistingParagraphs,
    hasMultipleActionItems,
    hasConstraintCluster,
    hasReferenceCluster,
    hasDeliverableLanguage,
    hasOpenQuestions,
    normalized.length > 220,
  ].filter(Boolean).length;
  const shouldRequireVisibleStructure =
    hasExistingMarkdownSyntax || (!isVeryShortSimpleInstruction && complexityScore >= 2);

  return {
    hasExistingParagraphs,
    hasListStructure,
    hasReferencedFiles,
    hasUrls,
    hasCodeBlocks,
    hasInlineCode,
    hasExplicitConstraints,
    hasDeliverableLanguage,
    hasOpenQuestions,
    hasAttachmentReferences,
    hasSectionCues,
    hasMultipleActionItems,
    hasConstraintCluster,
    hasReferenceCluster,
    hasExistingMarkdownSyntax,
    shouldRequireVisibleStructure,
  };
}

export function normalizePromptMarkdown(outputText: string): string {
  let normalized = normalizeLineEndings(outputText);
  normalized = normalized.replace(/^(?:[ \t]*\n)+/, "");
  normalized = normalized.replace(/(?:\n[ \t]*)+$/, "");
  return collapseExteriorBlankLinesPreservingFences(normalized);
}

export function detectUnsupportedMarkdownScaffolding(
  sourceText: string,
  outputText: string,
): string[] {
  const normalizedSource = normalizeLineEndings(sourceText);
  const semanticSource = stripUrls(normalizedSource);
  const normalizedOutput = normalizeLineEndings(outputText);
  const findings: string[] = [];
  const intent = deriveMarkdownIntent(sourceText);

  for (const marker of UNSUPPORTED_SCAFFOLD_MARKERS) {
    if (!containsPattern(marker.output, normalizedOutput)) {
      continue;
    }

    if (!containsPattern(marker.sourceEquivalent, normalizedSource)) {
      findings.push(marker.output.source);
    }
  }

  for (const rule of GROUNDED_NEUTRAL_HEADING_RULES) {
    if (!containsPattern(rule.output, normalizedOutput)) {
      continue;
    }

    if (containsPattern(rule.sourceEquivalent, normalizedSource)) {
      continue;
    }

    if (!rule.isGrounded(normalizedSource, semanticSource, intent)) {
      findings.push(`ungrounded-heading:${rule.label.toLowerCase()}`);
    }
  }

  return findings;
}

export function detectInsufficientMarkdownization(
  sourceText: string,
  outputText: string,
  intent: MarkdownIntent,
): boolean {
  if (hasVisibleMarkdownSyntax(outputText)) {
    return false;
  }

  if (intent.hasExistingMarkdownSyntax) {
    return true;
  }

  if (!intent.shouldRequireVisibleStructure) {
    return false;
  }

  const normalizedSource = normalizeForSimilarity(sourceText);
  const normalizedOutput = normalizeForSimilarity(outputText);
  const similarity = calculateDiceSimilarity(normalizedSource, normalizedOutput);

  return similarity >= 0.82;
}
