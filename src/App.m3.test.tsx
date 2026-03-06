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
    readAppSettingsMock: vi.fn(),
    writeAppSettingsMock: vi.fn(),
    MockOpenAIProviderError,
  };
});

const {
  streamTransformWithOpenAIMock,
  readAppSettingsMock,
  writeAppSettingsMock,
  MockOpenAIProviderError,
} = hoisted;

vi.mock("./providers/openai", () => ({
  DEFAULT_OPENAI_MODEL: "gpt-5-nano-2025-08-07",
  OpenAIProviderError: hoisted.MockOpenAIProviderError,
  streamTransformWithOpenAI: hoisted.streamTransformWithOpenAIMock,
}));

vi.mock("./settings/config", () => ({
  DEFAULT_APP_SETTINGS: {
    openaiApiKey: "",
    model: "gpt-5-nano-2025-08-07",
    temperature: 0.2,
    streaming: true,
    tokenProtection: true,
    smartStructuring: true,
  },
  readAppSettings: hoisted.readAppSettingsMock,
  writeAppSettings: hoisted.writeAppSettingsMock,
}));

const TEST_SETTINGS = {
  openaiApiKey: "test-key",
  model: "gpt-5-nano-2025-08-07",
  temperature: 0.2,
  streaming: true,
  tokenProtection: true,
  smartStructuring: true,
};

