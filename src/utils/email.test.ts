import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildGmailComposeUrl,
  buildMailtoComposeUrl,
  composeWithGmail,
  EmailComposeUnavailableError,
} from "./email";

const hoisted = vi.hoisted(() => ({
  openUrlMock: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: hoisted.openUrlMock,
}));

describe("email compose helpers", () => {
  afterEach(() => {
    hoisted.openUrlMock.mockReset();
  });

  it("encodes paragraph breaks for Gmail compose", () => {
    expect(buildGmailComposeUrl("First line\n\nSecond line")).toContain(
      "body=First%20line%0D%0A%0D%0ASecond%20line",
    );
  });

  it("encodes paragraph breaks for mailto compose", () => {
    expect(buildMailtoComposeUrl("First line\nSecond line")).toBe(
      "mailto:?body=First%20line%0D%0ASecond%20line",
    );
  });

  it("opens Gmail compose first", async () => {
    hoisted.openUrlMock.mockResolvedValueOnce(undefined);

    const result = await composeWithGmail("hello");

    expect(result).toBe("gmail");
    expect(hoisted.openUrlMock).toHaveBeenCalledTimes(1);
    expect(String(hoisted.openUrlMock.mock.calls[0]?.[0])).toContain("googlegmail:///co?");
  });

  it("falls back to mailto when Gmail compose fails", async () => {
    hoisted.openUrlMock
      .mockRejectedValueOnce(new Error("gmail missing"))
      .mockResolvedValueOnce(undefined);

    const result = await composeWithGmail("hello");

    expect(result).toBe("mailto");
    expect(hoisted.openUrlMock).toHaveBeenCalledTimes(2);
    expect(String(hoisted.openUrlMock.mock.calls[1]?.[0])).toBe("mailto:?body=hello");
  });

  it("throws a clear error when neither Gmail nor mailto can open", async () => {
    hoisted.openUrlMock.mockRejectedValue(new Error("nope"));

    await expect(composeWithGmail("hello")).rejects.toBeInstanceOf(
      EmailComposeUnavailableError,
    );
    expect(hoisted.openUrlMock).toHaveBeenCalledTimes(2);
  });
});
