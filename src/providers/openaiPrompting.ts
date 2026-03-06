import type { AgentPromptIntent } from "../agentPrompts/markdown";
import type { StructureIntent } from "../structuring/plainText";

export const DEFAULT_OPENAI_MODEL = "gpt-5-nano-2025-08-07";

export type RewriteTransformMode = "polish" | "casual" | "professional" | "direct";
export type AgentPromptPreset = "universal" | "codex" | "claude";
export type AgentPromptTransformMode = `agent-${AgentPromptPreset}`;
export type OpenAITransformMode = RewriteTransformMode | AgentPromptTransformMode;

type TextVerbosity = "low" | "medium";

export type ModePromptSpec = {
  label: string;
  styleRules: string[];
  structureRules: string[];
  textVerbosity: TextVerbosity;
};

export type AgentPromptSpec = {
  label: string;
  textVerbosity: TextVerbosity;
  styleRules: string[];
  sections: string[];
};

const REWRITE_PROMPT_INTRO =
  "You are a rewriting engine. Rewrite the user's text according to the requested mode.";

const AGENT_PROMPT_INTRO =
  "You turn user source material into a clean Markdown prompt for an AI coding agent.";

const REWRITE_USER_WRAPPER_PREFIX = `Rewrite the text below.

[BEGIN TEXT]
`;

const REWRITE_USER_WRAPPER_SUFFIX = `
[END TEXT]`;

const AGENT_PROMPT_USER_WRAPPER_PREFIX = `Convert the source material below into a Markdown prompt for the requested coding-agent preset.

[BEGIN SOURCE]
`;

const AGENT_PROMPT_USER_WRAPPER_SUFFIX = `
[END SOURCE]`;

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

const AGENT_PROMPT_BASE_CONSTRAINTS = [
  "Output valid Markdown only.",
  "Reorganize the source into a clean, useful coding-agent prompt.",
  "Do not invent facts, files, APIs, commands, deadlines, dependencies, or repository context.",
  "Preserve quoted text, URLs, paths, code, IDs, numbers, dates, and explicit constraints exactly.",
  "If the source references attachments, screenshots, or documents you have not seen, keep them as referenced inputs and do not imply their unseen contents.",
  "Prefer headings, bullets, short sections, and checklists over dense prose.",
  "Omit empty sections instead of emitting placeholders.",
  "Do not add explanatory preamble outside the Markdown.",
  "Do not alter placeholders of the form __PZPTOK###__.",
];

const AGENT_PROMPT_SECTION_BEHAVIOR = [
  "Keep section order fixed for the selected preset.",
  "Emit only sections that have meaningful content.",
  "Preserve existing bullets, quoted text, inline code, and fenced code blocks when they improve clarity.",
  "Convert dense prose into concise bullets where it improves scanability.",
];

