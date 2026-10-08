import { getProviderMeta } from "@/lib/ai/registry";
import { type AiProviderId, type ProviderCredentials } from "@/lib/ai/types";

/** For AI tools that just need one prompt in, one answer out - no tool-calling loop. */
export async function complete(
  providerId: AiProviderId,
  model: string,
  credentials: ProviderCredentials,
  system: string,
  userPrompt: string,
  maxTokens = 700
): Promise<string> {
  const { adapter } = getProviderMeta(providerId);
  const result = await adapter.chat(
    {
      messages: [{ role: "user", content: userPrompt }],
      system,
      model,
      maxTokens,
    },
    credentials
  );
  return result.content.trim();
}
