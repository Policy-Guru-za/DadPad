import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import {
  DEFAULT_OPENAI_MODEL,
  type OpenAITransformMode,
} from "../src/providers/openaiPrompting";
import { streamTransformWithOpenAI } from "../src/providers/openai";

type EvalSample = {
  id: string;
  label: string;
  input: string;
  workplace: boolean;
  directEligible: boolean;
  scaffoldAbsent: boolean;
  englishInput: boolean;
  polishMaxFormalityDelta?: number;
  polishShouldStayProse?: boolean;
  polishShouldAddStructure?: boolean;
  polishBlockedPhrases?: string[];
};

type EvalOutput = Record<OpenAITransformMode, string>;

type RuntimeConfig = {
  openaiApiKey: string;
  model: string;
  temperature: number;
};

type StoredConfig = Partial<RuntimeConfig>;

type RuntimeEnvironment = {
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  OPENAI_TEMPERATURE?: string;
};

type LoadRuntimeConfigOptions = {
  env?: RuntimeEnvironment;
  readConfig?: () => StoredConfig | null;
  onWarning?: (message: string) => void;
};

const EVAL_SAMPLES: EvalSample[] = [
  {
    id: "peter-email",
    label: "Voice-preserving casual email",
    input:
      "Hi Peter i was meaning to send this yesterday but then totaly forgot and now everything is a bit all over the place. The meeting we had last week was useful I think but there was still a lot of stuff that wasnt really clear to me, especialy around who is suppose to be doing what and by when. Also the numbers in that document dont really add up in my opinion and I dont know if thats because im reading it wrong or if somebody changed something after the fact. anyway can you just let me know what the actual latest version is because i have about 3 different ones and all of them seem kind of different.\n\nAlso with regards to the holiday thing, I dont know what the plan is anymore because Susan said one thing on monday and then Dave said something completley different on wednesday and now im not even sure if were still going ahead with it or not. If we are then somebody needs to book it soon otherwise the prices is going to go up again which is what happened last time and it was honestly a mess. I dont mind helping with sorting it out but I need proper information first because right now it feels like everybody is just saying things and nobody is actually deciding anything.\n\nOn a seperate note I tried that new app you sent me and to be honest its not really working properly on my side. It keeps freezing when I click the button and then when it finally does something the output looks weird and half the words is missing or repeated. maybe its because my internet was bad I dont know, but either way its frustrating and I wouldnt send it to anybody else yet until its more stable. let me know when youve fixed the main bugs and then ill test it again.",
    workplace: true,
    directEligible: true,
    scaffoldAbsent: false,
    englishInput: true,
    polishMaxFormalityDelta: 1,
    polishShouldStayProse: true,
    polishShouldAddStructure: true,
    polishBlockedPhrases: [
      "regarding the holiday plan",
      "im unclear about the current plan",
      "in my view",
      "several items",
      "separately",
      "on my end",
    ],
  },
  {
    id: "rough-dictation",
    label: "Rough dictation",
    input:
      "Hey team, um, I just wanted to kind of check in about the website launch because I feel like there are still a bunch of things that are maybe not fully finished and I think we probably need to decide what we're doing by Friday if that works for everyone.",
    workplace: true,
    directEligible: true,
    scaffoldAbsent: false,
    englishInput: true,
  },
  {
    id: "already-clean-informal",
    label: "Already clean informal note",
    input:
      "Hey, I saw your note. Monday works for me, so let's just keep it as is unless something changes.",
    workplace: false,
    directEligible: false,
    scaffoldAbsent: false,
    englishInput: true,
    polishMaxFormalityDelta: 1,
    polishShouldStayProse: true,
  },
  {
    id: "short-blunt-request",
    label: "Short blunt request",
    input: "Need the latest numbers today so I can finish this.",
    workplace: true,
    directEligible: false,
    scaffoldAbsent: true,
    englishInput: true,
    polishMaxFormalityDelta: 1,
    polishShouldStayProse: true,
  },
  {
    id: "short-request",
    label: "Short request",
    input: "can you send me the file when you have a chance thanks",
    workplace: true,
    directEligible: false,
    scaffoldAbsent: true,
    englishInput: true,
  },
  {
    id: "list-shaped-plan",
    label: "Naturally list-shaped note",
    input:
      "Before Friday I need three things: the final budget, confirmation from ops on staffing, and a yes or no on whether we are moving the launch review.",
    workplace: true,
    directEligible: true,
    scaffoldAbsent: true,
    englishInput: true,
  },
  {
    id: "wall-of-text",
    label: "Paragraph-heavy wall of text",
    input:
      "I know we said we would make a call on this by today but I still feel like a few parts are not lined up yet and I do not want us to rush into sending something that creates more confusion. The copy is close, the numbers are still moving, and I am not fully sure which version we are actually treating as final. If somebody has made that call already then please just tell me which one it is so I can stop working off the wrong draft and get this moving again.",
    workplace: true,
    directEligible: true,
    scaffoldAbsent: true,
    englishInput: true,
    polishMaxFormalityDelta: 1,
    polishShouldStayProse: true,
    polishShouldAddStructure: true,
  },
  {
    id: "schedule-move",
    label: "Scheduling note",
    input:
      "I think we maybe need to move the meeting because I am still waiting on the numbers and I do not want to waste everyones time.",
    workplace: true,
    directEligible: true,
    scaffoldAbsent: true,
    englishInput: true,
  },
  {
    id: "casual-checkin",
    label: "Casual check-in",
    input:
      "Hey, just checking if you saw my last message and if you are okay with us pushing this to Monday.",
    workplace: true,
    directEligible: true,
    scaffoldAbsent: false,
    englishInput: true,
  },
  {
    id: "status-update",
    label: "Workplace update",
    input:
      "The mockups are mostly done but the billing flow still has edge cases and QA found two pretty bad issues that we need to look at before we call this ready.",
    workplace: true,
    directEligible: true,
    scaffoldAbsent: true,
    englishInput: true,
  },
  {
    id: "decision-request",
    label: "Decision request",
    input:
      "I need a yes or no on whether we are shipping the new onboarding this week because support needs a heads up and I do not want to keep them waiting.",
    workplace: true,
    directEligible: true,
    scaffoldAbsent: true,
    englishInput: true,
  },
  {
    id: "follow-up",
    label: "Follow-up reminder",
    input:
      "Following up on the contract. We still need the final redlines before legal can sign off, and I would appreciate it if you could send them today.",
    workplace: true,
    directEligible: true,
    scaffoldAbsent: true,
    englishInput: true,
  },
  {
    id: "slack-note",
    label: "Slack update",
    input:
      "We pushed the fix, but I am not totally confident about the analytics numbers yet, so I want to keep monitoring this for the rest of the day.",
    workplace: true,
    directEligible: true,
    scaffoldAbsent: true,
    englishInput: true,
  },
  {
    id: "multi-topic",
    label: "Multi-topic note",
    input:
      "Thanks for sending the draft. I like the first section, but the pricing paragraph still feels confusing. Also, can we move tomorrow's review to the afternoon?",
    workplace: true,
    directEligible: true,
    scaffoldAbsent: false,
    englishInput: true,
  },
  {
    id: "client-update",
    label: "Client-facing update",
    input:
      "I want to let the client know that we are making progress, but I do not want to overpromise because the migration still has some risk.",
    workplace: true,
    directEligible: true,
    scaffoldAbsent: true,
    englishInput: true,
  },
  {
    id: "already-clean",
    label: "Already clean",
    input: "Please confirm whether Monday afternoon still works for the review.",
    workplace: true,
    directEligible: false,
    scaffoldAbsent: true,
    englishInput: true,
  },
  {
    id: "action-request",
    label: "Action request",
    input:
      "If we are not going to use the current plan, I need someone to tell me today so I can update the timeline and let the rest of the group know.",
    workplace: true,
    directEligible: true,
    scaffoldAbsent: true,
    englishInput: true,
  },
];

