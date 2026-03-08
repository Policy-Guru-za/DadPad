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
    openUrlMock: vi.fn(),
    MockOpenAIProviderError,
  };
});

const {
  streamTransformWithOpenAIMock,
  readAppSettingsMock,
  writeAppSettingsMock,
  openUrlMock,
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

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: hoisted.openUrlMock,
}));

const TEST_SETTINGS = {
  openaiApiKey: "test-key",
  model: "gpt-5-nano-2025-08-07",
  temperature: 0.2,
  streaming: true,
  tokenProtection: true,
  smartStructuring: true,
};

const OFFLINE_MESSAGE =
  "You are not connected to the internet. This app requires internet access.";

let clipboardWriteMock: ReturnType<typeof vi.fn>;
let shareMock: ReturnType<typeof vi.fn>;
let scrollToMock: ReturnType<typeof vi.fn>;
let fetchMock: ReturnType<typeof vi.fn>;
let navigatorOnlineState: boolean;
let documentVisibilityState: DocumentVisibilityState;
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
    child.getAttribute("aria-label") ??
      child.textContent?.replace(/\s+/g, " ").trim() ??
      "",
  );
}

function getEditorPanel(): HTMLElement {
  const panel = document.querySelector(".editor-panel");
  if (!(panel instanceof HTMLElement)) {
    throw new Error("Expected editor panel.");
  }

  return panel;
}

function getEditorLabel(): HTMLLabelElement {
  const label = document.querySelector(".editor-label");
  if (!(label instanceof HTMLLabelElement)) {
    throw new Error("Expected editor label.");
  }

  return label;
}

function getAppShell(): HTMLElement {
  return screen.getByRole("main");
}

function setNavigatorOnline(nextValue: boolean): void {
  navigatorOnlineState = nextValue;
}

