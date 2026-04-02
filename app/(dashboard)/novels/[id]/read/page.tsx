"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Volume2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useNovel, useChapters, useScenes } from "@/lib/hooks";
import { ReaderPanel } from "@/components/reader/reader-panel";
import { SentenceRenderer } from "@/components/reader/sentence-renderer";
import { useReaderPanel } from "@/lib/stores/reader-panel";

function ChapterContent({
  chapterId,
  readerOpen,
}: {
  chapterId: string;
  readerOpen: boolean;
}) {
  const scenes = useScenes(chapterId);
  if (!scenes) return <Skeleton className="h-64 w-full" />;
  const text = scenes.map((s) => s.content).join("\n\n");

  if (!text) {
    return (
      <div className="prose prose-sm max-w-none whitespace-pre-wrap dark:prose-invert">
        <p className="italic text-muted-foreground">
          Chương này chưa có nội dung.
        </p>
      </div>
    );
  }

  if (readerOpen) {
    return (
      <div className="prose prose-sm max-w-none dark:prose-invert">
        <SentenceRenderer content={text} />
      </div>
    );
  }

  return (
    <div className="prose prose-sm max-w-none whitespace-pre-wrap dark:prose-invert">
      {text}
    </div>
  );
}

/** Collect the full text content for a chapter from its scenes */
function useChapterText(chapterId: string | undefined) {
  const scenes = useScenes(chapterId ?? "");
  if (!scenes || !chapterId) return "";
  return scenes.map((s) => s.content).join("\n\n");
}

export default function ReadingView() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const novel = useNovel(id);
  const chapters = useChapters(id);

  const initialChapter = parseInt(searchParams.get("chapter") ?? "0", 10);
  const [currentIndex, setCurrentIndex] = useState(initialChapter);

  const isReaderOpen = useReaderPanel((s) => s.isOpen);

  // Clamp index to valid range
  const clampedIndex = chapters
    ? Math.min(currentIndex, Math.max(0, chapters.length - 1))
    : currentIndex;

  const chapter = chapters?.[clampedIndex];
  const hasPrev = clampedIndex > 0;
  const hasNext = chapters ? clampedIndex < chapters.length - 1 : false;

  // Get the full chapter text for the ReaderPanel
  const chapterText = useChapterText(chapter?.id);

  // Stop TTS playback when switching chapters
  const handleChapterChange = useCallback((newIndex: number) => {
    useReaderPanel.getState().stop();
    setCurrentIndex(newIndex);
  }, []);

  // Register auto-advance callback: when TTS finishes, move to next chapter and continue reading
  useEffect(() => {
    if (hasNext) {
      useReaderPanel.getState().setOnFinishChapter(() => {
        useReaderPanel.getState().setAutoPlayOnLoad(true);
        handleChapterChange(clampedIndex + 1);
      });
    } else {
      useReaderPanel.getState().setOnFinishChapter(undefined);
    }
    return () => {
      useReaderPanel.getState().setOnFinishChapter(undefined);
    };
  }, [hasNext, clampedIndex, handleChapterChange]);

  if (novel === undefined || !chapters) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-8">
        <Skeleton className="mb-4 h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </main>
    );
  }

  if (!novel) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-8">
        <p className="text-muted-foreground">Không tìm thấy tiểu thuyết.</p>
      </main>
    );
  }

  return (
    <div className="flex h-[calc(100svh-3rem)] overflow-hidden">
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden px-6 py-4">
        {/* Header */}
        <div className="mb-4 flex shrink-0 items-center gap-3">
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href={`/novels/${id}`}>
              <ArrowLeftIcon className="size-4" />
            </Link>
          </Button>
          <span className="text-sm font-medium text-muted-foreground">
            {novel.title}
          </span>
          <NativeSelect
            className="ml-auto w-48"
            value={clampedIndex}
            onChange={(e) => handleChapterChange(Number(e.target.value))}
          >
            {chapters.map((ch, i) => (
              <NativeSelectOption key={ch.id} value={i}>
                {i + 1}. {ch.title}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => useReaderPanel.getState().toggle()}
                  className={isReaderOpen ? "bg-muted" : undefined}
                  aria-label="Đọc truyện"
                >
                  <Volume2Icon className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Đọc truyện</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Chapter content */}
        {chapter && (
          <ScrollArea className="min-h-0 flex-1">
            <div className="mx-auto max-w-3xl pb-12">
              <h2 className="mb-6 text-center font-heading text-2xl font-bold">
                {chapter.title}
              </h2>
              <ChapterContent
                chapterId={chapter.id}
                readerOpen={isReaderOpen}
              />
            </div>
          </ScrollArea>
        )}

        {/* Navigation */}
        <div className="flex shrink-0 items-center justify-between border-t pt-3">
          <Button
            variant="outline"
            size="sm"
            disabled={!hasPrev}
            onClick={() => handleChapterChange(currentIndex - 1)}
          >
            <ChevronLeftIcon className="mr-1 size-4" />
            Trước
          </Button>
          <span className="text-xs text-muted-foreground">
            {clampedIndex + 1} / {chapters.length}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasNext}
            onClick={() => handleChapterChange(currentIndex + 1)}
          >
            Tiếp
            <ChevronRightIcon className="ml-1 size-4" />
          </Button>
        </div>
      </main>

      {/* TTS Reader Panel — sticky, fixed to viewport height */}
      <ReaderPanel content={chapterText} />
    </div>
  );
}
