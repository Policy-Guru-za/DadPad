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
import { validateEmailOutput } from "../providers/emailOutputValidation";
import {
  composeWithGmail,
  EmailComposeUnavailableError,
} from "../utils/email";
import {
  NotesShortcutUnavailableError,
  openNotesShortcut,
} from "../utils/notes";

type SettingsSaveStatus = "idle" | "saving" | "saved" | "error";
type StatusTone = "idle" | "success" | "error";
type PolishVariant = "notes" | "email";

type StatusState = {
  message: string;
  tone: StatusTone;
};

export type EditorResetMode = "dismissKeyboard" | "focusEditor";

export type EditorResetState = {
  version: number;
  mode: EditorResetMode;
};

const READY_MESSAGE = "Ready.";
const MISSING_API_KEY_MESSAGE = "Add your OpenAI API key to start.";

const TRANSFORM_CONFIG: Record<
  PolishVariant,
  {
    mode: "polish" | "email";
    emptyMessage: string;
    pendingMessage: string;
    successMessage: string;
    livePreview: boolean;
    forceSmartStructuring?: boolean;
    temperatureOverride?: number;
    validateOutput?: typeof validateEmailOutput;
  }
> = {
  notes: {
    mode: "polish",
    emptyMessage: "Add text before polishing.",
    pendingMessage: "Polishing…",
    successMessage: "Polished.",
    livePreview: true,
  },
  email: {
    mode: "email",
    emptyMessage: "Add text before polishing for email.",
    pendingMessage: "Polishing for email…",
    successMessage: "Polished for email.",
    livePreview: false,
    forceSmartStructuring: true,
    temperatureOverride: 0,
    validateOutput: validateEmailOutput,
  },
};

function getRestingStatus(openaiApiKey: string): StatusState {
  return openaiApiKey.trim().length > 0
    ? { message: READY_MESSAGE, tone: "idle" }
    : { message: MISSING_API_KEY_MESSAGE, tone: "error" };
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

  return "Rewrite failed. Original text restored.";
}

