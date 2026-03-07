export class ShareUnavailableError extends Error {
  constructor(message = "Sharing is not available on this device.") {
    super(message);
    this.name = "ShareUnavailableError";
  }
}

export async function shareText(text: string): Promise<void> {
  if (!navigator.share) {
    throw new ShareUnavailableError();
  }

  await navigator.share({ text });
}
