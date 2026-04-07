import { describe, expect, it } from "vitest";
import {
  EMAIL_OUTPUT_VALIDATION_MESSAGE,
  validateEmailOutput,
} from "./emailOutputValidation";

describe("validateEmailOutput", () => {
  it("accepts structural email formatting that only isolates existing greeting and sign-off", () => {
    const input =
      "dear team can you send the signed draft today i need it before the review thanks";
    const output =
      "Dear team,\n\nCan you send the signed draft today? I need it before the review.\n\nThanks,";

    expect(validateEmailOutput(input, output)).toEqual({ ok: true });
  });

  it("accepts spelling fixes and paragraph breaks without inventing new content", () => {
    const input =
      "hi sarah can you send the recieveables list today i need it before monday and i think we should keep the current order thanks";
    const output =
      "Hi Sarah,\n\nCan you send the receivables list today? I need it before Monday, and I think we should keep the current order.\n\nThanks,";

    expect(validateEmailOutput(input, output)).toEqual({ ok: true });
  });

  it("rejects invented courtesy filler and sign-offs", () => {
    const result = validateEmailOutput(
      "can you send the signed draft today",
      "Can you send the signed draft today?\n\nPlease let me know if you have any questions.\n\nKind regards,",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain(EMAIL_OUTPUT_VALIDATION_MESSAGE);
      expect(result.error).toContain("invented sign-off");
    }
  });

  it("rejects bullets that were not present in the original prose", () => {
    const result = validateEmailOutput(
      "please send the draft and confirm monday still works",
      "- Please send the draft\n- Confirm Monday still works",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Bullets were introduced");
    }
  });
});
