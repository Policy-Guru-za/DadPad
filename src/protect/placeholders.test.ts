import { describe, expect, it } from "vitest";
import {
  decodePlaceholders,
  encodeProtectedSpans,
  validatePlaceholders,
} from "./placeholders";

function roundTrip(text: string): string {
  const { encodedText, mapping } = encodeProtectedSpans(text);
  const decodedText = decodePlaceholders(encodedText, mapping);
  const validation = validatePlaceholders(decodedText, mapping);
  expect(validation.ok).toBe(true);
  return decodedText;
}

describe("placeholder protection", () => {
  it("preserves markdown links as a single protected span", () => {
    const text = "Read [docs](https://example.com/docs?q=1) before shipping.";
    const { encodedText, mapping } = encodeProtectedSpans(text);

    expect(mapping).toHaveLength(1);
    expect(mapping[0]?.kind).toBe("markdown_link");
    expect(mapping[0]?.original).toBe("[docs](https://example.com/docs?q=1)");
    expect(encodedText).toContain("__PZPTOK001__");
    expect(roundTrip(text)).toBe(text);
  });

  it("preserves markdown links with parentheses in the URL", () => {
    const text = "See [wiki](https://en.wikipedia.org/wiki/Function_(mathematics)) for details.";
    const { mapping } = encodeProtectedSpans(text);

    expect(mapping).toHaveLength(1);
    expect(mapping[0]?.kind).toBe("markdown_link");
    expect(mapping[0]?.original).toBe("[wiki](https://en.wikipedia.org/wiki/Function_(mathematics))");
    expect(roundTrip(text)).toBe(text);
  });

  it("preserves inline code spans", () => {
    const text = "Run `pnpm tauri dev` and then continue.";
    const { mapping } = encodeProtectedSpans(text);

    expect(mapping).toHaveLength(1);
    expect(mapping[0]?.kind).toBe("inline_code");
    expect(roundTrip(text)).toBe(text);
  });

  it("preserves fenced code blocks", () => {
    const text = "Config:\n```bash\npnpm install\npnpm test\n```\nDone.";
    const { mapping } = encodeProtectedSpans(text);

    expect(mapping).toHaveLength(1);
    expect(mapping[0]?.kind).toBe("fenced_code");
    expect(roundTrip(text)).toBe(text);
  });

  it("preserves urls and emails", () => {
    const text = "Contact ryan@example.com or visit https://polishpad.dev/docs now.";
    const { mapping } = encodeProtectedSpans(text);
    const kinds = mapping.map((entry) => entry.kind);

    expect(kinds).toContain("email");
    expect(kinds).toContain("url");
    expect(roundTrip(text)).toBe(text);
  });

  it("skips literal placeholder tokens already present in source text", () => {
    const text = "Keep __PZPTOK001__ as-is and visit https://polishpad.dev/docs.";
    const { encodedText, mapping } = encodeProtectedSpans(text);

    expect(mapping).toHaveLength(1);
    expect(mapping[0]?.token).not.toBe("__PZPTOK001__");
    expect(encodedText).toContain("__PZPTOK001__");

    const decodedText = decodePlaceholders(encodedText, mapping);
    const validation = validatePlaceholders(decodedText, mapping);

    expect(validation.ok).toBe(true);
    expect(decodedText).toBe(text);
  });

  it("rejects duplicated placeholder tokens during validation", () => {
    const text = "Visit https://polishpad.dev/docs now.";
    const { encodedText, mapping } = encodeProtectedSpans(text);
    const duplicatedOutput = encodedText.replace("__PZPTOK001__", "__PZPTOK001__ and __PZPTOK001__");

    decodePlaceholders(duplicatedOutput, mapping);
    const validation = validatePlaceholders(duplicatedOutput, mapping);

    expect(validation).toEqual({
      ok: false,
      error: "Protected content mismatch. Original text preserved. Token __PZPTOK001__ appeared 2 times.",
    });
  });

  it("protects currency, dates, times, and ids", () => {
    const text = "Meet at 14:30 on 2026-03-05 with budget $42.50 and ref AB123456.";
    const { mapping } = encodeProtectedSpans(text);
    const kinds = mapping.map((entry) => entry.kind);

    expect(kinds).toContain("time");
    expect(kinds).toContain("date");
    expect(kinds).toContain("currency");
    expect(kinds).toContain("id");
    expect(roundTrip(text)).toBe(text);
  });

  it("prioritizes full ids over embedded date fragments", () => {
    const text = "Reference INV-2026-03-05-A1B2C3 must remain exact.";
    const { mapping } = encodeProtectedSpans(text);

    const idEntry = mapping.find((entry) => entry.kind === "id");
    const dateEntries = mapping.filter((entry) => entry.kind === "date");

    expect(idEntry?.original).toBe("INV-2026-03-05-A1B2C3");
    expect(dateEntries).toHaveLength(0);
    expect(roundTrip(text)).toBe(text);
  });

  it("allows literal placeholder-like text when mapping is empty", () => {
    const text = "Literal token __PZPTOK777__ should remain untouched.";
    const { encodedText, mapping } = encodeProtectedSpans(text);

    expect(mapping).toHaveLength(0);

    const decodedText = decodePlaceholders(encodedText, mapping);
    const validation = validatePlaceholders(decodedText, mapping);

    expect(validation.ok).toBe(true);
    expect(decodedText).toBe(text);
  });
});