const DISTINCTNESS_MODES: OpenAITransformMode[] = [
  "polish",
  "casual",
  "professional",
  "direct",
];
const MODES: OpenAITransformMode[] = [...DISTINCTNESS_MODES];
const BULLET_LINE_REGEX = /^\s*(?:[-*•]|\d+[.)])\s+\S/m;
const BLANK_LINE_REGEX = /\n\s*\n/;
const GREETING_REGEX = /^(hi|hello|dear)\b/i;
const SIGN_OFF_REGEX =
  /\b(best|best regards|kind regards|regards|sincerely|thank you),?\s*(?:\[[^\]]+\]|\n|$)/i;
const PLACEHOLDER_SIGNATURE_REGEX = /\[your name\]/i;
const FORMAL_MARKERS = [
  "please",
  "appreciate",
  "regarding",
  "proceed",
  "confirm",
  "comfortable with",
  "i would like",
  "i’d like",
  "at your earliest convenience",
  "how to proceed",
  "as i am",
  "do not",
  "identified",
  "continue monitoring",
  "several items",
  "workplace",
];
const CASUAL_MARKERS = [
  "hey",
  "just",
  "wanted to",
  "want to",
  "a bunch",
  "okay",
  "thanks",
  "check in",
  "works for everyone",
  "we’re",
  "i’m",
  "might",
  "because",
  "pretty bad",
  "keep monitoring",
  "a bunch",
];
const POLISH_TRANSLATION_MARKERS = new Set([
  "hej",
  "zespole",
  "chciałem",
  "sprawdzić",
  "uruchomienia",
  "strony",
  "internetowej",
  "wrażenie",
  "powinniśmy",
  "piątku",
]);

