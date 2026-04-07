import type { MarkdownIntent } from "../agentPrompts/markdown";
import type { StructureIntent } from "../structuring/plainText";

export const DEFAULT_OPENAI_MODEL = "gpt-5-nano-2025-08-07";

export type RewriteTransformMode = "polish" | "casual" | "professional" | "direct";
export type MarkdownPreset = "universal" | "codex" | "claude";
export type MarkdownTransformMode = `agent-${MarkdownPreset}`;
export type OpenAITransformMode = RewriteTransformMode | MarkdownTransformMode;

type TextVerbosity = "low" | "medium";

export type ModePromptSpec = {
  label: string;
  styleRules: string[];
  structureRules: string[];
  textVerbosity: TextVerbosity;
};

export type MarkdownPresetSpec = {
  textVerbosity: TextVerbosity;
  styleRules: string[];
};

const REWRITE_PROMPT_INTRO =
  "You are a rewriting engine. Rewrite the user's text according to the requested mode.";

const MARKDOWN_PROMPT_INTRO =
  "You convert the user's existing text into visibly structured Markdown for use with AI coding agents.";

const REWRITE_USER_WRAPPER_PREFIX = `Rewrite the text below.

[BEGIN TEXT]
`;

const REWRITE_USER_WRAPPER_SUFFIX = `
[END TEXT]`;

const MARKDOWN_USER_WRAPPER_PREFIX =
  "Format the following text as clean Markdown. Preserve the original wording and intent as closely as possible.\n\n[BEGIN TEXT]\n";

const MARKDOWN_USER_WRAPPER_SUFFIX = `
[END TEXT]`;

const BASE_CONSTRAINTS = [
  "Preserve the original meaning, facts, and intent. Do not invent new information.",
  "Preserve the original language of the input. Do not translate unless the input explicitly asks for translation.",
  "Keep the approximate length unless the mode explicitly asks for brevity. Light tightening is allowed; modest lengthening is allowed if it improves clarity and flow.",
  "Preserve exactly (character-for-character) any: names, numbers, dates, times, currency amounts, percentages, addresses, URLs, email addresses, phone numbers, order/reference IDs, and quoted text.",
  "Fix grammar, spelling, punctuation, and sentence boundaries.",
  'Remove obvious filler words (e.g., "um", "uh", "like", "you know") and unintentional verbatim repetition.',
  "Homophones / wrong-word fixes: only change a word if the intended meaning is highly confident from context. If uncertain, leave it unchanged.",
  "Do not alter placeholders of the form __PZPTOK###__.",
  'Do not add greetings, sign-offs, signatures, subject lines, placeholder names like "[Your Name]", or extra calls to action unless they already exist in the input.',
  "Output only the rewritten text. No preamble, no labels, no explanations.",
];

const BASE_STRUCTURE_RULES = [
  "Keep the output as plain text.",
  "Prefer single blank lines between paragraphs.",
  "Prefer 2 to 4 compact paragraphs instead of one dense block when the content contains multiple ideas.",
  "Keep one idea per paragraph when possible: context/background, main request, next step/outcome, closing sentiment.",
  "If there is a clear ask, isolate it in its own paragraph unless the message is extremely short.",
  "If there is a closing sentiment, keep it separate from the operational request.",
  "Use bullets only when the message naturally contains multiple requests, deliverables, steps, options, or agenda items.",
  "Default bullet format is '- '. Use numbered items only when sequence matters or the source already implies sequence.",
  "Do not return one long block when the content clearly contains separate ideas.",
  "Do not over-format short or already clear messages.",
  "Do not introduce headings, labels, subject lines, greetings, sign-offs, signatures, or placeholder names just to organize the text.",
  "Do not flatten existing readable lists into prose unless that is clearly better.",
];

