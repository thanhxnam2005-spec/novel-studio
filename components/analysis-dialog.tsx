"use client";

import { AnalysisModelPicker } from "@/components/analysis-model-picker";
import { AnalysisProgress } from "@/components/analysis-progress";
import { AnalysisPromptEditor } from "@/components/analysis-prompt-editor";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getModel } from "@/lib/ai/provider";
import {
  analyzeNovel,
  analyzeNovelIncremental,
  type AnalysisDepth,
} from "@/lib/analysis";
import { db } from "@/lib/db";
import {
  useAIProvider,
  useAnalysisSettings,
  useChatSettings,
} from "@/lib/hooks";
import { useAnalysisStore } from "@/lib/stores/analysis";
import { GaugeIcon, TelescopeIcon, ZapIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

type AnalysisMode = "full" | "incremental" | "selected";

const DEPTH_OPTIONS: {
  value: AnalysisDepth;
  label: string;
  icon: React.ElementType;
}[] = [
  { value: "quick", label: "Nhanh", icon: ZapIcon },
  { value: "standard", label: "Tiêu chuẩn", icon: GaugeIcon },
  { value: "deep", label: "Chi tiết", icon: TelescopeIcon },
];

export function AnalysisDialog({
  open,
  onOpenChange,
  novelId,
  mode,
  selectedChapterIds,
  totalChapters,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  novelId: string;
  mode: AnalysisMode;
  selectedChapterIds?: string[];
  totalChapters: number;
}) {
  const chatSettings = useChatSettings();
  const provider = useAIProvider(chatSettings?.providerId);
  const analysisSettings = useAnalysisSettings();
  const {
    isAnalyzing,
    phase,
    errors,
    start,
    updateProgress,
    setPhase,
    addError,
    setError,
    reset,
  } = useAnalysisStore();
  const isDone =
    phase === "complete" || phase === "completed_with_errors" || phase === "error";

  const [depth, setDepth] = useState<AnalysisDepth>("standard");

  const modeLabel =
    mode === "full"
      ? "Phân tích toàn bộ"
      : mode === "incremental"
        ? "Phân tích còn lại"
        : `Phân tích đã chọn (${selectedChapterIds?.length ?? 0})`;

  const resolveStep = useCallback(
    async (cfg: { providerId: string; modelId: string } | undefined) => {
      if (!cfg?.providerId || !cfg?.modelId) return undefined;
      const p = await db.aiProviders.get(cfg.providerId);
      if (!p) return undefined;
      return getModel(p, cfg.modelId);
    },
    [],
  );

  const handleRun = useCallback(async () => {
    if (!provider || !chatSettings?.modelId) {
      toast.error("Vui lòng cấu hình nhà cung cấp AI trong Cài đặt trước.");
      return;
    }

    const count =
      mode === "selected"
        ? (selectedChapterIds?.length ?? 0)
        : mode === "incremental"
          ? totalChapters
          : totalChapters;
    start(novelId, count);
    const abortController = useAnalysisStore.getState().abortController;

    const commonOpts = {
      novelId,
      defaultModel: getModel(provider, chatSettings.modelId),
      signal: abortController?.signal,
      depth,
      customPrompts: {
        chapterAnalysis: analysisSettings.chapterAnalysisPrompt,
        novelAggregation: analysisSettings.novelAggregationPrompt,
        characterProfiling: analysisSettings.characterProfilingPrompt,
      },
      stepModels: {
        chapters: await resolveStep(analysisSettings.chapterModel),
        aggregation: await resolveStep(analysisSettings.aggregationModel),
        characters: await resolveStep(analysisSettings.characterModel),
      },
      globalSystemInstruction: chatSettings.globalSystemInstruction,
      onProgress: (progress: {
        chaptersCompleted: number;
        totalChapters: number;
        phase: string;
        error?: { phase: string; chapterTitle?: string; message: string };
      }) => {
        updateProgress(progress.chaptersCompleted, progress.totalChapters);
        setPhase(progress.phase as never);
        if (progress.error) addError(progress.error);
      },
    };

    try {
      if (mode === "full") {
        await analyzeNovel(commonOpts);
      } else {
        await analyzeNovelIncremental(commonOpts);
      }
      const storeErrors = useAnalysisStore.getState().errors;
      if (storeErrors.length > 0) {
        setPhase("completed_with_errors" as never);
        toast.warning(
          `Hoàn tất với ${storeErrors.length} lỗi. Bạn có thể chạy lại để thử các chương thất bại.`,
        );
      } else {
        toast.success("Phân tích hoàn tất!");
        reset();
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        toast.info("Đã hủy phân tích.");
        reset();
      } else {
        const msg = error instanceof Error ? error.message : "Unknown error";
        setError(msg);
        toast.error(`Phân tích thất bại: ${msg}`);
      }
    }
  }, [
    provider,
    chatSettings,
    novelId,
    mode,
    selectedChapterIds,
    totalChapters,
    depth,
    analysisSettings,
    start,
    updateProgress,
    setPhase,
    addError,
    setError,
    reset,
    resolveStep,
  ]);

  return (
    <Dialog
      open={open}
      onOpenChange={isAnalyzing && !isDone ? undefined : (v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{modeLabel}</DialogTitle>
          <DialogDescription>
            {mode === "full"
              ? "Phân tích tất cả chương từ đầu."
              : mode === "incremental"
                ? "Chỉ phân tích các chương mới hoặc đã sửa đổi."
                : `Phân tích ${selectedChapterIds?.length ?? 0} chương đã chọn.`}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 p-1 pr-4">
            {/* Progress (when running or done with errors) */}
            {(isAnalyzing || isDone) && <AnalysisProgress />}

            {/* Config (when not running and not done) */}
            {!isAnalyzing && !isDone && (
              <>
                <div>
                  <p className="mb-2 text-xs font-medium">Độ sâu</p>
                  <div className="flex gap-2">
                    {DEPTH_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setDepth(opt.value)}
                        className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                          depth === opt.value
                            ? "border-primary bg-primary/5 text-primary"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <opt.icon className="size-3.5" />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <AnalysisModelPicker />
                <AnalysisPromptEditor />

                {!provider && (
                  <p className="text-xs text-amber-500">
                    Chưa cấu hình nhà cung cấp AI.{" "}
                    <a href="/settings/providers" className="underline">
                      Thêm ngay
                    </a>
                  </p>
                )}
              </>
            )}
          </div>
        </ScrollArea>

        {/* Initial state: start button */}
        {!isAnalyzing && !isDone && (
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button onClick={handleRun} disabled={!provider}>
              Bắt đầu phân tích
            </Button>
          </div>
        )}

        {/* Done with errors: retry + close */}
        {isDone && errors.length > 0 && (
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
            >
              Đóng
            </Button>
            <Button
              onClick={() => {
                reset();
                // Small delay so store resets before handleRun reads it
                setTimeout(handleRun, 0);
              }}
              disabled={!provider}
            >
              Chạy lại phần thất bại
            </Button>
          </div>
        )}

        {/* Done cleanly: auto-closed, but just in case show close */}
        {isDone && errors.length === 0 && (
          <div className="flex justify-end gap-2 pt-2">
            <Button
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
            >
              Đóng
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
