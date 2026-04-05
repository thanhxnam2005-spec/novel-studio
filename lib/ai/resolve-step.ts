import { getModel } from "@/lib/ai/provider";
import {
  isWebGpuInferenceProvider,
  isWebGpuInferenceProviderId,
} from "@/lib/ai/api-inference";
import { db, type StepModelConfig } from "@/lib/db";
import type { LanguageModel } from "ai";

/**
 * Resolve a StepModelConfig to a LanguageModel instance.
 * Returns undefined if config is missing, provider not found, or provider is WebGPU
 * (WebGPU is chat-only).
 */
export async function resolveStep(
  cfg: StepModelConfig | undefined,
): Promise<LanguageModel | undefined> {
  if (!cfg?.providerId || !cfg?.modelId) return undefined;
  if (isWebGpuInferenceProviderId(cfg.providerId)) return undefined;
  const provider = await db.aiProviders.get(cfg.providerId);
  if (!provider || isWebGpuInferenceProvider(provider)) return undefined;
  return await getModel(provider, cfg.modelId);
}
