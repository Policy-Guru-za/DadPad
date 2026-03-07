import { describe, expect, it } from "vitest";
import {
  MARKDOWN_SCAFFOLD_DRIFT_MESSAGE,
  detectUnsupportedMarkdownScaffolding,
  deriveMarkdownIntent,
  normalizePromptMarkdown,
} from "./markdown";

describe("markdown helpers", () => {
  it("detects paragraphs, lists, references, constraints, questions, and section cues", () => {
    const intent = deriveMarkdownIntent(
      "Requirements:\nReview src/App.tsx and docs/PLAN.md.\n\nKeep https://example.com/spec intact, preserve `pnpm test`, use ```ts\nconst x = 1;\n```, do not change the API, and note the attached screenshot if anything remains unclear?\n- Return a patch\n- Confirm open questions",
    );

    expect(intent).toEqual({
      hasExistingParagraphs: true,
      hasListStructure: true,
      hasReferencedFiles: true,
      hasUrls: true,
      hasCodeBlocks: true,
      hasInlineCode: true,
      hasExplicitConstraints: true,
      hasDeliverableLanguage: true,
      hasOpenQuestions: true,
      hasAttachmentReferences: true,
      hasSectionCues: true,
    });
  });

  it("does not treat docs slash paths as unseen attachments", () => {
    const intent = deriveMarkdownIntent(
      "Use docs/POLISHPAD-UI-RESKIN-PROMPT.md and src/App.tsx as repo references.",
    );

    expect(intent.hasReferencedFiles).toBe(true);
    expect(intent.hasAttachmentReferences).toBe(false);
  });

  it("normalizes Markdown outer whitespace and collapses excessive blank lines outside fences", () => {
    expect(
      normalizePromptMarkdown(
        "\n\nIntro line \n\n\n- item one\n\n\n```ts\nconst x = 1;\n\n\nconst y = 2;\n```\n\n\nTail\n\n\n",
      ),
    ).toBe("Intro line\n\n- item one\n\n```ts\nconst x = 1;\n\n\nconst y = 2;\n```\n\nTail");
  });

  it("preserves markdown hard breaks while trimming single trailing spaces", () => {
    expect(
      normalizePromptMarkdown("Line with hard break  \nNext line \n"),
    ).toBe("Line with hard break  \nNext line");
  });

  it("preserves trailing whitespace inside fenced code blocks", () => {
    expect(
      normalizePromptMarkdown("\n```sh\necho hi \nprintf 'x'  \n```\n"),
    ).toBe("```sh\necho hi \nprintf 'x'  \n```");
  });

  it("detects unsupported synthetic scaffold markers absent from the source", () => {
    const findings = detectUnsupportedMarkdownScaffolding(
      "Please read agents.md and update it.",
      "Here is the Markdown version.\n\n## Expected Output\n- done\n\n### Notes\n- preserve file paths",
    );

    expect(findings).toHaveLength(3);
    expect(MARKDOWN_SCAFFOLD_DRIFT_MESSAGE).toContain("unsupported prompt scaffolding");
  });

  it("allows scaffold markers when equivalent headings already exist in the source", () => {
    expect(
      detectUnsupportedMarkdownScaffolding(
        "Objective:\nUpdate agents.md\n\nAcceptance Criteria:\n- preserve content",
        "## Objective\nUpdate agents.md\n\n## Acceptance Criteria\n- preserve content",
      ),
    ).toEqual([]);
  });

  it("allows inline source labels when headings preserve the same structure", () => {
    expect(
      detectUnsupportedMarkdownScaffolding(
        "Objective: Update agents.md\nAcceptance Criteria: Preserve paths",
        "## Objective\nUpdate agents.md\n\n## Acceptance Criteria\nPreserve paths",
      ),
    ).toEqual([]);
  });
});
