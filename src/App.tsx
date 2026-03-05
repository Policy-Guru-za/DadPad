import { useMemo, useRef, useState } from "react";
import "./App.css";
import { OpenAIProviderError, streamPolishWithOpenAI } from "./providers/openai";

type TransformMode = "Polish" | "Casual" | "Professional" | "Direct";

const TRANSFORM_MODES: TransformMode[] = [
  "Polish",
  "Casual",
  "Professional",
  "Direct",
];

const FOOTER_HINT = "Transforms apply to the current editor text.";

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
    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Polish failed. Original text restored.";
}

function App() {
  const [text, setText] = useState("");
  const [lastMode, setLastMode] = useState<TransformMode | null>(null);
  const [copyFeedback, setCopyFeedback] = useState("");
  const [statusMessage, setStatusMessage] = useState(FOOTER_HINT);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [warning, setWarning] = useState("None");
  const [isStreaming, setIsStreaming] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const undoSnapshotRef = useRef("");

  const wordCount = useMemo(() => countWords(text), [text]);
  const charCount = text.length;

  const handlePolishTransform = async (): Promise<void> => {
    if (isStreaming) {
      return;
    }

    const sourceText = text;
    if (!sourceText.trim()) {
      setStatusMessage("Add text before running Polish.");
      return;
    }

    const apiKey = (import.meta.env.VITE_OPENAI_API_KEY ?? "").trim();
    if (!apiKey) {
      setWarning("Missing API key");
      setStatusMessage("Set VITE_OPENAI_API_KEY in .env.local, then restart.");
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    undoSnapshotRef.current = sourceText;

    setIsStreaming(true);
    setCopyFeedback("");
    setLastMode("Polish");
    setLatencyMs(null);
    setWarning("None");
    setStatusMessage("Polish in progress...");
    setText("");

    const startedAt = performance.now();
    let streamedOutput = "";

    try {
      await streamPolishWithOpenAI({
        apiKey,
        inputText: sourceText,
        signal: controller.signal,
        onDelta: (delta) => {
          streamedOutput += delta;
          setText(streamedOutput);
        },
      });

      const elapsed = Math.round(performance.now() - startedAt);
      setLatencyMs(elapsed);
      setStatusMessage(`Polish complete in ${elapsed} ms.`);
    } catch (error) {
      setText(undoSnapshotRef.current);

      if (controller.signal.aborted) {
        setWarning("None");
        setStatusMessage("Polish cancelled. Original text restored.");
      } else {
        const friendlyMessage = mapProviderError(error);
        setWarning(friendlyMessage);
        setStatusMessage(friendlyMessage);
      }
    } finally {
      abortControllerRef.current = null;
      setIsStreaming(false);
    }
  };

  const handleTransformClick = (mode: TransformMode): void => {
    if (mode === "Polish") {
      void handlePolishTransform();
      return;
    }

    setLastMode(mode);
    setStatusMessage(`"${mode}" is not wired yet. M2 includes Polish only.`);
  };

  const handleCancel = (): void => {
    abortControllerRef.current?.abort();
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
              disabled={isStreaming}
              onClick={() => handleTransformClick(mode)}
            >
              {mode === "Polish" && isStreaming ? "Polish (Streaming...)" : mode}
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
          className="copy-button"
          onClick={handleCopy}
          disabled={text.length === 0 || isStreaming}
        >
          Copy
        </button>
        </div>
      </header>

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
        <span className="copy-feedback">{copyFeedback}</span>
      </footer>
      <p className="footer-hint">{statusMessage}</p>
    </main>
  );
}

export default App;