function normalizeText(value: string): string {
  return value
    .replace(/[’]/g, "'")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildBigrams(value: string): string[] {
  const padded = ` ${value} `;
  const bigrams: string[] = [];
  for (let index = 0; index < padded.length - 1; index += 1) {
    bigrams.push(padded.slice(index, index + 2));
  }
  return bigrams;
}

function diceSimilarity(left: string, right: string): number {
  if (left === right) {
    return 1;
  }

  const leftBigrams = buildBigrams(left);
  const rightBigrams = buildBigrams(right);
  if (leftBigrams.length === 0 || rightBigrams.length === 0) {
    return 0;
  }

  const rightCounts = new Map<string, number>();
  for (const bigram of rightBigrams) {
    rightCounts.set(bigram, (rightCounts.get(bigram) ?? 0) + 1);
  }

  let overlap = 0;
  for (const bigram of leftBigrams) {
    const count = rightCounts.get(bigram) ?? 0;
    if (count > 0) {
      overlap += 1;
      rightCounts.set(bigram, count - 1);
    }
  }

  return (2 * overlap) / (leftBigrams.length + rightBigrams.length);
}

function countMarkerHits(text: string, markers: string[]): number {
  const normalized = normalizeText(text);
  return markers.reduce((count, marker) => {
    if (normalized.includes(marker)) {
      return count + 1;
    }
    return count;
  }, 0);
}

function formalityScore(text: string): number {
  return countMarkerHits(text, FORMAL_MARKERS) - countMarkerHits(text, CASUAL_MARKERS);
}

function hasInventedEmailScaffolding(text: string): boolean {
  return (
    GREETING_REGEX.test(text.trim()) ||
    SIGN_OFF_REGEX.test(text.trim()) ||
    PLACEHOLDER_SIGNATURE_REGEX.test(text)
  );
}

function likelyTranslatedToPolish(text: string): boolean {
  const words = normalizeText(text).split(" ");
  let matches = 0;
  for (const word of words) {
    if (POLISH_TRANSLATION_MARKERS.has(word)) {
      matches += 1;
    }
  }
  return matches >= 2;
}

function hasBulletLines(text: string): boolean {
  return BULLET_LINE_REGEX.test(text);
}

function hasParagraphBreak(text: string): boolean {
  return BLANK_LINE_REGEX.test(text);
}

function resolveConfigPath(...segments: string[]): string {
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", "DadPad", ...segments);
  }

  if (process.platform === "win32") {
    const appData =
      process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
    return path.join(appData, "DadPad", ...segments);
  }

  const xdgConfigHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
  return path.join(xdgConfigHome, "DadPad", ...segments);
}

function readConfigFromDisk(): StoredConfig | null {
  const keyPath = resolveConfigPath("encryption.key");
  const configPath = resolveConfigPath("config.enc");
  if (!fs.existsSync(keyPath) || !fs.existsSync(configPath)) {
    return null;
  }

  const key = fs.readFileSync(keyPath);
  const payload = fs.readFileSync(configPath);
  const nonce = payload.subarray(0, 12);
  const ciphertext = payload.subarray(12, payload.length - 16);
  const authTag = payload.subarray(payload.length - 16);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8")) as StoredConfig;
}

function readConfigFromDiskSafely(
  readConfig: () => StoredConfig | null,
  onWarning: (message: string) => void,
): StoredConfig | null {
  try {
    return readConfig();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    onWarning(
      `Ignoring unreadable DadPad config in ${resolveConfigPath("config.enc")}: ${message}`,
    );
    return null;
  }
}

