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
};

export const MARKDOWN_SCAFFOLD_DRIFT_MESSAGE =
  "Markdown conversion introduced unsupported prompt scaffolding. Original text preserved.";

const FILE_PATH_REGEX =
  /(?:^|[\s(])(?:\/[\w./-]+|(?:[\w.-]+\/)+[\w./-]+(?:\.[A-Za-z0-9_-]+)?)(?=$|[\s),.:;])/m;
const URL_REGEX = /\bhttps?:\/\/\S+/i;
const CODE_FENCE_REGEX = /```[\s\S]*?```/;
const INLINE_CODE_REGEX = /`[^`\n]+`/;
const CONSTRAINT_REGEX =
  /\b(?:must|must not|should|should not|do not|don't|never|only|exactly|without|avoid|required|requirement|constraint|non-negotiable)\b/i;
const DELIVERABLE_REGEX =
  /\b(?:write|draft|prepare|produce|generate|return|output|deliver|email|summary|plan|patch|markdown|report|analysis|review|commit|update)\b/i;
const OPEN_QUESTION_REGEX =
  /\?|(?:\b(?:unclear|unsure|open question|unknown|not sure|need to know|missing information)\b)/i;
const ATTACHMENT_REGEX =
  /\b(?:attached|attachment|attached files?|attached screenshots?|screenshot|screenshots|screen shot|see attached)\b/i;
const LIST_REGEX = /^\s*(?:[-*•]|\d+[.)])\s+\S/m;
const PARAGRAPH_REGEX = /\n\s*\n/;
const SECTION_CUE_REGEX = /^\s*(?:#{1,6}\s+\S+|[A-Z][A-Za-z0-9 /_-]{1,40}:)\s*$/m;

type ScaffoldMarker = {
  output: RegExp;
  sourceEquivalent: RegExp;
};

const FIXED_SCAFFOLD_HEADINGS = [
  "Objective",
  "Context",
  "Inputs and References",
  "Constraints",
  "Deliverable",
  "Success Criteria",
  "Open Questions",
  "Repository Context",
  "Requested Changes",
  "Acceptance Criteria",
  "Notes",
  "Requirements",
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
  ...FIXED_SCAFFOLD_HEADINGS.map((heading) => createFixedHeadingMarker(heading)),
];

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n/g, "\n");
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

export function deriveMarkdownIntent(inputText: string): MarkdownIntent {
  const normalized = normalizeLineEndings(inputText);

  return {
    hasExistingParagraphs: PARAGRAPH_REGEX.test(normalized),
    hasListStructure: LIST_REGEX.test(normalized),
    hasReferencedFiles: FILE_PATH_REGEX.test(normalized),
    hasUrls: URL_REGEX.test(normalized),
    hasCodeBlocks: CODE_FENCE_REGEX.test(normalized),
    hasInlineCode: INLINE_CODE_REGEX.test(normalized),
    hasExplicitConstraints: CONSTRAINT_REGEX.test(normalized),
    hasDeliverableLanguage: DELIVERABLE_REGEX.test(normalized),
    hasOpenQuestions: OPEN_QUESTION_REGEX.test(normalized),
    hasAttachmentReferences: ATTACHMENT_REGEX.test(normalized),
    hasSectionCues: SECTION_CUE_REGEX.test(normalized),
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
  const normalizedOutput = normalizeLineEndings(outputText);
  const findings: string[] = [];

  for (const marker of UNSUPPORTED_SCAFFOLD_MARKERS) {
    if (!marker.output.test(normalizedOutput)) {
      continue;
    }

    if (!marker.sourceEquivalent.test(normalizedSource)) {
      findings.push(marker.output.source);
    }
  }

  return findings;
}
