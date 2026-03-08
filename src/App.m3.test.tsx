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
let scrollToMock: ReturnType<typeof vi.fn>;
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

function getStatusChip(): HTMLDivElement {
  const chip = document.querySelector(".status-chip");
  if (!(chip instanceof HTMLDivElement)) {
    throw new Error("Expected visible readiness chip.");
  }

  return chip;
}

function getStatusChipDot(): HTMLSpanElement {
  const dot = document.querySelector(".status-chip-dot");
  if (!(dot instanceof HTMLSpanElement)) {
    throw new Error("Expected readiness chip dot.");
  }

  return dot;
}

function getHeroLogo(): HTMLImageElement {
  const logo = document.querySelector(".hero-logo");
  if (!(logo instanceof HTMLImageElement)) {
    throw new Error("Expected hero logo.");
  }

  return logo;
}

function getLiveStatusRegion(): HTMLDivElement {
  const region = screen.getByRole("status");
  if (!(region instanceof HTMLDivElement)) {
    throw new Error("Expected hidden live status region.");
  }

  return region;
}

function getActionSpacer(): HTMLDivElement {
  const spacer = document.querySelector(".action-spacer");
  if (!(spacer instanceof HTMLDivElement)) {
    throw new Error("Expected action spacer.");
  }

  return spacer;
}

function getActionDock(): HTMLElement {
  const dock = document.querySelector(".action-dock");
  if (!(dock instanceof HTMLElement)) {
    throw new Error("Expected action dock.");
  }

  return dock;
}

function getAppMain(): HTMLDivElement {
  const main = document.querySelector(".app-main");
  if (!(main instanceof HTMLDivElement)) {
    throw new Error("Expected app main scroll region.");
  }

  return main;
}

function getActionBarLabels(): string[] {
  const actionBar = document.querySelector(".action-bar");
  if (!(actionBar instanceof HTMLElement)) {
    throw new Error("Expected action bar.");
  }

  return Array.from(actionBar.querySelectorAll("button")).map((child) =>
    child.textContent?.replace(/\s+/g, " ").trim() ?? "",
  );
}

