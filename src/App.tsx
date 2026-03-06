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
import { OpenAIProviderError, streamTransformWithOpenAI } from "./providers/openai";
import {
  PROTECTED_CONTENT_MISMATCH_MESSAGE,
  decodePlaceholders,
  encodeProtectedSpans,
  validatePlaceholders,
} from "./protect/placeholders";
import { normalizeStructuredPlainText } from "./structuring/plainText";
import {
  AppSettings,
  DEFAULT_APP_SETTINGS,
  readAppSettings,
  writeAppSettings,
} from "./settings/config";

type TransformMode = "Polish" | "Casual" | "Professional" | "Direct";
type WiredTransformMode = TransformMode;
type ToneMode = Exclude<TransformMode, "Polish">;

const TONE_MODES: ToneMode[] = [
  "Casual",
  "Professional",
  "Direct",
];

const MISSING_API_KEY_MESSAGE = "Set API key in Settings.";
const CREATOR_HANDLE = "@laup30";
const CREATOR_LOCATION = "Cape Town, South Africa";
const TONE_LOCKED_HELPER = "Unlocks after one Polish pass.";
const TONE_READY_HELPER = "Choose the final tone.";

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

    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Transform failed. Original text restored.";
}

function toProviderMode(mode: WiredTransformMode): "polish" | "casual" | "professional" | "direct" {
  if (mode === "Casual") {
    return "casual";
  }

  if (mode === "Professional") {
    return "professional";
  }

  if (mode === "Direct") {
    return "direct";
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
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [settingsDraft, setSettingsDraft] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState("");
  const setStatusMessage = (_nextStatusMessage: string): void => undefined;

  const abortControllerRef = useRef<AbortController | null>(null);
  const undoCheckpointRef = useRef<string | null>(null);
  const editorSelectionRef = useRef<{ start: number | null; end: number | null }>({
    start: null,
    end: null,
  });
  const resetToneLockOnNextChangeRef = useRef(false);

  const wordCount = useMemo(() => countWords(text), [text]);
  const charCount = text.length;
  const apiKeyMissing = settings.openaiApiKey.trim().length === 0;
  const transformsDisabled = isStreaming || !isSettingsLoaded || apiKeyMissing;
  const toneModesDisabled = transformsDisabled || !hasPolishedCurrentSession;

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
        onDelta: (delta) => {
          streamedOutput += delta;
          setText(streamedOutput);
        },
      });

      const finalOutput = result.outputText;
      const normalizedOutput = smartStructuringEnabled
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

      const committedText = decodedText;

      setText(committedText);
      const elapsed = Math.round(performance.now() - startedAt);
      setLatencyMs(elapsed);
      setCanUndo(true);

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
    resetToneLockOnNextChangeRef.current = false;
    rememberEditorSelection(target);
    setText(nextText);
    if (shouldResetToneLock) {
      setHasPolishedCurrentSession(false);
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
    }
  };

  const handleSettingsSave = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (isSavingSettings) {
      return;
    }

    setIsSavingSettings(true);
    setSettingsMessage("");

    try {
      const saved = await writeAppSettings(settingsDraft);
      setSettings(saved);
      setSettingsDraft(saved);
      setStatusMessage(saved.openaiApiKey ? "Settings saved." : MISSING_API_KEY_MESSAGE);
    } catch {
      setSettingsMessage("Unable to save settings.");
      setStatusMessage("Unable to save settings.");
    } finally {
      setIsSavingSettings(false);
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

  return (
    <main className="app-shell">
      <header className="toolbar" aria-label="PolishPad toolbar">
        <div className="toolbar-section transform-section">
          <div className="transform-panel transform-panel-primary">
            <span className="toolbar-label">Start</span>
            <button
              type="button"
              className={`polish-btn${lastMode === "Polish" ? " active" : ""}${activeStreamMode === "Polish" && isStreaming ? " streaming" : ""}`}
              disabled={transformsDisabled}
              onClick={() => handleTransformClick("Polish")}
            >
              Polish
            </button>
          </div>

          <div className={`transform-panel transform-panel-tone${hasPolishedCurrentSession ? " unlocked" : " locked"}`}>
            <div className="tone-heading">
              <span className="toolbar-label">After Polish</span>
              <span className="tone-helper">
                {hasPolishedCurrentSession ? TONE_READY_HELPER : TONE_LOCKED_HELPER}
              </span>
            </div>
            <div className="segmented-control tone-control" aria-label="Tone options">
              {TONE_MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`mode-btn${lastMode === mode ? " active" : ""}${activeStreamMode === mode && isStreaming ? " streaming" : ""}`}
                  disabled={toneModesDisabled}
                  onClick={() => handleTransformClick(mode)}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="toolbar-section toolbar-actions">
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
                  setSettingsDraft((current) => ({
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
                  setSettingsDraft((current) => ({
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
                  setSettingsDraft((current) => ({
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
                    setSettingsDraft((current) => ({
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
                    setSettingsDraft((current) => ({
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
                      setSettingsDraft((current) => ({
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
                <button type="submit" className="save-settings-button" disabled={isSavingSettings}>
                  {isSavingSettings ? "Saving..." : "Save Settings"}
                </button>
                <span className="settings-message">{settingsMessage}</span>
              </div>
          </form>
        </section>
      ) : null}

      <section className="editor-area">
        <span className="editor-label" aria-hidden="true">
          Your text
        </span>
        <label className="sr-only" htmlFor="editor">
          Text editor
        </label>
        <div className="editor-wrapper">
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

      <div className="stats-bar" aria-live="polite">
        <span className="stat-item">Words: {wordCount}</span>
        <span className="stat-divider" aria-hidden="true" />
        <span className="stat-item">Characters: {charCount}</span>
        <span className="stat-divider" aria-hidden="true" />
        <span className="stat-item">Last mode: {lastMode ?? "None"}</span>
        <span className="stat-divider" aria-hidden="true" />
        <span className="stat-item">Latency: {latencyMs === null ? "\u2013" : `${latencyMs} ms`}</span>
        <span className="stat-divider" aria-hidden="true" />
        <span className="stat-item">Warnings: {warning}</span>
        <span className="copy-feedback">{copyFeedback}</span>
      </div>

      <footer className="footer">
        <div className="credit" aria-label="App creator">
          <span className="credit-handle">{CREATOR_HANDLE}</span>
          <span className="credit-dot" aria-hidden="true">
            ·
          </span>
          <span className="credit-location">
            <span>Made in</span>
            <span className="credit-flag" aria-hidden="true">
              🇿🇦
            </span>
            <span>{CREATOR_LOCATION}</span>
          </span>
        </div>
      </footer>
    </main>
  );
}

export default App;
