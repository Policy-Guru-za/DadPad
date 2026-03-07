import { pathToFileURL } from "node:url";
import { type MarkdownTransformMode } from "../src/providers/openaiPrompting";
import { streamTransformWithOpenAI } from "../src/providers/openai";
import {
  MARKDOWN_SCAFFOLD_DRIFT_MESSAGE,
  detectUnsupportedMarkdownScaffolding,
  normalizePromptMarkdown,
} from "../src/agentPrompts/markdown";
import {
  decodePlaceholders,
  encodeProtectedSpans,
  validatePlaceholders,
} from "../src/protect/placeholders";
import { loadRuntimeConfig } from "./eval-modes";

type EvalSample = {
  id: string;
  label: string;
  input: string;
  expectedTokens?: string[];
};

type EvalOutput = Record<MarkdownTransformMode, string>;

const MODES: MarkdownTransformMode[] = [
  "agent-universal",
  "agent-codex",
  "agent-claude",
];
const NORMALIZED_WHITESPACE_REGEX = /\s+/g;

const EVAL_SAMPLES: EvalSample[] = [
  {
    id: "repo-change-request",
    label: "Repository change request",
    input:
      "Please read src/App.tsx and src/providers/openai.ts. Keep `pnpm test` and `pnpm build` in scope. Do not change the Rust layer. Deliver a patch plus a short verification summary.",
    expectedTokens: ["src/App.tsx", "src/providers/openai.ts", "`pnpm test`", "`pnpm build`"],
  },
  {
    id: "requirements-heavy",
    label: "Requirements-heavy request",
    input:
      "You are an AI coding agent. Review docs/POLISHPAD-UI-RESKIN-PROMPT.md and preserve the existing fenced block:\n```ts\nconst mode = \"polish\";\n```\nDo not invent files or dependencies. Call out any open questions instead of guessing.",
    expectedTokens: [
      "docs/POLISHPAD-UI-RESKIN-PROMPT.md",
      "```ts\nconst mode = \"polish\";\n```",
      "Do not invent files or dependencies.",
    ],
  },
  {
    id: "attachment-reference",
    label: "Attachment reference",
    input:
      "Draft this in clean Markdown. The source also references an attached screenshot and two unseen documents. Keep them only as referenced inputs and do not infer their contents.",
    expectedTokens: ["attached screenshot", "unseen documents"],
  },
];

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s`/.:_-]/gu, " ")
    .replace(NORMALIZED_WHITESPACE_REGEX, " ")
    .trim();
}

async function generateMarkdown(
  sample: EvalSample,
  mode: MarkdownTransformMode,
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
      const output = await generateMarkdown(sample, mode, config);
      outputs[mode] = output;
      console.log(`- ${mode}:\n${output}\n`);
    }

    results.push({ sample, outputs });
  }

  const tokenFailures: string[] = [];
  const scaffoldFailures: string[] = [];
  let divergentSamples = 0;

  for (const { sample, outputs } of results) {
    let sampleHasDivergence = false;

    for (let index = 0; index < MODES.length; index += 1) {
      for (let compareIndex = index + 1; compareIndex < MODES.length; compareIndex += 1) {
        const left = normalizeText(outputs[MODES[index]]);
        const right = normalizeText(outputs[MODES[compareIndex]]);
        if (left !== right) {
          sampleHasDivergence = true;
        }
      }
    }

    if (sampleHasDivergence) {
      divergentSamples += 1;
    }

    for (const mode of MODES) {
      if (sample.expectedTokens) {
        const missing = sample.expectedTokens.filter((token) => !outputs[mode].includes(token));
        if (missing.length > 0) {
          tokenFailures.push(`${sample.id}/${mode}: ${missing.join(", ")}`);
        }
      }

      const scaffoldFindings = detectUnsupportedMarkdownScaffolding(sample.input, outputs[mode]);
      if (scaffoldFindings.length > 0) {
        scaffoldFailures.push(`${sample.id}/${mode}: ${scaffoldFindings.join(", ")}`);
      }
    }
  }

  console.log("\nAcceptance summary");
  console.log(`- referenced tokens remain exact: ${tokenFailures.length === 0 ? "PASS" : "FAIL"}`);
  if (tokenFailures.length > 0) {
    console.log(`  failures: ${tokenFailures.join(", ")}`);
  }

  console.log(
    `- no unsupported meta-scaffold drift: ${scaffoldFailures.length === 0 ? "PASS" : "FAIL"}`,
  );
  if (scaffoldFailures.length > 0) {
    console.log(`  failures: ${scaffoldFailures.join(", ")}`);
    console.log(`  expected guard message: ${MARKDOWN_SCAFFOLD_DRIFT_MESSAGE}`);
  }

  console.log(
    `- presets show at least some layout bias across corpus: ${divergentSamples > 0 ? "PASS" : "FAIL"} (${divergentSamples}/${results.length} samples)`,
  );

  if (tokenFailures.length > 0 || scaffoldFailures.length > 0 || divergentSamples === 0) {
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
