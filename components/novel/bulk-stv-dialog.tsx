"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { db, type Chapter } from "@/lib/db";
import { updateChapter } from "@/lib/hooks/use-chapters";
import {
  createSceneVersion,
  ensureInitialVersion,
} from "@/lib/hooks/use-scene-versions";
import { updateScene } from "@/lib/hooks/use-scenes";
import { stvTranslate } from "@/lib/api/stv-translator";
import { getMergedNameDict } from "@/lib/hooks/use-name-entries";
import {
  CheckCircle2Icon,
  Loader2Icon,
  XCircleIcon,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

export function BulkSTVDialog({
  open,
  onOpenChange,
  novelId,
  chapterIds,
  chapters,
  mode = "translate",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  novelId: string;
  chapterIds: string[];
  chapters: Chapter[];
  mode?: "translate" | "convert";
}) {
  const [step, setStep] = useState<"config" | "processing" | "done">("config");
  const [processedCount, setProcessedCount] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const selectedChapters = chapters
    .filter((c) => chapterIds.includes(c.id))
    .sort((a, b) => a.order - b.order);

  const handleStart = useCallback(async () => {
    setStep("processing");
    setProcessedCount(0);
    setErrors([]);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const scenes = await db.scenes
        .where("novelId")
        .equals(novelId)
        .toArray();

      const dict = await getMergedNameDict(novelId);

      for (const ch of selectedChapters) {
        if (controller.signal.aborted) break;

        const scene = scenes.find((s) => s.chapterId === ch.id && s.isActive === 1);
        if (!scene?.content) {
          setProcessedCount((c) => c + 1);
          continue;
        }

        try {
          // Translate Title
          const translatedTitle = await stvTranslate(ch.title, { 
            signal: controller.signal,
            dictionary: dict 
          });
          
          // Translate Content
          const translatedContent = await stvTranslate(scene.content, { 
            signal: controller.signal,
            dictionary: dict
          });

          // Save results
          await ensureInitialVersion(scene.id, novelId, scene.content);
          await createSceneVersion(
            scene.id,
            novelId,
            `stv-${mode}`,
            translatedContent
          );
          await updateScene(scene.id, { content: translatedContent });
          await updateChapter(ch.id, { title: translatedTitle });

        } catch (err: any) {
          if (err.name === "AbortError") break;
          setErrors((prev) => [...prev, `Lỗi chương ${ch.order + 1}: ${err.message}`]);
        }

        setProcessedCount((c) => c + 1);
      }

      if (!controller.signal.aborted) {
        setStep("done");
      }
    } catch (err: any) {
      toast.error("Lỗi hệ thống: " + err.message);
      setStep("config");
    }
  }, [novelId, selectedChapters, mode]);

  const handleClose = () => {
    if (step === "processing") {
      abortRef.current?.abort();
    }
    setStep("config");
    setProcessedCount(0);
    setErrors([]);
    onOpenChange(false);
  };

  const progress = chapterIds.length > 0 ? (processedCount / chapterIds.length) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === "translate" ? "Dịch STV hàng loạt" : "Convert STV hàng loạt"}
          </DialogTitle>
        </DialogHeader>

        {step === "config" && (
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Sử dụng server STV để {mode === "translate" ? "dịch" : "convert"} <strong>{chapterIds.length}</strong> chương đã chọn.
              Quá trình này sẽ lưu phiên bản mới và cập nhật nội dung chương.
            </p>
            <Button onClick={handleStart} className="w-full">
              Bắt đầu
            </Button>
          </div>
        )}

        {step === "processing" && (
          <div className="space-y-4 py-6">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Loader2Icon className="size-4 animate-spin text-primary" />
                Đang xử lý...
              </span>
              <span className="font-medium">
                {processedCount} / {chapterIds.length}
              </span>
            </div>
            <Progress value={progress} className="h-2" />
            {errors.length > 0 && (
              <div className="max-h-32 overflow-y-auto rounded-md bg-destructive/10 p-2 text-[10px] text-destructive">
                {errors.map((err, i) => (
                  <div key={i}>{err}</div>
                ))}
              </div>
            )}
            <Button variant="outline" onClick={handleClose} className="w-full">
              Hủy bỏ
            </Button>
          </div>
        )}

        {step === "done" && (
          <div className="space-y-6 py-4 text-center">
            <div className="flex justify-center">
              {errors.length === chapterIds.length ? (
                <XCircleIcon className="size-12 text-destructive" />
              ) : (
                <CheckCircle2Icon className="size-12 text-emerald-500" />
              )}
            </div>
            <div>
              <p className="text-lg font-bold">
                {errors.length === 0 ? "Hoàn tất!" : "Đã xong (có lỗi)"}
              </p>
              <p className="text-sm text-muted-foreground">
                Đã xử lý xong {processedCount} chương.
                {errors.length > 0 && ` Gặp ${errors.length} lỗi.`}
              </p>
            </div>
            <Button onClick={handleClose} className="w-full">
              Đóng
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
