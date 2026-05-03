"use client";

import { ConvertConfig } from "@/components/convert-config";
import { ConvertDetectedNames } from "@/components/convert-detected-names";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { TextCompareEditor } from "@/components/ui/text-compare-editor";
import { useConvertSettings } from "@/lib/hooks/use-convert-settings";
import { useDebouncedValue } from "@/lib/hooks/use-debounce";
import { useExcludedNamesList } from "@/lib/hooks/use-excluded-names";
import { convertText, useQTEngineReady, refreshQTEngine } from "@/lib/hooks/use-qt-engine";
import type {
  ConvertOptions,
  ConvertSegment,
  DictPair,
} from "@/lib/workers/qt-engine.types";
import { useReaderPanel } from "@/lib/stores/reader-panel";
import { SegmentRenderer } from "@/components/reader/segment-renderer";
import { PasswordGate } from "@/components/password-gate";
import {
  extractNamesAI,
  extractNamesRuleBased
} from "@/lib/chapter-tools/name-extract";
import { bulkImportNameEntries, useGlobalNameEntries } from "@/lib/hooks/use-name-entries";
import { useAIProviders, useAIModels } from "@/lib/hooks/use-ai-providers";
import { getModel } from "@/lib/ai/provider";
import { runTranslationTraining, type TrainingSuggestion } from "@/lib/ai/training-tools";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowRightLeftIcon,
  CheckIcon,
  ChevronDownIcon,
  ClipboardCopyIcon,
  ClipboardListIcon,
  DownloadIcon,
  FileUpIcon,
  LoaderIcon,
  RefreshCwIcon,
  SettingsIcon,
  SparklesIcon,
  Trash2Icon,
  Volume2Icon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sify } from "chinese-conv";
import { useTrainingStore } from "@/lib/stores/training-store";
import { useBackgroundTraining } from "@/lib/hooks/use-background-training";
import { toast } from "sonner";
import { stvTranslate } from "@/lib/api/stv-translator";

function splitTextIntoChunks(text: string, maxChunkSize: number = 30000): string[] {
  const chunks: string[] = [];
  let currentStart = 0;
  
  while (currentStart < text.length) {
    if (text.length - currentStart <= maxChunkSize) {
      chunks.push(text.substring(currentStart));
      break;
    }
    
    let splitPos = text.lastIndexOf('\n', currentStart + maxChunkSize);
    
    if (splitPos <= currentStart) {
      splitPos = text.lastIndexOf('。', currentStart + maxChunkSize);
    }
    if (splitPos <= currentStart) {
      splitPos = text.lastIndexOf('，', currentStart + maxChunkSize);
    }
    if (splitPos <= currentStart) {
      splitPos = currentStart + maxChunkSize;
    } else {
      splitPos += 1;
    }
    
    chunks.push(text.substring(currentStart, splitPos));
    currentStart = splitPos;
  }
  
  return chunks;
}

