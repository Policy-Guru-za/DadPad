import { FormEvent, useEffect, useRef, useState } from "react";
import {
  OpenAIProviderError,
  streamTransformWithOpenAI,
} from "../providers/openai";
import {
  PROTECTED_CONTENT_MISMATCH_MESSAGE,
  decodePlaceholders,
  encodeProtectedSpans,
  validatePlaceholders,
} from "../protect/placeholders";
import { normalizeStructuredPlainText } from "../structuring/plainText";
import {
  AppSettings,
  DEFAULT_APP_SETTINGS,
  readAppSettings,
  writeAppSettings,
} from "../settings/config";
import { shareText, ShareUnavailableError } from "../utils/share";

type SettingsSaveStatus = "idle" | "saving" | "saved" | "error";
type StatusTone = "idle" | "success" | "error";

type StatusState = {
  message: string;
  tone: StatusTone;
};

const READY_MESSAGE = "Ready.";
const MISSING_API_KEY_MESSAGE = "Add your OpenAI API key to start.";

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

  return "Polish failed. Original text restored.";
}

export function useDadPadController() {
  const [text, setText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [canUndo, setCanUndo] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [settingsDraft, setSettingsDraft] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);
  const [settingsSaveStatus, setSettingsSaveStatus] = useState<SettingsSaveStatus>("idle");
  const [settingsMessage, setSettingsMessage] = useState("");
  const [status, setStatus] = useState<StatusState>({
    message: READY_MESSAGE,
    tone: "idle",
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const undoCheckpointRef = useRef<string | null>(null);

  const apiKeyMissing = settings.openaiApiKey.trim().length === 0;
  const polishDisabled =
    isStreaming || !isSettingsLoaded || apiKeyMissing || text.trim().length === 0;

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
        const needsSetup = loaded.openaiApiKey.trim().length === 0;
        setIsSettingsOpen(needsSetup);
        setStatus({
          message: needsSetup ? MISSING_API_KEY_MESSAGE : READY_MESSAGE,
          tone: needsSetup ? "error" : "idle",
        });
      } catch {
        if (cancelled) {
          return;
        }

        setIsSettingsOpen(true);
        setStatus({
          message: "Unable to load DadPad settings.",
          tone: "error",
        });
        setSettingsMessage("Unable to load settings.");
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

  const handleTextChange = (nextText: string): void => {
    setText(nextText);
  };

  const handleTransform = async (): Promise<void> => {
    if (isStreaming) {
      return;
    }

    const sourceText = text;
    if (!sourceText.trim()) {
      setStatus({ message: "Add text before polishing.", tone: "error" });
      return;
    }

    const apiKey = settings.openaiApiKey.trim();
    if (!apiKey) {
      setIsSettingsOpen(true);
      setStatus({ message: MISSING_API_KEY_MESSAGE, tone: "error" });
      return;
    }

    const shouldProtect = settings.tokenProtection;
    const encoded = shouldProtect
      ? encodeProtectedSpans(sourceText)
      : { encodedText: sourceText, mapping: [] };
    const controller = new AbortController();
    let streamedOutput = "";

    abortControllerRef.current = controller;
    undoCheckpointRef.current = sourceText;
    setCanUndo(false);
    setIsStreaming(true);
    setText("");
    setStatus({ message: "Polishing…", tone: "idle" });

    try {
      const result = await streamTransformWithOpenAI({
        apiKey,
        inputText: encoded.encodedText,
        mode: "polish",
        model: settings.model,
        temperature: settings.temperature,
        streaming: settings.streaming,
        smartStructuring: settings.smartStructuring,
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

      const normalizedOutput = settings.smartStructuring
        ? normalizeStructuredPlainText(result.outputText)
        : result.outputText;
      const decodedText = shouldProtect
        ? decodePlaceholders(normalizedOutput, encoded.mapping)
        : normalizedOutput;

      if (shouldProtect) {
        const validation = validatePlaceholders(decodedText, encoded.mapping);
        if (!validation.ok) {
          throw new OpenAIProviderError("unknown", validation.error);
        }
      }

      setText(decodedText);
      setCanUndo(true);
      setStatus({ message: "Polished.", tone: "success" });
    } catch (error) {
      setText(undoCheckpointRef.current ?? sourceText);
      undoCheckpointRef.current = null;
      setCanUndo(false);

      if (controller.signal.aborted) {
        setStatus({ message: "Cancelled. Original text restored.", tone: "idle" });
      } else {
        setStatus({ message: mapProviderError(error), tone: "error" });
      }
    } finally {
      abortControllerRef.current = null;
      setIsStreaming(false);
    }
  };

  const handleCancel = (): void => {
    if (!isStreaming) {
      return;
    }

    setStatus({ message: "Cancelling…", tone: "idle" });
    abortControllerRef.current?.abort();
  };

  const handleUndo = (): void => {
    if (isStreaming || !canUndo || undoCheckpointRef.current === null) {
      return;
    }

    setText(undoCheckpointRef.current);
    undoCheckpointRef.current = null;
    setCanUndo(false);
    setStatus({ message: "Undo restored the original text.", tone: "success" });
  };

  const handleClear = (): void => {
    if (isStreaming || text.length === 0) {
      return;
    }

    if (!window.confirm("Clear all text and start over?")) {
      setStatus({ message: "Clear cancelled.", tone: "idle" });
      return;
    }

    setText("");
    undoCheckpointRef.current = null;
    setCanUndo(false);
    setStatus({ message: "Cleared.", tone: "success" });
  };

  const handleCopy = async (): Promise<void> => {
    try {
      await writeClipboard(text);
      setStatus({ message: "Copied.", tone: "success" });
    } catch {
      setStatus({
        message: "Clipboard write failed. Check app clipboard permissions.",
        tone: "error",
      });
    }
  };

  const handleShare = async (): Promise<void> => {
    try {
      await shareText(text);
      setStatus({ message: "Share sheet opened.", tone: "success" });
    } catch (error) {
      if (error instanceof ShareUnavailableError) {
        setStatus({ message: error.message, tone: "error" });
        return;
      }

      if (error instanceof DOMException && error.name === "AbortError") {
        setStatus({ message: "Share cancelled.", tone: "idle" });
        return;
      }

      setStatus({ message: "Sharing failed.", tone: "error" });
    }
  };

  const handleSettingsSave = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (settingsSaveStatus === "saving") {
      return;
    }

    setSettingsSaveStatus("saving");
    setSettingsMessage("");

    try {
      const saved = await writeAppSettings(settingsDraft);
      const hasKey = saved.openaiApiKey.trim().length > 0;
      setSettings(saved);
      setSettingsDraft(saved);
      setSettingsSaveStatus("saved");
      setIsSettingsOpen(!hasKey);
      setSettingsMessage(hasKey ? "Saved." : "OpenAI API key required.");
      setStatus({
        message: hasKey ? "DadPad is ready." : MISSING_API_KEY_MESSAGE,
        tone: hasKey ? "success" : "error",
      });
    } catch {
      setSettingsSaveStatus("error");
      setSettingsMessage("Unable to save settings.");
      setStatus({ message: "Unable to save settings.", tone: "error" });
    }
  };

  const updateOpenAiApiKey = (openaiApiKey: string): void => {
    setSettingsSaveStatus("idle");
    setSettingsMessage("");
    setSettingsDraft((current) => ({
      ...current,
      openaiApiKey,
    }));
  };

  return {
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
  };
}
