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
import { bulkImportNameEntries } from "@/lib/hooks/use-name-entries";
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
import { toast } from "sonner";

export default function ConvertPage() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [isConverting, setIsConverting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [liveMode, setLiveMode] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [detectedNames, setDetectedNames] = useState<DictPair[]>([]);
  const [segments, setSegments] = useState<ConvertSegment[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractDialogOpen, setExtractDialogOpen] = useState(false);
  const [extractedNames, setExtractedNames] = useState<any[]>([]);
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());
  const [isTraining, setIsTraining] = useState(false);
  const [trainingSuggestions, setTrainingSuggestions] = useState<TrainingSuggestion[]>([]);
  const [newlyAddedToDict, setNewlyAddedToDict] = useState<any[]>([]);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [lastProcessedIndex, setLastProcessedIndex] = useState(0);
  const [isAutoNext, setIsAutoNext] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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

  const handleConvert = useCallback(async () => {
    if (!input.trim()) return;
    const seq = ++seqRef.current;
    setIsConverting(true);
    try {
      const result = await convertText(input, { options: mergedOptions });
      if (seqRef.current === seq) {
        setOutput(result.plainText);
        setSegments(result.segments);
        setDetectedNames(result.detectedNames ?? []);
      }
    } catch (err) {
      toast.error(
        "Lỗi convert: " + (err instanceof Error ? err.message : String(err)),
      );
    } finally {
      if (seqRef.current === seq) setIsConverting(false);
    }
  }, [input, mergedOptions]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setInput(text);
      setLastProcessedIndex(0);
      toast.success(`Đã nhập ${file.name}`);
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  useEffect(() => {
    if (!liveMode || !engineReady) return;
    if (!debouncedInput.trim()) {
      setOutput("");
      return;
    }
    const seq = ++seqRef.current;
    setIsConverting(true);
    convertText(debouncedInput, { options: mergedOptions })
      .then((result) => {
        if (seqRef.current === seq) {
          setOutput(result.plainText);
          setSegments(result.segments);
          setDetectedNames(result.detectedNames ?? []);
        }
      })
      .catch((err) => {
        if (seqRef.current === seq)
          toast.error(
            "Lỗi convert: " +
              (err instanceof Error ? err.message : String(err)),
          );
      })
      .finally(() => {
        if (seqRef.current === seq) setIsConverting(false);
      });
  }, [liveMode, debouncedInput, mergedOptions, engineReady]);

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

  const handleTrain = async (startIndex: number = 0) => {
    if (!input.trim()) return;
    
    const providerId = convertOptions.trainingProviderId;
    const modelId = convertOptions.trainingModelId;
    
    if (!providerId || !modelId) {
      toast.error("Vui lòng chọn Nhà cung cấp và Model AI trong phần Cài đặt để huấn luyện.");
      return;
    }

    const provider = providers?.find(p => p.id === providerId);
    if (!provider) {
      toast.error("Không tìm thấy cấu hình nhà cung cấp AI.");
      return;
    }

    setIsTraining(true);
    setTrainingSuggestions([]);
    
    const BATCH_SIZE = 10000;
    const totalChars = input.length;
    const numBatches = Math.ceil((totalChars - startIndex) / BATCH_SIZE);
    
    try {
      const model = await getModel(provider, modelId);
      const { generateText } = await import("ai");

      const systemPrompt = `
<role>
Bạn là dịch giả văn học chuyên nghiệp, chuyên dịch tiểu thuyết Trung Quốc sang Tiếng Việt. Nhiệm vụ của bạn là tạo bản dịch tự nhiên, trung thành và nhất quán.
</role>

<task>
Dịch chương truyện được cung cấp sang Tiếng Việt. Ưu tiên sự tự nhiên và mượt mà của ngôn ngữ đích trong khi giữ trung thành với nội dung gốc.
</task>

<translation_rules>
  <rule id="structure">Giữ nguyên cấu trúc đoạn văn, định dạng và dấu ngắt dòng của bản gốc.</rule>
  <rule id="proper_names">Tên riêng: sử dụng âm Hán-Việt (ví dụ: Vương Lâm, không phải Rừng Vương). Nhất quán cách dịch xuyên suốt chương.</rule>
  <rule id="style">Sử dụng văn phong tiểu thuyết mạng Trung Quốc (Tiên Hiệp/Ngôn Tình), ưu tiên các từ Hán-Việt trang trọng cho bối cảnh tu tiên/cổ đại. Tránh dùng từ ngữ quá hiện đại hoặc bình dân thuần Việt.</rule>
  <rule id="naturalness">Văn phong mượt mà nhưng vẫn giữ được "chất" truyện dịch, tránh dịch word-by-word.</rule>
  <rule id="dialogue_register">Giữ đúng ngữ điệu: lời thoại trang trọng (ví dụ: "Tiền bối", "Vãn bối") giữ đúng sắc thái.</rule>
  <rule id="terminology">Thuật ngữ tu tiên (Linh khí, Trúc Cơ, Đan dược) phải dùng đúng từ Hán-Việt tiêu chuẩn.</rule>
  <rule id="fidelity">Không thêm, bớt, giải thích, hoặc chú thích nội dung gốc.</rule>
  <rule id="special_chars">Giữ nguyên các ký hiệu đặc biệt (★, ※, ─, v.v.).</rule>
</translation_rules>

<context_usage>Nếu được cung cấp ngữ cảnh về tên nhân vật, địa danh: sử dụng nhất quán theo ngữ cảnh đó.</context_usage>

<output_format>Chỉ trả về bản dịch hoàn chỉnh. Không kèm giải thích, ghi chú, hoặc bình luận.</output_format>`;

      for (let i = 0; i < numBatches; i++) {
        const currentStart = startIndex + i * BATCH_SIZE;
        const currentEnd = Math.min(currentStart + BATCH_SIZE, totalChars);
        setBatchProgress({ current: i + 1, total: numBatches });
        setLastProcessedIndex(currentEnd);
        
        const chunk = input.slice(currentStart, currentEnd);
        
        // Auto-scroll to current position
        if (scrollContainerRef.current) {
          const leftPanel = scrollContainerRef.current.querySelector('.overflow-y-auto, textarea');
          if (leftPanel) {
            const ratio = currentStart / totalChars;
            leftPanel.scrollTop = (leftPanel.scrollHeight - leftPanel.clientHeight) * ratio;
          }
        }
        
        // 1. Get QT result for this chunk
        const qtResult = await convertText(chunk, { options: mergedOptions });
        
        // 2. Get AI translation for this chunk
        const { text: aiTranslated } = await generateText({
          model,
          system: systemPrompt,
          prompt: `Văn bản gốc cần dịch:\n\n${chunk}`,
        });

        // 3. Run comparison
        const suggestions = await runTranslationTraining({
          model,
          sourceText: chunk,
          qtTranslated: qtResult.plainText,
          aiTranslated,
        });

        if (suggestions.length > 0) {
          setTrainingSuggestions(prev => [...prev, ...suggestions]);
          if (!isAutoNext) {
            toast.info(`Tìm thấy ${suggestions.length} đề xuất. Vui lòng kiểm tra.`);
            break; 
          }
        }
      }
      
      if (lastProcessedIndex >= totalChars) {
        toast.success(`Đã hoàn thành huấn luyện toàn bộ văn bản!`);
      }
    } catch (err) {
      toast.error("Huấn luyện thất bại: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsTraining(false);
      setBatchProgress(null);
    }
  };

  const handleAddTrainingSuggestion = async (s: TrainingSuggestion) => {
    try {
      await bulkImportNameEntries("global", [{ chinese: s.chinese, vietnamese: s.vietnamese }], s.category, "replace");
      setNewlyAddedToDict(prev => [...prev, { chinese: s.chinese, vietnamese: s.vietnamese, category: s.category }]);
      setTrainingSuggestions(prev => prev.filter(item => item.chinese !== s.chinese));
      toast.success(`Đã thêm "${s.chinese}" vào từ điển`);
      
      // Refresh engine dictionary and re-convert
      await refreshQTEngine();
      setTimeout(() => handleConvert(), 100);
    } catch {
      toast.error("Lưu thất bại");
    }
  };

  const handleExportNewDict = () => {
    if (newlyAddedToDict.length === 0) return;
    const text = newlyAddedToDict.map(e => `${e.chinese}=${e.vietnamese}`).join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `new-dict-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportSelected = async () => {
    const toImport = extractedNames.filter(n => selectedNames.has(n.chinese));
    if (toImport.length === 0) return;

    try {
      await bulkImportNameEntries("global", toImport, "nhân vật", "replace");
      toast.success(`Đã thêm ${toImport.length} tên vào từ điển`);
      setExtractDialogOpen(false);
      // Re-trigger conversion
      handleConvert();
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
            Dán văn bản tiếng Trung và convert sang tiếng Việt bằng từ điển QT.
            Không cần API key.
          </p>
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

          <div className="flex items-center gap-2">
            <Switch
              id="live-mode"
              checked={liveMode}
              onCheckedChange={setLiveMode}
              disabled={!engineReady}
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

          <Button
            variant="outline"
            size="sm"
            onClick={handleExtractNames}
            disabled={isExtracting || !input}
            className="hidden sm:flex"
          >
            {isExtracting ? (
              <LoaderIcon className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <SparklesIcon className="mr-1.5 size-3.5 text-primary" />
            )}
            Bổ sung từ điển
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleTrain(lastProcessedIndex)}
            disabled={isTraining || !input}
            className="hidden sm:flex border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
          >
            {isTraining ? (
              <LoaderIcon className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <RefreshCwIcon className="mr-1.5 size-3.5" />
            )}
            {lastProcessedIndex > 0 ? "Tiếp tục huấn luyện" : "Huấn luyện AI"}
          </Button>

          <input
            type="file"
            accept=".txt"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileUpload}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            title="Nhập văn bản từ file .txt"
          >
            <FileUpIcon className="mr-1.5 size-3.5" />
            Nhập File
          </Button>

          {lastProcessedIndex > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setLastProcessedIndex(0);
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
            <PopoverContent align="end" className="w-72">
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
          onChange={editMode ? setOutput : setInput}
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
        <div className="mt-3 shrink-0">
          <ConvertDetectedNames
            detectedNames={detectedNames}
            onDismiss={handleConvert}
          />
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
              {newlyAddedToDict.length > 0 && (
                <Button size="xs" variant="outline" onClick={handleExportNewDict} className="text-[10px] h-7">
                  <DownloadIcon className="mr-1.5 size-3" />
                  Tải từ điển mới ({newlyAddedToDict.length})
                </Button>
              )}
              {isTraining && (
                <Badge variant="secondary" className="animate-pulse">Đang quét...</Badge>
              )}
            </div>
          </div>
          
          {trainingSuggestions.length > 0 ? (
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
                  <p className="text-[11px] text-muted-foreground line-clamp-2 italic">"{s.reason}"</p>
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
            disabled={isConverting || !input.trim() || !engineReady}
          >
            <ArrowRightLeftIcon className="mr-2 size-4" />
            {isConverting
              ? "Đang convert..."
              : !engineReady
                ? "Đang tải từ điển..."
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