export default function ConvertPage() {
  const store = useTrainingStore();
  const { handleTrain, stopTraining } = useBackgroundTraining();

  const {
    input = "", setInput,
    output = "", setOutput,
    segments = [], setSegments,
    isTraining = false,
    trainingSuggestions = [], setTrainingSuggestions,
    batchProgress = null,
    lastProcessedIndex = 0, setLastProcessedIndex,
    isAutoNext = false, setIsAutoNext
  } = store;

  const [isConverting, setIsConverting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [liveMode, setLiveMode] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [useSTVMode, setUseSTVMode] = useState(true);
  const [stvProgress, setSTVProgress] = useState<string | null>(null);
  const [detectedNames, setDetectedNames] = useState<DictPair[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractDialogOpen, setExtractDialogOpen] = useState(false);
  const [extractedNames, setExtractedNames] = useState<any[]>([]);
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
  const [showPreview, setShowPreview] = useState(false);
  const [showDetectedNames, setShowDetectedNames] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const stvAbortRef = useRef<AbortController | null>(null);

  const providers = useAIProviders();
  const activeProvider = providers?.find(p => p.isActive);
  const models = useAIModels(activeProvider?.id);
  const activeModel = models?.[0]?.modelId; // Simple heuristic

  const engineReady = useQTEngineReady();
  const convertOptions = useConvertSettings();
  const rejectedAutoNames = useExcludedNamesList();
  const debouncedInput = useDebouncedValue(input, 500);
  const seqRef = useRef(0);

  // Merge persistent settings with ephemeral rejected names
  const mergedOptions = useMemo<ConvertOptions>(
    () => ({ ...convertOptions, rejectedAutoNames }),
    [convertOptions, rejectedAutoNames],
  );

  const globalNames = useGlobalNameEntries();

  const handleConvert = useCallback(async () => {
    if (!input.trim()) return;
    const seq = ++seqRef.current;
    setIsConverting(true);
    setSTVProgress(null);
    
    // Cancel previous STV request if any
    stvAbortRef.current?.abort();
    
    try {
      if (useSTVMode) {
        // ── STV Server Mode ──
        const controller = new AbortController();
        stvAbortRef.current = controller;
        
        const result = await stvTranslate(input, {
          signal: controller.signal,
          onProgress: (p) => {
            if (seqRef.current !== seq) return;
            setOutput(p.partialResult);
            setSTVProgress(`Đang dịch: ${p.currentChunk + 1}/${p.totalChunks} phần`);
          },
        });
        
        if (seqRef.current === seq) {
          setOutput(result);
          setSegments([]);
          setDetectedNames([]);
          setSTVProgress(null);
        }
      } else {
        // ── QT Dictionary Mode ──
        const chunks = splitTextIntoChunks(input, 30000);
        let finalPlainText = "";
        let finalSegments: ConvertSegment[] = [];
        let finalDetectedNames: DictPair[] = [];

        for (let i = 0; i < chunks.length; i++) {
          if (seqRef.current !== seq) return;
          
          const result = await convertText(chunks[i], { globalNames, options: mergedOptions });
          
          finalPlainText += result.plainText;
          finalSegments = finalSegments.concat(result.segments);
          
          const newNames = result.detectedNames ?? [];
          for (const n of newNames) {
            if (!finalDetectedNames.some(d => d.chinese === n.chinese)) {
              finalDetectedNames.push(n);
            }
          }
          
          if (seqRef.current === seq) {
            setOutput(finalPlainText);
            setSegments(finalSegments);
            setDetectedNames([...finalDetectedNames]);
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (seqRef.current === seq) {
        toast.error("Lỗi convert: " + (err instanceof Error ? err.message : String(err)));
      }
    } finally {
      if (seqRef.current === seq) {
        setIsConverting(false);
        setSTVProgress(null);
      }
    }
  }, [input, mergedOptions, globalNames, useSTVMode]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setInput(sify(text));
      setLastProcessedIndex(0);
      toast.success(`Đã nhập ${file.name}`);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  useEffect(() => {
    if (!liveMode) return;
    // QT mode cần engine ready, STV mode luôn sẵn sàng
    if (!useSTVMode && !engineReady) return;
    if (!debouncedInput.trim()) {
      setOutput("");
      return;
    }
    const seq = ++seqRef.current;
    setIsConverting(true);
    setSTVProgress(null);
    
    // Cancel previous STV request
    stvAbortRef.current?.abort();
    
    const processChunks = async () => {
      try {
        if (useSTVMode) {
          // ── STV Server Mode ──
          const controller = new AbortController();
          stvAbortRef.current = controller;
          
          const result = await stvTranslate(debouncedInput, {
            signal: controller.signal,
            onProgress: (p) => {
              if (seqRef.current !== seq) return;
              setOutput(p.partialResult);
              setSTVProgress(`Đang dịch: ${p.currentChunk + 1}/${p.totalChunks} phần`);
            },
          });
          
          if (seqRef.current === seq) {
            setOutput(result);
            setSegments([]);
            setDetectedNames([]);
            setSTVProgress(null);
          }
        } else {
          // ── QT Dictionary Mode ──
          const chunks = splitTextIntoChunks(debouncedInput, 30000);
          let finalPlainText = "";
          let finalSegments: ConvertSegment[] = [];
          let finalDetectedNames: DictPair[] = [];

          for (let i = 0; i < chunks.length; i++) {
            if (seqRef.current !== seq) return;
            
            const result = await convertText(chunks[i], { globalNames, options: mergedOptions });
            
            finalPlainText += result.plainText;
            finalSegments = finalSegments.concat(result.segments);
            
            const newNames = result.detectedNames ?? [];
            for (const n of newNames) {
              if (!finalDetectedNames.some(d => d.chinese === n.chinese)) {
                finalDetectedNames.push(n);
              }
            }
            
            if (seqRef.current === seq) {
              setOutput(finalPlainText);
              setSegments(finalSegments);
              setDetectedNames([...finalDetectedNames]);
            }
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (seqRef.current === seq) {
          toast.error("Lỗi convert: " + (err instanceof Error ? err.message : String(err)));
        }
      } finally {
        if (seqRef.current === seq) {
          setIsConverting(false);
          setSTVProgress(null);
        }
      }
    };

    processChunks();
  }, [liveMode, debouncedInput, mergedOptions, engineReady, globalNames, useSTVMode]);

  const handleRead = useCallback(() => {
    if (!output.trim()) return;
    useReaderPanel.getState().loadText(output, "Kết quả convert");
  }, [output]);

  const handleExtractNames = async () => {
    if (!input.trim()) return;
    setIsExtracting(true);
    try {
      // Use AI if possible, otherwise rule-based
      let results: any[] = [];
      if (activeProvider && activeModel) {
        const model = await getModel(activeProvider, activeModel);
        results = await extractNamesAI({
          model,
          sourceText: input,
          translatedText: output,
        });
      } else {
        // Fallback to engine detection
        results = detectedNames.map(n => ({ chinese: n.chinese, vietnamese: n.vietnamese, category: "nhân vật" }));
      }

      setExtractedNames(results);
      setSelectedNames(new Set(results.map(r => r.chinese)));
      setExtractDialogOpen(true);
    } catch (err) {
      toast.error("Trích xuất tên thất bại: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsExtracting(false);
    }
  };


  const handleAddTrainingSuggestion = async (s: TrainingSuggestion) => {
    try {
      await bulkImportNameEntries("global", [{ chinese: s.chinese, vietnamese: s.vietnamese }], s.category, "replace");
      setTrainingSuggestions(trainingSuggestions.filter(item => item.chinese !== s.chinese));
      toast.success(`Đã thêm "${s.chinese}" vào Từ điển tên chung`);
      // Note: Re-conversion happens automatically via the globalNames dependency in useEffect
    } catch {
      toast.error("Lưu thất bại");
    }
  };

  const handleImportSelected = async () => {
    const toImport = extractedNames.filter(n => selectedNames.has(n.chinese));
    if (toImport.length === 0) return;

    try {
      await bulkImportNameEntries("global", toImport, "nhân vật", "replace");
      toast.success(`Đã thêm ${toImport.length} tên vào từ điển`);
      setExtractDialogOpen(false);
      // Re-trigger conversion happens automatically via the globalNames dependency in useEffect
    } catch (err) {
      toast.error("Lưu từ điển thất bại");
    }
  };

  const handleCopy = useCallback(async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    toast.success("Đã sao chép");
    setTimeout(() => setCopied(false), 2000);
  }, [output]);

  const handleClear = useCallback(() => {
    setInput("");
    setOutput("");
    setSegments([]);
    setDetectedNames([]);
  }, []);

  return (
    <main className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden px-6 py-4">
      {/* ── Header ── */}
      <div className="mb-4 flex shrink-0 items-start justify-between flex-col sm:flex-row gap-2">
        <div>
          <h1 className="font-serif text-2xl font-bold">Convert nhanh</h1>
          <p className="text-sm text-muted-foreground">
            {useSTVMode
              ? "Dịch tiếng Trung qua server STV (SangTacViet). Không cần từ điển."
              : "Dán văn bản tiếng Trung và convert sang tiếng Việt bằng từ điển QT."}
          </p>
          {stvProgress && (
            <p className="text-xs text-primary mt-1 flex items-center gap-1.5">
              <LoaderIcon className="size-3 animate-spin" />
              {stvProgress}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          {input && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleClear}
              title="Xóa"
            >
              <Trash2Icon className="size-3.5" />
            </Button>
          )}
          {output && (
            <>
              <Button variant="ghost" size="sm" onClick={handleRead}>
                <Volume2Icon className="mr-1.5 size-3.5" />
                Đọc
              </Button>
              <Button variant="ghost" size="sm" onClick={handleCopy}>
                {copied ? (
                  <CheckIcon className="mr-1.5 size-3.5" />
                ) : (
                  <ClipboardCopyIcon className="mr-1.5 size-3.5" />
                )}
                {copied ? "Đã chép" : "Sao chép"}
              </Button>
            </>
          )}

          {(input || output) && <div className="h-5 w-px bg-border" />}

          <div className="flex items-center gap-1.5 rounded-full border p-0.5 bg-muted/50">
            <button
              onClick={() => setUseSTVMode(true)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-all",
                useSTVMode
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              STV Server
            </button>
            <button
              onClick={() => setUseSTVMode(false)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-all",
                !useSTVMode
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              QT Từ điển
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="live-mode"
              checked={liveMode}
              onCheckedChange={setLiveMode}
              disabled={!useSTVMode && !engineReady}
            />
            <Label htmlFor="live-mode" className="text-sm">
              Live
            </Label>
          </div>

          <div className="flex items-center gap-2 border-l pl-4 mr-2">
            <Switch
              id="edit-mode"
              checked={editMode}
              onCheckedChange={setEditMode}
            />
            <Label htmlFor="edit-mode" className="text-sm">
              Chế độ sửa
            </Label>
          </div>

          {isConverting && (
            <LoaderIcon className="size-4 animate-spin text-muted-foreground" />
          )}

          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleTrain(lastProcessedIndex)}
              disabled={isTraining || !input}
              className="border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
            >
              {isTraining ? (
                <LoaderIcon className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <RefreshCwIcon className="mr-1.5 size-3.5" />
              )}
              {lastProcessedIndex > 0 ? "Tiếp tục huấn luyện" : "Huấn luyện AI"}
            </Button>

            {isTraining && (
              <Button
                variant="outline"
                size="sm"
                onClick={stopTraining}
                className="border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
              >
                Dừng
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              title="Nhập văn bản từ file .txt"
            >
              <FileUpIcon className="mr-1.5 size-3.5" />
              Nhập File
            </Button>

            <input
              type="file"
              accept=".txt"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>

          {lastProcessedIndex > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                store.resetTraining();
                handleTrain(0);
              }}
              className="text-[10px] h-8 px-2"
              title="Huấn luyện lại từ đầu"
            >
              Reset
            </Button>
          )}

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <SettingsIcon className="mr-1.5 size-3.5" />
                Cài đặt
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-[90vw] sm:w-72 max-w-[calc(100vw-1rem)] max-h-[80vh] overflow-y-auto">
              <ConvertConfig />
            </PopoverContent>
          </Popover>
        </div>
      </div>


      {/* ── Side-by-side editor ── */}
      <div ref={scrollContainerRef}>
        <TextCompareEditor
          panelWrapperClassName="h-[calc(100dvh-260px)]"
          leftValue={input}
          rightValue={output}
          onChange={editMode ? setOutput : (val) => setInput(sify(val))}
          editableSide={editMode ? "right" : "left"}
          storageKey="convert"
          leftLabel="Văn bản gốc (Trung)"
          rightLabel={editMode ? "Kết quả (Có thể sửa)" : "Kết quả (Chỉ đọc)"}
        />
      </div>

      {/* ── Interactive Preview & Quick Fix ── */}
      {segments.length > 0 && (
        <div className="mt-4 rounded-md border bg-muted/20 overflow-hidden">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="flex w-full items-center justify-between p-3 hover:bg-muted/40 transition-colors"
          >
            <h3 className="text-sm font-medium flex items-center gap-2">
              <SparklesIcon className="size-3.5 text-primary" />
              Xem trước & Sửa nhanh (Bấm để {showPreview ? 'ẩn' : 'hiện'})
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground uppercase">{segments.length} segments</span>
              <ChevronDownIcon className={cn("size-4 transition-transform", showPreview && "rotate-180")} />
            </div>
          </button>

          {showPreview && (
            <div className="p-4 border-t bg-background/50">
              <SegmentRenderer
                segments={segments}
                onRefresh={handleConvert}
                className="text-sm sm:text-base font-serif"
              />
            </div>
          )}
        </div>
      )}

      {/* ── Detected names ── */}
      {detectedNames.length > 0 && (
        <div className="mt-4 rounded-md border bg-muted/20 overflow-hidden shrink-0">
          <button
            onClick={() => setShowDetectedNames(!showDetectedNames)}
            className="flex w-full items-center justify-between p-3 hover:bg-muted/40 transition-colors"
          >
            <h3 className="text-sm font-medium flex items-center gap-2">
              <SparklesIcon className="size-3.5 text-primary" />
              Tên nhận diện tự động (Bấm để {showDetectedNames ? 'ẩn' : 'hiện'})
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground uppercase">{detectedNames.length} tên</span>
              <ChevronDownIcon className={cn("size-4 transition-transform", showDetectedNames && "rotate-180")} />
            </div>
          </button>

          {showDetectedNames && (
            <div className="p-4 border-t bg-background/50">
              <ConvertDetectedNames
                detectedNames={detectedNames}
                onDismiss={handleConvert}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Training Suggestions ── */}
      {(trainingSuggestions.length > 0 || batchProgress) && (
        <div className="mt-4 rounded-md border border-primary/30 bg-primary/5 p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold flex items-center gap-2 text-primary">
                <ClipboardListIcon className="size-4" />
                Kết quả huấn luyện AI {batchProgress && `(Khối hiện tại: ${batchProgress.current}/${batchProgress.total})`}
              </h3>
              <p className="text-[10px] text-muted-foreground mt-1">
                Tiến độ: {lastProcessedIndex.toLocaleString()} / {input.length.toLocaleString()} ký tự
                {lastProcessedIndex >= input.length && " (Hoàn thành)"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="auto-next" className="text-[10px] cursor-pointer">Tự động quét tiếp</Label>
                <Switch
                  id="auto-next"
                  checked={isAutoNext}
                  onCheckedChange={setIsAutoNext}
                  className="scale-75"
                />
              </div>
              {isTraining && (
                <Badge variant="secondary" className="animate-pulse">Đang quét...</Badge>
              )}
            </div>
          </div>

          {Array.isArray(trainingSuggestions) && trainingSuggestions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-2">
              {trainingSuggestions.map((s, idx) => (
                <div key={idx} className="flex flex-col gap-2 p-3 rounded-lg bg-background border shadow-sm hover:border-primary/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-bold">{s.chinese}</span>
                      <ArrowRightLeftIcon className="size-3 text-muted-foreground" />
                      <span className="text-sm text-primary font-medium">{s.vietnamese}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] capitalize h-5">{s.category}</Badge>
                  </div>

                  {s.context_zh && (
                    <div className="mt-1 space-y-1 rounded border bg-muted/30 p-2 text-[11px]">
                      <div className="flex gap-2">
                        <span className="shrink-0 font-bold text-muted-foreground/60">Gốc:</span>
                        <span className="font-mono">{s.context_zh}</span>
                      </div>
                      <div className="flex gap-2 border-t border-muted/50 pt-1">
                        <span className="shrink-0 font-bold text-red-500/60">Hiện tại:</span>
                        <span className="text-muted-foreground italic line-through decoration-red-500/30">{s.context_vi_before}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="shrink-0 font-bold text-green-500/60">Đề xuất:</span>
                        <span className="text-foreground font-medium">{s.context_vi_after}</span>
                      </div>
                    </div>
                  )}

                  <p className="text-[10px] text-muted-foreground line-clamp-2 italic px-1">"{s.reason}"</p>
                  <Button size="xs" className="w-full mt-1" onClick={() => handleAddTrainingSuggestion(s)}>
                    Chấp nhận & Thêm vào từ điển
                  </Button>
                </div>
              ))}
            </div>
          ) : isTraining ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <LoaderIcon className="size-8 animate-spin text-primary/40" />
              <p className="text-sm text-muted-foreground">Đang phân tích văn bản để tìm lỗi dịch...</p>
            </div>
          ) : null}
        </div>
      )}

      {/* ── Manual convert button ── */}
      {!liveMode && (
        <div className="mt-4 flex shrink-0 justify-center">
          <Button
            size="lg"
            onClick={handleConvert}
            disabled={isConverting || !input.trim() || (!useSTVMode && !engineReady)}
          >
            <ArrowRightLeftIcon className="mr-2 size-4" />
            {isConverting
              ? (useSTVMode ? "Đang dịch qua STV..." : "Đang convert...")
              : (!useSTVMode && !engineReady)
                ? "Đang tải từ điển..."
                : useSTVMode
                  ? "Dịch qua STV"
                  : "Convert"}
          </Button>
        </div>
      )}

      {/* ── Extraction Dialog ── */}
      <Dialog open={extractDialogOpen} onOpenChange={setExtractDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bổ sung từ điển tự động</DialogTitle>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto space-y-2 py-4">
            <p className="text-xs text-muted-foreground mb-2">
              Các tên sau đây được phát hiện trong văn bản. Hãy chọn những tên bạn muốn lưu vào từ điển chính thức.
            </p>
            {extractedNames.map((n, idx) => (
              <div key={idx} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 border">
                <Checkbox
                  id={`name-${idx}`}
                  checked={selectedNames.has(n.chinese)}
                  onCheckedChange={(checked) => {
                    const next = new Set(selectedNames);
                    if (checked) next.add(n.chinese);
                    else next.delete(n.chinese);
                    setSelectedNames(next);
                  }}
                />
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <div className="text-sm font-mono">{n.chinese}</div>
                  <div className="text-sm">{n.vietnamese}</div>
                </div>
                <div className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary uppercase font-bold">
                  {n.category || "NV"}
                </div>
              </div>
            ))}
            {extractedNames.length === 0 && (
              <p className="text-center py-8 text-muted-foreground">Không tìm thấy tên mới nào.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setExtractDialogOpen(false)}>Hủy</Button>
            <Button onClick={handleImportSelected} disabled={selectedNames.size === 0}>
              Lưu {selectedNames.size} tên vào từ điển
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