export function loadRuntimeConfig(options: LoadRuntimeConfigOptions = {}): RuntimeConfig {
  const env = options.env ?? process.env;
  const readConfig = options.readConfig ?? readConfigFromDisk;
  const onWarning = options.onWarning ?? ((message: string) => console.warn(message));

  const envApiKey = env.OPENAI_API_KEY?.trim() ?? "";
  const envModel = env.OPENAI_MODEL?.trim() ?? "";
  const envTemperature = env.OPENAI_TEMPERATURE;

  const shouldReadDiskConfig =
    envApiKey.length === 0 || envModel.length === 0 || envTemperature === undefined;
  const diskConfig = shouldReadDiskConfig ? readConfigFromDiskSafely(readConfig, onWarning) : null;

  const openaiApiKey = envApiKey || diskConfig?.openaiApiKey?.trim() || "";
  const model = envModel || diskConfig?.model?.trim() || DEFAULT_OPENAI_MODEL;
  const temperatureRaw = Number(envTemperature ?? diskConfig?.temperature ?? 0.2);

  if (!openaiApiKey.trim()) {
    throw new Error(
      "No OpenAI API key found. Set OPENAI_API_KEY or save one in the app settings first.",
    );
  }

  return {
    openaiApiKey: openaiApiKey.trim(),
    model: model.trim() || DEFAULT_OPENAI_MODEL,
    temperature: Number.isFinite(temperatureRaw) ? temperatureRaw : 0.2,
  };
}

