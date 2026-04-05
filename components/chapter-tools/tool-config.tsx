"use client";

import { useState, useEffect, useCallback } from "react";
import { useDebouncedCallback } from "@/lib/hooks/use-debounce";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  RotateCcwIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { toast } from "sonner";
import {
  useAnalysisSettings,
  updateAnalysisSettings,
  useAIModels,
  useApiInferenceProviders,
  useClearWebGpuStepModel,
} from "@/lib/hooks";
import type { StepModelConfig, AnalysisSettings } from "@/lib/db";

type ModelKey = "translateModel" | "reviewModel" | "editModel";
type PromptKey = "translatePrompt" | "reviewPrompt" | "editPrompt";

interface ToolConfigProps {
  modelKey: ModelKey;
  promptKey: PromptKey;
  defaultPrompt: string;
  modelLabel: string;
  promptLabel: string;
}

export function ToolConfig({
  modelKey,
  promptKey,
  defaultPrompt,
  modelLabel,
  promptLabel,
}: ToolConfigProps) {
  const settings = useAnalysisSettings();
  const [isOpen, setIsOpen] = useState(false);

  const providers = useApiInferenceProviders();
  const currentModel = settings[modelKey] as StepModelConfig | undefined;
  const selectedProviderId = currentModel?.providerId ?? "";
  const models = useAIModels(selectedProviderId || undefined);

  const storedPrompt = (settings[promptKey] as string | undefined) ?? "";
  const effectivePrompt = storedPrompt || defaultPrompt;

  const [promptText, setPromptText] = useState(effectivePrompt);

  useEffect(() => {
    setPromptText(effectivePrompt);
  }, [effectivePrompt]);

  const saveModel = useCallback(
    async (model: StepModelConfig | undefined) => {
      try {
        await updateAnalysisSettings({
          [modelKey]: model,
        } as Partial<AnalysisSettings>);
      } catch {
        toast.error("Lưu cài đặt thất bại");
      }
    },
    [modelKey],
  );

  const clearWebGpu = useCallback(async () => {
    await saveModel(undefined);
  }, [saveModel]);
  useClearWebGpuStepModel(currentModel?.providerId, clearWebGpu);

  const savePrompt = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      const value =
        !trimmed || trimmed === defaultPrompt.trim() ? undefined : trimmed;
      try {
        await updateAnalysisSettings({
          [promptKey]: value,
        } as Partial<AnalysisSettings>);
      } catch {
        toast.error("Lưu cài đặt thất bại");
      }
    },
    [promptKey, defaultPrompt],
  );

  const handleProviderChange = (providerId: string) => {
    const model = providerId ? { providerId, modelId: "" } : undefined;
    saveModel(model);
  };

  const handleModelChange = (modelId: string) => {
    if (!selectedProviderId) return;
    saveModel({ providerId: selectedProviderId, modelId });
  };

  const debouncedSavePrompt = useDebouncedCallback(savePrompt, 600);

  const handlePromptChange = (text: string) => {
    setPromptText(text);
    debouncedSavePrompt.run(text);
  };

  const hasCustomModel = !!currentModel;
  const hasCustomPrompt =
    !!storedPrompt.trim() && storedPrompt.trim() !== defaultPrompt.trim();

  return (
    <div className="rounded-lg border">
      <button
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? (
          <ChevronDownIcon className="size-3.5 text-muted-foreground" />
        ) : (
          <ChevronRightIcon className="size-3.5 text-muted-foreground" />
        )}
        <span className="text-xs font-medium">Cài đặt</span>
        {!isOpen && (hasCustomModel || hasCustomPrompt) && (
          <span className="text-xs text-muted-foreground">(đã tùy chỉnh)</span>
        )}
      </button>

      {isOpen && (
        <div className="space-y-3 border-t px-3 pb-3 pt-3">
          {/* Model selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">{modelLabel}</Label>
              {hasCustomModel && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => saveModel(undefined)}
                  className="h-6 text-xs"
                >
                  <RotateCcwIcon className="mr-1 size-3" />
                  Mặc định
                </Button>
              )}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <NativeSelect
                className="w-full"
                value={selectedProviderId}
                onChange={(e) => handleProviderChange(e.target.value)}
              >
                <NativeSelectOption value="">Mặc định</NativeSelectOption>
                {providers?.map((p) => (
                  <NativeSelectOption key={p.id} value={p.id}>
                    {p.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <NativeSelect
                className="w-full"
                value={currentModel?.modelId ?? ""}
                onChange={(e) => handleModelChange(e.target.value)}
                disabled={!selectedProviderId}
              >
                <NativeSelectOption value="">
                  {selectedProviderId
                    ? "Chọn mô hình"
                    : "Chọn nhà cung cấp trước"}
                </NativeSelectOption>
                {models?.map((m) => (
                  <NativeSelectOption key={m.id} value={m.modelId}>
                    {m.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          </div>

          {/* Custom prompt */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">{promptLabel}</Label>
              {hasCustomPrompt && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    debouncedSavePrompt.cancel();
                    await updateAnalysisSettings({
                      [promptKey]: undefined,
                    } as Partial<AnalysisSettings>);
                    setPromptText(defaultPrompt);
                  }}
                  className="h-6 text-xs"
                >
                  <RotateCcwIcon className="mr-1 size-3" />
                  Đặt lại
                </Button>
              )}
            </div>
            <Textarea
              value={promptText}
              onChange={(e) => handlePromptChange(e.target.value)}
              className="min-h-[80px] font-mono text-xs leading-relaxed"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Mặc định kế thừa từ cài đặt trò chuyện chung.
          </p>
        </div>
      )}
    </div>
  );
}
