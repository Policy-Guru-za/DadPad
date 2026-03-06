import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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

function createSuccessfulTransform(outputText: string, maxOutputTokens = 256) {
  return {
    outputText,
    truncatedByProvider: false,
    maxOutputTokens,
  };
}

async function unlockToneModes(
  user: ReturnType<typeof userEvent.setup>,
  editor: HTMLTextAreaElement,
  polishedText = "Polished text.",
): Promise<void> {
  streamTransformWithOpenAIMock.mockImplementationOnce(async ({ mode, onDelta }) => {
    expect(mode).toBe("polish");
    onDelta(polishedText);
    return createSuccessfulTransform(polishedText);
  });

  await user.click(screen.getByRole("button", { name: "Polish" }));

  await waitFor(() => {
    expect(editor.value).toBe(polishedText);
    expect((screen.getByRole("button", { name: "Direct" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });
}

beforeEach(() => {
  streamTransformWithOpenAIMock.mockReset();
  readAppSettingsMock.mockReset();
  writeAppSettingsMock.mockReset();
  readAppSettingsMock.mockResolvedValue(TEST_SETTINGS);
  writeAppSettingsMock.mockImplementation(async (settings) => settings);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("M8 settings gating", () => {
  it("renders simplified creator credit and no theme toggle", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/@laup30/)).toBeTruthy();
      expect(screen.getByText(/Cape Town/)).toBeTruthy();
      expect(screen.queryByLabelText("Toggle theme")).toBeNull();
      expect(screen.queryByText(/Created by/i)).toBeNull();
      expect(screen.queryByText("Rock Kestrel Ventures")).toBeNull();
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

  it("keeps tone buttons locked until polish succeeds", async () => {
    render(<App />);

    await waitFor(() => {
      expect((screen.getByRole("button", { name: "Polish" }) as HTMLButtonElement).disabled).toBe(
        false,
      );
      expect((screen.getByRole("button", { name: "Casual" }) as HTMLButtonElement).disabled).toBe(
        true,
      );
      expect(
        (screen.getByRole("button", { name: "Professional" }) as HTMLButtonElement).disabled,
      ).toBe(true);
      expect((screen.getByRole("button", { name: "Direct" }) as HTMLButtonElement).disabled).toBe(
        true,
      );
      expect(
        (screen.getByRole("button", { name: "Agent Prompt" }) as HTMLButtonElement).disabled,
      ).toBe(true);
      expect(
        (screen.getByRole("button", { name: "Universal" }) as HTMLButtonElement).disabled,
      ).toBe(true);
      expect(screen.getByText("After polish")).toBeTruthy();
      expect(screen.getByText("For agents")).toBeTruthy();
      expect(screen.getByLabelText("Tone options")).toBeTruthy();
      expect(screen.getByLabelText("Agent prompt presets")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Settings" })).toBeTruthy();
    });
  });

  it("switches the settings trigger label between settings and close", async () => {
    render(<App />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Settings" })).toBeTruthy();
    });

    await user.click(screen.getByRole("button", { name: "Settings" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Settings" })).toBeNull();
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

  it("shows only the placeholder when no API key has been saved", async () => {
    readAppSettingsMock.mockResolvedValue({
      ...TEST_SETTINGS,
      openaiApiKey: "",
    });

    render(<App />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Settings" }));

    const apiKeyInput = screen.getByLabelText("OpenAI API key") as HTMLInputElement;

    await waitFor(() => {
      expect(apiKeyInput.type).toBe("password");
      expect(apiKeyInput.value).toBe("");
      expect(apiKeyInput.placeholder).toBe("sk-...");
    });
  });

  it("keeps a saved API key in the native masked password field", async () => {
    render(<App />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Settings" }));

    const apiKeyInput = screen.getByLabelText("OpenAI API key") as HTMLInputElement;

    await waitFor(() => {
      expect(apiKeyInput.type).toBe("password");
      expect(apiKeyInput.value).toBe(TEST_SETTINGS.openaiApiKey);
    });
  });

  it("shows saving and saved button states after a successful settings save", async () => {
    let resolveSave: (() => void) | null = null;
    writeAppSettingsMock.mockImplementation(
      async (settings) =>
        await new Promise<typeof TEST_SETTINGS>((resolve) => {
          resolveSave = () => resolve(settings);
        }),
    );

    render(<App />);
    await screen.findByRole("button", { name: "Settings" });

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Settings" }));

    await waitFor(() => {
      const savingButton = screen.getByRole("button", { name: "Saving..." }) as HTMLButtonElement;
      expect(savingButton.disabled).toBe(true);
    });

    await act(async () => {
      resolveSave?.();
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Saved" })).toBeTruthy();
    });

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 1850));
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Save Settings" })).toBeTruthy();
    });
  }, 7000);

  it("resets the saved button state as soon as settings are edited again", async () => {
    render(<App />);
    await screen.findByRole("button", { name: "Settings" });

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Settings" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Saved" })).toBeTruthy();
    });

    fireEvent.change(screen.getByLabelText("Model"), {
      target: { value: "gpt-5-nano-2025-08-07-alt" },
    });

    expect(screen.getByRole("button", { name: "Save Settings" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Saved" })).toBeNull();
  });

  it("keeps inline settings feedback for save failures only", async () => {
    writeAppSettingsMock.mockRejectedValueOnce(new Error("save failed"));

    render(<App />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Settings" }));
    await user.click(screen.getByRole("button", { name: "Save Settings" }));

    await waitFor(() => {
      expect(screen.getByText("Unable to save settings.")).toBeTruthy();
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

  it("re-locks tone buttons when a full-content paste replaces the editor text", async () => {
    render(<App />);
    const user = userEvent.setup();
    const editor = screen.getByRole("textbox", { name: "Text editor" }) as HTMLTextAreaElement;

    await user.type(editor, "original draft");
    await unlockToneModes(user, editor, "Polished draft.");

    editor.focus();
    editor.setSelectionRange(0, editor.value.length);
    await user.paste("Completely new pasted text");

    await waitFor(() => {
      expect(editor.value).toBe("Completely new pasted text");
      expect((screen.getByRole("button", { name: "Direct" }) as HTMLButtonElement).disabled).toBe(
        true,
      );
      expect(
        (screen.getByRole("button", { name: "Agent Prompt" }) as HTMLButtonElement).disabled,
      ).toBe(true);
    });
  });

  it("keeps agent prompt unlocked when full-content typing replaces the editor text", async () => {
    render(<App />);
    const user = userEvent.setup();
    const editor = screen.getByRole("textbox", { name: "Text editor" }) as HTMLTextAreaElement;

    await user.type(editor, "original draft");
    await unlockToneModes(user, editor, "Polished draft.");

    editor.focus();
    editor.setSelectionRange(0, editor.value.length);
    fireEvent.select(editor);
    fireEvent.input(editor, { target: { value: "Completely new typed text" } });

    await waitFor(() => {
      expect(editor.value).toBe("Completely new typed text");
      expect((screen.getByRole("button", { name: "Direct" }) as HTMLButtonElement).disabled).toBe(
        true,
      );
      expect(
        (screen.getByRole("button", { name: "Agent Prompt" }) as HTMLButtonElement).disabled,
      ).toBe(false);
    });
  });

  it("keeps tone buttons unlocked through manual edits and undo", async () => {
    render(<App />);
    const user = userEvent.setup();
    const editor = screen.getByRole("textbox", { name: "Text editor" }) as HTMLTextAreaElement;

    await user.type(editor, "original draft");
    await unlockToneModes(user, editor, "Polished draft.");

    await user.type(editor, " More detail.");

    await waitFor(() => {
      expect((screen.getByRole("button", { name: "Direct" }) as HTMLButtonElement).disabled).toBe(
        false,
      );
    });

    await user.click(screen.getByRole("button", { name: "Undo" }));

    await waitFor(() => {
      expect(editor.value).toBe("original draft");
      expect((screen.getByRole("button", { name: "Direct" }) as HTMLButtonElement).disabled).toBe(
        false,
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
      expect(screen.getByText("Warnings: None")).toBeTruthy();
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
      return createSuccessfulTransform("Hello.", 128);
    });

    render(<App />);
    const user = userEvent.setup();
    const editor = screen.getByRole("textbox", { name: "Text editor" }) as HTMLTextAreaElement;

    await user.type(editor, "source text");
    await user.click(screen.getByRole("button", { name: "Polish" }));

    await waitFor(() => {
      expect(editor.value).toBe("Hello.");
      expect(screen.getByText(/^Latency: \d+ ms$/)).toBeTruthy();
      expect(screen.getByText("Warnings: None")).toBeTruthy();
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
    await user.click(screen.getByRole("button", { name: "Polish" }));

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

  it("restores the original text when the provider stops before completing the rewrite", async () => {
    streamTransformWithOpenAIMock.mockImplementation(async ({ onDelta }) => {
      onDelta("Partial rewrite");
      throw new MockOpenAIProviderError(
        "unknown",
        "OpenAI stopped before completing the rewrite. Original text preserved.",
      );
    });

    render(<App />);
    const user = userEvent.setup();
    const editor = screen.getByRole("textbox", { name: "Text editor" }) as HTMLTextAreaElement;

    await user.type(editor, "safe original");
    await user.click(screen.getByRole("button", { name: "Polish" }));

    await waitFor(() => {
      expect(editor.value).toBe("safe original");
      expect(
        screen.getByText(
          "Warnings: OpenAI stopped before completing the rewrite. Original text preserved.",
        ),
      ).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Retry (more room)" })).toBeNull();
    });
  });
});

describe("M4 direct mode wiring", () => {
  it("agent prompt unlocks after a successful rewrite and routes the selected preset", async () => {
    streamTransformWithOpenAIMock.mockImplementationOnce(async ({ mode, onDelta }) => {
      expect(mode).toBe("polish");
      onDelta("Polished base.");
      return createSuccessfulTransform("Polished base.");
    });
    streamTransformWithOpenAIMock.mockImplementationOnce(async ({ mode, onDelta }) => {
      expect(mode).toBe("agent-claude");
      const markdown = [
        "## Objective",
        "",
        "Turn this into an agent-ready brief.",
        "",
        "## Expected Output",
        "",
        "- Markdown prompt",
      ].join("\n");
      onDelta(markdown);
      return createSuccessfulTransform(markdown);
    });

    render(<App />);
    const user = userEvent.setup();
    const editor = screen.getByRole("textbox", { name: "Text editor" }) as HTMLTextAreaElement;

    await user.type(editor, "Longer source text that should be prepared first.");
    await user.click(screen.getByRole("button", { name: "Polish" }));

    await waitFor(() => {
      expect(
        (screen.getByRole("button", { name: "Agent Prompt" }) as HTMLButtonElement).disabled,
      ).toBe(false);
    });

    await user.click(screen.getByRole("button", { name: "Claude" }));
    await user.click(screen.getByRole("button", { name: "Agent Prompt" }));

    await waitFor(() => {
      expect(editor.value).toContain("## Objective");
      expect(editor.value).toContain("## Expected Output");
      expect(screen.getByText("Mode: Agent Prompt (Claude)")).toBeTruthy();
      expect(streamTransformWithOpenAIMock).toHaveBeenCalledWith(
        expect.objectContaining({ mode: "agent-claude" }),
      );
    });
  });

  it("undo restores the prior rewritten text after agent prompt conversion", async () => {
    streamTransformWithOpenAIMock.mockImplementationOnce(async ({ mode, onDelta }) => {
      expect(mode).toBe("polish");
      onDelta("Polished draft.");
      return createSuccessfulTransform("Polished draft.");
    });
    streamTransformWithOpenAIMock.mockImplementationOnce(async ({ mode, onDelta }) => {
      expect(mode).toBe("agent-universal");
      const markdown = [
        "## Objective",
        "",
        "Create a clean coding-agent prompt.",
      ].join("\n");
      onDelta(markdown);
      return createSuccessfulTransform(markdown);
    });

    render(<App />);
    const user = userEvent.setup();
    const editor = screen.getByRole("textbox", { name: "Text editor" }) as HTMLTextAreaElement;

    await user.type(editor, "Source text");
    await user.click(screen.getByRole("button", { name: "Polish" }));
    await waitFor(() => {
      expect(editor.value).toBe("Polished draft.");
    });

    await user.click(screen.getByRole("button", { name: "Agent Prompt" }));

    await waitFor(() => {
      expect(editor.value).toContain("## Objective");
    });

    await user.click(screen.getByRole("button", { name: "Undo" }));

    await waitFor(() => {
      expect(editor.value).toBe("Polished draft.");
      expect(
        (screen.getByRole("button", { name: "Agent Prompt" }) as HTMLButtonElement).disabled,
      ).toBe(false);
    });
  });

  it("preserves markdown hard breaks and code-block spacing in agent prompt output", async () => {
    const expectedMarkdown =
      "## Objective\u0020\u0020\nShip the fix.\u0020\u0020\n\n```ts\nconst x = 1;\n\n\nconst y = 2;\n```";

    streamTransformWithOpenAIMock.mockImplementationOnce(async ({ mode, onDelta }) => {
      expect(mode).toBe("polish");
      onDelta("Polished draft.");
      return createSuccessfulTransform("Polished draft.");
    });
    streamTransformWithOpenAIMock.mockImplementationOnce(async ({ mode, onDelta }) => {
      expect(mode).toBe("agent-universal");
      const markdown = `\n\n${expectedMarkdown}\n\n`;
      onDelta(markdown);
      return createSuccessfulTransform(markdown);
    });

    render(<App />);
    const user = userEvent.setup();
    const editor = screen.getByRole("textbox", { name: "Text editor" }) as HTMLTextAreaElement;

    await user.type(editor, "Source text");
    await user.click(screen.getByRole("button", { name: "Polish" }));
    await waitFor(() => {
      expect(editor.value).toBe("Polished draft.");
    });

    await user.click(screen.getByRole("button", { name: "Agent Prompt" }));

    await waitFor(() => {
      expect(editor.value).toBe(expectedMarkdown);
    });
  });

  it("direct button uses direct mode and commits streamed output on success", async () => {
    streamTransformWithOpenAIMock.mockImplementationOnce(async ({ mode, onDelta }) => {
      expect(mode).toBe("polish");
      onDelta("Polished base.");
      return createSuccessfulTransform("Polished base.");
    });
    streamTransformWithOpenAIMock.mockImplementationOnce(async ({ mode, onDelta }) => {
      if (mode !== "direct") {
        throw new Error(`expected direct mode, got ${mode}`);
      }

      onDelta("Short");
      onDelta(" output.");
      return createSuccessfulTransform("Short output.");
    });

    render(<App />);
    const user = userEvent.setup();
    const editor = screen.getByRole("textbox", { name: "Text editor" }) as HTMLTextAreaElement;

    await user.type(editor, "Longer source text that should be tightened.");
    await user.click(screen.getByRole("button", { name: "Polish" }));
    await waitFor(() => {
      expect((screen.getByRole("button", { name: "Direct" }) as HTMLButtonElement).disabled).toBe(
        false,
      );
    });
    await user.click(screen.getByRole("button", { name: "Direct" }));

    await waitFor(() => {
      expect(editor.value).toBe("Short output.");
      expect(screen.getByText(/^Latency: \d+ ms$/)).toBeTruthy();
      expect(screen.getByText("Mode: Direct")).toBeTruthy();
      expect(screen.getByText("Warnings: None")).toBeTruthy();
      expect(streamTransformWithOpenAIMock).toHaveBeenCalledWith(
        expect.objectContaining({ mode: "direct" }),
      );
    });
  });

  it("cancel in direct mode restores original text after partial stream", async () => {
    streamTransformWithOpenAIMock.mockImplementationOnce(async ({ mode, onDelta }) => {
      expect(mode).toBe("polish");
      onDelta("Polished draft.");
      return createSuccessfulTransform("Polished draft.");
    });
    streamTransformWithOpenAIMock.mockImplementationOnce(async ({ signal, mode, onDelta }) => {
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
    await user.click(screen.getByRole("button", { name: "Polish" }));
    await waitFor(() => {
      expect((screen.getByRole("button", { name: "Direct" }) as HTMLButtonElement).disabled).toBe(
        false,
      );
    });
    await user.click(screen.getByRole("button", { name: "Direct" }));

    await waitFor(() => {
      expect(editor.value).toBe("partial direct");
      expect(
        (screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement).disabled,
      ).toBe(false);
    });

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(editor.value).toBe("Polished draft.");
      expect(screen.getByText("Warnings: None")).toBeTruthy();
    });
  });
});

describe("M7 casual/professional mode wiring", () => {
  it("casual button uses casual mode and commits streamed output on success", async () => {
    streamTransformWithOpenAIMock.mockImplementationOnce(async ({ mode, onDelta }) => {
      expect(mode).toBe("polish");
      onDelta("Polished base.");
      return createSuccessfulTransform("Polished base.");
    });
    streamTransformWithOpenAIMock.mockImplementationOnce(async ({ mode, onDelta }) => {
      if (mode !== "casual") {
        throw new Error(`expected casual mode, got ${mode}`);
      }

      onDelta("Hey team, quick update.");
      return createSuccessfulTransform("Hey team, quick update.");
    });

    render(<App />);
    const user = userEvent.setup();
    const editor = screen.getByRole("textbox", { name: "Text editor" }) as HTMLTextAreaElement;

    await user.type(editor, "This is a longer paragraph that should sound more casual.");
    await user.click(screen.getByRole("button", { name: "Polish" }));
    await waitFor(() => {
      expect((screen.getByRole("button", { name: "Casual" }) as HTMLButtonElement).disabled).toBe(
        false,
      );
    });
    await user.click(screen.getByRole("button", { name: "Casual" }));

    await waitFor(() => {
      expect(editor.value).toBe("Hey team, quick update.");
      expect(screen.getByText(/^Latency: \d+ ms$/)).toBeTruthy();
      expect(screen.getByText("Mode: Casual")).toBeTruthy();
      expect(screen.getByText("Warnings: None")).toBeTruthy();
      expect(streamTransformWithOpenAIMock).toHaveBeenCalledWith(
        expect.objectContaining({ mode: "casual" }),
      );
    });
  });

  it("professional button uses professional mode and commits streamed output on success", async () => {
    streamTransformWithOpenAIMock.mockImplementationOnce(async ({ mode, onDelta }) => {
      expect(mode).toBe("polish");
      onDelta("Polished base.");
      return createSuccessfulTransform("Polished base.");
    });
    streamTransformWithOpenAIMock.mockImplementationOnce(async ({ mode, onDelta }) => {
      if (mode !== "professional") {
        throw new Error(`expected professional mode, got ${mode}`);
      }

      onDelta("Good morning team. Please review the attached plan.");
      return createSuccessfulTransform("Good morning team. Please review the attached plan.");
    });

    render(<App />);
    const user = userEvent.setup();
    const editor = screen.getByRole("textbox", { name: "Text editor" }) as HTMLTextAreaElement;

    await user.type(editor, "can you all quickly check this and tell me what you think");
    await user.click(screen.getByRole("button", { name: "Polish" }));
    await waitFor(() => {
      expect(
        (screen.getByRole("button", { name: "Professional" }) as HTMLButtonElement).disabled,
      ).toBe(false);
    });
    await user.click(screen.getByRole("button", { name: "Professional" }));

    await waitFor(() => {
      expect(editor.value).toBe("Good morning team. Please review the attached plan.");
      expect(screen.getByText(/^Latency: \d+ ms$/)).toBeTruthy();
      expect(screen.getByText("Mode: Professional")).toBeTruthy();
      expect(screen.getByText("Warnings: None")).toBeTruthy();
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
      expect(
        screen.getByText("Warnings: Protected content mismatch. Original text preserved."),
      ).toBeTruthy();
    });
  });
});