function printSimilarityMatrix(outputs: EvalOutput): void {
  const pairs: Array<[OpenAITransformMode, OpenAITransformMode]> = [
    ["polish", "casual"],
    ["polish", "professional"],
    ["polish", "direct"],
    ["casual", "professional"],
    ["casual", "direct"],
    ["professional", "direct"],
  ];

  for (const [left, right] of pairs) {
    const similarity = diceSimilarity(normalizeText(outputs[left]), normalizeText(outputs[right]));
    console.log(`  similarity ${left}/${right}: ${similarity.toFixed(3)}`);
  }
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
    console.log(`input (${sample.input.length} chars): ${sample.input}`);

    for (const mode of MODES) {
      const result = await streamTransformWithOpenAI({
        apiKey: config.openaiApiKey,
        inputText: sample.input,
        mode,
        model: config.model,
        temperature: config.temperature,
        streaming: true,
        timeoutMs: 30_000,
        onDelta: () => undefined,
      });
      outputs[mode] = result.outputText;
      const charDelta = result.outputText.length - sample.input.length;
      console.log(
        `- ${mode} (${result.outputText.length} chars, delta ${charDelta}): ${result.outputText}`,
      );
    }

    printSimilarityMatrix(outputs);
    results.push({ sample, outputs });
  }

  const identicalFailures: string[] = [];
  let directEligibleCount = 0;
  let directShorterCount = 0;
  const professionalScaffoldingFailures: string[] = [];
  const casualFormalityFailures: string[] = [];
  const languageFailures: string[] = [];
  const polishFormalityFailures: string[] = [];
  const polishBulletFailures: string[] = [];
  const polishStructureFailures: string[] = [];
  const polishBlockedPhraseFailures: string[] = [];

  for (const { sample, outputs } of results) {
    const normalizedOutputs = DISTINCTNESS_MODES.map((mode) => ({
      mode,
      normalized: normalizeText(outputs[mode]),
    }));

    for (let index = 0; index < normalizedOutputs.length; index += 1) {
      for (
        let compareIndex = index + 1;
        compareIndex < normalizedOutputs.length;
        compareIndex += 1
      ) {
        const left = normalizedOutputs[index];
        const right = normalizedOutputs[compareIndex];
        if (left.normalized === right.normalized) {
          identicalFailures.push(`${sample.id}: ${left.mode} == ${right.mode}`);
        }
      }
    }

    if (sample.directEligible) {
      directEligibleCount += 1;
      if (outputs.direct.length < outputs.polish.length) {
        directShorterCount += 1;
      }
    }

    if (sample.scaffoldAbsent && hasInventedEmailScaffolding(outputs.professional)) {
      professionalScaffoldingFailures.push(sample.id);
    }

    if (
      sample.workplace &&
      formalityScore(outputs.casual) >= formalityScore(outputs.professional)
    ) {
      casualFormalityFailures.push(sample.id);
    }

    if (sample.englishInput && likelyTranslatedToPolish(outputs.polish)) {
      languageFailures.push(sample.id);
    }

    if (sample.polishMaxFormalityDelta !== undefined) {
      const inputFormality = formalityScore(sample.input);
      const outputFormality = formalityScore(outputs.polish);
      if (outputFormality > inputFormality + sample.polishMaxFormalityDelta) {
        polishFormalityFailures.push(
          `${sample.id} (${inputFormality} -> ${outputFormality})`,
        );
      }
    }

    if (sample.polishShouldStayProse && hasBulletLines(outputs.polish)) {
      polishBulletFailures.push(sample.id);
    }

    if (
      sample.polishShouldAddStructure &&
      !hasParagraphBreak(outputs.polish) &&
      !hasBulletLines(outputs.polish)
    ) {
      polishStructureFailures.push(sample.id);
    }

    if (sample.polishBlockedPhrases) {
      const normalizedPolish = normalizeText(outputs.polish);
      const hits = sample.polishBlockedPhrases.filter((phrase) =>
        normalizedPolish.includes(normalizeText(phrase)),
      );
      if (hits.length > 0) {
        polishBlockedPhraseFailures.push(`${sample.id}: ${hits.join(", ")}`);
      }
    }
  }

  const directShorterRate =
    directEligibleCount === 0 ? 1 : directShorterCount / directEligibleCount;

  console.log("\nAcceptance summary");
  console.log(
    `- unique normalized outputs: ${identicalFailures.length === 0 ? "PASS" : "FAIL"} (${results.length} samples)`,
  );
  if (identicalFailures.length > 0) {
    console.log(`  collisions: ${identicalFailures.join(", ")}`);
  }

  console.log(
    `- direct shorter than polish on eligible inputs: ${directShorterRate >= 0.8 ? "PASS" : "FAIL"} (${directShorterCount}/${directEligibleCount})`,
  );
  console.log(
    `- professional adds no new email scaffolding: ${professionalScaffoldingFailures.length === 0 ? "PASS" : "FAIL"}`,
  );
  if (professionalScaffoldingFailures.length > 0) {
    console.log(`  scaffolding failures: ${professionalScaffoldingFailures.join(", ")}`);
  }

  console.log(
    `- casual less formal than professional on workplace inputs: ${casualFormalityFailures.length === 0 ? "PASS" : "FAIL"}`,
  );
  if (casualFormalityFailures.length > 0) {
    console.log(`  formality failures: ${casualFormalityFailures.join(", ")}`);
  }

  console.log(
    `- polish preserves English without translation markers: ${languageFailures.length === 0 ? "PASS" : "FAIL"}`,
  );
  if (languageFailures.length > 0) {
    console.log(`  translation failures: ${languageFailures.join(", ")}`);
  }

  console.log(
    `- polish keeps bounded formality drift on voice-preservation samples: ${polishFormalityFailures.length === 0 ? "PASS" : "FAIL"}`,
  );
  if (polishFormalityFailures.length > 0) {
    console.log(`  formality drift failures: ${polishFormalityFailures.join(", ")}`);
  }

  console.log(
    `- polish avoids unnecessary bullets on prose samples: ${polishBulletFailures.length === 0 ? "PASS" : "FAIL"}`,
  );
  if (polishBulletFailures.length > 0) {
    console.log(`  bullet failures: ${polishBulletFailures.join(", ")}`);
  }

  console.log(
    `- polish adds paragraph/list structure where needed: ${polishStructureFailures.length === 0 ? "PASS" : "FAIL"}`,
  );
  if (polishStructureFailures.length > 0) {
    console.log(`  structure failures: ${polishStructureFailures.join(", ")}`);
  }

  console.log(
    `- polish avoids assistant-like blocked phrases on reference samples: ${polishBlockedPhraseFailures.length === 0 ? "PASS" : "FAIL"}`,
  );
  if (polishBlockedPhraseFailures.length > 0) {
    console.log(`  blocked phrase failures: ${polishBlockedPhraseFailures.join(", ")}`);
  }

  if (
    identicalFailures.length > 0 ||
    directShorterRate < 0.8 ||
    professionalScaffoldingFailures.length > 0 ||
    casualFormalityFailures.length > 0 ||
    languageFailures.length > 0 ||
    polishFormalityFailures.length > 0 ||
    polishBulletFailures.length > 0 ||
    polishStructureFailures.length > 0 ||
    polishBlockedPhraseFailures.length > 0
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
