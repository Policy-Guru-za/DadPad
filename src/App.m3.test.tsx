import { act, render, screen, waitFor } from "@testing-library/react";
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

let clipboardWriteMock: ReturnType<typeof vi.fn>;
let shareMock: ReturnType<typeof vi.fn>;
let visualViewportListeners: Map<string, Set<() => void>>;
let visualViewportMock:
  | {
      height: number;
      offsetTop: number;
      addEventListener: ReturnType<typeof vi.fn>;
      removeEventListener: ReturnType<typeof vi.fn>;
    }
  | undefined;

function createSuccessfulTransform(outputText: string) {
  return {
    outputText,
    truncatedByProvider: false,
    maxOutputTokens: 256,
  };
}

beforeEach(() => {
  streamTransformWithOpenAIMock.mockReset();
  readAppSettingsMock.mockReset();
  writeAppSettingsMock.mockReset();
  readAppSettingsMock.mockResolvedValue(TEST_SETTINGS);
  writeAppSettingsMock.mockImplementation(async (settings) => settings);

  vi.stubGlobal("confirm", vi.fn(() => true));
  clipboardWriteMock = vi.fn().mockResolvedValue(undefined);
  shareMock = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: clipboardWriteMock },
  });
  Object.defineProperty(navigator, "share", {
    configurable: true,
    value: shareMock,
  });
  visualViewportListeners = new Map();
  visualViewportMock = undefined;
  Object.defineProperty(window, "visualViewport", {
    configurable: true,
    value: undefined,
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("DadPad app", () => {
  it("renders the DadPad shell and hides PolishPad-only controls", async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "DadPad" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Polish" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Clear" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Share" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Casual" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Professional" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Direct" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Markdown" })).toBeNull();
    });
  });

  it("shrinks the shell when visualViewport reports the software keyboard", async () => {
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 1024,
    });

    visualViewportMock = {
      height: 1024,
      offsetTop: 0,
      addEventListener: vi.fn((event: string, listener: () => void) => {
        const listeners = visualViewportListeners.get(event) ?? new Set<() => void>();
        listeners.add(listener);
        visualViewportListeners.set(event, listeners);
      }),
      removeEventListener: vi.fn((event: string, listener: () => void) => {
        visualViewportListeners.get(event)?.delete(listener);
      }),
    };

    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: visualViewportMock,
    });

    render(<App />);

    const main = await screen.findByRole("main");
    await waitFor(() => {
      expect(main.style.getPropertyValue("--viewport-height")).toBe("1024px");
    });

    visualViewportMock.height = 700;
    visualViewportListeners.get("resize")?.forEach((listener) => listener());

    await waitFor(() => {
      expect(main.classList.contains("keyboard-open")).toBe(true);
      expect(main.style.getPropertyValue("--viewport-height")).toBe("700px");
      expect(main.style.getPropertyValue("--keyboard-inset")).toBe("324px");
    });
  });

  it("opens the minimal setup card when the API key is missing", async () => {
    readAppSettingsMock.mockResolvedValue({
      ...TEST_SETTINGS,
      openaiApiKey: "",
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText("Add your OpenAI API key to start.")).toBeTruthy();
      expect(screen.getByRole("heading", { name: "Set up DadPad" })).toBeTruthy();
      expect((screen.getByRole("button", { name: "Polish" }) as HTMLButtonElement).disabled).toBe(
        true,
      );
    });
  });

  it("saves the API key through the DadPad setup flow", async () => {
    readAppSettingsMock.mockResolvedValue({
      ...TEST_SETTINGS,
      openaiApiKey: "",
    });

    render(<App />);
    const user = userEvent.setup();

    const apiKeyInput = (await screen.findByLabelText("OpenAI API key")) as HTMLInputElement;
    await user.type(apiKeyInput, "sk-test-123");
    await user.click(screen.getByRole("button", { name: "Save key" }));

    await waitFor(() => {
      expect(writeAppSettingsMock).toHaveBeenCalledWith({
        ...TEST_SETTINGS,
        openaiApiKey: "sk-test-123",
      });
      expect(screen.getByText("DadPad is ready.")).toBeTruthy();
      expect(screen.queryByRole("heading", { name: "Set up DadPad" })).toBeNull();
    });
  });

  it("streams a Polish transform into the single editor", async () => {
    streamTransformWithOpenAIMock.mockImplementationOnce(async ({ mode, onDelta }) => {
      expect(mode).toBe("polish");
      onDelta("Polished");
      onDelta(" text.");
      return createSuccessfulTransform("Polished text.");
    });

    render(<App />);
    const user = userEvent.setup();
    const editor = (await screen.findByLabelText("Your text")) as HTMLTextAreaElement;

    await user.type(editor, "rough draft");
    await user.click(screen.getByRole("button", { name: "Polish" }));

    await waitFor(() => {
      expect(editor.value).toBe("Polished text.");
      expect(screen.getByText("Polished.")).toBeTruthy();
      expect((screen.getByRole("button", { name: "Undo" }) as HTMLButtonElement).disabled).toBe(
        false,
      );
    });
  });

  it("cancels an in-flight transform and restores the original text", async () => {
    streamTransformWithOpenAIMock.mockImplementationOnce(
      ({ signal, onDelta }) =>
        new Promise((resolve, reject) => {
          onDelta("Partial");
          signal.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
          window.setTimeout(() => resolve(createSuccessfulTransform("Should not finish")), 5000);
        }),
    );

    render(<App />);
    const user = userEvent.setup();
    const editor = (await screen.findByLabelText("Your text")) as HTMLTextAreaElement;

    await user.type(editor, "keep me");
    await user.click(screen.getByRole("button", { name: "Polish" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(editor.value).toBe("keep me");
      expect(screen.getByText("Cancelled. Original text restored.")).toBeTruthy();
    });
  });

  it("undo restores the pre-transform text", async () => {
    streamTransformWithOpenAIMock.mockResolvedValueOnce(createSuccessfulTransform("Polished text."));

    render(<App />);
    const user = userEvent.setup();
    const editor = (await screen.findByLabelText("Your text")) as HTMLTextAreaElement;

    await user.type(editor, "rough text");
    await user.click(screen.getByRole("button", { name: "Polish" }));

    await waitFor(() => {
      expect(editor.value).toBe("Polished text.");
    });

    await user.click(screen.getByRole("button", { name: "Undo" }));

    await waitFor(() => {
      expect(editor.value).toBe("rough text");
      expect(screen.getByText("Undo restored the original text.")).toBeTruthy();
    });
  });

  it("respects clear confirmation and clears when confirmed", async () => {
    const confirmMock = vi.fn(() => true);
    vi.stubGlobal("confirm", confirmMock);

    render(<App />);
    const user = userEvent.setup();
    const editor = (await screen.findByLabelText("Your text")) as HTMLTextAreaElement;

    await user.type(editor, "clear me");
    await user.click(screen.getByRole("button", { name: "Clear" }));

    const clearedEditor = screen.getByLabelText("Your text") as HTMLTextAreaElement;
    expect(confirmMock).toHaveBeenCalledWith("Clear all text and start over?");
    expect(clearedEditor.value).toBe("");
    expect(screen.getByText("Cleared.")).toBeTruthy();

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 1050));
    });

    expect(screen.getByText("Ready.")).toBeTruthy();
    expect(screen.queryByText("Cleared.")).toBeNull();
  });

  it("leaves text untouched when clear is cancelled", async () => {
    const confirmMock = vi.fn(() => false);
    vi.stubGlobal("confirm", confirmMock);

    render(<App />);
    const user = userEvent.setup();
    const editor = (await screen.findByLabelText("Your text")) as HTMLTextAreaElement;

    await user.type(editor, "keep me");
    await user.click(screen.getByRole("button", { name: "Clear" }));

    await waitFor(() => {
      expect(editor.value).toBe("keep me");
      expect(screen.getByText("Clear cancelled.")).toBeTruthy();
    });
  });

  it("returns to the missing-key resting status after clear when setup is still required", async () => {
    readAppSettingsMock.mockResolvedValue({
      ...TEST_SETTINGS,
      openaiApiKey: "",
    });

    const confirmMock = vi.fn(() => true);
    vi.stubGlobal("confirm", confirmMock);

    render(<App />);
    const user = userEvent.setup();
    const editor = (await screen.findByLabelText("Your text")) as HTMLTextAreaElement;

    await user.type(editor, "draft without key");
    await user.click(screen.getByRole("button", { name: "Clear" }));

    expect(confirmMock).toHaveBeenCalledWith("Clear all text and start over?");
    expect(screen.getByText("Cleared.")).toBeTruthy();

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 1050));
    });

    expect(screen.getByText("Add your OpenAI API key to start.")).toBeTruthy();
    expect(screen.queryByText("Cleared.")).toBeNull();
  });

  it("remounts and resets the editor DOM state on confirmed clear", async () => {
    const confirmMock = vi.fn(() => true);
    vi.stubGlobal("confirm", confirmMock);

    render(<App />);
    const user = userEvent.setup();
    const editor = (await screen.findByLabelText("Your text")) as HTMLTextAreaElement;

    await user.type(editor, "Line 1\nLine 2\nLine 3\nLine 4\nLine 5");
    editor.focus();
    editor.setSelectionRange(8, 8);
    editor.scrollTop = 120;
    editor.scrollLeft = 18;

    await user.click(screen.getByRole("button", { name: "Clear" }));

    await waitFor(() => {
      const resetEditor = screen.getByLabelText("Your text") as HTMLTextAreaElement;
      expect(confirmMock).toHaveBeenCalledWith("Clear all text and start over?");
      expect(resetEditor).not.toBe(editor);
      expect(resetEditor.value).toBe("");
      expect(document.activeElement).toBe(resetEditor);
      expect(resetEditor.selectionStart).toBe(0);
      expect(resetEditor.selectionEnd).toBe(0);
      expect(resetEditor.scrollTop).toBe(0);
      expect(resetEditor.scrollLeft).toBe(0);
    });
  });

  it("does not let the delayed clear reset overwrite a newer status", async () => {
    let resolveTransform:
      | ((result: ReturnType<typeof createSuccessfulTransform>) => void)
      | undefined;

    streamTransformWithOpenAIMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveTransform = resolve;
        }),
    );

    const confirmMock = vi.fn(() => true);
    vi.stubGlobal("confirm", confirmMock);

    render(<App />);
    const user = userEvent.setup();
    const editor = (await screen.findByLabelText("Your text")) as HTMLTextAreaElement;

    await user.type(editor, "clear then polish");
    await user.click(screen.getByRole("button", { name: "Clear" }));

    const resetEditor = screen.getByLabelText("Your text") as HTMLTextAreaElement;
    await user.type(resetEditor, "second pass");
    await user.click(screen.getByRole("button", { name: "Polish" }));

    expect(confirmMock).toHaveBeenCalledWith("Clear all text and start over?");
    expect(screen.getByRole("status").textContent).toContain("Polishing…");

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 1050));
    });

    expect(screen.getByRole("status").textContent).toContain("Polishing…");
    expect(screen.queryByText("Ready.")).toBeNull();

    act(() => {
      resolveTransform?.(createSuccessfulTransform("Second pass polished."));
    });

    await waitFor(() => {
      expect(screen.getByText("Polished.")).toBeTruthy();
      expect((screen.getByLabelText("Your text") as HTMLTextAreaElement).value).toBe(
        "Second pass polished.",
      );
    });
  });

  it("copies the current text", async () => {
    render(<App />);
    const user = userEvent.setup();
    const editor = (await screen.findByLabelText("Your text")) as HTMLTextAreaElement;

    await user.type(editor, "copy me");
    await user.click(screen.getByRole("button", { name: "Copy" }));

    await waitFor(() => {
      expect(screen.getByText("Copied.")).toBeTruthy();
    });
  });

  it("shares the current text through navigator.share", async () => {
    render(<App />);
    const user = userEvent.setup();
    const editor = (await screen.findByLabelText("Your text")) as HTMLTextAreaElement;

    await user.type(editor, "share me");
    await user.click(screen.getByRole("button", { name: "Share" }));

    await waitFor(() => {
      expect(shareMock).toHaveBeenCalledWith({ text: "share me" });
      expect(screen.getByText("Share sheet opened.")).toBeTruthy();
    });
  });

  it("shows a clear error when sharing is unavailable", async () => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    });

    render(<App />);
    const user = userEvent.setup();
    const editor = (await screen.findByLabelText("Your text")) as HTMLTextAreaElement;

    await user.type(editor, "share me");
    await user.click(screen.getByRole("button", { name: "Share" }));

    await waitFor(() => {
      expect(screen.getByText("Sharing is not available on this device.")).toBeTruthy();
    });
  });

  it("disables copy, clear, and share while streaming", async () => {
    let resolveTransform: ((value: ReturnType<typeof createSuccessfulTransform>) => void) | null =
      null;
    streamTransformWithOpenAIMock.mockImplementationOnce(
      async () =>
        await new Promise((resolve) => {
          resolveTransform = resolve;
        }),
    );

    render(<App />);
    const user = userEvent.setup();
    const editor = (await screen.findByLabelText("Your text")) as HTMLTextAreaElement;

    await user.type(editor, "busy");
    await user.click(screen.getByRole("button", { name: "Polish" }));

    await waitFor(() => {
      expect((screen.getByRole("button", { name: "Copy" }) as HTMLButtonElement).disabled).toBe(
        true,
      );
      expect((screen.getByRole("button", { name: "Clear" }) as HTMLButtonElement).disabled).toBe(
        true,
      );
      expect((screen.getByRole("button", { name: "Share" }) as HTMLButtonElement).disabled).toBe(
        true,
      );
      expect((screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement).disabled).toBe(
        false,
      );
    });

    await act(async () => {
      resolveTransform?.(createSuccessfulTransform("done"));
    });
  });

  it("surfaces provider errors through the visible status strip", async () => {
    streamTransformWithOpenAIMock.mockRejectedValueOnce(
      new MockOpenAIProviderError("auth", "Auth failed"),
    );

    render(<App />);
    const user = userEvent.setup();
    const editor = (await screen.findByLabelText("Your text")) as HTMLTextAreaElement;

    await user.type(editor, "rough");
    await user.click(screen.getByRole("button", { name: "Polish" }));

    await waitFor(() => {
      expect(screen.getByText("OpenAI authentication failed. Check your API key.")).toBeTruthy();
      expect(editor.value).toBe("rough");
    });
  });
});