beforeEach(() => {
  streamTransformWithOpenAIMock.mockReset();
  readAppSettingsMock.mockReset();
  writeAppSettingsMock.mockReset();
  readAppSettingsMock.mockResolvedValue(TEST_SETTINGS);
  writeAppSettingsMock.mockImplementation(async (settings) => settings);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("M8 settings gating", () => {
  it("renders creator credit in the lower chrome", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByLabelText("App creator")).toBeTruthy();
      expect(screen.getByText("Rock Kestrel Ventures")).toBeTruthy();
      expect(screen.getByText("@laup30")).toBeTruthy();
      expect(screen.getByText("Cape Town, South Africa")).toBeTruthy();
    });
  });

  it("disables transform buttons when API key is missing", async () => {
    readAppSettingsMock.mockResolvedValue({
      ...TEST_SETTINGS,
      openaiApiKey: "",
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Set API key in Settings.")).toBeTruthy();
      expect((screen.getByRole("button", { name: "Polish" }) as HTMLButtonElement).disabled).toBe(
        true,
      );
      expect((screen.getByRole("button", { name: "Direct" }) as HTMLButtonElement).disabled).toBe(
        true,
      );
    });
  });

  it("allows pasting API key into settings without renderer crash", async () => {
    render(<App />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Settings" }));

    const apiKeyInput = screen.getByLabelText("OpenAI API key") as HTMLInputElement;
    await user.click(apiKeyInput);
    await user.clear(apiKeyInput);
    await user.paste("sk-proj-testkey-1234567890");

    await waitFor(() => {
      expect(apiKeyInput.value).toBe("sk-proj-testkey-1234567890");
      expect(screen.getByRole("button", { name: "Save Settings" })).toBeTruthy();
    });
  });

  it("passes smart structuring setting through to the provider", async () => {
    streamTransformWithOpenAIMock.mockResolvedValue({
      outputText: "Kept as typed",
      truncatedByProvider: false,
      maxOutputTokens: 128,
    });

    render(<App />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Settings" }));
    await user.click(screen.getByRole("checkbox", { name: "Smart message structuring" }));
    await user.click(screen.getByRole("button", { name: "Save Settings" }));

    await waitFor(() => {
      expect(writeAppSettingsMock).toHaveBeenCalledWith({
        ...TEST_SETTINGS,
        smartStructuring: false,
      });
    });

    const editor = screen.getByRole("textbox", { name: "Text editor" }) as HTMLTextAreaElement;
    await user.type(editor, "source text");
    await user.click(screen.getByRole("button", { name: "Polish" }));

    await waitFor(() => {
      expect(streamTransformWithOpenAIMock).toHaveBeenCalledWith(
        expect.objectContaining({ smartStructuring: false }),
      );
    });
  });
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

  it("commits canonical provider output after streaming preview diverges", async () => {
    streamTransformWithOpenAIMock.mockImplementation(async ({ onDelta }) => {
      onDelta("\n");
      return {
        outputText: "Hello.",
        truncatedByProvider: false,
        maxOutputTokens: 128,
      };
    });

    render(<App />);
    const user = userEvent.setup();
    const editor = screen.getByRole("textbox", { name: "Text editor" }) as HTMLTextAreaElement;

    await user.type(editor, "source text");
    await user.click(screen.getByRole("button", { name: "Polish" }));

    await waitFor(() => {
      expect(editor.value).toBe("Hello.");
      expect(screen.getByText(/Polish complete in/)).toBeTruthy();
    });
  });

  it("normalizes paragraph spacing and bullet spacing when smart structuring is enabled", async () => {
    streamTransformWithOpenAIMock.mockResolvedValue({
      outputText: "\nFirst paragraph.\n\n\n- item one\n-   item two\n\n",
      truncatedByProvider: false,
      maxOutputTokens: 128,
    });

    render(<App />);
    const user = userEvent.setup();
    const editor = screen.getByRole("textbox", { name: "Text editor" }) as HTMLTextAreaElement;

    await user.type(editor, "source text");
    await user.click(screen.getByRole("button", { name: "Direct" }));

    await waitFor(() => {
      expect(editor.value).toBe("First paragraph.\n\n- item one\n- item two");
      expect(screen.getByText("Warnings: None")).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Retry (more room)" })).toBeNull();
    });
  });

  it("preserves protected code blocks during smart-structuring normalization", async () => {
    streamTransformWithOpenAIMock.mockImplementation(async ({ inputText }) => ({
      outputText: String(inputText),
      truncatedByProvider: false,
      maxOutputTokens: 128,
    }));

    render(<App />);
    const user = userEvent.setup();
    const editor = screen.getByRole("textbox", { name: "Text editor" }) as HTMLTextAreaElement;
    const sourceText = `Please use this snippet:\n\`\`\`txt\n1.23 revenue\n2)foo\n\`\`\`\nThanks.`;

    await user.type(editor, sourceText);
    await user.click(screen.getByRole("button", { name: "Polish" }));

    await waitFor(() => {
      expect(editor.value).toBe(sourceText);
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

describe("M7 casual/professional mode wiring", () => {
  it("casual button uses casual mode and commits streamed output on success", async () => {
    streamTransformWithOpenAIMock.mockImplementation(async ({ mode, onDelta }) => {
      if (mode !== "casual") {
        throw new Error(`expected casual mode, got ${mode}`);
      }

      onDelta("Hey team, quick update.");
      return { outputText: "Hey team, quick update." };
    });

    render(<App />);
    const user = userEvent.setup();
    const editor = screen.getByRole("textbox", { name: "Text editor" }) as HTMLTextAreaElement;

    await user.type(editor, "This is a longer paragraph that should sound more casual.");
    await user.click(screen.getByRole("button", { name: "Casual" }));

    await waitFor(() => {
      expect(editor.value).toBe("Hey team, quick update.");
      expect(screen.getByText(/Casual complete in/)).toBeTruthy();
      expect(screen.getByText("Last mode: Casual")).toBeTruthy();
      expect(streamTransformWithOpenAIMock).toHaveBeenCalledWith(
        expect.objectContaining({ mode: "casual" }),
      );
    });
  });

  it("professional button uses professional mode and commits streamed output on success", async () => {
    streamTransformWithOpenAIMock.mockImplementation(async ({ mode, onDelta }) => {
      if (mode !== "professional") {
        throw new Error(`expected professional mode, got ${mode}`);
      }

      onDelta("Good morning team. Please review the attached plan.");
      return { outputText: "Good morning team. Please review the attached plan." };
    });

    render(<App />);
    const user = userEvent.setup();
    const editor = screen.getByRole("textbox", { name: "Text editor" }) as HTMLTextAreaElement;

    await user.type(editor, "can you all quickly check this and tell me what you think");
    await user.click(screen.getByRole("button", { name: "Professional" }));

    await waitFor(() => {
      expect(editor.value).toBe("Good morning team. Please review the attached plan.");
      expect(screen.getByText(/Professional complete in/)).toBeTruthy();
      expect(screen.getByText("Last mode: Professional")).toBeTruthy();
      expect(streamTransformWithOpenAIMock).toHaveBeenCalledWith(
        expect.objectContaining({ mode: "professional" }),
      );
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
