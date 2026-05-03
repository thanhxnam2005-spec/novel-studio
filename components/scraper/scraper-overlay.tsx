"use client";

import { useScraperStore } from "@/lib/stores/scraper";
import { 
  PauseIcon, 
  PlayIcon, 
  XIcon, 
  Loader2Icon, 
  ChevronUpIcon, 
  ChevronDownIcon,
  CheckCircle2Icon,
  AlertTriangleIcon
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export function ScraperOverlay() {
  const { 
    isBackground, 
    isPaused, 
    progress, 
    scrapedChapters, 
    isLoading,
    pauseScraping,
    resumeScraping,
    abortScraping
  } = useScraperStore();

  const [isMinimized, setIsMinimized] = useState(false);

  if (!isBackground) return null;

  const percentage = progress.total > 0 
    ? Math.round((progress.completed / progress.total) * 100) 
    : 0;

  const warnCount = scrapedChapters.filter(ch => ch.warning).length;
  const isFinished = progress.completed === progress.total && progress.total > 0;

  return (
    <div 
      className={cn(
        "fixed bottom-4 right-4 z-[100] w-72 rounded-xl border bg-background shadow-2xl transition-all duration-300",
        isMinimized ? "h-12" : "h-auto"
      )}
    >
      {/* Header */}
      <div className="flex h-12 items-center justify-between px-4 border-b">
        <div className="flex items-center gap-2 overflow-hidden">
          {isFinished ? (
            <CheckCircle2Icon className="size-4 text-green-500 shrink-0" />
          ) : (
            <Loader2Icon className={cn("size-4 text-primary shrink-0", !isPaused && "animate-spin")} />
          )}
          <span className="text-xs font-semibold truncate">
            {isFinished ? "Hoàn tất tải" : isPaused ? "Đang tạm dừng" : "Đang tải nền..."}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon-xs" 
            onClick={() => setIsMinimized(!isMinimized)}
          >
            {isMinimized ? <ChevronUpIcon className="size-3.5" /> : <ChevronDownIcon className="size-3.5" />}
          </Button>
          {!isFinished && (
            <Button 
              variant="ghost" 
              size="icon-xs" 
              onClick={abortScraping}
              className="text-muted-foreground hover:text-destructive"
            >
              <XIcon className="size-3.5" />
            </Button>
          )}
          {isFinished && (
            <Button 
              variant="ghost" 
              size="icon-xs" 
              onClick={() => useScraperStore.getState().reset()}
            >
              <XIcon className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Body */}
      {!isMinimized && (
        <div className="p-4 space-y-3">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{progress.completed} / {progress.total} chương</span>
            <span className="font-medium text-foreground">{percentage}%</span>
          </div>
          <Progress value={percentage} className="h-1.5" />
          
          <div className="space-y-1">
            <p className="text-[11px] font-medium truncate">
              {progress.current || "Đang kết nối..."}
            </p>
            {warnCount > 0 && (
              <div className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                <AlertTriangleIcon className="size-3" />
                <span>{warnCount} chương lỗi nhẹ</span>
              </div>
            )}
          </div>

          {!isFinished && (
            <div className="flex gap-2 pt-1">
              {isPaused ? (
                <Button 
                  className="flex-1 h-8 text-xs gap-1.5" 
                  onClick={resumeScraping}
                >
                  <PlayIcon className="size-3" /> Tiếp tục
                </Button>
              ) : (
                <Button 
                  variant="secondary" 
                  className="flex-1 h-8 text-xs gap-1.5" 
                  onClick={pauseScraping}
                >
                  <PauseIcon className="size-3" /> Tạm dừng
                </Button>
              )}
            </div>
          )}
          
          {isFinished && (
            <Button 
              variant="outline" 
              className="w-full h-8 text-xs" 
              onClick={() => useScraperStore.getState().reset()}
            >
              Đóng
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
