"use client";

import { useCallback, useEffect } from "react";
import { ClipboardCheckIcon, PenLineIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useChapterTools } from "@/lib/stores/chapter-tools";
import { useAnalysisSettings, useChatSettings, useAIProvider } from "@/lib/hooks";
import { resolveChapterToolPrompts, DEFAULT_REVIEW_SYSTEM } from "@/lib/chapter-tools/prompts";
import { buildMinimalContext } from "@/lib/chapter-tools/context";
import {
  getChapterToolModelMissingMessage,
  resolveChapterToolModel,
  runChapterToolStream,
} from "@/lib/chapter-tools/stream-runner";
import { ToolConfig } from "./tool-config";
import { StreamingDisplay } from "./streaming-display";

export function ReviewMode({
  content,
  novelId,
  chapterId,
  renderFooter,
}: {
  content: string;
  novelId: string;
  chapterId: string;
  renderFooter: (node: React.ReactNode) => void;
}) {
  const isStreaming = useChapterTools((s) => s.isStreaming);
  const streamingContent = useChapterTools((s) => s.streamingContent);
  const completedResult = useChapterTools((s) => s.completedResult);
  const clearResult = useChapterTools((s) => s.clearResult);
  const setReviewResult = useChapterTools((s) => s.setReviewResult);
  const setActiveMode = useChapterTools((s) => s.setActiveMode);

  const settings = useAnalysisSettings();
  const chatSettings = useChatSettings();
  const provider = useAIProvider(chatSettings?.providerId);

  const handleReview = useCallback(async () => {
    if (!content.trim()) {
      toast.error("Không có nội dung để đánh giá");
      return;
    }

    const [model, minContext] = await Promise.all([
      resolveChapterToolModel(settings.reviewModel, provider, chatSettings),
      buildMinimalContext(novelId),
    ]);

    if (!model) {
      toast.error(getChapterToolModelMissingMessage(provider));
      return;
    }

    const prompts = resolveChapterToolPrompts(settings);
    const systemPrompt = minContext
      ? `${prompts.review}\n\n## Ngữ cảnh truyện:\n${minContext}`
      : prompts.review;

    await runChapterToolStream({
      model,
      system: systemPrompt,
      prompt: content,
      cancelMessage: "Đã hủy đánh giá.",
      errorPrefix: "Đánh giá thất bại",
      onComplete: (result) => setReviewResult(result, chapterId),
    });
  }, [content, novelId, chapterId, settings, provider, chatSettings, setReviewResult]);

  const handleRegenerate = useCallback(() => {
    clearResult();
    setReviewResult(null);
    handleReview();
  }, [clearResult, setReviewResult, handleReview]);

  // Push footer actions to the panel's fixed footer via effect
  useEffect(() => {
    if (isStreaming) {
      renderFooter(null);
      return;
    }
    if (completedResult) {
      renderFooter(
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRegenerate} className="flex-1">
            Đánh giá lại
          </Button>
          <Button size="sm" onClick={() => setActiveMode("edit")} className="flex-1">
            <PenLineIcon className="mr-1.5 size-3.5" />
            Chỉnh sửa theo đánh giá
          </Button>
        </div>,
      );
      return;
    }
    renderFooter(
      <Button onClick={handleReview} className="w-full">
        <ClipboardCheckIcon className="mr-1.5 size-3.5" />
        Đánh giá chương
      </Button>,
    );
    return () => renderFooter(null);
  }, [isStreaming, completedResult, handleRegenerate, handleReview, setActiveMode, renderFooter]);

  return (
    <div className="space-y-4">
      <ToolConfig
        modelKey="reviewModel"
        promptKey="reviewPrompt"
        defaultPrompt={DEFAULT_REVIEW_SYSTEM}
        modelLabel="Mô hình đánh giá"
        promptLabel="Prompt đánh giá"
      />

      {(isStreaming || completedResult) && (
        <StreamingDisplay
          content={isStreaming ? streamingContent : (completedResult ?? "")}
          isStreaming={isStreaming}
          renderAsMarkdown
        />
      )}
    </div>
  );
}