const MARKDOWN_BASE_CONSTRAINTS = [
  "Convert the current text into visibly structured Markdown for an AI coding agent.",
  "Preserve the original wording, intent, order, commitments, and imperative voice as closely as possible.",
  "Do not summarize the source or restate it as a meta-task.",
  "Do not describe the conversion task or address the user about the source material.",
  'Do not add wrapper text or prefatory lines like "Convert the provided source material..." or "Here is the Markdown version."',
  "Do not add fixed scaffold headings like `## Objective`, `## Repository Context`, `## Requested Changes`, `## Acceptance Criteria`, `## Notes`, or `## Expected Output` unless equivalent structure is already clearly present in the source.",
  "Preserve quoted text, URLs, paths, code, IDs, numbers, dates, and explicit constraints exactly.",
  "If the source references attachments, screenshots, or documents you have not seen, keep them only as referenced inputs; do not infer their contents.",
  "For dense prose with multiple tasks, constraints, references, deliverables, or questions, do not return plain prose only. Introduce visible Markdown structure.",
  "Prefer headings, bullets, numbered steps, checklists, blockquotes, or fenced code blocks when they make the content easier to scan.",
  "If headings help, only use grounded neutral headings from this set: `## Task`, `## Context`, `## References`, `## Files`, `## Requirements`, `## Constraints`, `## Deliverable`, `## Questions`, `## Validation`.",
  "Do not emit empty sections.",
  "Output only Markdown. No extra prose before or after.",
  "Do not alter placeholders of the form __PZPTOK###__.",
];

export const MODE_PROMPT_SPECS: Record<RewriteTransformMode, ModePromptSpec> = {
  polish: {
    label: "REFINE",
    textVerbosity: "medium",
    styleRules: [
      "Rewrite into a clear, elegant, well-structured version suitable for general professional communication.",
      "Actively improve sentence structure and paragraph flow.",
      "It should read like a competent human wrote it carefully, not like a transcript, chat message, or template.",
      "Preserve the writer's natural level of formality, directness, warmth, and personality.",
      "Make this sound like the same person, just clearer and cleaner.",
      "Do not professionalize casual writing unless the input already sounds formal.",
      "Do not make it sound corporate, elegant, templated, assistant-like, or overly polished.",
      "Preserve the original level of assertiveness.",
      "Keep the tone neutral and polished, not especially chatty, corporate, or terse.",
      "Avoid formulaic workplace-email wording when a neutral polished phrasing will do.",
      'Avoid business-email phrasing like "please confirm", "could you please", "I’d like to", and "thank you" unless it is already present in the input or clearly required to preserve the tone.',
      "If the input already contains a clear request, keep the request natural and polished rather than turning it into a more formal workplace instruction.",
      "When the input is already short or reasonably clean, still improve cadence and clarity while keeping the tone neutral rather than chatty or terse.",
      'Tone reference: "Could you send that over when you have a chance? Thanks."',
      "Keep approximate length: you may slightly tighten, and you may modestly expand if it makes the writing more elegant or easier to read.",
    ],
    structureRules: [
      "Prefer elegant, balanced paragraphs.",
      "Use bullets only when multiple concrete asks or deliverables clearly make the message easier to scan.",
    ],
  },
  casual: {
    label: "CASUAL",
    textVerbosity: "medium",
    styleRules: [
      "Rewrite to sound casual, friendly, and conversational between real people.",
      "Prefer everyday wording, contractions, and natural phrasing over corporate or formal wording.",
      "Keep it warm, relaxed, and readable without becoming slangy, childish, or overly polished.",
      "Do not make it sound like a workplace template.",
      'Prefer casual choices like "can you", "just checking", and "thanks" over more formal workplace phrasing when natural.',
      "When the input is already short or clean, still make the tone visibly more relaxed than professional mode instead of returning the same sentence with only punctuation fixes.",
      'Tone reference: "Can you send that over when you get a chance? Thanks!"',
      "Keep approximate length; light tightening allowed.",
    ],
    structureRules: [
      "Prefer short conversational paragraphs.",
      "Use bullets rarely; keep the output feeling like a natural message, not a memo.",
    ],
  },
  professional: {
    label: "PROFESSIONAL",
    textVerbosity: "medium",
    styleRules: [
      "Rewrite to sound professional, neutral, and polished for a workplace email or Slack update.",
      "Clear, calm, courteous, and well-structured.",
      "Prefer polished workplace phrasing over chatty wording, but do not become stiff or verbose.",
      "Do not add a greeting, sign-off, signature, subject line, or sender name unless it is already present in the input.",
      'Prefer professional choices like "could you please", "I’d like to", "please confirm", and "thank you" when natural.',
      'Prefer more formal workplace verbs like "confirm whether", "remain suitable", "inform", and "appreciate" when natural.',
      'Prefer business-ready phrasing like "we may need to reschedule", "please let me know", and "avoid wasting anyone’s time" over tentative first-person framing when natural.',
      "Prefer a slightly more formal workplace register than polish mode whenever the two would otherwise come out the same.",
      "If the input is already reasonably polished, do not leave it unchanged. Rephrase it into a clearer, more businesslike workplace version.",
      "When the input contains a request, follow-up, or confirmation, make it more explicit and professionally courteous than polish mode instead of leaving the original phrasing untouched.",
      "When the input is already short or clean, still prefer visibly more professional wording than casual or polish mode instead of returning the same sentence unchanged.",
      'Tone reference for follow-ups: "Please send the final redlines today so legal can sign off."',
      'Tone reference for confirmations: "Please confirm whether Monday afternoon remains suitable for the review."',
      'Tone reference: "Could you please send that over when you have a chance? Thank you."',
      "Keep approximate length; light tightening allowed.",
    ],
    structureRules: [
      "Prefer scan-friendly business blocks.",
      "Bullets are acceptable for deliverables, options, or action items when they improve clarity.",
    ],
  },
  direct: {
    label: "DIRECT",
    textVerbosity: "low",
    styleRules: [
      "Rewrite to be concise, direct, and action-oriented.",
      "Prefer short sentences and the shortest natural phrasing.",
      "Remove filler, hedging, and softening language that doesn't add meaning.",
      "State requests, questions, and next steps plainly.",
      "Do not add pleasantries, greetings, or sign-offs unless they are already present in the input and still necessary.",
      "Prefer imperative or plainly stated requests when that does not change the meaning.",
      'Strip follow-up framing like "just checking", "following up", and "I would appreciate it if" down to the shortest natural request whenever possible.',
      "When the input is already short or clean, still compress and simplify instead of only correcting punctuation or swapping synonyms.",
      'Tone reference: "Send that over today."',
      "Use bullet points when it improves clarity.",
      "Shorten meaningfully, but do not remove essential information.",
    ],
    structureRules: [
      "Prefer the shortest useful blocks.",
      "When there are 2 or more asks, steps, or deliverables, prefer bullets over dense prose.",
    ],
  },
};

