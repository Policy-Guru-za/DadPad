import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const hoisted = vi.hoisted(() => {
  class MockOpenAIProviderError extends Error {
    readonly code: string;

    constructor(code: string, message: string) {
      super(message);
      this.code = code;
      this.name = "OpenAIProviderError";
    }
  }

  return {
    streamTransformWithOpenAIMock: vi.fn(),
    MockOpenAIProviderError,
  };
});

const { streamTransformWithOpenAIMock, MockOpenAIProviderError } = hoisted;

vi.mock("./providers/openai", () => ({
  DEFAULT_OPENAI_MODEL: "gpt-5-nano-2025-08-07",
  OpenAIProviderError: hoisted.MockOpenAIProviderError,
  streamTransformWithOpenAI: hoisted.streamTransformWithOpenAIMock,
}));

beforeEach(() => {
  vi.stubEnv("VITE_OPENAI_API_KEY", "test-key");
  streamTransformWithOpenAIMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("M3 transform resilience", () => {
  it("cancel restores original text after partial stream and resets action state", async () => {
    streamTransformWithOpenAIMock.mockImplementation(async ({ signal, onDelta }) => {
      onDelta("partial stream");

      await new Promise((_, reject) => {
        if (signal?.aborted) {
          reject(new DOMException("Aborted", "AbortError"));
          return;
        }

        signal?.addEventListener(
          "abort",
          () => {
            reject(new DOMException("Aborted", "AbortError"));
          },
          { once: true },
        );
      });

      return { outputText: "partial stream" };
    });

    render(<App />);
    const user = userEvent.setup();
    const editor = screen.getByRole("textbox", { name: "Text editor" }) as HTMLTextAreaElement;
    const polishButton = screen.getByRole("button", { name: "Polish" }) as HTMLButtonElement;
    const cancelButton = screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement;
    const copyButton = screen.getByRole("button", { name: "Copy" }) as HTMLButtonElement;
    const undoButton = screen.getByRole("button", { name: "Undo" }) as HTMLButtonElement;

    await user.type(editor, "original text");
    await user.click(polishButton);

    await waitFor(() => {
      expect(cancelButton.disabled).toBe(false);
      expect(copyButton.disabled).toBe(true);
      expect(editor.readOnly).toBe(true);
      expect(editor.value).toBe("partial stream");
    });

    await user.click(cancelButton);

    await waitFor(() => {
      expect(editor.value).toBe("original text");
      expect(screen.getByText("Polish cancelled. Original text restored.")).toBeTruthy();
      expect(cancelButton.disabled).toBe(true);
      expect(undoButton.disabled).toBe(true);
      expect(polishButton.disabled).toBe(false);
      expect(editor.readOnly).toBe(false);
    });
  });

  it("stream error restores original text and surfaces error status", async () => {
    streamTransformWithOpenAIMock.mockImplementation(async ({ onDelta }) => {
      onDelta("partial output");
      throw new MockOpenAIProviderError(
        "server",
        "OpenAI stream returned malformed JSON. Original text preserved.",
      );
    });

    render(<App />);
    const user = userEvent.setup();
    const editor = screen.getByRole("textbox", { name: "Text editor" }) as HTMLTextAreaElement;
    const undoButton = screen.getByRole("button", { name: "Undo" }) as HTMLButtonElement;

    await user.type(editor, "safe original");
    await user.click(screen.getByRole("button", { name: "Polish" }));

    await waitFor(() => {
      expect(editor.value).toBe("safe original");
      expect(
        screen.getByText("OpenAI stream returned malformed JSON. Original text preserved."),
      ).toBeTruthy();
      expect(
        screen.getByText(
          "Warnings: OpenAI stream returned malformed JSON. Original text preserved.",
        ),
      ).toBeTruthy();
      expect(undoButton.disabled).toBe(true);
    });
  });
});

describe("M4 direct mode wiring", () => {
  it("direct button uses direct mode and commits streamed output on success", async () => {
    streamTransformWithOpenAIMock.mockImplementation(async ({ mode, onDelta }) => {
      if (mode !== "direct") {
        throw new Error(`expected direct mode, got ${mode}`);
      }

      onDelta("Short");
      onDelta(" output.");
      return { outputText: "Short output." };
    });

    render(<App />);
    const user = userEvent.setup();
    const editor = screen.getByRole("textbox", { name: "Text editor" }) as HTMLTextAreaElement;

    await user.type(editor, "Longer source text that should be tightened.");
    await user.click(screen.getByRole("button", { name: "Direct" }));

    await waitFor(() => {
      expect(editor.value).toBe("Short output.");
      expect(screen.getByText(/Direct complete in/)).toBeTruthy();
      expect(screen.getByText("Last mode: Direct")).toBeTruthy();
      expect(streamTransformWithOpenAIMock).toHaveBeenCalledWith(
        expect.objectContaining({ mode: "direct" }),
      );
    });
  });

  it("cancel in direct mode restores original text after partial stream", async () => {
    streamTransformWithOpenAIMock.mockImplementation(async ({ signal, mode, onDelta }) => {
      if (mode === "direct") {
        onDelta("partial direct");
      }

      await new Promise((_, reject) => {
        if (signal?.aborted) {
          reject(new DOMException("Aborted", "AbortError"));
          return;
        }

        signal?.addEventListener(
          "abort",
          () => {
            reject(new DOMException("Aborted", "AbortError"));
          },
          { once: true },
        );
      });

      return { outputText: "partial direct" };
    });

    render(<App />);
    const user = userEvent.setup();
    const editor = screen.getByRole("textbox", { name: "Text editor" }) as HTMLTextAreaElement;

    await user.type(editor, "direct original");
    await user.click(screen.getByRole("button", { name: "Direct" }));

    await waitFor(() => {
      expect(editor.value).toBe("partial direct");
      expect(
        (screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement).disabled,
      ).toBe(false);
    });

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(editor.value).toBe("direct original");
      expect(screen.getByText("Direct cancelled. Original text restored.")).toBeTruthy();
    });
  });
});