export function useDadPadController() {
  const [text, setText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeTransform, setActiveTransform] = useState<PolishVariant | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [editorReset, setEditorReset] = useState<EditorResetState>({
    version: 0,
    mode: "focusEditor",
  });
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
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
  const transformDisabled =
    isStreaming ||
    isConfirmingClear ||
    !isSettingsLoaded ||
    apiKeyMissing ||
    text.trim().length === 0;

  const applyStatus = (nextStatus: StatusState): void => {
    setStatus(nextStatus);
  };

  const resetToReadyState = (mode: EditorResetMode = "focusEditor"): void => {
    setText("");
    undoCheckpointRef.current = null;
    setCanUndo(false);
    setEditorReset((current) => ({
      version: current.version + 1,
      mode,
    }));
    setStatus(getRestingStatus(settings.openaiApiKey));
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
        const needsSetup = loaded.openaiApiKey.trim().length === 0;
        setIsSettingsOpen(needsSetup);
        applyStatus(getRestingStatus(loaded.openaiApiKey));
      } catch {
        if (cancelled) {
          return;
        }

        setIsSettingsOpen(true);
        applyStatus({
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
    if (isConfirmingClear) {
      return;
    }

    setText(nextText);
  };

  const handleTransform = async (variant: PolishVariant = "notes"): Promise<void> => {
    if (isStreaming || isConfirmingClear) {
      return;
    }

    const transformConfig = TRANSFORM_CONFIG[variant];
    const sourceText = text;
    if (!sourceText.trim()) {
      applyStatus({ message: transformConfig.emptyMessage, tone: "error" });
      return;
    }

    const apiKey = settings.openaiApiKey.trim();
    if (!apiKey) {
      setIsSettingsOpen(true);
      applyStatus({ message: MISSING_API_KEY_MESSAGE, tone: "error" });
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
    setActiveTransform(variant);
    setIsStreaming(true);
    if (transformConfig.livePreview) {
      setText("");
    }
    applyStatus({ message: transformConfig.pendingMessage, tone: "idle" });

    try {
      const result = await streamTransformWithOpenAI({
        apiKey,
        inputText: encoded.encodedText,
        mode: transformConfig.mode,
        model: settings.model,
        temperature: transformConfig.temperatureOverride ?? settings.temperature,
        streaming: settings.streaming,
        smartStructuring: transformConfig.forceSmartStructuring || settings.smartStructuring,
        signal: controller.signal,
        onRetrying: () => {
          streamedOutput = "";
          if (transformConfig.livePreview) {
            setText("");
          }
        },
        onDelta: (delta) => {
          streamedOutput += delta;
          if (transformConfig.livePreview) {
            setText(streamedOutput);
          }
        },
      });

      const normalizedOutput =
        transformConfig.forceSmartStructuring || settings.smartStructuring
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

      if (transformConfig.validateOutput) {
        const validation = transformConfig.validateOutput(sourceText, decodedText);
        if (!validation.ok) {
          throw new OpenAIProviderError("unknown", validation.error);
        }
      }

      setText(decodedText);
      setCanUndo(true);
      applyStatus({ message: transformConfig.successMessage, tone: "success" });
    } catch (error) {
      setText(undoCheckpointRef.current ?? sourceText);
      undoCheckpointRef.current = null;
      setCanUndo(false);

      if (controller.signal.aborted) {
        applyStatus({ message: "Cancelled. Original text restored.", tone: "idle" });
      } else {
        applyStatus({ message: mapProviderError(error), tone: "error" });
      }
    } finally {
      abortControllerRef.current = null;
      setIsStreaming(false);
      setActiveTransform(null);
    }
  };

  const handleCancel = (): void => {
    if (!isStreaming) {
      return;
    }

    applyStatus({ message: "Cancelling…", tone: "idle" });
    abortControllerRef.current?.abort();
  };

  const handleUndo = (): void => {
    if (isStreaming || isConfirmingClear || !canUndo || undoCheckpointRef.current === null) {
      return;
    }

    setText(undoCheckpointRef.current);
    undoCheckpointRef.current = null;
    setCanUndo(false);
    applyStatus({ message: "Undo restored the original text.", tone: "success" });
  };

  const handleClear = (): void => {
    if (isStreaming || isConfirmingClear || text.length === 0) {
      return;
    }

    setIsConfirmingClear(true);
  };

  const handleClearCancel = (): void => {
    if (!isConfirmingClear) {
      return;
    }

    setIsConfirmingClear(false);
  };

  const handleClearConfirm = (): void => {
    if (!isConfirmingClear) {
      return;
    }

    setIsConfirmingClear(false);
    resetToReadyState("dismissKeyboard");
  };

  const handleNotes = async (): Promise<void> => {
    if (isConfirmingClear) {
      return;
    }

    try {
      await writeClipboard(text);
      await openNotesShortcut();
      applyStatus({ message: "Copied text and opened Notes shortcut.", tone: "success" });
    } catch (error) {
      if (error instanceof NotesShortcutUnavailableError) {
        applyStatus({ message: error.message, tone: "error" });
        return;
      }

      applyStatus({
        message: "Clipboard write failed. Check app clipboard permissions.",
        tone: "error",
      });
    }
  };

  const handleGmail = async (): Promise<void> => {
    if (isConfirmingClear) {
      return;
    }

    try {
      const method = await composeWithGmail(text);
      applyStatus({
        message: method === "gmail" ? "Gmail compose opened." : "Email compose opened.",
        tone: "success",
      });
    } catch (error) {
      if (error instanceof EmailComposeUnavailableError) {
        applyStatus({ message: error.message, tone: "error" });
        return;
      }

      applyStatus({ message: "Email compose failed.", tone: "error" });
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
      applyStatus({
        message: hasKey ? "DadPad is ready." : MISSING_API_KEY_MESSAGE,
        tone: hasKey ? "success" : "error",
      });
    } catch {
      setSettingsSaveStatus("error");
      setSettingsMessage("Unable to save settings.");
      applyStatus({ message: "Unable to save settings.", tone: "error" });
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
    activeTransform,
    canUndo,
    editorReset,
    isConfirmingClear,
    isSettingsOpen,
    isSettingsLoaded,
    apiKeyMissing,
    transformDisabled,
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
    handleClearCancel,
    handleClearConfirm,
    handleNotes,
    handleGmail,
    handleSettingsSave,
    updateOpenAiApiKey,
  };
}
