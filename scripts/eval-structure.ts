import { pathToFileURL } from "node:url";
import { type OpenAITransformMode } from "../src/providers/openaiPrompting";
import { streamTransformWithOpenAI } from "../src/providers/openai";
import {
  decodePlaceholders,
  encodeProtectedSpans,
  validatePlaceholders,
} from "../src/protect/placeholders";
import { normalizeStructuredPlainText } from "../src/structuring/plainText";
import { loadRuntimeConfig } from "./eval-modes";

type EvalSample = {
  id: string;
  label: string;
  input: string;
  scaffoldAbsent: boolean;
  expectParagraphs?: boolean;
  expectBullets?: boolean;
  shortSimple?: boolean;
  existingBullets?: boolean;
  protectedTokens?: string[];
};

type EvalOutput = Record<OpenAITransformMode, string>;

const MODES: OpenAITransformMode[] = ["polish", "casual", "professional", "direct"];
const PARAGRAPH_MODES: OpenAITransformMode[] = ["polish", "casual", "professional"];
const BULLET_MODES: OpenAITransformMode[] = ["professional", "direct"];
const BULLET_LINE_REGEX = /^\s*(?:[-*•]|\d+[.)])\s+\S/m;
const GREETING_REGEX = /^\s*(?:hi|hello|hey|dear)\b/im;
const SIGN_OFF_REGEX =
  /\b(?:best|best regards|kind regards|regards|sincerely|thank you|thanks),?\s*$/im;
const SUBJECT_REGEX = /^\s*subject:/im;
const LABEL_REGEX = /^\s*(?:next steps|action items|summary):\s*$/im;

const EVAL_SAMPLES: EvalSample[] = [
  {
    id: "dense-dictation",
    label: "Dense dictated message",
    input:
      "Hello Banksy, I want to confirm we are aligned on the way forward. Automating certain functions is a top priority, and we should explore how to use AI and modern technology effectively. Please send me a detailed email outlining exactly which functions and processes you need automated. I will then assemble a demo platform that showcases the best of modern tech. I hope this matches your thinking, and I look forward to hearing from you.",
    scaffoldAbsent: false,
    expectParagraphs: true,
  },
  {
    id: "background-ask-close",
    label: "Background + ask + close",
    input:
      "We are close to finalising the proposal, but legal still needs the latest redlines before we can send it. Please send the updated version today if you can. I appreciate the help.",
    scaffoldAbsent: true,
    expectParagraphs: true,
  },
  {
    id: "deliverables-request",
    label: "Multi-deliverable request",
    input:
      "Please send the final draft, confirm whether Monday still works, and share the updated budget before end of day.",
    scaffoldAbsent: true,
    expectBullets: true,
  },
  {
    id: "scheduling-options",
    label: "Scheduling options",
    input:
      "We need to move tomorrow's review. Please propose two alternative times, confirm who still needs to attend, and let me know whether the finance deck will be ready by then.",
    scaffoldAbsent: true,
    expectBullets: true,
  },
  {
    id: "already-clean-paragraphs",
    label: "Already clean two-paragraph note",
    input:
      "The draft looks strong overall, and the timeline still works on our side.\n\nPlease confirm whether Monday afternoon remains suitable for the review.",
    scaffoldAbsent: true,
  },
  {
    id: "existing-bullets",
    label: "Existing bullet list",
    input:
      "- Review the pricing section\n- Confirm the revised launch date\n- Share the client-ready deck",
    scaffoldAbsent: true,
    existingBullets: true,
  },
  {
    id: "short-casual",
    label: "Short casual message",
    input: "Can you send that over today?",
    scaffoldAbsent: true,
    shortSimple: true,
  },
  {
    id: "protected-content",
    label: "Protected content message",
    input:
      "Please review https://example.com/spec before 2026-03-10 at 14:30 and confirm whether the $42.50 surcharge should remain on order REF-887712.",
    scaffoldAbsent: true,
    expectParagraphs: true,
    protectedTokens: [
      "https://example.com/spec",
      "2026-03-10",
      "14:30",
      "$42.50",
      "REF-887712",
    ],
  },
];

function countParagraphs(text: string): number {
  return text
    .trim()
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean).length;
}

function hasInventedScaffolding(text: string): boolean {
  return (
    GREETING_REGEX.test(text) ||
    SIGN_OFF_REGEX.test(text) ||
    SUBJECT_REGEX.test(text) ||
    LABEL_REGEX.test(text)
  );
}

async function rewriteSample(
  sample: EvalSample,
  mode: OpenAITransformMode,
  config: ReturnType<typeof loadRuntimeConfig>,
): Promise<string> {
  const encoded = encodeProtectedSpans(sample.input);
  const result = await streamTransformWithOpenAI({
    apiKey: config.openaiApiKey,
    inputText: encoded.encodedText,
    mode,
    model: config.model,
    temperature: config.temperature,
    streaming: true,
    smartStructuring: true,
    timeoutMs: 30_000,
    onDelta: () => undefined,
  });

  const decoded = decodePlaceholders(result.outputText, encoded.mapping);
  const validation = validatePlaceholders(decoded, encoded.mapping);
  if (!validation.ok) {
    throw new Error(`${sample.id}/${mode}: ${validation.error}`);
  }

  return normalizeStructuredPlainText(decoded);
}

