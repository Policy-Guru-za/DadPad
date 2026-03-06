import { pathToFileURL } from "node:url";
import {
  type AgentPromptTransformMode,
  type OpenAITransformMode,
} from "../src/providers/openaiPrompting";
import { streamTransformWithOpenAI } from "../src/providers/openai";
import {
  decodePlaceholders,
  encodeProtectedSpans,
  validatePlaceholders,
} from "../src/protect/placeholders";
import { normalizePromptMarkdown } from "../src/agentPrompts/markdown";
import { loadRuntimeConfig } from "./eval-modes";

type EvalSample = {
  id: string;
  label: string;
  input: string;
  expectedTokens?: string[];
  attachmentReference?: boolean;
};

type EvalOutput = Record<AgentPromptTransformMode, string>;

const MODES: AgentPromptTransformMode[] = [
  "agent-universal",
  "agent-codex",
  "agent-claude",
];
const HEADING_REGEX = /^##\s+\S/m;
const NORMALIZED_WHITESPACE_REGEX = /\s+/g;
const ATTACHMENT_REFERENCE_REGEX =
  /\b(?:attachment|attached|screenshot|screen shot|document|documents|docs?)\b/i;
const SPECIFIC_ATTACHMENT_CLAIMS_REGEX =
  /\b(?:the screenshot shows|the attachment shows|the document says|the attached file contains)\b/i;

const EVAL_SAMPLES: EvalSample[] = [
  {
    id: "repo-change-request",
    label: "Repository change request",
    input:
      "Please turn this into a prompt for an AI coding agent. Review src/App.tsx and src/providers/openai.ts. Keep `pnpm test` and `pnpm build` in scope. Do not change the Rust layer. Deliver a patch plus a short verification summary.",
    expectedTokens: ["src/App.tsx", "src/providers/openai.ts", "`pnpm test`", "`pnpm build`"],
  },
  {
    id: "messy-business-brief",
    label: "Messy business brief",
    input:
      "I need a coding agent prompt that will take this rough app brief and make the frontend cleaner, more readable, and more structured. It must not invent files or dependencies. It should call out any open questions instead of guessing. Output should be markdown only.",
    expectedTokens: ["markdown only"],
  },
  {
    id: "reference-heavy",
    label: "Reference-heavy request",
    input:
      "Use docs/POLISHPAD-UI-RESKIN-PROMPT.md and https://example.com/spec as references. Preserve the existing fenced code block:\n```ts\nconst mode = \"polish\";\n```\nReturn requested changes and acceptance criteria.",
    expectedTokens: [
      "docs/POLISHPAD-UI-RESKIN-PROMPT.md",
      "https://example.com/spec",
      "```ts\nconst mode = \"polish\";\n```",
    ],
  },
  {
    id: "attachment-reference",
    label: "Attachment reference",
    input:
      "Draft a coding-agent prompt from this note. The source also references an attached screenshot and two documents that the agent has not seen. Keep them as referenced inputs only and do not infer their contents. Ask for open questions where needed.",
    attachmentReference: true,
  },
];

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s`/.:_-]/gu, " ")
    .replace(NORMALIZED_WHITESPACE_REGEX, " ")
    .trim();
}

function printSimilarityMatrix(outputs: EvalOutput): void {
  const pairs: Array<[AgentPromptTransformMode, AgentPromptTransformMode]> = [
    ["agent-universal", "agent-codex"],
    ["agent-universal", "agent-claude"],
    ["agent-codex", "agent-claude"],
  ];

  for (const [left, right] of pairs) {
    const same = normalizeText(outputs[left]) === normalizeText(outputs[right]);
    console.log(`  identical ${left}/${right}: ${same ? "YES" : "NO"}`);
  }
}

async function generatePrompt(
  sample: EvalSample,
  mode: AgentPromptTransformMode,
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
    timeoutMs: 30_000,
    onDelta: () => undefined,
  });

  const decoded = decodePlaceholders(result.outputText, encoded.mapping);
  const validation = validatePlaceholders(decoded, encoded.mapping);
  if (!validation.ok) {
    throw new Error(`${sample.id}/${mode}: ${validation.error}`);
  }

  return normalizePromptMarkdown(decoded);
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
    console.log(`input: ${sample.input}`);

    for (const mode of MODES) {
      const output = await generatePrompt(sample, mode, config);
      outputs[mode] = output;
      console.log(`- ${mode}:\n${output}\n`);
    }

    printSimilarityMatrix(outputs);
    results.push({ sample, outputs });
  }

  const markdownFailures: string[] = [];
  const identicalFailures: string[] = [];
  const tokenFailures: string[] = [];
  const attachmentFailures: string[] = [];

  for (const { sample, outputs } of results) {
    const normalizedOutputs = MODES.map((mode) => ({
      mode,
      normalized: normalizeText(outputs[mode]),
    }));

    for (const mode of MODES) {
      if (!HEADING_REGEX.test(outputs[mode])) {
        markdownFailures.push(`${sample.id}/${mode}`);
      }
    }

    for (let index = 0; index < normalizedOutputs.length; index += 1) {
      for (let compareIndex = index + 1; compareIndex < normalizedOutputs.length; compareIndex += 1) {
        if (normalizedOutputs[index].normalized === normalizedOutputs[compareIndex].normalized) {
          identicalFailures.push(
            `${sample.id}: ${normalizedOutputs[index].mode} == ${normalizedOutputs[compareIndex].mode}`,
          );
        }
      }
    }

    if (sample.expectedTokens) {
      for (const mode of MODES) {
        const missing = sample.expectedTokens.filter((token) => !outputs[mode].includes(token));
        if (missing.length > 0) {
          tokenFailures.push(`${sample.id}/${mode}: ${missing.join(", ")}`);
        }
      }
    }

    if (sample.attachmentReference) {
      for (const mode of MODES) {
        if (!ATTACHMENT_REFERENCE_REGEX.test(outputs[mode])) {
          attachmentFailures.push(`${sample.id}/${mode}: missing attachment reference`);
          continue;
        }
        if (SPECIFIC_ATTACHMENT_CLAIMS_REGEX.test(outputs[mode])) {
          attachmentFailures.push(`${sample.id}/${mode}: invented attachment contents`);
        }
      }
    }
  }

  console.log("\nAcceptance summary");
  console.log(`- markdown headings present: ${markdownFailures.length === 0 ? "PASS" : "FAIL"}`);
  if (markdownFailures.length > 0) {
    console.log(`  failures: ${markdownFailures.join(", ")}`);
  }

  console.log(`- preset outputs diverge materially: ${identicalFailures.length === 0 ? "PASS" : "FAIL"}`);
  if (identicalFailures.length > 0) {
    console.log(`  collisions: ${identicalFailures.join(", ")}`);
  }

  console.log(`- referenced tokens remain exact: ${tokenFailures.length === 0 ? "PASS" : "FAIL"}`);
  if (tokenFailures.length > 0) {
    console.log(`  failures: ${tokenFailures.join(", ")}`);
  }

  console.log(
    `- unseen attachments stay referenced, not invented: ${attachmentFailures.length === 0 ? "PASS" : "FAIL"}`,
  );
  if (attachmentFailures.length > 0) {
    console.log(`  failures: ${attachmentFailures.join(", ")}`);
  }

  if (
    markdownFailures.length > 0 ||
    identicalFailures.length > 0 ||
    tokenFailures.length > 0 ||
    attachmentFailures.length > 0
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
  void run();
}

export type { EvalSample, EvalOutput, OpenAITransformMode };
