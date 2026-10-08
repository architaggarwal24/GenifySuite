import { type AiProviderId } from "@/lib/ai/types";

// Everything about a provider that is safe to ship to the browser: labels, defaults, hints. No network
// code lives here, so the settings page can import it directly. The server-only adapters are attached
// to this in registry.ts - that way there is ONE list of providers to edit, not two that must agree.
export interface ProviderInfo {
  id: AiProviderId;
  label: string;
  /** Empty string means there's no sensible default - the user must supply one (e.g. Custom). */
  defaultBaseUrl: string;
  /** Whether the base URL field is shown/editable (local, proxied and custom endpoints need it). */
  baseUrlConfigurable: boolean;
  keyRequired: boolean;
  defaultModel: string;
  modelHint: string;
  helpUrl: string;
}

export const PROVIDER_INFO: Record<AiProviderId, ProviderInfo> = {
  anthropic: {
    id: "anthropic",
    label: "Anthropic",
    defaultBaseUrl: "https://api.anthropic.com",
    // Configurable (not just the default) because enterprise Anthropic proxies/gateways that
    // speak the same Messages API at a different host are a real setup some people have.
    baseUrlConfigurable: true,
    keyRequired: true,
    defaultModel: "claude-sonnet-4-5",
    modelHint: "e.g. claude-sonnet-4-5, claude-haiku-4-5",
    helpUrl: "https://console.anthropic.com/settings/keys",
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    defaultBaseUrl: "https://api.openai.com/v1",
    baseUrlConfigurable: true,
    keyRequired: true,
    defaultModel: "gpt-4o-mini",
    modelHint: "e.g. gpt-4o-mini, gpt-4o",
    helpUrl: "https://platform.openai.com/api-keys",
  },
  ollama: {
    id: "ollama",
    label: "Ollama (local / self-hosted)",
    defaultBaseUrl: "http://localhost:11434/v1",
    baseUrlConfigurable: true,
    keyRequired: false,
    defaultModel: "llama3.1",
    modelHint: "e.g. llama3.1, qwen2.5-coder",
    helpUrl: "https://github.com/ollama/ollama",
  },
  nim: {
    id: "nim",
    label: "NVIDIA NIM",
    defaultBaseUrl: "https://integrate.api.nvidia.com/v1",
    baseUrlConfigurable: true,
    keyRequired: true,
    defaultModel: "meta/llama-3.1-8b-instruct",
    modelHint: "e.g. meta/llama-3.1-8b-instruct",
    helpUrl: "https://build.nvidia.com",
  },
  custom: {
    id: "custom",
    label: "Custom (OpenAI-compatible)",
    defaultBaseUrl: "",
    baseUrlConfigurable: true,
    keyRequired: false,
    defaultModel: "",
    modelHint: "Whatever model name your endpoint expects",
    helpUrl: "",
  },
};

export const PROVIDER_INFO_LIST: ProviderInfo[] = Object.values(PROVIDER_INFO);
