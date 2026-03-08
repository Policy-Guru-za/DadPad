import { openUrl } from "@tauri-apps/plugin-opener";

export type EmailComposeMethod = "gmail" | "mailto";

export class EmailComposeUnavailableError extends Error {
  constructor(message = "Email compose is not available on this device.") {
    super(message);
    this.name = "EmailComposeUnavailableError";
  }
}

function normalizeEmailBody(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n/g, "\r\n");
}

export function buildGmailComposeUrl(text: string): string {
  const body = encodeURIComponent(normalizeEmailBody(text));
  return `googlegmail:///co?subject=&body=${body}`;
}

export function buildMailtoComposeUrl(text: string): string {
  const body = encodeURIComponent(normalizeEmailBody(text));
  return `mailto:?body=${body}`;
}

export async function composeWithGmail(text: string): Promise<EmailComposeMethod> {
  try {
    await openUrl(buildGmailComposeUrl(text));
    return "gmail";
  } catch {
    try {
      await openUrl(buildMailtoComposeUrl(text));
      return "mailto";
    } catch {
      throw new EmailComposeUnavailableError();
    }
  }
}
