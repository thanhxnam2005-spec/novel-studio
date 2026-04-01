"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useChapterPlans,
  useChapters,
  useCharacters,
  useNovel,
  usePlotArcs,
} from "@/lib/hooks";
import { generateFromExisting } from "@/lib/writing/auto-generate";
import {
  AlertTriangleIcon,
  BookOpenIcon,
  CheckCircle2Icon,
  GlobeIcon,
  Loader2Icon,
  MapIcon,
  MessageSquareIcon,
  SkipForwardIcon,
  SparklesIcon,
  UsersIcon,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

type DashboardAction = "auto-generate" | "chat" | "skip";

export function NovelSetup({
  novelId,
  onActionAction,
}: {
  novelId: string;
  onActionAction: (action: DashboardAction, startStep?: string) => void;
}) {
  const novel = useNovel(novelId);
  const chapters = useChapters(novelId);
  const characters = useCharacters(novelId);
  const plotArcs = usePlotArcs(novelId);
  const chapterPlans = useChapterPlans(novelId);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genPhase, setGenPhase] = useState<string>("");
  const abortRef = useRef<AbortController | null>(null);

  const hasWorld = !!(novel?.worldOverview || novel?.factions?.length);
  const hasCharacters = (characters?.length ?? 0) > 0;
  const hasPlotArcs = (plotArcs?.length ?? 0) > 0;
  const hasChapterPlans = (chapterPlans?.length ?? 0) > 0;
  const hasChapters = (chapters?.length ?? 0) > 0;
  const hasEnoughForWriting = hasChapterPlans && hasPlotArcs;
  const hasPartialData = hasWorld || hasCharacters || hasChapters;

  const steps = [
    {
      key: "world",
      label: "Thế giới quan",
      icon: GlobeIcon,
      done: hasWorld,
      detail: hasWorld
        ? `${novel?.factions?.length ?? 0} thế lực, ${novel?.keyLocations?.length ?? 0} địa danh`
        : "Chưa có",
    },
    {
      key: "characters",
      label: "Nhân vật",
      icon: UsersIcon,
      done: hasCharacters,
      detail: hasCharacters ? `${characters?.length} nhân vật` : "Chưa có",
    },
    {
      key: "arcs",
      label: "Mạch truyện",
      icon: MapIcon,
      done: hasPlotArcs,
      detail: hasPlotArcs ? `${plotArcs?.length} mạch truyện` : "Chưa có",
    },
    {
      key: "plans",
      label: "Kế hoạch chương",
      icon: BookOpenIcon,
      done: hasChapterPlans,
      detail: hasChapterPlans ? `${chapterPlans?.length} chương` : "Chưa có",
    },
  ];

  const handleAutoGenerate = useCallback(async () => {
    setIsGenerating(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await generateFromExisting(novelId, controller.signal, (phase) =>
        setGenPhase(phase === "arcs" ? "mạch truyện" : "kế hoạch chương"),
      );
      toast.success("Đã tạo mạch truyện và kế hoạch chương");
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      toast.error(err instanceof Error ? err.message : "Lỗi không xác định");
    } finally {
      setIsGenerating(false);
      setGenPhase("");
    }
  }, [novelId]);

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto max-w-lg p-6 space-y-6">
        {/* Status cards */}
        <div>
          <h3 className="text-sm font-medium mb-3">Trạng thái dữ liệu</h3>
          <div className="grid grid-cols-2 gap-2">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <Card key={step.key} className="text-sm">
                  <CardHeader className="py-2 px-3">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 shrink-0" />
                      <CardTitle className="text-xs flex-1">
                        {step.label}
                      </CardTitle>
                      {step.done ? (
                        <CheckCircle2Icon className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertTriangleIcon className="h-4 w-4 text-yellow-500" />
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="px-3 pb-2 pt-0">
                    <p className="text-xs text-muted-foreground">
                      {step.detail}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Summary */}
        {hasChapters && (
          <div className="rounded-lg border bg-muted/50 p-3">
            <p className="text-sm">
              Truyện đã có <strong>{chapters?.length} chương</strong>
              {hasCharacters && (
                <>
                  , <strong>{characters?.length} nhân vật</strong>
                </>
              )}
              {hasWorld && <>, thế giới quan đã thiết lập</>}.
              {!hasPlotArcs &&
                " Cần tạo mạch truyện và kế hoạch chương để bắt đầu viết tự động."}
            </p>
          </div>
        )}

        {/* Actions */}
        {hasEnoughForWriting ? (
          <Button
            onClick={() => onActionAction("skip")}
            className="w-full"
            size="lg"
          >
            <SkipForwardIcon className="h-4 w-4 mr-2" />
            Bắt đầu viết
          </Button>
        ) : (
          <div className="space-y-2">
            <Button
              variant="default"
              onClick={() => onActionAction("chat")}
              className="w-full"
            >
              <MessageSquareIcon className="h-4 w-4 mr-2" />
              Tiếp tục setup
            </Button>

            {hasPartialData && (
              <Button
                onClick={handleAutoGenerate}
                disabled={isGenerating}
                className="w-full"
                size="lg"
                variant="secondary"
              >
                {isGenerating ? (
                  <>
                    <Loader2Icon className="h-4 w-4 mr-2 animate-spin" />
                    Đang tạo {genPhase}...
                  </>
                ) : (
                  <>
                    <SparklesIcon className="h-4 w-4 mr-2" />
                    Tự động tạo toàn bộ
                  </>
                )}
              </Button>
            )}

            {hasPartialData && (
              <Button
                variant="ghost"
                onClick={() => onActionAction("skip")}
                className="w-full text-muted-foreground"
              >
                Bỏ qua, viết tự do
              </Button>
            )}
          </div>
        )}

        {isGenerating && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => abortRef.current?.abort()}
            className="w-full"
          >
            Hủy
          </Button>
        )}
      </div>
    </ScrollArea>
  );
}
