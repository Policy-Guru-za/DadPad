import { invoke } from "@tauri-apps/api/core";

export const DEFAULT_APP_SETTINGS = {
  openaiApiKey: "",
  model: "gpt-5-nano-2025-08-07",
  temperature: 0.2,
  streaming: true,
  tokenProtection: true,
  smartStructuring: true,
} as const;

export type AppSettings = {
  openaiApiKey: string;
  model: string;
  temperature: number;
  streaming: boolean;
  tokenProtection: boolean;
  smartStructuring: boolean;
};

function normalizeSettings(input: Partial<AppSettings> | null | undefined): AppSettings {
  const base = { ...DEFAULT_APP_SETTINGS };

  const modelCandidate = typeof input?.model === "string" ? input.model.trim() : "";
  const temperatureCandidate = Number(input?.temperature);

  return {
    openaiApiKey: typeof input?.openaiApiKey === "string" ? input.openaiApiKey.trim() : "",
    model: modelCandidate || base.model,
    temperature: Number.isFinite(temperatureCandidate)
      ? Math.min(2, Math.max(0, temperatureCandidate))
      : base.temperature,
    streaming: typeof input?.streaming === "boolean" ? input.streaming : base.streaming,
    tokenProtection:
      typeof input?.tokenProtection === "boolean" ? input.tokenProtection : base.tokenProtection,
    smartStructuring:
      typeof input?.smartStructuring === "boolean"
        ? input.smartStructuring
        : base.smartStructuring,
  };
}

export async function readAppSettings(): Promise<AppSettings> {
  const settings = await invoke<AppSettings>("read_config");
  return normalizeSettings(settings);
}

export async function writeAppSettings(settings: AppSettings): Promise<AppSettings> {
  const normalized = normalizeSettings(settings);
  await invoke("write_config", { config: normalized });
  return normalized;
}
