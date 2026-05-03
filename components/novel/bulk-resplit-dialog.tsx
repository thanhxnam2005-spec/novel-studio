"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CHAPTER_PRESETS, parseCustomRegex, splitChapters } from "@/lib/import";
import { db, type Chapter } from "@/lib/db";
import { Loader2Icon, ScissorsIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

export function BulkResplitDialog({
  open,
  onOpenChange,
  novelId,
  chapterIds,
  chapters,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  novelId: string;
  chapterIds: string[];
  chapters: Chapter[];
}) {
  const [step, setStep] = useState<"config" | "processing">("config");
  const [selectedPreset, setSelectedPreset] = useState<string>("vietnamese");
  const [customRegex, setCustomRegex] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleResplit = useCallback(async () => {
    let pattern: RegExp | null = null;
    if (useCustom) {
      pattern = parseCustomRegex(customRegex);
    } else {
      const preset = CHAPTER_PRESETS[selectedPreset];
      if (preset) pattern = new RegExp(preset.pattern.source, preset.pattern.flags);
    }

    if (!pattern) {
      toast.error("Biểu thức regex không hợp lệ");
      return;
    }

    setIsProcessing(true);
    setStep("processing");

    try {
      // 1. Get all chapters and their scenes
      const selectedChapters = chapters
        .filter((c) => chapterIds.includes(c.id))
        .sort((a, b) => a.order - b.order);

      const chapterIdsSet = new Set(chapterIds);
      const allScenes = await db.scenes
        .where("novelId")
        .equals(novelId)
        .toArray();
      
      const selectedScenes = allScenes
        .filter(s => chapterIdsSet.has(s.chapterId) && s.isActive === 1)
        .sort((a, b) => {
           const chA = selectedChapters.find(c => c.id === a.chapterId);
           const chB = selectedChapters.find(c => c.id === b.chapterId);
           return (chA?.order ?? 0) - (chB?.order ?? 0);
        });

      // 2. Merge content
      const mergedContent = selectedScenes.map(s => s.content).join("\n\n");

      // 3. Split by new pattern
      const newChapters = splitChapters(mergedContent, pattern);

      if (newChapters.length === 0) {
        toast.error("Không tìm thấy chương nào với mẫu đã chọn");
        setIsProcessing(false);
        setStep("config");
        return;
      }

      // 4. Update database
      await db.transaction("rw", [db.chapters, db.scenes], async () => {
        // Delete old chapters and their scenes
        await db.chapters.bulkDelete(chapterIds);
        await db.scenes.where("chapterId").anyOf(chapterIds).delete();

        // Create new chapters starting from the first selected chapter's order
        const startOrder = Math.min(...selectedChapters.map(c => c.order));
        const now = new Date();

        for (let i = 0; i < newChapters.length; i++) {
          const ch = newChapters[i];
          const chapterId = crypto.randomUUID();
          
          await db.chapters.add({
            id: chapterId,
            novelId,
            title: ch.title,
            order: startOrder + i,
            createdAt: now,
            updatedAt: now,
          });

          await db.scenes.add({
            id: crypto.randomUUID(),
            chapterId,
            novelId,
            title: ch.title,
            content: ch.content,
            order: 0,
            wordCount: ch.wordCount,
            version: 0,
            versionType: "manual",
            isActive: 1,
            createdAt: now,
            updatedAt: now,
          });
        }

        // Shift subsequent chapters' order if needed
        const diff = newChapters.length - selectedChapters.length;
        if (diff !== 0) {
          const subsequentChapters = chapters.filter(c => !chapterIdsSet.has(c.id) && c.order > startOrder);
          for (const ch of subsequentChapters) {
             await db.chapters.update(ch.id, { order: ch.order + diff });
          }
        }
      });

      toast.success(`Đã tách lại thành ${newChapters.length} chương mới`);
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Lỗi: " + err.message);
    } finally {
      setIsProcessing(false);
      setStep("config");
    }
  }, [novelId, chapterIds, chapters, selectedPreset, customRegex, useCustom, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScissorsIcon className="size-5 text-primary" />
            Gộp & Tách lại chương
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-xs text-muted-foreground">
            Hệ thống sẽ gộp nội dung của {chapterIds.length} chương đã chọn, sau đó sử dụng Regex để tách lại thành các chương mới dựa trên tiêu đề tìm thấy.
          </p>

          <div className="space-y-3">
            <Label className="text-xs">Mẫu tách chương mới</Label>
            <div className="grid gap-2">
              {Object.entries(CHAPTER_PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => {
                    setSelectedPreset(key);
                    setUseCustom(false);
                  }}
                  className={`rounded-lg border p-2 text-left text-xs transition-colors ${
                    !useCustom && selectedPreset === key
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <span className="font-bold">{preset.label}</span>
                  <span className="ml-2 text-muted-foreground">{preset.pattern.source}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-1">
               <input
                 type="checkbox"
                 id="resplit-custom"
                 checked={useCustom}
                 onChange={(e) => setUseCustom(e.target.checked)}
                 className="size-3.5 rounded border-border"
               />
               <Label htmlFor="resplit-custom" className="text-xs">Sử dụng regex tùy chỉnh</Label>
            </div>
            {useCustom && (
              <Input
                placeholder="Regex tiêu đề chương..."
                value={customRegex}
                onChange={(e) => setCustomRegex(e.target.value)}
                className="h-8 text-xs"
              />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            Hủy
          </Button>
          <Button onClick={handleResplit} disabled={isProcessing}>
            {isProcessing ? (
              <>
                <Loader2Icon className="mr-2 size-4 animate-spin" />
                Đang xử lý...
              </>
            ) : (
              "Bắt đầu Tách lại"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
