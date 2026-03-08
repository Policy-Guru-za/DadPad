import { useEffect, useRef } from "react";
import "./App.css";
import dadPadLogo from "./assets/dadpad-logo.png";
import { useDadPadController } from "./dadpad/useDadPadController";
import { useViewportShell } from "./dadpad/useViewportShell";

type EditorSnapshot = {
  selectionStart: number;
  selectionEnd: number;
  scrollTop: number;
  scrollLeft: number;
  resetVersion: number;
};

function scrollWindowToTop(): void {
  if (typeof window.scrollTo !== "function") {
    return;
  }

  try {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    return;
  } catch {
    // Older WebViews may only support the numeric signature.
  }

  try {
    window.scrollTo(0, 0);
  } catch {
    // Ignore non-browser test environments that do not implement scrollTo.
  }
}

function App() {
  const {
    text,
    isStreaming,
    editorReset,
    isConfirmingClear,
    isSettingsOpen,
    isSettingsLoaded,
    apiKeyMissing,
    polishDisabled,
    settingsDraft,
    settingsSaveStatus,
    settingsMessage,
    status,
    setIsSettingsOpen,
    handleTextChange,
    handleTransform,
    handleClear,
    handleClearCancel,
    handleClearConfirm,
    handleCopy,
    handleShare,
    handleSettingsSave,
    updateOpenAiApiKey,
  } = useDadPadController();
  const { isKeyboardOpen, shellStyle } = useViewportShell();
  const appMainRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const keepTextButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousIsConfirmingClearRef = useRef(false);
  const editorSnapshotRef = useRef<EditorSnapshot | null>(null);

  const actionDisabled = text.length === 0 || isStreaming || isConfirmingClear;
  const visibleStatusMessage = isSettingsLoaded ? status.message : "Loading DadPad…";
  const visibleStatusTone = isSettingsLoaded ? status.tone : "idle";
  const settingsButtonLabel = isSettingsOpen ? "Close settings" : "Settings";
  const readinessChipTone = visibleStatusTone === "error" ? "error" : "ready";
  const readinessChipText = visibleStatusTone === "error" ? visibleStatusMessage : "Ready";
  const readinessChipDotClass =
    readinessChipTone === "ready" ? "status-chip-dot ready-dot" : "status-chip-dot error-dot";

  useEffect(() => {
    if (editorReset.version === 0) {
      return;
    }

    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const normalizeShellPosition = () => {
      const appMain = appMainRef.current;
      if (appMain) {
        appMain.scrollTop = 0;
        appMain.scrollLeft = 0;
      }

      scrollWindowToTop();
    };

    editor.scrollTop = 0;
    editor.scrollLeft = 0;
    editor.setSelectionRange(0, 0);

    if (editorReset.mode === "focusEditor") {
      editor.focus();
      return;
    }

    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement) {
      activeElement.blur();
    }

    normalizeShellPosition();

    const frameId = window.requestAnimationFrame(() => {
      normalizeShellPosition();
    });
    const viewport = window.visualViewport;
    const handleViewportResize = () => {
      normalizeShellPosition();
      viewport?.removeEventListener("resize", handleViewportResize);
    };

    viewport?.addEventListener("resize", handleViewportResize);

    return () => {
      window.cancelAnimationFrame(frameId);
      viewport?.removeEventListener("resize", handleViewportResize);
    };
  }, [editorReset]);

  useEffect(() => {
    if (isConfirmingClear) {
      const editor = editorRef.current;

      if (editor) {
        editorSnapshotRef.current = {
          selectionStart: editor.selectionStart,
          selectionEnd: editor.selectionEnd,
          scrollTop: editor.scrollTop,
          scrollLeft: editor.scrollLeft,
          resetVersion: editorReset.version,
        };
      }

      keepTextButtonRef.current?.focus();
      previousIsConfirmingClearRef.current = true;
      return;
    }

    if (!previousIsConfirmingClearRef.current) {
      return;
    }

    previousIsConfirmingClearRef.current = false;

    const snapshot = editorSnapshotRef.current;
    editorSnapshotRef.current = null;

    if (!snapshot || snapshot.resetVersion !== editorReset.version) {
      return;
    }

    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    editor.focus();
    editor.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd);
    editor.scrollTop = snapshot.scrollTop;
    editor.scrollLeft = snapshot.scrollLeft;
  }, [editorReset.version, isConfirmingClear]);

  return (
    <main
      className={`app-shell${isKeyboardOpen ? " keyboard-open" : ""}${
        isConfirmingClear ? " clear-sheet-open" : ""
      }`}
      data-theme="warm-sand"
      style={shellStyle}
      aria-busy={isStreaming}
    >
      <section className="hero">
        <div className="hero-header">
          <div className="hero-copy">
            <h1 className="hero-logo-heading">
              <span className="sr-only">DadPad</span>
              <img
                className="hero-logo"
                src={dadPadLogo}
                alt=""
                aria-hidden="true"
                draggable="false"
              />
            </h1>
          </div>
          <div
            className={`status-chip ${readinessChipTone}`}
            data-tone={readinessChipTone}
            title={readinessChipText}
          >
            <span className={readinessChipDotClass} aria-hidden="true" />
            <span className="status-chip-text">{readinessChipText}</span>
          </div>
        </div>
        <p className="hero-text">
          <em>The ultimate helper to ensure that RCML is finally understood in written form.</em>
        </p>
      </section>

      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {`Status update: ${visibleStatusMessage}`}
      </div>

      <div ref={appMainRef} className="app-main">
        {isSettingsOpen ? (
          <section className="setup-card" aria-label="DadPad setup">
            <div className="setup-copy">
              <h2>Set up DadPad</h2>
              <p>Enter your OpenAI API key once. DadPad stores it locally in encrypted app storage.</p>
            </div>
            <form className="setup-form" onSubmit={handleSettingsSave}>
              <label className="setup-label" htmlFor="openai-api-key">
                OpenAI API key
              </label>
              <input
                id="openai-api-key"
                className="setup-input"
                type="password"
                value={settingsDraft.openaiApiKey}
                onChange={(event) => updateOpenAiApiKey(event.currentTarget.value)}
                placeholder="sk-..."
                autoComplete="off"
              />
              <div className="setup-actions">
                <button
                  type="submit"
                  className="setup-save"
                  disabled={settingsSaveStatus === "saving"}
                >
                  {settingsSaveStatus === "saving" ? "Saving…" : "Save key"}
                </button>
                {settingsMessage ? <span className="setup-message">{settingsMessage}</span> : null}
              </div>
            </form>
          </section>
        ) : null}

        {apiKeyMissing ? (
          <section className="setup-warning" aria-label="API key required">
            DadPad needs an OpenAI API key before you can polish text.
          </section>
        ) : null}

        <section className="editor-panel">
          <label className="editor-label" htmlFor="dadpad-editor">
            Your text
          </label>
          <textarea
            key={editorReset.version}
            ref={editorRef}
            id="dadpad-editor"
            className="editor"
            value={text}
            onChange={(event) => handleTextChange(event.currentTarget.value)}
            placeholder="Paste or write text here."
            spellCheck
            readOnly={isStreaming}
          />
        </section>
      </div>

      <section className="action-dock">
        <section className="action-bar" aria-label="DadPad actions">
          <button
            type="button"
            className="primary-action action-polish"
            onClick={() => void handleTransform()}
            disabled={polishDisabled}
          >
            {isStreaming ? "Polishing…" : "Polish"}
          </button>
          <button
            type="button"
            className="secondary-action action-clear"
            onClick={handleClear}
            disabled={actionDisabled}
          >
            Clear
          </button>
          <button
            type="button"
            className="secondary-action action-copy"
            onClick={() => void handleCopy()}
            disabled={actionDisabled}
          >
            Copy
          </button>
          <button
            type="button"
            className="secondary-action action-share"
            onClick={() => void handleShare()}
            disabled={actionDisabled}
          >
            Share
          </button>
          <div className="action-spacer" aria-hidden="true" />
          <button
            type="button"
            className="system-action action-settings"
            onClick={() => setIsSettingsOpen((open) => !open)}
            disabled={isConfirmingClear}
            aria-pressed={isSettingsOpen}
          >
            {settingsButtonLabel}
          </button>
        </section>
      </section>

      {isConfirmingClear ? (
        <div className="confirm-sheet-layer" role="presentation">
          <div className="confirm-sheet-backdrop" aria-hidden="true" />
          <section
            className="confirm-sheet"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="clear-sheet-title"
            aria-describedby="clear-sheet-description"
          >
            <span className="confirm-sheet-grip" aria-hidden="true" />
            <div className="confirm-copy">
              <h2 id="clear-sheet-title">Clear all text?</h2>
              <p id="clear-sheet-description">
                This resets DadPad to a clean ready state and removes the current draft.
              </p>
            </div>
            <div className="confirm-actions">
              <button
                ref={keepTextButtonRef}
                type="button"
                className="secondary-action"
                onClick={handleClearCancel}
              >
                Keep text
              </button>
              <button
                type="button"
                className="secondary-action secondary-danger confirm-clear"
                onClick={handleClearConfirm}
              >
                Clear now
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

export default App;
