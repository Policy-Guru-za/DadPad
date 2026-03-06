export type AgentPromptIntent = {
  hasReferencedFiles: boolean;
  hasUrls: boolean;
  hasCodeBlocks: boolean;
  hasInlineCode: boolean;
  hasExplicitConstraints: boolean;
  hasDeliverableLanguage: boolean;
  hasOpenQuestions: boolean;
  hasAttachmentReferences: boolean;
  hasListStructure: boolean;
};

const FILE_PATH_REGEX =
  /(?:^|[\s(])(?:\/[\w./-]+|(?:[\w.-]+\/)+[\w./-]+(?:\.[A-Za-z0-9_-]+)?)(?=$|[\s),.:;])/m;
const URL_REGEX = /\bhttps?:\/\/\S+/i;
const CODE_FENCE_REGEX = /```[\s\S]*?```/;
const INLINE_CODE_REGEX = /`[^`\n]+`/;
const CONSTRAINT_REGEX =
  /\b(?:must|must not|should|should not|do not|don't|never|only|exactly|without|avoid|required|requirement|constraint|non-negotiable)\b/i;
const DELIVERABLE_REGEX =
  /\b(?:write|draft|prepare|produce|generate|return|output|deliver|email|summary|plan|patch|markdown|prompt|report|analysis|review)\b/i;
const OPEN_QUESTION_REGEX =
  /\?|(?:\b(?:unclear|unsure|open question|unknown|not sure|need to know|missing information)\b)/i;
const ATTACHMENT_REGEX =
  /\b(?:attached|attachment|attached documents?|attached files?|screenshot|screenshots|screen shot|document|documents|see attached)\b/i;
const LIST_REGEX = /^\s*(?:[-*•]|\d+[.)])\s+\S/m;

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n/g, "\n");
}

export function deriveAgentPromptIntent(inputText: string): AgentPromptIntent {
  const normalized = normalizeLineEndings(inputText);

  return {
    hasReferencedFiles: FILE_PATH_REGEX.test(normalized),
    hasUrls: URL_REGEX.test(normalized),
    hasCodeBlocks: CODE_FENCE_REGEX.test(normalized),
    hasInlineCode: INLINE_CODE_REGEX.test(normalized),
    hasExplicitConstraints: CONSTRAINT_REGEX.test(normalized),
    hasDeliverableLanguage: DELIVERABLE_REGEX.test(normalized),
    hasOpenQuestions: OPEN_QUESTION_REGEX.test(normalized),
    hasAttachmentReferences: ATTACHMENT_REGEX.test(normalized),
    hasListStructure: LIST_REGEX.test(normalized),
  };
}

export function normalizePromptMarkdown(outputText: string): string {
  let normalized = normalizeLineEndings(outputText);
  normalized = normalized.replace(/^(?:[ \t]*\n)+/, "");
  normalized = normalized.replace(/(?:\n[ \t]*)+$/, "");
  return normalized;
}