function setDocumentVisibility(nextValue: DocumentVisibilityState): void {
  documentVisibilityState = nextValue;
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

async function renderApp(): Promise<void> {
  render(<App />);

  await waitFor(() => {
    expect(getAppShell().getAttribute("data-connectivity")).toBe("online");
  });
}

beforeEach(() => {
  streamTransformWithOpenAIMock.mockReset();
  readAppSettingsMock.mockReset();
  writeAppSettingsMock.mockReset();
  openUrlMock.mockReset();
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
  fetchMock = vi.fn().mockResolvedValue({});
  vi.stubGlobal("fetch", fetchMock);
  navigatorOnlineState = true;
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    get: () => navigatorOnlineState,
  });
  documentVisibilityState = "visible";
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => documentVisibilityState,
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
  it("shows no offline overlay after a successful startup connectivity probe", async () => {
    await renderApp();

    expect(screen.queryByText(OFFLINE_MESSAGE)).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith("https://api.openai.com", {
      method: "HEAD",
      mode: "no-cors",
      cache: "no-store",
      signal: expect.any(AbortSignal),
    });
  });

  it("shows the offline overlay immediately when navigator reports no internet at startup", async () => {
    setNavigatorOnline(false);
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(OFFLINE_MESSAGE)).toBeTruthy();
      expect(getAppShell().getAttribute("data-connectivity")).toBe("offline");
    });
  });

  it("shows the offline overlay when the startup reachability probe fails", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(OFFLINE_MESSAGE)).toBeTruthy();
      expect(getAppShell().getAttribute("data-connectivity")).toBe("offline");
    });
  });

  it("keeps the offline overlay visible until the follow-up online probe succeeds", async () => {
    setNavigatorOnline(false);
    fetchMock.mockRejectedValueOnce(new Error("offline"));
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(OFFLINE_MESSAGE)).toBeTruthy();
    });

    const probe = createDeferred<{}>();
    fetchMock.mockReturnValueOnce(probe.promise);
    setNavigatorOnline(true);
    window.dispatchEvent(new Event("online"));

    expect(screen.getByText(OFFLINE_MESSAGE)).toBeTruthy();

    await act(async () => {
      probe.resolve({});
      await probe.promise;
    });

    await waitFor(() => {
      expect(screen.queryByText(OFFLINE_MESSAGE)).toBeNull();
      expect(getAppShell().getAttribute("data-connectivity")).toBe("online");
    });
  });

  it("rechecks connectivity on visibility return and focus", async () => {
    await renderApp();

    fetchMock.mockClear();
    setDocumentVisibility("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(fetchMock).not.toHaveBeenCalled();

    setDocumentVisibility("visible");
    document.dispatchEvent(new Event("visibilitychange"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    fetchMock.mockClear();
    window.dispatchEvent(new Event("focus"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  it("automatically removes the offline overlay on retry once internet access returns", async () => {
    vi.useFakeTimers();
    fetchMock.mockRejectedValue(new Error("offline"));

    render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText(OFFLINE_MESSAGE)).toBeTruthy();

    fetchMock.mockReset();
    fetchMock.mockResolvedValue({});
    setNavigatorOnline(true);

    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    expect(screen.queryByText(OFFLINE_MESSAGE)).toBeNull();
    expect(getAppShell().getAttribute("data-connectivity")).toBe("online");
  });

  it("recovers on retry even if navigator.onLine still lags behind the reconnect", async () => {
    vi.useFakeTimers();
    setNavigatorOnline(false);
    fetchMock.mockRejectedValue(new Error("offline"));

    render(<App />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText(OFFLINE_MESSAGE)).toBeTruthy();

    fetchMock.mockReset();
    fetchMock.mockResolvedValue({});

    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
    });

    expect(screen.queryByText(OFFLINE_MESSAGE)).toBeNull();
    expect(getAppShell().getAttribute("data-connectivity")).toBe("online");
    expect(fetchMock).toHaveBeenCalledWith("https://api.openai.com", {
      method: "HEAD",
      mode: "no-cors",
      cache: "no-store",
      signal: expect.any(AbortSignal),
    });
  });

  it("preserves the live draft when the offline overlay disappears after reconnect", async () => {
    await renderApp();
    const user = userEvent.setup();
    const editor = screen.getByLabelText("Your text") as HTMLTextAreaElement;

    await user.type(editor, "preserve this draft");
    setNavigatorOnline(false);
    window.dispatchEvent(new Event("offline"));

    await waitFor(() => {
      expect(screen.getByText(OFFLINE_MESSAGE)).toBeTruthy();
      expect(editor.value).toBe("preserve this draft");
    });

    fetchMock.mockResolvedValueOnce({});
    setNavigatorOnline(true);
    window.dispatchEvent(new Event("online"));

    await waitFor(() => {
      expect(screen.queryByText(OFFLINE_MESSAGE)).toBeNull();
      expect(editor.value).toBe("preserve this draft");
    });
  });

  it("blocks the editor, actions, and settings while the offline overlay is visible", async () => {
    await renderApp();
    const user = userEvent.setup();
    const editor = screen.getByLabelText("Your text") as HTMLTextAreaElement;

    await user.type(editor, "offline lock");
    setNavigatorOnline(false);
    window.dispatchEvent(new Event("offline"));

    await waitFor(() => {
      expect(screen.getByText(OFFLINE_MESSAGE)).toBeTruthy();
      expect(editor.readOnly).toBe(true);
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
    });
  });

  it("renders the Warm Sand DadPad shell with the remapped bottom action grid", async () => {
    await renderApp();

    const heroHeader = document.querySelector(".hero-header");
    const editor = screen.getByLabelText("Your text") as HTMLTextAreaElement;
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
    expect(screen.getByRole("button", { name: "Gmail" })).toBeTruthy();
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
    expect(getActionBarLabels()).toEqual([
      "Polish",
      "Clear",
      "Settings",
      "Share",
      "Copy",
      "Gmail",
    ]);
    expect(getActionDock()).toBeTruthy();
    expect(getAppMain()).toBeTruthy();
    expect(getEditorPanel()).toBeTruthy();
    expect(getEditorLabel().classList.contains("sr-only")).toBe(true);
    expect(editor.placeholder).toBe("Paste or write text here.");
    expect(screen.queryByRole("button", { name: "Casual" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Professional" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Direct" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Markdown" })).toBeNull();
  });

  it("marks the live shell as the Warm Sand production theme", async () => {
    await renderApp();

    const main = screen.getByRole("main");
    expect(main.getAttribute("data-theme")).toBe("warm-sand");
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

    await renderApp();

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

    await renderApp();

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

    await renderApp();
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

    await renderApp();
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
    await renderApp();
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
    await renderApp();
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

    await renderApp();
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
    await renderApp();
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
    await renderApp();
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
    await renderApp();
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
    await renderApp();

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
    await renderApp();

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

  it("keeps only one visible editor surface while preserving the hidden label", async () => {
    await renderApp();

    const editor = screen.getByLabelText("Your text") as HTMLTextAreaElement;
    const editorLabel = getEditorLabel();
    const editorPanel = getEditorPanel();

    expect(editorLabel.classList.contains("sr-only")).toBe(true);
    expect(editor.getAttribute("placeholder")).toBe("Paste or write text here.");
    expect(editor.parentElement).toBe(editorPanel);
    expect(editorPanel.querySelectorAll("textarea")).toHaveLength(1);
    expect(editorPanel.querySelectorAll("label")).toHaveLength(1);
  });

  it("copies the current text", async () => {
    await renderApp();
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
    await renderApp();
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

  it("opens Gmail compose first and preserves paragraph breaks", async () => {
    openUrlMock.mockResolvedValueOnce(undefined);

    await renderApp();
    const user = userEvent.setup();
    const editor = (await screen.findByLabelText("Your text")) as HTMLTextAreaElement;

    await user.type(editor, "First paragraph{enter}{enter}Second paragraph");
    await user.click(screen.getByRole("button", { name: "Gmail" }));

    await waitFor(() => {
      expect(openUrlMock).toHaveBeenCalledTimes(1);
      expect(String(openUrlMock.mock.calls[0]?.[0])).toContain("googlegmail:///co?");
      expect(String(openUrlMock.mock.calls[0]?.[0])).toContain(
        "body=First%20paragraph%0D%0A%0D%0ASecond%20paragraph",
      );
      expect(getStatusChip().textContent).toContain("Ready");
      expect(getLiveStatusRegion().textContent).toContain("Gmail compose opened.");
    });
  });

  it("falls back to mailto when Gmail compose cannot open", async () => {
    openUrlMock
      .mockRejectedValueOnce(new Error("gmail missing"))
      .mockResolvedValueOnce(undefined);

    await renderApp();
    const user = userEvent.setup();
    const editor = (await screen.findByLabelText("Your text")) as HTMLTextAreaElement;

    await user.type(editor, "email me");
    await user.click(screen.getByRole("button", { name: "Gmail" }));

    await waitFor(() => {
      expect(openUrlMock).toHaveBeenCalledTimes(2);
      expect(String(openUrlMock.mock.calls[1]?.[0])).toBe("mailto:?body=email%20me");
      expect(getLiveStatusRegion().textContent).toContain("Email compose opened.");
    });
  });

  it("shows a clear error when Gmail and mailto are unavailable", async () => {
    openUrlMock.mockRejectedValue(new Error("no compose"));

    await renderApp();
    const user = userEvent.setup();
    const editor = (await screen.findByLabelText("Your text")) as HTMLTextAreaElement;

    await user.type(editor, "email me");
    await user.click(screen.getByRole("button", { name: "Gmail" }));

    await waitFor(() => {
      expect(getStatusChip().getAttribute("data-tone")).toBe("error");
      expect(getStatusChip().textContent).toContain(
        "Email compose is not available on this device.",
      );
    });
  });

  it("shows a clear error when sharing is unavailable", async () => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    });

    await renderApp();
    const user = userEvent.setup();
    const editor = (await screen.findByLabelText("Your text")) as HTMLTextAreaElement;

    await user.type(editor, "share me");
    await user.click(screen.getByRole("button", { name: "Share" }));

    await waitFor(() => {
      expect(getStatusChip().getAttribute("data-tone")).toBe("error");
      expect(getStatusChip().textContent).toContain("Sharing is not available on this device.");
    });
  });

  it("disables copy, clear, share, and Gmail while streaming without showing cancel", async () => {
    let resolveTransform: ((value: ReturnType<typeof createSuccessfulTransform>) => void) | null =
      null;
    streamTransformWithOpenAIMock.mockImplementationOnce(
      async () =>
        await new Promise((resolve) => {
          resolveTransform = resolve;
        }),
    );

    await renderApp();
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
      expect((screen.getByRole("button", { name: "Gmail" }) as HTMLButtonElement).disabled).toBe(
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

    await renderApp();
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

  it("moves settings into the top row and toggles its label", async () => {
    await renderApp();
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
