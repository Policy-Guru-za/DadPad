import { describe, expect, it } from "vitest";
import { deriveAgentPromptIntent, normalizePromptMarkdown } from "./markdown";

describe("agent prompt markdown helpers", () => {
  it("detects referenced files, URLs, code, constraints, and unseen references", () => {
    const intent = deriveAgentPromptIntent(
      "Review src/App.tsx and docs/PLAN.md, keep https://example.com/spec intact, preserve `pnpm test`, use ```ts\nconst x = 1;\n```, do not change the API, and note the attached screenshot if anything remains unclear?",
    );

    expect(intent).toEqual({
      hasReferencedFiles: true,
      hasUrls: true,
      hasCodeBlocks: true,
      hasInlineCode: true,
      hasExplicitConstraints: true,
      hasDeliverableLanguage: true,
      hasOpenQuestions: true,
      hasAttachmentReferences: true,
      hasListStructure: false,
    });
  });

  it("detects deliverable language and existing list structure", () => {
    const intent = deriveAgentPromptIntent(
      "- Produce a Markdown plan\n- Return a patch summary\n- Confirm open questions",
    );

    expect(intent.hasDeliverableLanguage).toBe(true);
    expect(intent.hasListStructure).toBe(true);
  });

  it("does not treat docs slash paths as unseen attachments", () => {
    const intent = deriveAgentPromptIntent(
      "Use docs/POLISHPAD-UI-RESKIN-PROMPT.md and src/App.tsx as repo references.",
    );

    expect(intent.hasReferencedFiles).toBe(true);
    expect(intent.hasAttachmentReferences).toBe(false);
  });

  it("normalizes only outer blank lines in Markdown output", () => {
    expect(
      normalizePromptMarkdown(
        "\n\n## Objective  \nShip the fix.  \n\n- item one  \n- item two\n\n\n",
      ),
    ).toBe("## Objective  \nShip the fix.  \n\n- item one  \n- item two");
  });

  it("preserves fenced code spacing and internal blank lines", () => {
    expect(
      normalizePromptMarkdown(
        "\n```ts\nconst x = 1;\n\n\nconst y = 2;\n```\n",
      ),
    ).toBe("```ts\nconst x = 1;\n\n\nconst y = 2;\n```");
  });
});
