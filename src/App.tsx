import "./App.css";
import { useDadPadController } from "./dadpad/useDadPadController";

function App() {
  const {
    text,
    isStreaming,
    canUndo,
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
    handleCancel,
    handleUndo,
    handleClear,
    handleCopy,
    handleShare,
    handleSettingsSave,
    updateOpenAiApiKey,
  } = useDadPadController();

  const actionDisabled = text.length === 0 || isStreaming;

  return (
    <main className="app-shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">iPad-first writing help</p>
          <h1>DadPad</h1>
          <p className="hero-text">
            Paste rough text. Tap <span>Polish</span>. Read, copy, or share.
          </p>
        </div>
        <button
          type="button"
          className="setup-toggle"
          onClick={() => setIsSettingsOpen((open) => !open)}
        >
          {isSettingsOpen ? "Close setup" : "API key"}
        </button>
      </section>

      <section
        className={`status-strip ${status.tone}`}
        aria-live="polite"
      >
        <span className="status-label">Status</span>
        <span>{isSettingsLoaded ? status.message : "Loading DadPad…"}</span>
      </section>

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
          id="dadpad-editor"
          className="editor"
          value={text}
          onChange={(event) => handleTextChange(event.currentTarget.value)}
          placeholder="Paste or write text here."
          spellCheck
          readOnly={isStreaming}
        />
      </section>

      <section className="action-bar" aria-label="DadPad actions">
        <button
          type="button"
          className="primary-action"
          onClick={() => void handleTransform()}
          disabled={polishDisabled}
        >
          {isStreaming ? "Polishing…" : "Polish"}
        </button>
        <button
          type="button"
          className="secondary-action"
          onClick={handleCancel}
          disabled={!isStreaming}
        >
          Cancel
        </button>
        <button
          type="button"
          className="secondary-action"
          onClick={handleUndo}
          disabled={isStreaming || !canUndo}
        >
          Undo
        </button>
        <button
          type="button"
          className="secondary-action secondary-danger"
          onClick={handleClear}
          disabled={actionDisabled}
        >
          Clear
        </button>
        <button
          type="button"
          className="secondary-action"
          onClick={() => void handleCopy()}
          disabled={actionDisabled}
        >
          Copy
        </button>
        <button
          type="button"
          className="secondary-action"
          onClick={() => void handleShare()}
          disabled={actionDisabled}
        >
          Share
        </button>
      </section>
    </main>
  );
}

export default App;
