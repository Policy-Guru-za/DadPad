import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { OpenAIProviderError, streamTransformWithOpenAI } from "./providers/openai";
import {
  PROTECTED_CONTENT_MISMATCH_MESSAGE,
  decodePlaceholders,
  encodeProtectedSpans,
  validatePlaceholders,
} from "./protect/placeholders";
import {
  AppSettings,
  DEFAULT_APP_SETTINGS,
  readAppSettings,
  writeAppSettings,
} from "./settings/config";
import { endsWithNaturalTerminator } from "./utils/truncation";

type TransformMode = "Polish" | "Casual" | "Professional" | "Direct";
type WiredTransformMode = TransformMode;

const TRANSFORM_MODES: TransformMode[] = [
  "Polish",
  "Casual",
  "Professional",
  "Direct",
];

const FOOTER_HINT = "Transforms apply to the current editor text.";
const TRUNCATION_WARNING_MESSAGE = "Output may be truncated.";
const MISSING_API_KEY_MESSAGE = "Set API key in Settings.";

type TransformOptions = {
  sourceText?: string;
  maxOutputTokens?: number;
  undoCheckpointText?: string;
};

type RetryContext = {
  mode: WiredTransformMode;
  sourceText: string;
  nextMaxOutputTokens: number;
};

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

