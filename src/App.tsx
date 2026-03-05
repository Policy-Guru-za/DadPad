import { useMemo, useState } from "react";
import "./App.css";

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

function App() {
  const [text, setText] = useState("");
  const [lastMode, setLastMode] = useState<TransformMode | null>(null);
  const [copyFeedback, setCopyFeedback] = useState("");
  const [statusMessage, setStatusMessage] = useState(FOOTER_HINT);

  const wordCount = useMemo(() => countWords(text), [text]);
  const charCount = text.length;

  const handleTransformClick = (mode: TransformMode): void => {
    setLastMode(mode);
    setStatusMessage(`"${mode}" selected. Transform pipeline starts in M2.`);
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
              onClick={() => handleTransformClick(mode)}
            >
              {mode}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="copy-button"
          onClick={handleCopy}
          disabled={text.length === 0}
        >
          Copy
        </button>
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
        />
      </section>

      <footer className="status-bar" aria-live="polite">
        <span>Words: {wordCount}</span>
        <span>Characters: {charCount}</span>
        <span>Last mode: {lastMode ?? "None"}</span>
        <span>Latency: --</span>
        <span>Warnings: None</span>
        <span className="copy-feedback">{copyFeedback}</span>
      </footer>
      <p className="footer-hint">{statusMessage}</p>
    </main>
  );
}

export default App;
