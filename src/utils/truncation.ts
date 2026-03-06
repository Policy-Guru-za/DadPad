import { isStructuredListItemLine } from "../structuring/plainText";

const NATURAL_TERMINATOR_PATTERN = /[.!?…][)"'”’\]]*$/;

export function endsWithNaturalTerminator(text: string): boolean {
  const trimmed = text.trimEnd();
  if (!trimmed) {
    return false;
  }

  if (NATURAL_TERMINATOR_PATTERN.test(trimmed)) {
    return true;
  }

  const lines = trimmed.split("\n");
  const lastLine = lines.length > 0 ? lines[lines.length - 1]?.trimEnd() ?? "" : "";
  return isStructuredListItemLine(lastLine);
}
