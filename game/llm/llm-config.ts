import debug from "debug";
import { z } from "zod";
import { clearSetting, loadSetting, saveSetting } from "../storage/local-store";
import type { LlmConfig, LlmConfigOverrides, LlmProvider } from "./llm-types";

const log = debug("ralph:llm-config");

const SETTINGS_KEY = "llm-config-overrides";

const DEFAULT_CONFIG: LlmConfig = {
  provider: "cerebras",
  baseUrl: "https://api.cerebras.ai/v1",
  model: "gpt-oss-120b",
  apiKeyEnv: "NEXT_PUBLIC_CEREBRAS_API_KEY",
  temperature: 0.7,
  maxCompletionTokens: 240,
};

const llmConfigSchema = z.object({
  provider: z.enum(["cerebras", "openai-compatible"]),
  baseUrl: z.string().min(1),
  model: z.string().min(1),
  apiKeyEnv: z.string().min(1),
  temperature: z.number().min(0).max(2),
  maxCompletionTokens: z.number().min(1).max(8192),
});

const llmConfigOverridesSchema = llmConfigSchema
  .partial()
  .extend({ apiKeyOverride: z.string().min(1).optional() });

export async function getResolvedLlmConfig() {
  const envOverrides = readEnvOverrides();
  const storedOverrides = await getLlmConfigOverrides();
  const mergedConfig = applyOverrides(
    applyOverrides(DEFAULT_CONFIG, envOverrides),
    storedOverrides
  );
  const parsed = llmConfigSchema.safeParse(mergedConfig);
  if (!parsed.success) {
    log("Invalid LLM config %o", parsed.error.format());
    throw new Error("Invalid LLM configuration");
  }

  const apiKey = resolveApiKey(parsed.data, storedOverrides);
  return { config: parsed.data, apiKey, overrides: storedOverrides };
}

export async function getLlmConfigOverrides(): Promise<LlmConfigOverrides> {
  const stored = await loadSetting<LlmConfigOverrides>(SETTINGS_KEY);
  if (!stored) return {};
  const parsed = llmConfigOverridesSchema.safeParse(stored);
  if (!parsed.success) {
    log("Invalid LLM override settings %o", parsed.error.format());
    return {};
  }
  return parsed.data;
}

export async function setLlmConfigOverrides(overrides: LlmConfigOverrides): Promise<void> {
  const sanitized = sanitizeOverrides(overrides);
  const parsed = llmConfigOverridesSchema.safeParse(sanitized);
  if (!parsed.success) {
    log("Invalid LLM override update %o", parsed.error.format());
    throw new Error("Invalid LLM override update");
  }

  await saveSetting(SETTINGS_KEY, parsed.data);
}

export async function clearLlmConfigOverrides(): Promise<void> {
  await clearSetting(SETTINGS_KEY);
}

function readEnvOverrides(): LlmConfigOverrides {
  const candidate: LlmConfigOverrides = {
    provider: parseProvider(readLlmEnvValue("NEXT_PUBLIC_LLM_PROVIDER")),
    baseUrl: readLlmEnvValue("NEXT_PUBLIC_LLM_BASE_URL"),
    model: readLlmEnvValue("NEXT_PUBLIC_LLM_MODEL"),
    apiKeyEnv: readLlmEnvValue("NEXT_PUBLIC_LLM_API_KEY_ENV"),
    temperature: parseNumber(readLlmEnvValue("NEXT_PUBLIC_LLM_TEMPERATURE")),
    maxCompletionTokens: parseNumber(readLlmEnvValue("NEXT_PUBLIC_LLM_MAX_TOKENS")),
  };

  const parsed = llmConfigOverridesSchema.safeParse(candidate);
  if (!parsed.success) {
    log("Invalid env overrides ignored %o", parsed.error.format());
    return {};
  }

  return parsed.data;
}

function resolveApiKey(config: LlmConfig, overrides: LlmConfigOverrides) {
  if (overrides.apiKeyOverride) return overrides.apiKeyOverride;
  const envValue = readLlmEnvValue(config.apiKeyEnv);
  if (envValue) return envValue;
  log("Missing API key (env=%s)", config.apiKeyEnv);
  throw new Error("Missing LLM API key");
}

function applyOverrides(config: LlmConfig, overrides: LlmConfigOverrides): LlmConfig {
  return {
    provider: overrides.provider ?? config.provider,
    baseUrl: overrides.baseUrl ?? config.baseUrl,
    model: overrides.model ?? config.model,
    apiKeyEnv: overrides.apiKeyEnv ?? config.apiKeyEnv,
    temperature: overrides.temperature ?? config.temperature,
    maxCompletionTokens: overrides.maxCompletionTokens ?? config.maxCompletionTokens,
  };
}

function sanitizeOverrides(overrides: LlmConfigOverrides): LlmConfigOverrides {
  const entries = Object.entries(overrides).filter(([, value]) => value !== undefined);
  return Object.fromEntries(entries) as LlmConfigOverrides;
}

function parseProvider(value?: string): LlmProvider | undefined {
  if (!value) return undefined;
  if (value === "cerebras" || value === "openai-compatible") return value;
  return undefined;
}

function parseNumber(value?: string) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function readLlmEnvValue(name: string) {
  if (!name) return undefined;
  switch (name) {
    case "NEXT_PUBLIC_LLM_PROVIDER":
      return process.env.NEXT_PUBLIC_LLM_PROVIDER;
    case "NEXT_PUBLIC_LLM_BASE_URL":
      return process.env.NEXT_PUBLIC_LLM_BASE_URL;
    case "NEXT_PUBLIC_LLM_MODEL":
      return process.env.NEXT_PUBLIC_LLM_MODEL;
    case "NEXT_PUBLIC_LLM_API_KEY_ENV":
      return process.env.NEXT_PUBLIC_LLM_API_KEY_ENV;
    case "NEXT_PUBLIC_LLM_TEMPERATURE":
      return process.env.NEXT_PUBLIC_LLM_TEMPERATURE;
    case "NEXT_PUBLIC_LLM_MAX_TOKENS":
      return process.env.NEXT_PUBLIC_LLM_MAX_TOKENS;
    case "NEXT_PUBLIC_CEREBRAS_API_KEY":
      return process.env.NEXT_PUBLIC_CEREBRAS_API_KEY;
    case "NEXT_PUBLIC_OPENAI_API_KEY":
      return process.env.NEXT_PUBLIC_OPENAI_API_KEY;
    default:
      return undefined;
  }
}