export const MARKDOWN_PRESET_SPECS: Record<MarkdownPreset, MarkdownPresetSpec> = {
  universal: {
    textVerbosity: "medium",
    styleRules: [
      "Be faithful to the source wording, but still make the Markdown visibly structured for non-trivial prompts.",
      "Prefer short grounded headings plus bullets when the source contains multiple instructions, constraints, or references.",
      "Keep sectioning minimal and neutral; do not introduce repo-specific vocabulary unless it is already present in the source.",
    ],
  },
  codex: {
    textVerbosity: "medium",
    styleRules: [
      "Use the strongest task-execution structure of the presets.",
      "For repository-oriented material, prefer `## Task`, `## Files`, `## Constraints`, and `## Validation` when those concepts are grounded in the source.",
      "Prefer crisp bullets or checklists for multi-step repo tasks.",
      "Preserve commands, file paths, and code exactly as written.",
      "Do not add synthetic acceptance-criteria or repository-context scaffolding unless validation requirements already exist in the source.",
    ],
  },
  claude: {
    textVerbosity: "medium",
    styleRules: [
      "Use the strongest requirement-and-unknowns structure of the presets.",
      "Prefer `## Context`, `## Requirements`, `## Constraints`, and `## Questions` when those concepts are grounded in the source.",
      "Separate assumptions, unknowns, and requested outputs more clearly when they already exist in the source.",
      "Do not add generic expected-output scaffolding unless the source already asks for an output artifact.",
    ],
  },
};

