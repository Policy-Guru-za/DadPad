import { describe, expect, it } from "vitest";
import { deriveStructureIntent, normalizeStructuredPlainText } from "./plainText";

describe("smart structuring helpers", () => {
  it("disables structure intent cleanly when the setting is off", () => {
    expect(deriveStructureIntent("Please send the file.", "polish", false)).toEqual({
      enabled: false,
      targetShape: "paragraphs",
      isolateRequest: false,
      isolateClosing: false,
      preserveExistingLists: false,
      preserveExistingParagraphs: false,
      inferredContentType: "message",
    });
  });

  it("detects dense single-block prose that should become paragraphs", () => {
    const intent = deriveStructureIntent(
      "Hello Banksy, I want to confirm we are aligned on the way forward. Automating certain functions is a top priority, and we should explore how to use AI effectively. Please send me a detailed email outlining which functions you need automated. I look forward to hearing from you.",
      "polish",
    );

    expect(intent.enabled).toBe(true);
    expect(intent.targetShape).toBe("paragraphs");
    expect(intent.isolateRequest).toBe(true);
    expect(intent.isolateClosing).toBe(true);
    expect(intent.preserveExistingParagraphs).toBe(false);
  });

  it("prefers bullets for compact multi-item asks in direct mode", () => {
    const intent = deriveStructureIntent(
      "Please send the redlines, confirm the review time, and share the revised budget today.",
      "direct",
    );

    expect(intent.targetShape).toBe("bullets");
    expect(intent.isolateRequest).toBe(true);
  });

  it("keeps multi-ask polish prose in paragraphs unless it is explicitly list-shaped", () => {
    const intent = deriveStructureIntent(
      "Can you send me the latest budget, let me know which version is current, and tell me if we are still meeting tomorrow? I have three different drafts and I do not know which one is right.",
      "polish",
    );

    expect(intent.targetShape).toBe("paragraphs");
    expect(intent.isolateRequest).toBe(true);
  });

  it("keeps email mode in paragraphs for compact multi-ask prose", () => {
    const intent = deriveStructureIntent(
      "Can you send me the latest budget, let me know which version is current, and tell me if we are still meeting tomorrow? I have three different drafts and I do not know which one is right.",
      "email",
    );

    expect(intent.targetShape).toBe("paragraphs");
    expect(intent.isolateRequest).toBe(true);
  });

  it("allows hybrid structure for explicitly list-shaped polish content", () => {
    const intent = deriveStructureIntent(
      "Before Friday I need three things: the final budget, confirmation from ops on staffing, and a yes or no on whether we are moving the launch review.",
      "polish",
    );

    expect(intent.targetShape).toBe("hybrid");
    expect(intent.isolateRequest).toBe(true);
  });

  it("preserves readable existing bullets", () => {
    const intent = deriveStructureIntent(
      "- Review the latest draft\n- Confirm Monday works\n- Share the final numbers",
      "professional",
    );

    expect(intent.targetShape).toBe("bullets");
    expect(intent.preserveExistingLists).toBe(true);
    expect(intent.inferredContentType).toBe("note");
  });

  it("detects existing paragraph structure in an already clean note", () => {
    const intent = deriveStructureIntent(
      "The draft is in good shape.\n\nPlease confirm whether Monday afternoon still works for the review.",
      "professional",
    );

    expect(intent.targetShape).toBe("paragraphs");
    expect(intent.preserveExistingParagraphs).toBe(true);
    expect(intent.isolateRequest).toBe(true);
  });

  it("does not over-interpret a short one-line message as a closing-heavy email", () => {
    const intent = deriveStructureIntent("Can you send the file today?", "casual");

    expect(intent.targetShape).toBe("paragraphs");
    expect(intent.isolateRequest).toBe(true);
    expect(intent.isolateClosing).toBe(false);
    expect(intent.inferredContentType).toBe("note");
  });

  it("normalizes whitespace and bullet spacing without changing paragraph text", () => {
    expect(
      normalizeStructuredPlainText("\nFirst paragraph.  \n\n\n- item one \n2)second item\n\n"),
    ).toBe("First paragraph.\n\n- item one\n2) second item");
  });

  it("does not rewrite decimals or separators that only resemble list markers", () => {
    expect(normalizeStructuredPlainText("1.23 revenue\n---\n2)follow up")).toBe(
      "1.23 revenue\n---\n2) follow up",
    );
  });
});
