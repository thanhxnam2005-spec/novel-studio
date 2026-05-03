"use client";

import { ConvertConfig } from "@/components/convert-config";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { TextCompareEditor } from "@/components/ui/text-compare-editor";
import { useDebouncedValue } from "@/lib/hooks/use-debounce";
import { useReaderPanel } from "@/lib/stores/reader-panel";
import { getMergedNameDict, bulkImportNameEntries } from "@/lib/hooks/use-name-entries";
import { useAIProviders, useAIModels } from "@/lib/hooks/use-ai-providers";
import { getModel } from "@/lib/ai/provider";
import { type TrainingSuggestion } from "@/lib/ai/training-tools";
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
  BookTextIcon,
  CheckIcon,
  ChevronDownIcon,
  ClipboardCopyIcon,
  ClipboardListIcon,
  FileUpIcon,
  LoaderIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
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
import { DictionaryManagement } from "@/components/dictionary-management";
import { useMergedNameEntries } from "@/lib/hooks/use-name-entries";
import { convertText, useQTEngineReady } from "@/lib/hooks/use-qt-engine";
import { useConvertSettings } from "@/lib/hooks/use-convert-settings";

export default function ConvertPage() {
  const store = useTrainingStore();
  const { handleTrain, stopTraining } = useBackgroundTraining();
  const qtReady = useQTEngineReady();
  const convertSettings = useConvertSettings();

  const {
    input = "", setInput,
    output = "", setOutput,
    isTraining = false,
    trainingSuggestions = [], setTrainingSuggestions,
    batchProgress = null,
    lastProcessedIndex = 0, setLastProcessedIndex,
    isAutoNext = false, setIsAutoNext
  } = store;

  const [isScanning, setIsScanning] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [liveMode, setLiveMode] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [useSTVMode, setUseSTVMode] = useState(true);
  const [stvProgress, setSTVProgress] = useState<string | null>(null);
  const [dictPopoverOpen, setDictPopoverOpen] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const stvAbortRef = useRef<AbortController | null>(null);
  const seqRef = useRef(0);

  const mergedEntries = useMergedNameEntries("global");
  
  // Quét các từ điển đang xuất hiện trong văn bản
  const activeEntries = useMemo(() => {
    if (!input || !mergedEntries) return [];
    return mergedEntries.filter(e => input.includes(e.chinese)).slice(0, 20);
  }, [input, mergedEntries]);

  const debouncedInput = useDebouncedValue(input, 500);

  const handleConvert = useCallback(async () => {
    if (!input.trim()) {
      setOutput("");
      return;
    }
    const seq = ++seqRef.current;
    setIsConverting(true);
    setSTVProgress(null);
    stvAbortRef.current?.abort();
    
    try {
      const controller = new AbortController();
      stvAbortRef.current = controller;
      
      // Lấy từ điển hiện tại
      const dict = await getMergedNameDict();
      
      const result = await stvTranslate(input, {
        signal: controller.signal,
        dictionary: dict,
        onProgress: (p) => {
          if (seqRef.current !== seq) return;
          setOutput(p.partialResult);
          setSTVProgress(`Đang dịch: ${p.currentChunk + 1}/${p.totalChunks} phần`);
        },
      });
      
      if (seqRef.current === seq) {
        setOutput(result);
        setSTVProgress(null);
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
  }, [input, setOutput]);

  useEffect(() => {
    if (liveMode) {
      handleConvert();
    }
  }, [debouncedInput, liveMode, handleConvert]);

  const handleQuickScan = useCallback(async () => {
    if (!input.trim()) return;
    setIsScanning(true);
    try {
      // Thực hiện convert giả định bằng bộ máy QT cục bộ để bóc tách từ điển
      const result = await convertText(input, {
        options: {
          ...convertSettings,
          autoDetectNames: true,
          nameDetectMinFrequency: 1, // Quét triệt để
          maxPhraseLength: 10,
        }
      });
      
      // Thu thập tất cả các đoạn đã được dịch (không phải unknown hoặc phienam thuần túy)
      const recognizedEntries = new Map<string, string>();
      
      if (result.segments) {
        for (const seg of result.segments) {
          // Chỉ lấy các từ được nhận diện từ các nguồn từ điển (novel, global, qt, vietphrase, luatnhan)
          if (seg.source !== "unknown" && seg.source !== "phienam" && seg.original.length > 1) {
            recognizedEntries.set(seg.original, seg.translated);
          }
        }
      }

      // Bổ sung thêm các tên tự động nhận diện nếu có
      if (result.detectedNames) {
        for (const n of result.detectedNames) {
          recognizedEntries.set(n.chinese, n.vietnamese);
        }
      }
      
      if (recognizedEntries.size > 0) {
        const entriesToImport = Array.from(recognizedEntries.entries()).map(([chinese, vietnamese]) => ({
          chinese,
          vietnamese
        }));
        
        // Tự động lưu toàn bộ vào từ điển chung (Global)
        const importResult = await bulkImportNameEntries("global", entriesToImport, "khác", "skip");
        
        toast.success(`Đã quét toàn bộ! Tự động thêm ${importResult.added} cụm từ mới vào bộ quản lý.`);
        setDictPopoverOpen(true); // Tự động mở bảng quản lý
        
        if (importResult.skipped > 0) {
          toast.info(`${importResult.skipped} cụm từ đã tồn tại.`);
        }
      } else {
        toast.info("Không tìm thấy cụm từ nào mới trong văn bản");
      }
    } catch (err) {
      toast.error("Lỗi khi quét toàn bộ từ điển: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setIsScanning(false);
    }
  }, [input, convertSettings]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setInput(content);
    };
    reader.readAsText(file);
  };

  const handleRead = useCallback(() => {
    if (!output.trim()) return;
    useReaderPanel.getState().loadText(output, "Kết quả convert");
  }, [output]);

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
  }, []);

  const handleAddTrainingSuggestion = async (s: TrainingSuggestion) => {
    try {
      await bulkImportNameEntries("global", [{ chinese: s.chinese, vietnamese: s.vietnamese }], s.category, "replace");
      setTrainingSuggestions(trainingSuggestions.filter(item => item.chinese !== s.chinese));
      toast.success(`Đã thêm "${s.chinese}" vào Từ điển tên chung`);
    } catch {
      toast.error("Lưu thất bại");
    }
  };

  return (
    <main className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden px-6 py-4">
      {/* ── Header ── */}
      <div className="mb-4 flex shrink-0 items-start justify-between flex-col sm:flex-row gap-2">
        <div>
          <h1 className="font-serif text-2xl font-bold">Convert nhanh</h1>
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

          <div className="flex items-center gap-2 border-l pl-4 mr-2">
            <Switch
              id="live-mode"
              checked={liveMode}
              onCheckedChange={setLiveMode}
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

          <div className="flex items-center gap-1">
            {isConverting && (
              <LoaderIcon className="size-4 animate-spin text-muted-foreground mr-2" />
            )}
            
            <Button
              size="sm"
              variant="outline"
              onClick={handleQuickScan}
              disabled={isScanning || !input || !qtReady}
              className="border-emerald-500/30 bg-emerald-500/5 text-emerald-600 hover:bg-emerald-500/10"
            >
              {isScanning ? (
                <LoaderIcon className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <SearchIcon className="mr-1.5 size-3.5" />
              )}
              Quét toàn bộ từ điển
            </Button>

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
                <SparklesIcon className="mr-1.5 size-3.5" />
              )}
              {lastProcessedIndex > 0 ? "Tiếp tục huấn luyện AI" : "Huấn luyện AI"}
            </Button>

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

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <SettingsIcon className="mr-1.5 size-3.5" />
                  Cài đặt
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <ConvertConfig />
              </PopoverContent>
            </Popover>
          </div>


        </div>
      </div>

      {/* ── Dictionary Bar (Thanh từ điển bên trên) ── */}
      <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <div className="flex shrink-0 items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-r pr-2">
          <BookTextIcon className="size-3" />
          Từ điển & Gợi ý:
        </div>
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
          {/* 1. Hiển thị các từ ĐÃ CÓ trong từ điển */}
          {activeEntries.map((entry) => (
            <Badge
              key={entry.id}
              variant="secondary"
              className="px-2 py-0.5 text-[10px] font-medium whitespace-nowrap border-primary/20 bg-primary/5"
            >
              <span className="text-primary mr-1">{entry.chinese}</span>
              <span className="opacity-50">→</span>
              <span className="ml-1">{entry.vietnamese}</span>
            </Badge>
          ))}

          {/* 2. Hiển thị các GỢI Ý từ AI vừa quét được */}
          {trainingSuggestions.map((s, idx) => (
            <Badge
              key={`suggest-${idx}`}
              variant="outline"
              className="px-2 py-0.5 text-[10px] font-medium whitespace-nowrap cursor-pointer hover:bg-primary/10 border-dashed border-primary/50 animate-in fade-in zoom-in duration-300"
              onClick={() => handleAddTrainingSuggestion(s)}
              title="Click để thêm vào từ điển"
            >
              <SparklesIcon className="size-2.5 mr-1 text-primary" />
              <span className="font-bold">{s.chinese}</span>
              <span className="mx-1 opacity-50">:</span>
              <span>{s.vietnamese}</span>
              <PlusIcon className="size-2.5 ml-1.5 opacity-50" />
            </Badge>
          ))}

          {activeEntries.length === 0 && trainingSuggestions.length === 0 && (
            <span className="text-[10px] text-muted-foreground italic">Chưa phát hiện từ điển hoặc gợi ý...</span>
          )}
        </div>
        <div className="ml-auto pl-2 border-l">
           <Popover open={dictPopoverOpen} onOpenChange={setDictPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="link" size="xs" className="h-auto p-0 text-[10px] uppercase font-bold text-primary">
                  Quản lý
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="end">
                <div className="max-h-[500px] overflow-y-auto custom-scrollbar p-3">
                   <DictionaryManagement compact />
                </div>
              </PopoverContent>
            </Popover>
        </div>
      </div>

      {/* ── Side-by-side editor ── */}
      <div className="flex-1 min-h-[600px]" ref={scrollContainerRef}>
        <TextCompareEditor
          panelWrapperClassName="h-[calc(100vh-280px)] min-h-[500px]"
          leftValue={input}
          rightValue={output}
          onChange={editMode ? setOutput : (val) => setInput(sify(val))}
          editableSide={editMode ? "right" : "left"}
          storageKey="convert-stv"
          leftLabel="Văn bản gốc (Trung)"
          rightLabel={editMode ? "Kết quả (Có thể sửa)" : "Kết quả (Chỉ đọc)"}
        />
      </div>

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
              {isTraining && (
                <Button variant="outline" size="xs" onClick={stopTraining}>Dừng</Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2">
            {trainingSuggestions.map((s, idx) => (
              <div key={idx} className="flex flex-col gap-2 p-3 rounded-lg bg-background border shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-bold">{s.chinese}</span>
                    <ArrowRightLeftIcon className="size-3 text-muted-foreground" />
                    <span className="text-sm text-primary font-medium">{s.vietnamese}</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] capitalize h-5">{s.category}</Badge>
                </div>
                <p className="text-[10px] text-muted-foreground line-clamp-2 italic">"{s.reason}"</p>
                <Button size="xs" className="w-full mt-1" onClick={() => handleAddTrainingSuggestion(s)}>
                  Thêm vào từ điển
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