export function isMarkdownTransformMode(mode: OpenAITransformMode): mode is MarkdownTransformMode {
  return mode.startsWith("agent-");
}

export function isRewriteTransformMode(mode: OpenAITransformMode): mode is RewriteTransformMode {
  return !isMarkdownTransformMode(mode);
}

export function getMarkdownPreset(mode: MarkdownTransformMode): MarkdownPreset {
  return mode.slice("agent-".length) as MarkdownPreset;
}

function buildStructureGuidance(structureIntent: StructureIntent): string[] {
  const shapeRuleMap: Record<StructureIntent["targetShape"], string> = {
    paragraphs: "Preferred shape for this input: paragraphs.",
    bullets: "Preferred shape for this input: bullets or a very short lead-in followed by bullets.",
    hybrid:
      "Preferred shape for this input: a short lead-in paragraph plus bullets or compact follow-on paragraphs.",
  };

  const contentTypeRuleMap: Record<StructureIntent["inferredContentType"], string> = {
    message: "Treat the input as a plain-text message.",
    email: "Treat the input as a plain-text email body.",
    note: "Treat the input as a plain-text note.",
    mixed: "Treat the input as a plain-text message that may contain mixed prose and list structure.",
  };

  const rules = [
    "Structure guidance:",
    ...BASE_STRUCTURE_RULES.map((rule) => `- ${rule}`),
    `- ${contentTypeRuleMap[structureIntent.inferredContentType]}`,
    `- ${shapeRuleMap[structureIntent.targetShape]}`,
  ];

  if (structureIntent.isolateRequest) {
    rules.push("- The main request should stand on its own paragraph or bullet when natural.");
  }

  if (structureIntent.isolateClosing) {
    rules.push("- Keep any closing sentiment separate from the operational request.");
  }

  if (structureIntent.preserveExistingLists) {
    rules.push("- Preserve existing readable bullets or numbering; improve spacing only.");
  }

  if (structureIntent.preserveExistingParagraphs) {
    rules.push("- Preserve existing paragraph separation when it is already clear.");
  }

  return rules;
}

function buildMarkdownIntentGuidance(intent: MarkdownIntent): string[] {
  const rules = [
    "Markdown formatting guidance:",
    "- Preserve the original paragraph order.",
  ];

  if (intent.shouldRequireVisibleStructure) {
    rules.push(
      "- This input requires visible Markdown structure. Do not return prose only.",
      "- Introduce headings, bullets, checklists, numbered steps, blockquotes, or fenced code blocks as appropriate.",
    );
  }

  if (intent.hasExistingMarkdownSyntax) {
    rules.push("- Preserve useful existing Markdown structure instead of flattening it.");
  }

  if (intent.hasExistingParagraphs) {
    rules.push("- Preserve the existing paragraph breaks unless a tiny Markdown cleanup makes them clearer.");
  }

  if (intent.hasListStructure) {
    rules.push("- Preserve useful existing list structure instead of flattening it into prose.");
  } else {
    rules.push("- Convert dense inline enumerations into bullets when they become materially easier to scan.");
  }

  if (intent.hasSectionCues) {
    rules.push(
      "- The source already contains section-like cues; preserve them as grounded Markdown headings when that keeps the same structure.",
    );
  }

  if (intent.hasReferencedFiles) {
    rules.push("- Keep every referenced file path exactly as written.");
  }

  if (intent.hasUrls) {
    rules.push("- Keep every URL exactly as written.");
  }

  if (intent.hasCodeBlocks) {
    rules.push("- Preserve fenced code blocks exactly as written.");
  }

  if (intent.hasInlineCode) {
    rules.push("- Preserve inline code spans exactly as written.");
  }

  if (intent.hasExplicitConstraints) {
    rules.push("- Keep explicit constraints prominent and easy to scan.");
  }

  if (intent.hasDeliverableLanguage) {
    rules.push("- Keep explicit deliverables or requested outputs easy to identify, preferably with bullets or a short `## Deliverable` section when grounded.");
  }

  if (intent.hasOpenQuestions) {
    rules.push("- Keep open questions explicit rather than burying them inside dense paragraphs, preferably with bullets or a short `## Questions` section when grounded.");
  }

  if (intent.hasAttachmentReferences) {
    rules.push("- Keep unseen attachments or screenshots only as references; do not infer their contents.");
  }

  if (intent.hasMultipleActionItems) {
    rules.push("- Multiple action items are present. Break them into bullets, a checklist, or numbered steps.");
  }

  if (intent.hasConstraintCluster) {
    rules.push("- Multiple constraints are present. Surface them as a short bullet list or a grounded `## Constraints` section.");
  }

  if (intent.hasReferenceCluster) {
    rules.push("- Multiple references are present. Surface them clearly, ideally under bullets or a grounded `## Files` / `## References` section.");
  }

  return rules;
}

