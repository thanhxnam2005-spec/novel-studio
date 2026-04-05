"use client";

import { Button } from "@/components/ui/button";
import { ConfirmInterruptDialog } from "@/components/ui/confirm-interrupt-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { BulkTranslateOptions } from "@/lib/chapter-tools/bulk-translate";
import {
  runBulkTranslate,
  saveBulkResults,
} from "@/lib/chapter-tools/bulk-translate";
import type { ContextDepth } from "@/lib/chapter-tools/context";
import { DEFAULT_TRANSLATE_SYSTEM } from "@/lib/chapter-tools/prompts";
import {
  getChapterToolModelMissingMessage,
  resolveChapterToolModel,
} from "@/lib/chapter-tools/stream-runner";
import type { AnalysisSettings, Chapter, StepModelConfig } from "@/lib/db";
import {
  updateAnalysisSettings,
  useAIModels,
  useAIProvider,
  useAnalysisSettings,
  useApiInferenceProviders,
  useChatSettings,
  useClearWebGpuStepModel,
  useConfirmInterrupt,
} from "@/lib/hooks";
import { useBulkTranslateStore } from "@/lib/stores/bulk-translate";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ChevronDownIcon,
  ChevronRightIcon,
  CircleDashedIcon,
  GaugeIcon,
  LanguagesIcon,
  LoaderIcon,
  RotateCcwIcon,
  SaveIcon,
  TelescopeIcon,
  XIcon,
  ZapIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDebouncedCallback } from "@/lib/hooks/use-debounce";
import { toast } from "sonner";

const DEPTH_OPTIONS: {
  value: ContextDepth;
  label: string;
  icon: React.ElementType;
}[] = [
  { value: "quick", label: "Nhanh", icon: ZapIcon },
  { value: "standard", label: "Tiêu chuẩn", icon: GaugeIcon },
  { value: "deep", label: "Chi tiết", icon: TelescopeIcon },
];

const STATUS_ICON: Record<string, React.ElementType> = {
  pending: CircleDashedIcon,
  translating: LoaderIcon,
  done: CheckCircle2Icon,
  error: AlertTriangleIcon,
};

const STATUS_CLASS: Record<string, string> = {
  pending: "text-muted-foreground",
  translating: "text-primary animate-spin",
  done: "text-emerald-500",
  error: "text-destructive",
};

function makeCallbacks(
  autoSave: boolean,
): Pick<
  BulkTranslateOptions,
  "onChapterStart" | "onChapterComplete" | "onChapterError" | "onAllComplete"
> {
  const store = useBulkTranslateStore.getState;
  return {
    onChapterStart: (chapterId) => {
      store().setCurrentChapter(chapterId);
      store().setChapterStatus(chapterId, "translating");
    },
    onChapterComplete: (result) => {
      store().setChapterStatus(result.chapterId, "done");
      store().addResult(result);
      store().incrementCompleted();
      if (autoSave) store().markSaved([result.chapterId]);
    },
    onChapterError: (error) => {
      store().setChapterStatus(error.chapterId, "error");
      store().addError(error);
      store().incrementCompleted();
    },
    onAllComplete: () => {
      store().finish();
    },
  };
}