beforeEach(() => {
  streamTransformWithOpenAIMock.mockReset();
  readAppSettingsMock.mockReset();
  writeAppSettingsMock.mockReset();
  readAppSettingsMock.mockResolvedValue(TEST_SETTINGS);
  writeAppSettingsMock.mockImplementation(async (settings) => settings);
  clipboardWriteMock = vi.fn().mockResolvedValue(undefined);
  shareMock = vi.fn().mockResolvedValue(undefined);
  scrollToMock = vi.fn();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: clipboardWriteMock },
  });
  Object.defineProperty(navigator, "share", {
    configurable: true,
    value: shareMock,
  });
  Object.defineProperty(window, "scrollTo", {
    configurable: true,
    value: scrollToMock,
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
  it("renders the Warm Sand DadPad shell with the remapped bottom action grid", async () => {
    render(<App />);

    await waitFor(() => {
      const heroHeader = document.querySelector(".hero-header");
      expect(screen.getByRole("heading", { name: "DadPad" })).toBeTruthy();
      expect(getHeroLogo().getAttribute("src")).toContain("dadpad-logo");
      expect(getHeroLogo().getAttribute("alt")).toBe("");
      expect(getHeroLogo().closest(".hero-header")).toBe(heroHeader);
      const strapline = screen.getByText(
        "The ultimate helper to ensure that RCML is finally understood in written form.",
      );
      expect(strapline.closest("em")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Polish" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Clear" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Share" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Settings" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
      expect(screen.queryByRole("button", { name: "API key" })).toBeNull();
      expect(screen.queryByText("iPad-first writing help")).toBeNull();
      expect(document.querySelector(".status-strip")).toBeNull();
      expect(document.querySelector(".status-tile")).toBeNull();
      expect(getStatusChip().closest(".hero-header")).toBe(heroHeader);
      expect(getStatusChip().closest(".app-main")).toBeNull();
      expect(getStatusChip().getAttribute("data-tone")).toBe("ready");
      expect(getStatusChip().textContent).toContain("Ready");
      expect(getStatusChipDot().classList.contains("ready-dot")).toBe(true);
      expect(getStatusChipDot().classList.contains("error-dot")).toBe(false);
      expect(getActionBarLabels()).toEqual(["Polish", "Clear", "Copy", "Share", "Settings"]);
      expect(getActionSpacer()).toBeTruthy();
      expect(getActionDock()).toBeTruthy();
      expect(getAppMain()).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Casual" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Professional" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Direct" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Markdown" })).toBeNull();
    });
  });

  it("marks the live shell as the Warm Sand production theme", async () => {
    render(<App />);

    await waitFor(() => {
      const main = screen.getByRole("main");
      expect(main.getAttribute("data-theme")).toBe("warm-sand");
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
      expect(
        screen.getByText("The ultimate helper to ensure that RCML is finally understood in written form."),
      ).toBeTruthy();
      expect(getActionDock()).toBeTruthy();
      expect(getAppMain()).toBeTruthy();
    });
  });

  it("opens the minimal setup card when the API key is missing", async () => {
    readAppSettingsMock.mockResolvedValue({
      ...TEST_SETTINGS,
      openaiApiKey: "",
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByLabelText("API key required")).toBeTruthy();
      expect(screen.getByRole("heading", { name: "Set up DadPad" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Close settings" })).toBeTruthy();
      expect(getStatusChip().getAttribute("data-tone")).toBe("error");
      expect(getStatusChip().textContent).toContain("Add your OpenAI API key to start.");
      expect(getStatusChipDot().classList.contains("error-dot")).toBe(true);
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
      expect(getStatusChip().textContent).toContain("Ready");
      expect(getLiveStatusRegion().textContent).toContain("DadPad is ready.");
      expect(screen.queryByRole("heading", { name: "Set up DadPad" })).toBeNull();
      expect(screen.getByRole("button", { name: "Settings" })).toBeTruthy();
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
      expect(getStatusChip().textContent).toContain("Ready");
      expect(getLiveStatusRegion().textContent).toContain("Polished.");
      expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    });
  });

  it("opens the clear sheet without changing the main status and resets on confirm", async () => {
    render(<App />);
    const user = userEvent.setup();
    const editor = (await screen.findByLabelText("Your text")) as HTMLTextAreaElement;

    await user.type(editor, "clear me");
    expect(getStatusChip().textContent).toContain("Ready");

    await user.click(screen.getByRole("button", { name: "Clear" }));

    expect(screen.getByRole("alertdialog", { name: "Clear all text?" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Keep text" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Clear now" })).toBeTruthy();
    expect(getStatusChip().textContent).toContain("Ready");

    await user.click(screen.getByRole("button", { name: "Clear now" }));

    const clearedEditor = screen.getByLabelText("Your text") as HTMLTextAreaElement;
    expect(clearedEditor.value).toBe("");
    expect(getStatusChip().textContent).toContain("Ready");
    expect(screen.queryByRole("alertdialog", { name: "Clear all text?" })).toBeNull();
  });

  it("leaves text and status untouched when clear is cancelled", async () => {
    render(<App />);
    const user = userEvent.setup();
    const editor = (await screen.findByLabelText("Your text")) as HTMLTextAreaElement;

    await user.type(editor, "keep me");
    await user.click(screen.getByRole("button", { name: "Clear" }));
    await user.click(screen.getByRole("button", { name: "Keep text" }));

    await waitFor(() => {
      expect(editor.value).toBe("keep me");
      expect(getStatusChip().textContent).toContain("Ready");
      expect(screen.queryByRole("alertdialog", { name: "Clear all text?" })).toBeNull();
    });
  });

  it("returns to the missing-key resting status immediately after clear when setup is still required", async () => {
    readAppSettingsMock.mockResolvedValue({
      ...TEST_SETTINGS,
      openaiApiKey: "",
    });

    render(<App />);
    const user = userEvent.setup();
    const editor = (await screen.findByLabelText("Your text")) as HTMLTextAreaElement;

    await user.type(editor, "draft without key");
    await user.click(screen.getByRole("button", { name: "Clear" }));
    await user.click(screen.getByRole("button", { name: "Clear now" }));

    expect(getStatusChip().getAttribute("data-tone")).toBe("error");
    expect(getStatusChip().textContent).toContain("Add your OpenAI API key to start.");
    expect(screen.queryByRole("alertdialog", { name: "Clear all text?" })).toBeNull();
  });

  it("remounts and resets the editor DOM state on confirmed clear without refocusing it", async () => {
    render(<App />);
    const user = userEvent.setup();
    const editor = (await screen.findByLabelText("Your text")) as HTMLTextAreaElement;
    const appMain = getAppMain();

    await user.type(editor, "Line 1\nLine 2\nLine 3\nLine 4\nLine 5");
    editor.focus();
    editor.setSelectionRange(8, 8);
    editor.scrollTop = 120;
    editor.scrollLeft = 18;
    appMain.scrollTop = 160;
    appMain.scrollLeft = 22;

    await user.click(screen.getByRole("button", { name: "Clear" }));
    await user.click(screen.getByRole("button", { name: "Clear now" }));

    await waitFor(() => {
      const resetEditor = screen.getByLabelText("Your text") as HTMLTextAreaElement;
      expect(resetEditor).not.toBe(editor);
      expect(resetEditor.value).toBe("");
      expect(document.activeElement).not.toBe(resetEditor);
      expect(resetEditor.selectionStart).toBe(0);
      expect(resetEditor.selectionEnd).toBe(0);
      expect(resetEditor.scrollTop).toBe(0);
      expect(resetEditor.scrollLeft).toBe(0);
      expect(appMain.scrollTop).toBe(0);
      expect(appMain.scrollLeft).toBe(0);
      expect(scrollToMock).toHaveBeenCalled();
    });
  });

  it("restores editor DOM state when clear is cancelled", async () => {
    render(<App />);
    const user = userEvent.setup();
    const editor = (await screen.findByLabelText("Your text")) as HTMLTextAreaElement;

    await user.type(editor, "Line 1\nLine 2\nLine 3\nLine 4\nLine 5");
    editor.focus();
    editor.setSelectionRange(8, 12);
    editor.scrollTop = 120;
    editor.scrollLeft = 18;

    await user.click(screen.getByRole("button", { name: "Clear" }));
    await user.click(screen.getByRole("button", { name: "Keep text" }));

    await waitFor(() => {
      expect(document.activeElement).toBe(editor);
      expect(editor.selectionStart).toBe(8);
      expect(editor.selectionEnd).toBe(12);
      expect(editor.scrollTop).toBe(120);
      expect(editor.scrollLeft).toBe(18);
    });
  });

  it("locks the main actions while clear confirmation is open", async () => {
    render(<App />);
    const user = userEvent.setup();
    const editor = (await screen.findByLabelText("Your text")) as HTMLTextAreaElement;

    await user.type(editor, "lock these actions");
    await user.click(screen.getByRole("button", { name: "Clear" }));

    expect((screen.getByRole("button", { name: "Polish" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect((screen.getByRole("button", { name: "Clear" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect((screen.getByRole("button", { name: "Copy" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect((screen.getByRole("button", { name: "Share" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(
      (screen.getByRole("button", { name: "Settings" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect((screen.getByRole("button", { name: "Keep text" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
    expect((screen.getByRole("button", { name: "Clear now" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it("keeps Polish unchanged while harmonizing the secondary buttons and Settings treatment", async () => {
    render(<App />);

    const polish = (await screen.findByRole("button", { name: "Polish" })) as HTMLButtonElement;
    const clear = screen.getByRole("button", { name: "Clear" }) as HTMLButtonElement;
    const copy = screen.getByRole("button", { name: "Copy" }) as HTMLButtonElement;
    const share = screen.getByRole("button", { name: "Share" }) as HTMLButtonElement;
    const settings = screen.getByRole("button", { name: "Settings" }) as HTMLButtonElement;

    expect(polish.classList.contains("primary-action")).toBe(true);
    expect(polish.classList.contains("secondary-action")).toBe(false);
    expect(clear.classList.contains("secondary-action")).toBe(true);
    expect(copy.classList.contains("secondary-action")).toBe(true);
    expect(share.classList.contains("secondary-action")).toBe(true);
    expect(clear.classList.contains("secondary-danger")).toBe(false);
    expect(settings.classList.contains("system-action")).toBe(true);
    expect(settings.classList.contains("secondary-action")).toBe(false);
  });

  it("splits the shell into a fixed hero, scrollable main region, and docked footer actions", async () => {
    render(<App />);

    const title = await screen.findByRole("heading", { name: "DadPad" });
    const strapline = screen.getByText(
      "The ultimate helper to ensure that RCML is finally understood in written form.",
    );
    const appMain = getAppMain();
    const actionDock = getActionDock();
    const actionBar = document.querySelector(".action-bar");

    expect(title.closest(".hero")).toBeTruthy();
    expect(strapline.closest(".hero")).toBeTruthy();
    expect(strapline.closest(".app-main")).toBeNull();
    expect(screen.getByLabelText("Your text").closest(".app-main")).toBe(appMain);
    expect(actionBar?.parentElement).toBe(actionDock);
  });

  it("copies the current text", async () => {
    render(<App />);
    const user = userEvent.setup();
    const editor = (await screen.findByLabelText("Your text")) as HTMLTextAreaElement;

    await user.type(editor, "copy me");
    await user.click(screen.getByRole("button", { name: "Copy" }));

    await waitFor(() => {
      expect(getStatusChip().textContent).toContain("Ready");
      expect(getLiveStatusRegion().textContent).toContain("Copied.");
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
      expect(getStatusChip().textContent).toContain("Ready");
      expect(getLiveStatusRegion().textContent).toContain("Share sheet opened.");
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
      expect(getStatusChip().getAttribute("data-tone")).toBe("error");
      expect(getStatusChip().textContent).toContain("Sharing is not available on this device.");
    });
  });

  it("disables copy, clear, and share while streaming without showing cancel", async () => {
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
      expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
      expect(getStatusChip().textContent).toContain("Ready");
      expect(getLiveStatusRegion().textContent).toContain("Polishing…");
    });

    await act(async () => {
      resolveTransform?.(createSuccessfulTransform("done"));
    });
  });

  it("surfaces provider errors through the readiness chip", async () => {
    streamTransformWithOpenAIMock.mockRejectedValueOnce(
      new MockOpenAIProviderError("auth", "Auth failed"),
    );

    render(<App />);
    const user = userEvent.setup();
    const editor = (await screen.findByLabelText("Your text")) as HTMLTextAreaElement;

    await user.type(editor, "rough");
    await user.click(screen.getByRole("button", { name: "Polish" }));

    await waitFor(() => {
      expect(getStatusChip().getAttribute("data-tone")).toBe("error");
      expect(getStatusChip().textContent).toContain(
        "OpenAI authentication failed. Check your API key.",
      );
      expect(editor.value).toBe("rough");
    });
  });

  it("moves settings into the bottom row and toggles its label", async () => {
    render(<App />);
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Settings" })).toBeTruthy();
      expect(screen.queryByRole("heading", { name: "Set up DadPad" })).toBeNull();
    });

    await user.click(screen.getByRole("button", { name: "Settings" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Close settings" })).toBeTruthy();
      expect(screen.getByRole("heading", { name: "Set up DadPad" })).toBeTruthy();
    });

    await user.click(screen.getByRole("button", { name: "Close settings" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Settings" })).toBeTruthy();
      expect(screen.queryByRole("heading", { name: "Set up DadPad" })).toBeNull();
    });
  });
});