async function run(): Promise<void> {
  const config = loadRuntimeConfig();
  (
    globalThis as typeof globalThis & {
      window: Pick<typeof globalThis, "setTimeout" | "clearTimeout">;
    }
  ).window = { setTimeout, clearTimeout };

  const results: Array<{ sample: EvalSample; outputs: EvalOutput }> = [];

  for (const sample of EVAL_SAMPLES) {
    const outputs = {} as EvalOutput;
    console.log(`\n[${sample.id}] ${sample.label}`);

    for (const mode of MODES) {
      const output = await rewriteSample(sample, mode, config);
      outputs[mode] = output;
      console.log(
        `- ${mode} (${countParagraphs(output)} paragraphs${BULLET_LINE_REGEX.test(output) ? ", bullets" : ""}): ${output}`,
      );
    }

    results.push({ sample, outputs });
  }

  let paragraphEligible = 0;
  let paragraphPasses = 0;
  let bulletEligible = 0;
  let bulletPasses = 0;
  const shortSimpleFailures: string[] = [];
  const scaffoldingFailures: string[] = [];
  const bulletPreservationFailures: string[] = [];
  const protectedTokenFailures: string[] = [];

  for (const { sample, outputs } of results) {
    if (sample.expectParagraphs) {
      for (const mode of PARAGRAPH_MODES) {
        paragraphEligible += 1;
        if (countParagraphs(outputs[mode]) > 1) {
          paragraphPasses += 1;
        }
      }
    }

    if (sample.expectBullets) {
      for (const mode of BULLET_MODES) {
        bulletEligible += 1;
        if (BULLET_LINE_REGEX.test(outputs[mode])) {
          bulletPasses += 1;
        }
      }
    }

    if (sample.shortSimple) {
      for (const mode of MODES) {
        const paragraphCount = countParagraphs(outputs[mode]);
        if (paragraphCount > 2 || BULLET_LINE_REGEX.test(outputs[mode])) {
          shortSimpleFailures.push(`${sample.id}/${mode}`);
        }
      }
    }

    if (sample.scaffoldAbsent) {
      for (const mode of MODES) {
        if (hasInventedScaffolding(outputs[mode])) {
          scaffoldingFailures.push(`${sample.id}/${mode}`);
        }
      }
    }

    if (sample.existingBullets) {
      for (const mode of MODES) {
        if (!BULLET_LINE_REGEX.test(outputs[mode])) {
          bulletPreservationFailures.push(`${sample.id}/${mode}`);
        }
      }
    }

    if (sample.protectedTokens) {
      for (const mode of MODES) {
        const missingTokens = sample.protectedTokens.filter((token) => !outputs[mode].includes(token));
        if (missingTokens.length > 0) {
          protectedTokenFailures.push(`${sample.id}/${mode}: ${missingTokens.join(", ")}`);
        }
      }
    }
  }

  const paragraphRate = paragraphEligible === 0 ? 1 : paragraphPasses / paragraphEligible;
  const bulletRate = bulletEligible === 0 ? 1 : bulletPasses / bulletEligible;

  console.log("\nAcceptance summary");
  console.log(
    `- dense prose expands into multiple paragraphs: ${paragraphRate >= 0.9 ? "PASS" : "FAIL"} (${paragraphPasses}/${paragraphEligible})`,
  );
  console.log(
    `- multi-item asks become bullets when appropriate: ${bulletRate >= 0.8 ? "PASS" : "FAIL"} (${bulletPasses}/${bulletEligible})`,
  );
  console.log(
    `- short/simple messages avoid over-formatting: ${shortSimpleFailures.length === 0 ? "PASS" : "FAIL"}`,
  );
  if (shortSimpleFailures.length > 0) {
    console.log(`  failures: ${shortSimpleFailures.join(", ")}`);
  }

  console.log(
    `- no invented scaffolding or labels: ${scaffoldingFailures.length === 0 ? "PASS" : "FAIL"}`,
  );
  if (scaffoldingFailures.length > 0) {
    console.log(`  failures: ${scaffoldingFailures.join(", ")}`);
  }

  console.log(
    `- existing bullets stay as bullets: ${bulletPreservationFailures.length === 0 ? "PASS" : "FAIL"}`,
  );
  if (bulletPreservationFailures.length > 0) {
    console.log(`  failures: ${bulletPreservationFailures.join(", ")}`);
  }

  console.log(
    `- protected tokens remain exact: ${protectedTokenFailures.length === 0 ? "PASS" : "FAIL"}`,
  );
  if (protectedTokenFailures.length > 0) {
    console.log(`  failures: ${protectedTokenFailures.join(", ")}`);
  }

  if (
    paragraphRate < 0.9 ||
    bulletRate < 0.8 ||
    shortSimpleFailures.length > 0 ||
    scaffoldingFailures.length > 0 ||
    bulletPreservationFailures.length > 0 ||
    protectedTokenFailures.length > 0
  ) {
    process.exitCode = 1;
  }
}

function isMainModule(): boolean {
  const entryPoint = process.argv[1];
  if (!entryPoint) {
    return false;
  }

  return import.meta.url === pathToFileURL(entryPoint).href;
}

if (isMainModule()) {
  void run().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
