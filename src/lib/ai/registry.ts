import { anthropicAdapter } from "@/lib/ai/anthropic";
import { createOpenAiCompatibleAdapter } from "@/lib/ai/openai-compatible";
import { PROVIDER_INFO, type ProviderInfo } from "@/lib/ai/provider-meta";
import { type AIProviderAdapter, type AiProviderId } from "@/lib/ai/types";

export interface ProviderMeta extends ProviderInfo {
  adapter: AIProviderAdapter;
}

// To add a provider: describe it in provider-meta.ts, attach its adapter here, and add its uppercase
// id to the AiProvider enum in prisma/schema.prisma (a test fails if any of the three is missing).
// Anything that speaks the OpenAI chat-completions protocol can reuse createOpenAiCompatibleAdapter.
export const PROVIDERS: Record<AiProviderId, ProviderMeta> = {
  anthropic: { ...PROVIDER_INFO.anthropic, adapter: anthropicAdapter },
  openai: { ...PROVIDER_INFO.openai, adapter: createOpenAiCompatibleAdapter(PROVIDER_INFO.openai.defaultBaseUrl) },
  ollama: { ...PROVIDER_INFO.ollama, adapter: createOpenAiCompatibleAdapter(PROVIDER_INFO.ollama.defaultBaseUrl) },
  nim: { ...PROVIDER_INFO.nim, adapter: createOpenAiCompatibleAdapter(PROVIDER_INFO.nim.defaultBaseUrl) },
  custom: { ...PROVIDER_INFO.custom, adapter: createOpenAiCompatibleAdapter("") },
};

export const PROVIDER_LIST = Object.values(PROVIDERS);

export function getProviderMeta(id: AiProviderId): ProviderMeta {
  const meta = PROVIDERS[id];
  if (!meta) throw new Error(`Unknown AI provider: ${id}`);
  return meta;
}
