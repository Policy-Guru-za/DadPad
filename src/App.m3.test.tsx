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