describe("M5 placeholder fail-safe", () => {
  it("restores original text when placeholder tokens are altered by the model output", async () => {
    streamTransformWithOpenAIMock.mockImplementation(async ({ inputText, onDelta }) => {
      const tokenMatch = inputText.match(/__PZPTOK\d{3}__/);
      if (!tokenMatch) {
        throw new Error("Expected encoded placeholder token in input.");
      }

      const alteredOutput = inputText.replace(tokenMatch[0], "__PZPTOK999__");
      onDelta(alteredOutput);
      return { outputText: alteredOutput };
    });

    render(<App />);
    const user = userEvent.setup();
    const editor = screen.getByRole("textbox", { name: "Text editor" }) as HTMLTextAreaElement;

    const originalText = "Please review https://example.com/spec and respond.";
    await user.type(editor, originalText);
    await user.click(screen.getByRole("button", { name: "Polish" }));

    await waitFor(() => {
      expect(editor.value).toBe(originalText);
      expect(screen.getByText("Protected content mismatch. Original text preserved.")).toBeTruthy();
      expect(
        screen.getByText("Warnings: Protected content mismatch. Original text preserved."),
      ).toBeTruthy();
    });
  });
});

describe("M6 truncation warning and retry", () => {
  it("retry uses original input, increases max tokens, and undo restores first-pass text", async () => {
    const originalText = "Original source text that needs another pass";
    let callCount = 0;

    streamTransformWithOpenAIMock.mockImplementation(
      async ({ inputText, mode, maxOutputTokens, onDelta }) => {
        callCount += 1;

        if (callCount === 1) {
          expect(mode).toBe("direct");
          expect(inputText).toBe(originalText);
          expect(maxOutputTokens).toBeUndefined();
          onDelta("First pass still incomplete");
          return {
            outputText: "First pass still incomplete",
            maxOutputTokens: 200,
            truncatedByProvider: false,
          };
        }

        expect(mode).toBe("direct");
        expect(inputText).toBe(originalText);
        expect(maxOutputTokens).toBe(300);
        onDelta("Second pass complete.");
        return {
          outputText: "Second pass complete.",
          maxOutputTokens: 300,
          truncatedByProvider: false,
        };
      },
    );

    render(<App />);
    const user = userEvent.setup();
    const editor = screen.getByRole("textbox", { name: "Text editor" }) as HTMLTextAreaElement;

    await user.type(editor, originalText);
    await user.click(screen.getByRole("button", { name: "Direct" }));

    await waitFor(() => {
      expect(editor.value).toBe("First pass still incomplete");
      expect(screen.getByText("Warnings: Output may be truncated.")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Retry (more room)" })).toBeTruthy();
    });

    await user.click(screen.getByRole("button", { name: "Retry (more room)" }));

    await waitFor(() => {
      expect(editor.value).toBe("Second pass complete.");
      expect(screen.queryByRole("button", { name: "Retry (more room)" })).toBeNull();
      expect(screen.getByText("Warnings: None")).toBeTruthy();
    });

    await user.click(screen.getByRole("button", { name: "Undo" }));

    await waitFor(() => {
      expect(editor.value).toBe("First pass still incomplete");
      expect(screen.getByText("Undo restored pre-transform text.")).toBeTruthy();
    });

    expect(streamTransformWithOpenAIMock).toHaveBeenCalledTimes(2);
  });

  it("does not offer retry when max token budget is already capped", async () => {
    streamTransformWithOpenAIMock.mockImplementation(async ({ mode, onDelta }) => {
      expect(mode).toBe("direct");
      onDelta("Output clipped");
      return {
        outputText: "Output clipped",
        maxOutputTokens: 8192,
        truncatedByProvider: true,
      };
    });

    render(<App />);
    const user = userEvent.setup();
    const editor = screen.getByRole("textbox", { name: "Text editor" }) as HTMLTextAreaElement;

    await user.type(editor, "source text");
    await user.click(screen.getByRole("button", { name: "Direct" }));

    await waitFor(() => {
      expect(editor.value).toBe("Output clipped");
      expect(screen.getByText("Warnings: Output may be truncated.")).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Retry (more room)" })).toBeNull();
    });

    expect(streamTransformWithOpenAIMock).toHaveBeenCalledTimes(1);
  });
});
