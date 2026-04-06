import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildNotesShortcutUrl,
  DEFAULT_NOTES_SHORTCUT_NAME,
  NotesShortcutUnavailableError,
  openNotesShortcut,
} from "./notes";

const hoisted = vi.hoisted(() => ({
  openUrlMock: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: hoisted.openUrlMock,
}));

describe("notes shortcut helpers", () => {
  afterEach(() => {
    hoisted.openUrlMock.mockReset();
  });

  it("builds the default Notes shortcut URL using clipboard input", () => {
    expect(buildNotesShortcutUrl()).toBe(
      `shortcuts://run-shortcut?name=${encodeURIComponent(DEFAULT_NOTES_SHORTCUT_NAME)}&input=clipboard`,
    );
  });

  it("encodes custom shortcut names", () => {
    expect(buildNotesShortcutUrl("DadPad New Note")).toBe(
      "shortcuts://run-shortcut?name=DadPad%20New%20Note&input=clipboard",
    );
  });

  it("opens the Notes shortcut URL", async () => {
    hoisted.openUrlMock.mockResolvedValueOnce(undefined);

    await openNotesShortcut();

    expect(hoisted.openUrlMock).toHaveBeenCalledTimes(1);
    expect(String(hoisted.openUrlMock.mock.calls[0]?.[0])).toBe(
      `shortcuts://run-shortcut?name=${encodeURIComponent(DEFAULT_NOTES_SHORTCUT_NAME)}&input=clipboard`,
    );
  });

  it("throws a clear error when the Notes shortcut handoff cannot open", async () => {
    hoisted.openUrlMock.mockRejectedValueOnce(new Error("missing shortcuts"));

    await expect(openNotesShortcut()).rejects.toBeInstanceOf(NotesShortcutUnavailableError);
  });
});