function buildRewriteInstructions(
  mode: RewriteTransformMode,
  structureIntent?: StructureIntent,
): string {
  const promptSpec = MODE_PROMPT_SPECS[mode];
  const instructions = [
    REWRITE_PROMPT_INTRO,
    "",
    "Non-negotiable constraints:",
    ...BASE_CONSTRAINTS.map((constraint) => `- ${constraint}`),
    "",
    `Mode: ${promptSpec.label}`,
    ...promptSpec.styleRules,
  ];

  if (structureIntent?.enabled) {
    instructions.push("", ...buildStructureGuidance(structureIntent), ...promptSpec.structureRules);
  }

  return instructions.join("\n");
}

function buildMarkdownInstructions(
  mode: MarkdownTransformMode,
  intent?: MarkdownIntent,
): string {
  const promptSpec = MARKDOWN_PRESET_SPECS[getMarkdownPreset(mode)];
  const instructions = [
    MARKDOWN_PROMPT_INTRO,
    "",
    "Non-negotiable constraints:",
    ...MARKDOWN_BASE_CONSTRAINTS.map((constraint) => `- ${constraint}`),
    "",
    ...promptSpec.styleRules,
  ];

  if (intent) {
    instructions.push("", ...buildMarkdownIntentGuidance(intent));
  }

  return instructions.join("\n");
}

export function buildInstructions(
  mode: OpenAITransformMode,
  context?: StructureIntent | MarkdownIntent,
): string {
  if (isMarkdownTransformMode(mode)) {
    return buildMarkdownInstructions(mode, context as MarkdownIntent | undefined);
  }

  return buildRewriteInstructions(mode, context as StructureIntent | undefined);
}

export function buildUserInput(mode: OpenAITransformMode, inputText: string): string {
  if (isMarkdownTransformMode(mode)) {
    return `${MARKDOWN_USER_WRAPPER_PREFIX}${inputText}${MARKDOWN_USER_WRAPPER_SUFFIX}`;
  }

  return `${REWRITE_USER_WRAPPER_PREFIX}${inputText}${REWRITE_USER_WRAPPER_SUFFIX}`;
}

function isGpt5FamilyModel(model: string): boolean {
  const normalized = model.trim().toLowerCase();
  return normalized === "gpt-5" || normalized.startsWith("gpt-5-");
}

export function getModelRequestControls(
  model: string,
  mode: OpenAITransformMode,
): Record<string, unknown> {
  if (!isGpt5FamilyModel(model)) {
    return {};
  }

  const textVerbosity = isMarkdownTransformMode(mode)
    ? MARKDOWN_PRESET_SPECS[getMarkdownPreset(mode)].textVerbosity
    : MODE_PROMPT_SPECS[mode].textVerbosity;

  return {
    reasoning: {
      effort: "minimal",
    },
    text: {
      verbosity: textVerbosity,
    },
  };
}

export function getMaxOutputTokens(mode: OpenAITransformMode, inputText: string): number {
  const inputTokens = Math.max(1, Math.round(inputText.length / 4));

  if (mode === "direct") {
    return Math.min(12288, Math.round(inputTokens * 1.4) + 192);
  }

  return Math.min(16384, Math.round(inputTokens * 2.0) + 256);
}
