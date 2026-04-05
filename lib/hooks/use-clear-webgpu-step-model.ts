"use client";

import { useEffect, useRef } from "react";
import { isWebGpuInferenceProviderId } from "@/lib/ai/api-inference";

/**
 * Clears persisted per-step model once if it references the system WebGPU provider.
 */
export function useClearWebGpuStepModel(
  providerId: string | undefined,
  onClear: () => void | Promise<void>,
): void {
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    if (!providerId || !isWebGpuInferenceProviderId(providerId)) return;
    ran.current = true;
    void Promise.resolve(onClear());
  }, [providerId, onClear]);
}
