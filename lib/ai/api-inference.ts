import type { AIProvider } from "@/lib/db";

/** System WebGPU entry (matches `WEBGPU_SYSTEM_PROVIDER` in use-ai-providers). */
export const WEBGPU_SYSTEM_PROVIDER_ID = "webgpu-system";

export const WEBGPU_BLOCKED_FOR_API_INFERENCE_VI =
  "WebGPU chỉ dùng cho chat. Phân tích, công cụ chương và auto viết cần nhà cung cấp API — đổi model trong Cài đặt chat hoặc chọn nhà cung cấp riêng.";

export function isWebGpuInferenceProviderId(
  id: string | null | undefined,
): boolean {
  return id === WEBGPU_SYSTEM_PROVIDER_ID;
}

export function isWebGpuInferenceProvider(
  p: Pick<AIProvider, "id" | "providerType"> | null | undefined,
): boolean {
  if (!p) return false;
  if (isWebGpuInferenceProviderId(p.id)) return true;
  return p.providerType === "webgpu";
}

export function isApiInferenceEligibleProvider(
  p: Pick<AIProvider, "id" | "providerType">,
): boolean {
  return !isWebGpuInferenceProvider(p);
}

export function filterApiInferenceProviders<T extends Pick<
  AIProvider,
  "id" | "providerType"
>>(
  providers: T[] | undefined,
): T[] | undefined {
  if (!providers) return undefined;
  return providers.filter(isApiInferenceEligibleProvider);
}
