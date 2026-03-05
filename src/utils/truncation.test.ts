import { describe, expect, it } from "vitest";
import { endsWithNaturalTerminator } from "./truncation";

describe("truncation terminator heuristic", () => {
  it("accepts sentence terminators and trailing closing quotes/parens", () => {
    expect(endsWithNaturalTerminator("Complete sentence.")).toBe(true);
    expect(endsWithNaturalTerminator("Is this ready?)")).toBe(true);
    expect(endsWithNaturalTerminator("She said yes.\"")).toBe(true);
    expect(endsWithNaturalTerminator("Wrapped thought…")).toBe(true);
  });

  it("flags text without a natural ending terminator", () => {
    expect(endsWithNaturalTerminator("Likely cut off mid thought")).toBe(false);
  });
});

