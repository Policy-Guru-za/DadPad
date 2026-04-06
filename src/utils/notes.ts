import { openUrl } from "@tauri-apps/plugin-opener";

export const DEFAULT_NOTES_SHORTCUT_NAME = "Add to Notes";

export class NotesShortcutUnavailableError extends Error {
  constructor(message = `Install the "${DEFAULT_NOTES_SHORTCUT_NAME}" shortcut to send text to Notes.`) {
    super(message);
    this.name = "NotesShortcutUnavailableError";
  }
}

export function buildNotesShortcutUrl(shortcutName = DEFAULT_NOTES_SHORTCUT_NAME): string {
  return `shortcuts://run-shortcut?name=${encodeURIComponent(shortcutName)}&input=clipboard`;
}

export async function openNotesShortcut(shortcutName = DEFAULT_NOTES_SHORTCUT_NAME): Promise<void> {
  try {
    await openUrl(buildNotesShortcutUrl(shortcutName));
  } catch {
    throw new NotesShortcutUnavailableError(
      `Install the "${shortcutName}" shortcut to send text to Notes.`,
    );
  }
}