export function BulkTranslateDialog({
  open,
  onOpenChange,
  novelId,
  selectedChapterIds,
  chapters,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  novelId: string;
  selectedChapterIds: string[];
  chapters: Chapter[];
}) {
  // Store — use selectors to avoid unnecessary re-renders
  const step = useBulkTranslateStore((s) => s.step);
  const isRunning = useBulkTranslateStore((s) => s.isRunning);

  const { showConfirm, guard, confirm, dismiss } =
    useConfirmInterrupt(isRunning);
  const statuses = useBulkTranslateStore((s) => s.statuses);
  const chaptersCompleted = useBulkTranslateStore((s) => s.chaptersCompleted);
  const totalChapters = useBulkTranslateStore((s) => s.totalChapters);
  const results = useBulkTranslateStore((s) => s.results);
  const errors = useBulkTranslateStore((s) => s.errors);
  const savedChapterIds = useBulkTranslateStore((s) => s.savedChapterIds);

  const settings = useAnalysisSettings();
  const chatSettings = useChatSettings();
  const providers = useApiInferenceProviders();
  const defaultProvider = useAIProvider(chatSettings?.providerId);

  // Model — synced with AnalysisSettings.translateModel
  const currentModel = settings.translateModel as StepModelConfig | undefined;
  const selectedProviderId = currentModel?.providerId ?? "";
  const models = useAIModels(selectedProviderId || undefined);

  const saveModel = useCallback(async (model: StepModelConfig | undefined) => {
    try {
      await updateAnalysisSettings({
        translateModel: model,
      } as Partial<AnalysisSettings>);
    } catch {
      /* silent */
    }
  }, []);

  const clearWebGpu = useCallback(async () => {
    await saveModel(undefined);
  }, [saveModel]);
  useClearWebGpuStepModel(currentModel?.providerId, clearWebGpu);

  const handleProviderChange = (providerId: string) => {
    saveModel(providerId ? { providerId, modelId: "" } : undefined);
  };
  const handleModelChange = (modelId: string) => {
    if (!selectedProviderId) return;
    saveModel({ providerId: selectedProviderId, modelId });
  };

  const storedPrompt = (settings.translatePrompt as string | undefined) ?? "";
  const effectivePrompt = storedPrompt || DEFAULT_TRANSLATE_SYSTEM;
  const [promptText, setPromptText] = useState(effectivePrompt);
  const [promptOpen, setPromptOpen] = useState(false);

  useEffect(() => {
    setPromptText(effectivePrompt);
  }, [effectivePrompt]);

  const savePrompt = useCallback(async (text: string) => {
    const trimmed = text.trim();
    const value =
      !trimmed || trimmed === DEFAULT_TRANSLATE_SYSTEM.trim()
        ? undefined
        : trimmed;
    try {
      await updateAnalysisSettings({
        translatePrompt: value,
      } as Partial<AnalysisSettings>);
    } catch {
      /* silent */
    }
  }, []);

  const debouncedSavePrompt = useDebouncedCallback(savePrompt, 600);

  const handlePromptChange = (text: string) => {
    setPromptText(text);
    debouncedSavePrompt.run(text);
  };

  const isCustomPrompt = promptText.trim() !== DEFAULT_TRANSLATE_SYSTEM.trim();

  // Other config
  const [depth, setDepth] = useState<ContextDepth>("standard");
  const [translateTitle, setTranslateTitle] = useState(true);
  const [autoSave, setAutoSave] = useState(false);

  const selectedChapters = useMemo(
    () => chapters.filter((c) => selectedChapterIds.includes(c.id)),
    [chapters, selectedChapterIds],
  );

  const resolveModel = useCallback(async () => {
    const model = await resolveChapterToolModel(
      settings.translateModel,
      defaultProvider,
      chatSettings,
    );
    if (!model) {
      toast.error(getChapterToolModelMissingMessage(defaultProvider));
    }
    return model;
  }, [settings.translateModel, defaultProvider, chatSettings]);

  const runTranslate = useCallback(
    async (chapterIds: string[]) => {
      const model = await resolveModel();
      if (!model) return;

      const signal = useBulkTranslateStore.getState().abortController?.signal;

      await runBulkTranslate({
        novelId,
        chapterIds,
        model,
        depth,
        translateTitle,
        autoSave,
        settings,
        customPrompt: promptText,
        signal,
        ...makeCallbacks(autoSave),
      });
    },
    [
      novelId,
      depth,
      translateTitle,
      autoSave,
      settings,
      promptText,
      resolveModel,
    ],
  );

  const handleStart = useCallback(async () => {
    useBulkTranslateStore.getState().start(selectedChapterIds);
    await runTranslate(selectedChapterIds);
  }, [selectedChapterIds, runTranslate]);

  const handleRetry = useCallback(async () => {
    const failedIds = errors.map((e) => e.chapterId);
    if (failedIds.length === 0) return;
    useBulkTranslateStore.getState().startRetry(failedIds);
    await runTranslate(failedIds);
  }, [errors, runTranslate]);

  const handleSaveAll = useCallback(async () => {
    const unsaved = Array.from(results.entries()).filter(
      ([id]) => !savedChapterIds.has(id),
    );
    if (unsaved.length === 0) return;

    try {
      await saveBulkResults(unsaved.map(([, r]) => r));
      useBulkTranslateStore.getState().markSaved(unsaved.map(([id]) => id));
      toast.success(`Đã lưu ${unsaved.length} chương`);
    } catch {
      toast.error("Lưu thất bại");
    }
  }, [results, savedChapterIds]);

  const handleClose = () => {
    useBulkTranslateStore.getState().reset();
    onOpenChange(false);
  };

  const progressPercent =
    totalChapters > 0 ? (chaptersCompleted / totalChapters) * 100 : 0;

  const doneCount = useMemo(
    () => Array.from(statuses.values()).filter((s) => s === "done").length,
    [statuses],
  );

  const unsavedCount = results.size - savedChapterIds.size;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          guard(() => {
            useBulkTranslateStore.getState().cancel();
            handleClose();
          });
        } else {
          onOpenChange(v);
        }
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <ConfirmInterruptDialog
          open={showConfirm}
          onConfirm={confirm}
          onCancel={dismiss}
        />
        <DialogHeader>
          <DialogTitle>
            Dịch hàng loạt ({selectedChapterIds.length} chương)
          </DialogTitle>
          <DialogDescription>
            Dịch tuần tự từng chương đã chọn.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 p-1 pr-4">
            {/* ── Step 1: Config ── */}
            {step === "config" && (
              <>
                {/* Depth */}
                <div>
                  <p className="mb-2 text-xs font-medium">Ngữ cảnh</p>
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

                {/* Model picker */}
                <div className="space-y-2">
                  <Label className="text-xs">Mô hình dịch</Label>
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
                        {selectedProviderId ? "Chọn mô hình" : "Mặc định"}
                      </NativeSelectOption>
                      {models?.map((m) => (
                        <NativeSelectOption key={m.id} value={m.modelId}>
                          {m.name}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </div>
                </div>

                {/* Toggles */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="bulk-translate-title"
                      checked={translateTitle}
                      onCheckedChange={setTranslateTitle}
                    />
                    <Label
                      htmlFor="bulk-translate-title"
                      className="cursor-pointer text-xs"
                    >
                      Dịch tiêu đề chương
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="bulk-auto-save"
                      checked={autoSave}
                      onCheckedChange={setAutoSave}
                    />
                    <Label
                      htmlFor="bulk-auto-save"
                      className="cursor-pointer text-xs"
                    >
                      Tự động lưu sau mỗi chương
                    </Label>
                  </div>
                </div>

                {/* Prompt editor (collapsible) */}
                <div className="rounded-lg border">
                  <button
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
                    onClick={() => setPromptOpen(!promptOpen)}
                  >
                    {promptOpen ? (
                      <ChevronDownIcon className="size-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronRightIcon className="size-3.5 text-muted-foreground" />
                    )}
                    <span className="text-xs font-medium">
                      Prompt dịch thuật
                    </span>
                    {!promptOpen && isCustomPrompt && (
                      <span className="text-xs text-muted-foreground">
                        (đã tùy chỉnh)
                      </span>
                    )}
                  </button>
                  {promptOpen && (
                    <div className="space-y-1.5 border-t px-3 pb-3 pt-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Prompt hệ thống</Label>
                        {isCustomPrompt && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              debouncedSavePrompt.cancel();
                              handlePromptChange(DEFAULT_TRANSLATE_SYSTEM);
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
                        className="min-h-[100px] font-mono text-xs leading-relaxed"
                      />
                    </div>
                  )}
                </div>

                {!defaultProvider && (
                  <p className="text-xs text-amber-500">
                    Chưa cấu hình nhà cung cấp AI.{" "}
                    <a href="/settings/providers" className="underline">
                      Thêm ngay
                    </a>
                  </p>
                )}
              </>
            )}

            {/* ── Step 2: Progress ── */}
            {step === "progress" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Chương {chaptersCompleted} / {totalChapters}
                    </span>
                    {isRunning && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={() =>
                          useBulkTranslateStore.getState().cancel()
                        }
                      >
                        <XIcon className="mr-1 size-3" />
                        Hủy
                      </Button>
                    )}
                  </div>
                  <Progress value={progressPercent} className="h-2" />
                </div>

                <div className="space-y-1">
                  {selectedChapters.map((ch) => {
                    const status = statuses.get(ch.id) ?? "pending";
                    const Icon = STATUS_ICON[status];
                    return (
                      <div
                        key={ch.id}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs"
                      >
                        <Icon
                          className={`size-3.5 shrink-0 ${STATUS_CLASS[status]}`}
                        />
                        <span className="flex-1 truncate">
                          {ch.order + 1}. {ch.title}
                        </span>
                        {status === "error" && (
                          <span className="text-destructive">Lỗi</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Step 3: Results ── */}
            {step === "results" && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
                  <CheckCircle2Icon className="size-4 shrink-0" />
                  <span className="text-xs font-medium">
                    Đã dịch {doneCount}/{totalChapters} chương
                    {errors.length > 0 && `, ${errors.length} lỗi`}
                  </span>
                </div>

                <div className="space-y-1">
                  {selectedChapters.map((ch) => {
                    const result = results.get(ch.id);
                    const error = errors.find((e) => e.chapterId === ch.id);
                    const saved = savedChapterIds.has(ch.id);

                    return (
                      <div
                        key={ch.id}
                        className="rounded-md border bg-muted/20 px-3 py-2 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          {result ? (
                            <CheckCircle2Icon className="size-3.5 shrink-0 text-emerald-500" />
                          ) : (
                            <AlertTriangleIcon className="size-3.5 shrink-0 text-destructive" />
                          )}
                          <span className="flex-1 truncate font-medium">
                            {ch.order}. {ch.title}
                          </span>
                          {saved && (
                            <span className="text-emerald-600 dark:text-emerald-400">
                              Đã lưu
                            </span>
                          )}
                        </div>
                        {result && (
                          <div className="mt-1 pl-5.5 text-muted-foreground">
                            {result.newTitle && (
                              <div>
                                <span className="line-through opacity-60">
                                  {result.originalTitle}
                                </span>
                                {" → "}
                                <span>{result.newTitle}</span>
                              </div>
                            )}
                            <div>
                              {result.originalLineCount} dòng →{" "}
                              {result.translatedLineCount} dòng
                              {result.translatedLineCount !==
                                result.originalLineCount && (
                                <span
                                  className={
                                    result.translatedLineCount >
                                    result.originalLineCount
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : "text-amber-600 dark:text-amber-400"
                                  }
                                >
                                  {" "}
                                  (
                                  {result.translatedLineCount >
                                  result.originalLineCount
                                    ? "+"
                                    : ""}
                                  {result.translatedLineCount -
                                    result.originalLineCount}
                                  )
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                        {error && (
                          <p className="mt-1 pl-5.5 text-destructive">
                            {error.message}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* ── Footer buttons ── */}
        {step === "config" && (
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={handleClose}>
              Hủy
            </Button>
            <Button onClick={handleStart} disabled={!defaultProvider}>
              <LanguagesIcon className="mr-1.5 size-3.5" />
              Bắt đầu dịch
            </Button>
          </div>
        )}

        {step === "results" && (
          <div className="flex justify-end gap-2 pt-2">
            {errors.length > 0 && (
              <Button variant="outline" onClick={handleRetry}>
                Thử lại ({errors.length})
              </Button>
            )}
            {!autoSave && unsavedCount > 0 && (
              <Button variant="outline" onClick={handleSaveAll}>
                <SaveIcon className="mr-1.5 size-3.5" />
                Lưu tất cả ({unsavedCount})
              </Button>
            )}
            <Button onClick={handleClose}>Đóng</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