function App() {
  const [text, setText] = useState("");
  const [lastMode, setLastMode] = useState<TransformMode | null>(null);
  const [copyFeedback, setCopyFeedback] = useState("");
  const [statusMessage, setStatusMessage] = useState(FOOTER_HINT);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [warning, setWarning] = useState("None");
  const [isStreaming, setIsStreaming] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [activeStreamMode, setActiveStreamMode] = useState<WiredTransformMode | null>(null);
  const [retryContext, setRetryContext] = useState<RetryContext | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [settingsDraft, setSettingsDraft] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState("");

  const abortControllerRef = useRef<AbortController | null>(null);
  const undoCheckpointRef = useRef<string | null>(null);

  const wordCount = useMemo(() => countWords(text), [text]);
  const charCount = text.length;
  const apiKeyMissing = settings.openaiApiKey.trim().length === 0;
  const transformsDisabled = isStreaming || !isSettingsLoaded || apiKeyMissing;

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
        setStatusMessage(loaded.openaiApiKey ? FOOTER_HINT : MISSING_API_KEY_MESSAGE);
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

  const handleTransform = async (
    mode: WiredTransformMode,
    options: TransformOptions = {},
  ): Promise<void> => {
    if (isStreaming) {
      return;
    }

    const sourceText = options.sourceText ?? text;
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
    const controller = new AbortController();
    const encoded = shouldProtect
      ? encodeProtectedSpans(sourceText)
      : { encodedText: sourceText, mapping: [] };
    const { encodedText, mapping } = encoded;
    abortControllerRef.current = controller;
    undoCheckpointRef.current = options.undoCheckpointText ?? sourceText;
    setCanUndo(false);

    setIsStreaming(true);
    setActiveStreamMode(mode);
    setRetryContext(null);
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
        maxOutputTokens: options.maxOutputTokens,
        signal: controller.signal,
        onDelta: (delta) => {
          streamedOutput += delta;
          setText(streamedOutput);
        },
      });

      const finalOutput = result.outputText;
      const decodedText = shouldProtect ? decodePlaceholders(finalOutput, mapping) : finalOutput;
      if (shouldProtect) {
        const validation = validatePlaceholders(decodedText, mapping);
        if (!validation.ok) {
          throw new OpenAIProviderError("unknown", validation.error);
        }
      }

      setText(decodedText);
      const elapsed = Math.round(performance.now() - startedAt);
      setLatencyMs(elapsed);
      setCanUndo(true);

      const providerSignalledTruncation = result.truncatedByProvider;
      const missingNaturalTerminator = !endsWithNaturalTerminator(decodedText);
      if (providerSignalledTruncation || missingNaturalTerminator) {
        const retrySourceText = undoCheckpointRef.current ?? sourceText;
        const nextMaxOutputTokens = Math.min(
          8192,
          Math.max(result.maxOutputTokens + 1, Math.round(result.maxOutputTokens * 1.5)),
        );
        setWarning(TRUNCATION_WARNING_MESSAGE);
        setStatusMessage(`${mode} complete in ${elapsed} ms. ${TRUNCATION_WARNING_MESSAGE}`);
        if (nextMaxOutputTokens > result.maxOutputTokens) {
          setRetryContext({
            mode,
            sourceText: retrySourceText,
            nextMaxOutputTokens,
          });
        } else {
          setRetryContext(null);
        }
      } else {
        setWarning("None");
        setStatusMessage(`${mode} complete in ${elapsed} ms.`);
      }
    } catch (error) {
      setText(undoCheckpointRef.current ?? sourceText);
      undoCheckpointRef.current = null;
      setCanUndo(false);
      setLatencyMs(null);
      setCopyFeedback("");
      setRetryContext(null);

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

  const handleUndo = (): void => {
    if (isStreaming || !canUndo || undoCheckpointRef.current === null) {
      return;
    }

    setText(undoCheckpointRef.current);
    undoCheckpointRef.current = null;
    setCanUndo(false);
    setLatencyMs(null);
    setWarning("None");
    setRetryContext(null);
    setCopyFeedback("");
    setStatusMessage("Undo restored pre-transform text.");
  };

  const handleRetryMoreRoom = (): void => {
    if (isStreaming || retryContext === null) {
      return;
    }

    void handleTransform(retryContext.mode, {
      sourceText: retryContext.sourceText,
      maxOutputTokens: retryContext.nextMaxOutputTokens,
      undoCheckpointText: text,
    });
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
        <div className="mode-group">
          {TRANSFORM_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              className="mode-button"
              disabled={transformsDisabled}
              onClick={() => handleTransformClick(mode)}
            >
              {mode === activeStreamMode && isStreaming ? `${mode} (Streaming...)` : mode}
            </button>
          ))}
        </div>
        <div className="action-group">
          <button
            type="button"
            className="cancel-button"
            onClick={handleCancel}
            disabled={!isStreaming}
          >
            Cancel
          </button>
          <button
            type="button"
            className="undo-button"
            onClick={handleUndo}
            disabled={isStreaming || !canUndo}
          >
            Undo
          </button>
          <button
            type="button"
            className="copy-button"
            onClick={handleCopy}
            disabled={text.length === 0 || isStreaming}
          >
            Copy
          </button>
          <button
            type="button"
            className="settings-button"
            onClick={() => setIsSettingsOpen((open) => !open)}
          >
            {isSettingsOpen ? "Hide Settings" : "Settings"}
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

            <div className="settings-actions">
              <button type="submit" className="save-settings-button" disabled={isSavingSettings}>
                {isSavingSettings ? "Saving..." : "Save Settings"}
              </button>
              <span className="settings-message">{settingsMessage}</span>
            </div>
          </form>
        </section>
      ) : null}

      <section className="editor-panel">
        <label className="sr-only" htmlFor="editor">
          Text editor
        </label>
        <textarea
          id="editor"
          className="editor"
          value={text}
          onChange={(event) => setText(event.currentTarget.value)}
          placeholder="Paste or write text here. Choose a mode, then copy after reviewing."
          spellCheck
          readOnly={isStreaming}
        />
      </section>

      <footer className="status-bar" aria-live="polite">
        <span>Words: {wordCount}</span>
        <span>Characters: {charCount}</span>
        <span>Last mode: {lastMode ?? "None"}</span>
        <span>Latency: {latencyMs === null ? "--" : `${latencyMs} ms`}</span>
        <span>Warnings: {warning}</span>
        {retryContext ? (
          <button
            type="button"
            className="retry-button"
            onClick={handleRetryMoreRoom}
            disabled={isStreaming}
          >
            Retry (more room)
          </button>
        ) : null}
        <span className="copy-feedback">{copyFeedback}</span>
      </footer>
      <p className="footer-hint">{statusMessage}</p>
    </main>
  );
}

export default App;
