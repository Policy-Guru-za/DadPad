import {
  ChangeEvent,
  ClipboardEvent,
  FormEvent,
  SyntheticEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import "./App.css";
import {
  OpenAIProviderError,
  streamTransformWithOpenAI,
  type OpenAITransformMode,
} from "./providers/openai";
import {
  PROTECTED_CONTENT_MISMATCH_MESSAGE,
  decodePlaceholders,
  encodeProtectedSpans,
  validatePlaceholders,
} from "./protect/placeholders";
import {
  MARKDOWN_SCAFFOLD_DRIFT_MESSAGE,
  detectUnsupportedMarkdownScaffolding,
  normalizePromptMarkdown,
} from "./agentPrompts/markdown";
import { normalizeStructuredPlainText } from "./structuring/plainText";
import {
  AppSettings,
  DEFAULT_APP_SETTINGS,
  readAppSettings,
  writeAppSettings,
} from "./settings/config";

type RewriteTransformMode = "Polish" | "Casual" | "Professional" | "Direct";
type MarkdownPreset = "Universal" | "Codex" | "Claude";
type MarkdownTransformMode = `Markdown (${MarkdownPreset})`;
type TransformMode = RewriteTransformMode | MarkdownTransformMode;
type WiredTransformMode = TransformMode;
type ToneMode = Exclude<RewriteTransformMode, "Polish">;
type SettingsSaveStatus = "idle" | "saving" | "saved" | "error";

const TONE_MODES: ToneMode[] = [
  "Casual",
  "Professional",
  "Direct",
];
const MARKDOWN_PRESETS: MarkdownPreset[] = ["Universal", "Codex", "Claude"];

const MISSING_API_KEY_MESSAGE = "Set API key in Settings.";
const CREATOR_HANDLE = "@laup30";
const CREATOR_LOCATION = "Cape Town";
// Tone helper messages (available for future use)
// const TONE_LOCKED_HELPER = "Unlocks after one Polish pass.";
// const TONE_READY_HELPER = "Choose the final tone.";

function countWords(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) {
    return 0;
  }

  return trimmed.split(/\s+/).length;
}

