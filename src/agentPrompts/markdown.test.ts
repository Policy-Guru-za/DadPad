import { describe, expect, it } from "vitest";
import {
  MARKDOWN_INSUFFICIENT_STRUCTURE_MESSAGE,
  MARKDOWN_SCAFFOLD_DRIFT_MESSAGE,
  detectInsufficientMarkdownization,
  detectUnsupportedMarkdownScaffolding,
  deriveMarkdownIntent,
  normalizePromptMarkdown,
} from "./markdown";

describe("markdown helpers", () => {
  it("detects non-trivial prose that requires visible Markdown structure", () => {
    const intent = deriveMarkdownIntent(
      "Please read src/App.tsx and docs/PLAN.md, keep https://example.com/spec intact, preserve `pnpm test`, do not change the Rust layer, return a patch, and call out any open questions.",
    );

    expect(intent).toMatchObject({
      hasReferencedFiles: true,
      hasUrls: true,
      hasInlineCode: true,
      hasExplicitConstraints: true,
      hasDeliverableLanguage: true,
      hasOpenQuestions: true,
      hasMultipleActionItems: true,
      hasConstraintCluster: true,
      hasReferenceCluster: true,
      hasExistingMarkdownSyntax: false,
      shouldRequireVisibleStructure: true,
    });
  });

  it("does not require visible structure for a very short simple instruction", () => {
    const intent = deriveMarkdownIntent("Please review this.");

    expect(intent.shouldRequireVisibleStructure).toBe(false);
  });

  it("recognizes existing visible Markdown syntax and keeps visible structure required", () => {
    const intent = deriveMarkdownIntent("## Task\n- Keep src/App.tsx unchanged\n- Run `pnpm test`");

    expect(intent.hasExistingMarkdownSyntax).toBe(true);
    expect(intent.shouldRequireVisibleStructure).toBe(true);
  });

  it("ignores URL query text when scoring prompt complexity", () => {
    const intent = deriveMarkdownIntent("Review https://example.com/spec?draft=1 and report back.");

    expect(intent.hasUrls).toBe(true);
    expect(intent.hasOpenQuestions).toBe(false);
    expect(intent.hasMultipleActionItems).toBe(false);
    expect(intent.shouldRequireVisibleStructure).toBe(false);
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
        "\n\n## Task\n\n\n- item one\n\n\n```ts\nconst x = 1;\n\n\nconst y = 2;\n```\n\n\nTail\n\n\n",
      ),
    ).toBe("## Task\n\n- item one\n\n```ts\nconst x = 1;\n\n\nconst y = 2;\n```\n\nTail");
  });

  it("preserves markdown hard breaks and fenced trailing spaces", () => {
    expect(normalizePromptMarkdown("Line with hard break  \nNext line \n")).toBe(
      "Line with hard break  \nNext line",
    );
    expect(normalizePromptMarkdown("\n```sh\necho hi \nprintf 'x'  \n```\n")).toBe(
      "```sh\necho hi \nprintf 'x'  \n```",
    );
  });

  it("rejects prose-only near-no-op markdown output for qualifying inputs", () => {
    const source =
      "Please read agents.md, compare it to the build loop, identify gaps, preserve file paths, and return a patch plus open questions.";
    const intent = deriveMarkdownIntent(source);
    const output =
      "Please read agents.md, compare it to the build loop, identify the gaps, preserve file paths, and return a patch plus open questions.";

    expect(detectInsufficientMarkdownization(source, output, intent)).toBe(true);
    expect(MARKDOWN_INSUFFICIENT_STRUCTURE_MESSAGE).toContain("visible Markdown structure");
  });

  it("accepts visibly structured Markdown for qualifying inputs", () => {
    const source =
      "Please read agents.md, compare it to the build loop, identify gaps, preserve file paths, and return a patch plus open questions.";
    const intent = deriveMarkdownIntent(source);
    const output = [
      "## Task",
      "- Read `agents.md`.",
      "- Compare it to the build loop.",
      "- Identify the gaps.",
      "",
      "## Constraints",
      "- Preserve file paths exactly.",
      "",
      "## Deliverable",
      "- Return a patch.",
      "",
      "## Questions",
      "- Capture any open questions.",
    ].join("\n");

    expect(detectInsufficientMarkdownization(source, output, intent)).toBe(false);
  });

  it("rejects prose output that flattens existing visible Markdown", () => {
    const source = "## Task\n- Read agents.md\n- Run `pnpm test`";
    const intent = deriveMarkdownIntent(source);
    const output = "Read agents.md and run `pnpm test`.";

    expect(detectInsufficientMarkdownization(source, output, intent)).toBe(true);
  });

  it("detects unsupported synthetic scaffold markers absent from the source", () => {
    const findings = detectUnsupportedMarkdownScaffolding(
      "Please read agents.md and update it.",
      "Here is the Markdown version.\n\n## Expected Output\n- done\n\n### Notes\n- preserve file paths",
    );

    expect(findings).toHaveLength(3);
    expect(MARKDOWN_SCAFFOLD_DRIFT_MESSAGE).toContain("unsupported prompt scaffolding");
  });

  it("allows grounded neutral headings and inline label upgrades", () => {
    expect(
      detectUnsupportedMarkdownScaffolding(
        "Task: Update agents.md\nConstraints: Preserve paths",
        "## Task\nUpdate agents.md\n\n## Constraints\nPreserve paths",
      ),
    ).toEqual([]);
  });

  it("allows grounded files and validation headings when the source implies them", () => {
    expect(
      detectUnsupportedMarkdownScaffolding(
        "Please update src/App.tsx and run `pnpm test` before handing off.",
        "## Files\n- src/App.tsx\n\n## Validation\n- Run `pnpm test`.",
      ),
    ).toEqual([]);
  });

  it("rejects ungrounded neutral headings that are absent from the source", () => {
    expect(
      detectUnsupportedMarkdownScaffolding(
        "Please look at this note.",
        "## Constraints\n- Keep it short.\n\n## Deliverable\n- Return Markdown.",
      ),
    ).toEqual(["ungrounded-heading:constraints", "ungrounded-heading:deliverable"]);
  });

  it("still allows old scaffold headings only when the source already had them", () => {
    expect(
      detectUnsupportedMarkdownScaffolding(
        "Objective: Update agents.md\nAcceptance Criteria: Preserve paths",
        "## Objective\nUpdate agents.md\n\n## Acceptance Criteria\nPreserve paths",
      ),
    ).toEqual([]);
  });
});