export const MODE_PROMPT_SPECS: Record<RewriteTransformMode, ModePromptSpec> = {
  polish: {
    label: "REFINE",
    textVerbosity: "medium",
    styleRules: [
      "Rewrite into a clear, elegant, well-structured version suitable for general professional communication.",
      "Actively improve sentence structure and paragraph flow.",
      "It should read like a competent human wrote it carefully, not like a transcript, chat message, or template.",
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

export const AGENT_PROMPT_SPECS: Record<AgentPromptPreset, AgentPromptSpec> = {
  universal: {
    label: "UNIVERSAL",
    textVerbosity: "medium",
    styleRules: [
      "Optimize the prompt for cross-agent clarity and portability.",
      "Make the final Markdown useful for any capable coding agent without assuming a specific product or toolchain.",
      "Prefer plain, explicit language over agent-specific jargon.",
    ],
    sections: [
      "## Objective",
      "## Context",
      "## Inputs and References",
      "## Constraints",
      "## Deliverable",
      "## Success Criteria",
      "## Open Questions",
    ],
  },
  codex: {
    label: "CODEX",
    textVerbosity: "medium",
    styleRules: [
      "Optimize the prompt for a coding agent working directly in a repository and terminal workflow.",
      "Surface repository context, requested changes, and acceptance criteria as clearly as possible.",
      "Bias toward implementation-oriented phrasing rather than general brainstorming language.",
    ],
    sections: [
      "## Objective",
      "## Repository Context",
      "## Constraints",
      "## Requested Changes",
      "## Acceptance Criteria",
      "## Notes",
    ],
  },
  claude: {
    label: "CLAUDE",
    textVerbosity: "medium",
    styleRules: [
      "Optimize the prompt for a coding agent that benefits from clear requirements, expected output shape, and unresolved questions.",
      "Bias toward explicit requirements and expected output framing over repository-specific assumptions.",
      "Keep the structure concise but unambiguous.",
    ],
    sections: [
      "## Objective",
      "## Context",
      "## Requirements",
      "## Constraints",
      "## Expected Output",
      "## Open Questions",
    ],
  },
};

export function isAgentPromptMode(mode: OpenAITransformMode): mode is AgentPromptTransformMode {
  return mode.startsWith("agent-");
}

export function isRewriteTransformMode(mode: OpenAITransformMode): mode is RewriteTransformMode {
  return !isAgentPromptMode(mode);
}

export function getAgentPromptPreset(mode: AgentPromptTransformMode): AgentPromptPreset {
  return mode.slice("agent-".length) as AgentPromptPreset;
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

function buildAgentPromptIntentGuidance(intent: AgentPromptIntent): string[] {
  const rules = [
    "Input-specific guidance:",
    "- Preserve quoted text, list items, and explicit constraints exactly.",
  ];

  if (intent.hasReferencedFiles) {
    rules.push("- The source references file paths or repository artifacts. Keep every path exactly as written.");
  }

  if (intent.hasUrls) {
    rules.push("- The source contains URLs. Keep each URL exactly as written and place it in a relevant reference section.");
  }

  if (intent.hasCodeBlocks) {
    rules.push("- The source includes fenced code blocks. Preserve them exactly when they are relevant context.");
  }

  if (intent.hasInlineCode) {
    rules.push("- The source includes inline code. Keep inline code spans exactly as written.");
  }

  if (intent.hasExplicitConstraints) {
    rules.push("- Surface explicit must/must-not requirements under Constraints.");
  }

  if (intent.hasDeliverableLanguage) {
    rules.push("- Make the requested deliverable or output shape explicit in the relevant section.");
  }

  if (intent.hasOpenQuestions) {
    rules.push("- Pull unresolved questions or missing information into Open Questions or Notes.");
  }

  if (intent.hasAttachmentReferences) {
    rules.push("- The source references attachments, screenshots, or documents you have not seen. Mention them as referenced inputs only; do not infer their contents.");
  }

  if (intent.hasListStructure) {
    rules.push("- Preserve useful list structure instead of flattening it into prose.");
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

function buildAgentPromptInstructions(
  mode: AgentPromptTransformMode,
  intent?: AgentPromptIntent,
): string {
  const preset = getAgentPromptPreset(mode);
  const promptSpec = AGENT_PROMPT_SPECS[preset];
  const sectionRules = promptSpec.sections.map((section) => `- ${section}`);
  const instructions = [
    AGENT_PROMPT_INTRO,
    "",
    "Non-negotiable constraints:",
    ...AGENT_PROMPT_BASE_CONSTRAINTS.map((constraint) => `- ${constraint}`),
    "",
    `Preset: ${promptSpec.label}`,
    ...promptSpec.styleRules,
    "",
    "Section order:",
    ...sectionRules,
    "",
    "Section behavior:",
    ...AGENT_PROMPT_SECTION_BEHAVIOR.map((rule) => `- ${rule}`),
  ];

  if (intent) {
    instructions.push("", ...buildAgentPromptIntentGuidance(intent));
  }

  return instructions.join("\n");
}

export function buildInstructions(
  mode: OpenAITransformMode,
  context?: StructureIntent | AgentPromptIntent,
): string {
  if (isAgentPromptMode(mode)) {
    return buildAgentPromptInstructions(mode, context as AgentPromptIntent | undefined);
  }

  return buildRewriteInstructions(mode, context as StructureIntent | undefined);
}

export function buildUserInput(mode: OpenAITransformMode, inputText: string): string {
  if (isAgentPromptMode(mode)) {
    return `${AGENT_PROMPT_USER_WRAPPER_PREFIX}${inputText}${AGENT_PROMPT_USER_WRAPPER_SUFFIX}`;
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

  const textVerbosity = isAgentPromptMode(mode)
    ? AGENT_PROMPT_SPECS[getAgentPromptPreset(mode)].textVerbosity
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
