import type { StructureIntent } from "../structuring/plainText";

export const DEFAULT_OPENAI_MODEL = "gpt-5-nano-2025-08-07";

export type OpenAITransformMode = "polish" | "casual" | "professional" | "direct";

type TextVerbosity = "low" | "medium";

export type ModePromptSpec = {
  label: string;
  styleRules: string[];
  structureRules: string[];
  textVerbosity: TextVerbosity;
};

const BASE_PROMPT_INTRO =
  "You are a rewriting engine. Rewrite the user's text according to the requested mode.";

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

export const MODE_PROMPT_SPECS: Record<OpenAITransformMode, ModePromptSpec> = {
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

function buildStructureGuidance(structureIntent: StructureIntent): string[] {
  const shapeRuleMap: Record<StructureIntent["targetShape"], string> = {
    paragraphs: "Preferred shape for this input: paragraphs.",
    bullets: "Preferred shape for this input: bullets or a very short lead-in followed by bullets.",
    hybrid: "Preferred shape for this input: a short lead-in paragraph plus bullets or compact follow-on paragraphs.",
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

export function buildInstructions(
  mode: OpenAITransformMode,
  structureIntent?: StructureIntent,
): string {
  const promptSpec = MODE_PROMPT_SPECS[mode];
  const instructions = [
    BASE_PROMPT_INTRO,
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

  return {
    reasoning: {
      effort: "minimal",
    },
    text: {
      verbosity: MODE_PROMPT_SPECS[mode].textVerbosity,
    },
  };
}

export function getMaxOutputTokens(mode: OpenAITransformMode, inputText: string): number {
  const inputTokens = Math.max(1, Math.round(inputText.length / 4));

  if (mode === "direct") {
    return Math.min(8192, Math.round(inputTokens * 0.8) + 96);
  }

  return Math.min(8192, Math.round(inputTokens * 1.3) + 128);
}