async function writeClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function mapProviderError(error: unknown): string {
  if (error instanceof OpenAIProviderError) {
    if (error.code === "auth") {
      return "OpenAI authentication failed. Check your API key.";
    }
    if (error.code === "rate_limit") {
      return "OpenAI rate limit reached. Wait briefly, then retry.";
    }
    if (error.code === "timeout") {
      return "OpenAI request timed out. Retry with a shorter input.";
    }
    if (error.code === "network") {
      return "Network error contacting OpenAI. Check your connection.";
    }

    if (error.message.startsWith(PROTECTED_CONTENT_MISMATCH_MESSAGE)) {
      return PROTECTED_CONTENT_MISMATCH_MESSAGE;
    }

    if (error.message === MARKDOWN_SCAFFOLD_DRIFT_MESSAGE) {
      return MARKDOWN_SCAFFOLD_DRIFT_MESSAGE;
    }

    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Transform failed. Original text restored.";
}

function isMarkdownMode(mode: WiredTransformMode | null): mode is MarkdownTransformMode {
  return mode !== null && mode.startsWith("Markdown (");
}

function createMarkdownMode(preset: MarkdownPreset): MarkdownTransformMode {
  return `Markdown (${preset})`;
}

function toProviderMode(mode: WiredTransformMode): OpenAITransformMode {
  if (mode === "Casual") {
    return "casual";
  }

  if (mode === "Professional") {
    return "professional";
  }

  if (mode === "Direct") {
    return "direct";
  }

  if (mode === "Markdown (Universal)") {
    return "agent-universal";
  }

  if (mode === "Markdown (Codex)") {
    return "agent-codex";
  }

  if (mode === "Markdown (Claude)") {
    return "agent-claude";
  }

  return "polish";
}

function isFullEditorSelection(
  value: string,
  selectionStart: number | null,
  selectionEnd: number | null,
): boolean {
  return value.length > 0 && selectionStart === 0 && selectionEnd === value.length;
}

function App() {
  const [text, setText] = useState("");
  const [lastMode, setLastMode] = useState<TransformMode | null>(null);
  const [copyFeedback, setCopyFeedback] = useState("");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [warning, setWarning] = useState("None");
  const [isStreaming, setIsStreaming] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [activeStreamMode, setActiveStreamMode] = useState<WiredTransformMode | null>(null);
  const [hasPolishedCurrentSession, setHasPolishedCurrentSession] = useState(false);
  const [hasSuccessfulTransformCurrentSession, setHasSuccessfulTransformCurrentSession] =
    useState(false);
  const [selectedMarkdownPreset, setSelectedMarkdownPreset] =
    useState<MarkdownPreset>("Universal");
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [settingsDraft, setSettingsDraft] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);
  const [settingsSaveStatus, setSettingsSaveStatus] = useState<SettingsSaveStatus>("idle");
  const [settingsMessage, setSettingsMessage] = useState("");
  const setStatusMessage = (_nextStatusMessage: string): void => undefined;

  const abortControllerRef = useRef<AbortController | null>(null);
  const undoCheckpointRef = useRef<string | null>(null);
  const editorSelectionRef = useRef<{ start: number | null; end: number | null }>({
    start: null,
    end: null,
  });
  const resetToneLockOnNextChangeRef = useRef(false);
  const settingsSaveResetTimeoutRef = useRef<number | null>(null);

  const wordCount = useMemo(() => countWords(text), [text]);
  const charCount = text.length;
  const apiKeyMissing = settings.openaiApiKey.trim().length === 0;
  const transformsDisabled = isStreaming || !isSettingsLoaded || apiKeyMissing;
  const toneModesDisabled = transformsDisabled || !hasPolishedCurrentSession;
  const markdownDisabled = transformsDisabled || !hasSuccessfulTransformCurrentSession;
  const isSavingSettings = settingsSaveStatus === "saving";

  const clearSettingsSaveResetTimeout = (): void => {
    if (settingsSaveResetTimeoutRef.current !== null) {
      window.clearTimeout(settingsSaveResetTimeoutRef.current);
      settingsSaveResetTimeoutRef.current = null;
    }
  };

  const resetSettingsSaveFeedback = (): void => {
    clearSettingsSaveResetTimeout();
    setSettingsSaveStatus((current) =>
      current === "saved" || current === "error" ? "idle" : current,
    );
    setSettingsMessage("");
  };

  const updateSettingsDraft = (updater: (current: AppSettings) => AppSettings): void => {
    resetSettingsSaveFeedback();
    setSettingsDraft((current) => updater(current));
  };

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const loaded = await readAppSettings();
        if (cancelled) {
          return;
        }

        setSettings(loaded);
        setSettingsDraft(loaded);
        setStatusMessage(loaded.openaiApiKey ? "" : MISSING_API_KEY_MESSAGE);
      } catch {
        if (cancelled) {
          return;
        }

        setSettingsMessage("Unable to load settings.");
        setStatusMessage("Unable to load settings.");
      } finally {
        if (!cancelled) {
          setIsSettingsLoaded(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (settingsSaveResetTimeoutRef.current !== null) {
        window.clearTimeout(settingsSaveResetTimeoutRef.current);
      }
    };
  }, []);

  const handleTransform = async (mode: WiredTransformMode): Promise<void> => {
    if (isStreaming) {
      return;
    }

    const sourceText = text;
    if (!sourceText.trim()) {
      setStatusMessage("Add text before running a transform.");
      return;
    }

    const apiKey = settings.openaiApiKey.trim();
    if (!apiKey) {
      setWarning("Missing API key");
      setStatusMessage(MISSING_API_KEY_MESSAGE);
      return;
    }

    const shouldProtect = settings.tokenProtection;
    const smartStructuringEnabled = settings.smartStructuring;
    const controller = new AbortController();
    const encoded = shouldProtect
      ? encodeProtectedSpans(sourceText)
      : { encodedText: sourceText, mapping: [] };
    const { encodedText, mapping } = encoded;
    abortControllerRef.current = controller;
    undoCheckpointRef.current = sourceText;
    setCanUndo(false);

    setIsStreaming(true);
    setActiveStreamMode(mode);
    setCopyFeedback("");
    setLastMode(mode);
    setLatencyMs(null);
    setWarning("None");
    setStatusMessage(`${mode} in progress...`);
    setText("");

    const startedAt = performance.now();
    let streamedOutput = "";

    try {
      const result = await streamTransformWithOpenAI({
        apiKey,
        inputText: encodedText,
        mode: toProviderMode(mode),
        model: settings.model,
        temperature: settings.temperature,
        streaming: settings.streaming,
        smartStructuring: smartStructuringEnabled,
        signal: controller.signal,
        onRetrying: () => {
          streamedOutput = "";
          setText("");
        },
        onDelta: (delta) => {
          streamedOutput += delta;
          setText(streamedOutput);
        },
      });

      const finalOutput = result.outputText;
      const normalizedOutput = isMarkdownMode(mode)
        ? normalizePromptMarkdown(finalOutput)
        : smartStructuringEnabled
          ? normalizeStructuredPlainText(finalOutput)
          : finalOutput;
      const decodedText = shouldProtect
        ? decodePlaceholders(normalizedOutput, mapping)
        : normalizedOutput;
      if (shouldProtect) {
        const validation = validatePlaceholders(decodedText, mapping);
        if (!validation.ok) {
          throw new OpenAIProviderError("unknown", validation.error);
        }
      }

      if (isMarkdownMode(mode)) {
        const markdownDrift = detectUnsupportedMarkdownScaffolding(sourceText, decodedText);
        if (markdownDrift.length > 0) {
          throw new OpenAIProviderError("unknown", MARKDOWN_SCAFFOLD_DRIFT_MESSAGE);
        }
      }

      const committedText = decodedText;

      setText(committedText);
      const elapsed = Math.round(performance.now() - startedAt);
      setLatencyMs(elapsed);
      setCanUndo(true);
      setHasSuccessfulTransformCurrentSession(true);

      if (mode === "Polish") {
        setHasPolishedCurrentSession(true);
      }

      setWarning("None");
      setStatusMessage(`${mode} complete in ${elapsed} ms.`);
    } catch (error) {
      setText(undoCheckpointRef.current ?? sourceText);
      undoCheckpointRef.current = null;
      setCanUndo(false);
      setLatencyMs(null);
      setCopyFeedback("");

      if (controller.signal.aborted) {
        setWarning("None");
        setStatusMessage(`${mode} cancelled. Original text restored.`);
      } else {
        const friendlyMessage = mapProviderError(error);
        setWarning(friendlyMessage);
        setStatusMessage(friendlyMessage);
      }
    } finally {
      abortControllerRef.current = null;
      setIsStreaming(false);
      setActiveStreamMode(null);
    }
  };

  const handleTransformClick = (mode: TransformMode): void => {
    void handleTransform(mode);
  };

  const handleCancel = (): void => {
    if (!isStreaming) {
      return;
    }

    setStatusMessage(`Cancelling ${activeStreamMode ?? "transform"}...`);
    abortControllerRef.current?.abort();
  };

  const rememberEditorSelection = (target: HTMLTextAreaElement): void => {
    editorSelectionRef.current = {
      start: target.selectionStart,
      end: target.selectionEnd,
    };
  };

  const handleUndo = (): void => {
    if (isStreaming || !canUndo || undoCheckpointRef.current === null) {
      return;
    }

    setText(undoCheckpointRef.current);
    undoCheckpointRef.current = null;
    setCanUndo(false);
    setLatencyMs(null);
    setWarning("None");
    setCopyFeedback("");
    setStatusMessage("Undo restored pre-transform text.");
  };

  const handleEditorChange = (event: ChangeEvent<HTMLTextAreaElement>): void => {
    const target = event.currentTarget;
    const nextText = event.currentTarget.value;
    const shouldResetToneLock =
      nextText.length === 0 ||
      resetToneLockOnNextChangeRef.current ||
      (nextText !== text &&
        isFullEditorSelection(text, editorSelectionRef.current.start, editorSelectionRef.current.end));
    const shouldResetAgentPromptLock = nextText.length === 0;
    resetToneLockOnNextChangeRef.current = false;
    rememberEditorSelection(target);
    setText(nextText);
    if (shouldResetToneLock) {
      setHasPolishedCurrentSession(false);
    }
    if (shouldResetAgentPromptLock) {
      setHasSuccessfulTransformCurrentSession(false);
    }
  };

  const handleEditorBeforeInput = (event: FormEvent<HTMLTextAreaElement>): void => {
    const nativeEvent = event.nativeEvent as InputEvent;
    const inputType = typeof nativeEvent.inputType === "string" ? nativeEvent.inputType : "";
    if (!inputType.startsWith("insert")) {
      return;
    }

    const target = event.currentTarget;
    if (isFullEditorSelection(target.value, target.selectionStart, target.selectionEnd)) {
      resetToneLockOnNextChangeRef.current = true;
    }
  };

  const handleEditorSelect = (event: SyntheticEvent<HTMLTextAreaElement>): void => {
    rememberEditorSelection(event.currentTarget);
  };

  const handleEditorPaste = (event: ClipboardEvent<HTMLTextAreaElement>): void => {
    const target = event.currentTarget;
    if (
      target.value.length === 0 ||
      isFullEditorSelection(target.value, target.selectionStart, target.selectionEnd)
    ) {
      setHasPolishedCurrentSession(false);
      setHasSuccessfulTransformCurrentSession(false);
    }
  };

  const handleSettingsSave = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (isSavingSettings) {
      return;
    }

    clearSettingsSaveResetTimeout();
    setSettingsSaveStatus("saving");
    setSettingsMessage("");

    try {
      const saved = await writeAppSettings(settingsDraft);
      setSettings(saved);
      setSettingsDraft(saved);
      setSettingsSaveStatus("saved");
      settingsSaveResetTimeoutRef.current = window.setTimeout(() => {
        setSettingsSaveStatus("idle");
        settingsSaveResetTimeoutRef.current = null;
      }, 1800);
      setStatusMessage(saved.openaiApiKey ? "Settings saved." : MISSING_API_KEY_MESSAGE);
    } catch {
      setSettingsSaveStatus("error");
      setSettingsMessage("Unable to save settings.");
      setStatusMessage("Unable to save settings.");
    }
  };

  const handleCopy = async (): Promise<void> => {
    try {
      await writeClipboard(text);
      setCopyFeedback("Copied");
      setStatusMessage("Copied current text to clipboard.");
      window.setTimeout(() => setCopyFeedback(""), 1300);
    } catch {
      setCopyFeedback("Copy failed");
      setStatusMessage("Clipboard write failed. Check app clipboard permissions.");
      window.setTimeout(() => setCopyFeedback(""), 1800);
    }
  };

  const handleMarkdownClick = (): void => {
    void handleTransform(createMarkdownMode(selectedMarkdownPreset));
  };

  return (
    <main className="app-shell">
      {/* Enso circle — brushstroke watermark */}
      <svg className="enso" viewBox="0 0 200 200" aria-hidden="true">
        <circle cx="100" cy="100" r="80" fill="none" stroke="#1c1b18" strokeWidth="8" strokeLinecap="round" strokeDasharray="420 80" transform="rotate(-30 100 100)" />
      </svg>

      {/* Header — brand + action buttons */}
      <header className="header">
        <div className="brand-area">
          <span className="brand-jp">磨く — to polish</span>
          <h1 className="brand-title">PolishPad</h1>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="action-btn"
            onClick={handleCancel}
            disabled={!isStreaming}
          >
            Cancel
          </button>
          <button
            type="button"
            className="action-btn"
            onClick={handleUndo}
            disabled={isStreaming || !canUndo}
          >
            Undo
          </button>
          <button
            type="button"
            className={`action-btn primary${copyFeedback === "Copied" ? " copied" : ""}`}
            onClick={handleCopy}
            disabled={text.length === 0 || isStreaming}
          >
            {copyFeedback === "Copied" ? "\u2713 Copied" : "Copy"}
          </button>
          <button
            type="button"
            className="action-btn settings-trigger"
            onClick={() => setIsSettingsOpen((open) => !open)}
          >
            {isSettingsOpen ? "Close" : "Settings"}
          </button>
        </div>
      </header>

      {/* Ink line divider with vermillion accent */}
      <div className="ink-line" aria-hidden="true" />

      {apiKeyMissing ? <p className="settings-warning">{MISSING_API_KEY_MESSAGE}</p> : null}

      {isSettingsOpen ? (
        <section className="settings-panel" aria-label="Settings">
          <form className="settings-form" onSubmit={handleSettingsSave}>
              <label className="settings-field" htmlFor="openai-api-key">
                OpenAI API key
              </label>
              <input
                id="openai-api-key"
                className="settings-input"
                type="password"
                value={settingsDraft.openaiApiKey}
                onChange={(event) => {
                  const nextOpenAiApiKey = event.currentTarget.value;
                  updateSettingsDraft((current) => ({
                    ...current,
                    openaiApiKey: nextOpenAiApiKey,
                  }));
                }}
                placeholder="sk-..."
                autoComplete="off"
              />

              <label className="settings-field" htmlFor="model-name">
                Model
              </label>
              <input
                id="model-name"
                className="settings-input"
                type="text"
                value={settingsDraft.model}
                onChange={(event) => {
                  const nextModel = event.currentTarget.value;
                  updateSettingsDraft((current) => ({
                    ...current,
                    model: nextModel,
                  }));
                }}
              />

              <label className="settings-field" htmlFor="temperature">
                Temperature
              </label>
              <input
                id="temperature"
                className="settings-input"
                type="number"
                min={0}
                max={2}
                step={0.1}
                value={settingsDraft.temperature}
                onChange={(event) => {
                  const nextTemperatureRaw = Number(event.currentTarget.value);
                  updateSettingsDraft((current) => ({
                    ...current,
                    temperature: Number.isFinite(nextTemperatureRaw)
                      ? nextTemperatureRaw
                      : current.temperature,
                  }));
                }}
              />

              <label className="settings-checkbox">
                <input
                  type="checkbox"
                  checked={settingsDraft.streaming}
                  onChange={(event) => {
                    const nextStreaming = event.currentTarget.checked;
                    updateSettingsDraft((current) => ({
                      ...current,
                      streaming: nextStreaming,
                    }));
                  }}
                />
                Streaming
              </label>

              <label className="settings-checkbox">
                <input
                  type="checkbox"
                  checked={settingsDraft.tokenProtection}
                  onChange={(event) => {
                    const nextTokenProtection = event.currentTarget.checked;
                    updateSettingsDraft((current) => ({
                      ...current,
                      tokenProtection: nextTokenProtection,
                    }));
                  }}
                />
                Token protection
              </label>

              <div className="settings-toggle-group">
                <label className="settings-checkbox">
                  <input
                  type="checkbox"
                  checked={settingsDraft.smartStructuring}
                  onChange={(event) => {
                    const nextSmartStructuring = event.currentTarget.checked;
                    updateSettingsDraft((current) => ({
                      ...current,
                      smartStructuring: nextSmartStructuring,
                    }));
                    }}
                  />
                  Smart message structuring
                </label>
                <p className="settings-help">
                  Use better paragraph breaks and bullets when they improve readability.
                </p>
              </div>

              <div className="settings-actions">
                <button
                  type="submit"
                  className={`save-settings-button${settingsSaveStatus === "saved" ? " saved" : ""}`}
                  disabled={isSavingSettings}
                >
                  {settingsSaveStatus === "saving"
                    ? "Saving..."
                    : settingsSaveStatus === "saved"
                      ? "Saved"
                      : "Save Settings"}
                </button>
                {settingsMessage ? <span className="settings-message">{settingsMessage}</span> : null}
              </div>
          </form>
        </section>
      ) : null}

      {/* Controls — Polish button + tone selector */}
      <div className="controls">
        <button
          type="button"
          className={`polish-btn${lastMode === "Polish" ? " active" : ""}${activeStreamMode === "Polish" && isStreaming ? " streaming" : ""}`}
          disabled={transformsDisabled}
          onClick={() => handleTransformClick("Polish")}
        >
          <span>Polish</span>
        </button>
        <div className="tone-area">
          <span className="tone-label">After polish</span>
          <div className={`tone-group${hasPolishedCurrentSession ? "" : " locked"}`} aria-label="Tone options">
            {TONE_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                className={`tone-btn${lastMode === mode ? " active" : ""}${activeStreamMode === mode && isStreaming ? " streaming" : ""}`}
                disabled={toneModesDisabled}
                onClick={() => handleTransformClick(mode)}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
        <div className="agent-area">
          <span className="tone-label">For agents</span>
          <div className="agent-controls">
            <button
              type="button"
              className={`agent-prompt-btn${isMarkdownMode(lastMode) ? " active" : ""}${isMarkdownMode(activeStreamMode) && isStreaming ? " streaming" : ""}`}
              disabled={markdownDisabled}
              onClick={handleMarkdownClick}
            >
              <span>Markdown</span>
            </button>
            <div
              className={`agent-preset-group${hasSuccessfulTransformCurrentSession ? "" : " locked"}`}
              aria-label="Markdown presets"
            >
              {MARKDOWN_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`agent-preset-btn${selectedMarkdownPreset === preset ? " active" : ""}`}
                  disabled={markdownDisabled}
                  onClick={() => setSelectedMarkdownPreset(preset)}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Editor */}
      <section className="editor-section">
        <span className="editor-label" aria-hidden="true">
          Your text
        </span>
        <label className="sr-only" htmlFor="editor">
          Text editor
        </label>
        <div className="editor-frame">
          <textarea
            id="editor"
            className="editor"
            value={text}
            onBeforeInput={handleEditorBeforeInput}
            onChange={handleEditorChange}
            onPaste={handleEditorPaste}
            onSelect={handleEditorSelect}
            placeholder="Paste or write text here. Polish first, then choose a tone if needed."
            spellCheck
            readOnly={isStreaming}
          />
        </div>
      </section>

      {/* Bottom divider */}
      <div className="bottom-line" aria-hidden="true" />

      {/* Footer — stats left, credit right */}
      <footer className="footer">
        <div className="stats" aria-live="polite">
          <span><span className="stat-val">{wordCount}</span> words</span>
          <span><span className="stat-val">{charCount}</span> chars</span>
          <span>Mode: {lastMode ?? "None"}</span>
          <span>Latency: {latencyMs === null ? "\u2013" : `${latencyMs} ms`}</span>
          <span>Warnings: {warning}</span>
        </div>
        <div className="footer-right">
          <span className="attribution">{CREATOR_HANDLE} · 🇿🇦 {CREATOR_LOCATION}</span>
          <div className="hanko" aria-hidden="true">P</div>
        </div>
      </footer>
    </main>
  );
}

export default App;
