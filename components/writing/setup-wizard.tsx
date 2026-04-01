"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { EditableText } from "@/components/novel/editable-text";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import type { StepModelConfig, WritingAgentRole } from "@/lib/db";
import {
  getOrCreateWritingSettings,
  updateWritingSettings,
  updateNovel,
  useAIModels,
  useAIProviders,
  useChapterPlans,
  useCharacters,
  useNovel,
  usePlotArcs,
  useWritingSettings,
} from "@/lib/hooks";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";
import {
  generateChapterPlans,
  generateCharacters,
  generatePlotArcs,
  generateWorldBuilding,
  saveChapterPlans,
  saveCharacters,
  savePlotArcs,
  saveWorldBuilding,
} from "@/lib/writing/auto-generate";
import {
  BookOpenIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  GlobeIcon,
  Loader2Icon,
  MapIcon,
  MapPinIcon,
  RefreshCwIcon,
  SettingsIcon,
  ShieldIcon,
  SparklesIcon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import type { IdeaFormData } from "./idea-form";

const STEP_DEFAULT_PROMPTS: Record<WizardStep, string> = {
  world: `Bạn là nhà xây dựng thế giới chuyên nghiệp cho tiểu thuyết. Tạo thế giới quan chi tiết dựa trên ý tưởng.

Bao gồm:
- Tổng quan thế giới (worldOverview)
- Hệ thống sức mạnh/phép thuật (nếu có)
- Bối cảnh chính (storySetting)
- Thời kỳ/niên đại
- Quy tắc đặc biệt của thế giới
- 2-4 thế lực/phe phái quan trọng
- 3-5 địa danh quan trọng

Trả lời bằng Tiếng Việt.`,
  characters: `Bạn là nhà văn chuyên tạo nhân vật cho tiểu thuyết. Tạo 4-6 nhân vật phù hợp với thế giới và ý tưởng.

Cho mỗi nhân vật:
- Tên và vai trò (chính/phản diện/phụ/mentor)
- Mô tả ngắn gọn
- Tính cách nổi bật
- Động lực và mục tiêu

Đảm bảo nhân vật đa dạng và có mối quan hệ thú vị với nhau.
Trả lời bằng Tiếng Việt.`,
  arcs: `Bạn là nhà biên kịch chuyên nghiệp. Tạo mạch truyện chính và phụ với các điểm mốc cụ thể.

Bao gồm:
- 1 mạch truyện chính (main) với 4-6 điểm mốc
- 1-2 mạch phụ (subplot) với 2-3 điểm mốc mỗi mạch
- 1 mạch nhân vật (character) cho nhân vật chính

Mỗi điểm mốc cần tiêu đề và mô tả ngắn.
Trả lời bằng Tiếng Việt.`,
  plans: `Bạn là nhà văn chuyên lập kế hoạch tiểu thuyết. Tạo kế hoạch cho các chương đầu tiên.

Mỗi chương cần:
- Số thứ tự
- Tiêu đề hấp dẫn
- 2-3 hướng đi chính (mô tả ngắn gọn nội dung sẽ xảy ra)

Đảm bảo các chương có nhịp điệu tốt: xen kẽ hành động và phát triển nhân vật.
Trả lời bằng Tiếng Việt.`,
};

type WizardStep = "world" | "characters" | "arcs" | "plans";

const STEPS: {
  key: WizardStep;
  agentRole: WritingAgentRole;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    key: "world",
    agentRole: "context",
    label: "Thế giới quan",
    description: "Xây dựng bối cảnh, thế lực, địa danh và quy tắc",
    icon: GlobeIcon,
  },
  {
    key: "characters",
    agentRole: "direction",
    label: "Nhân vật",
    description: "Tạo nhân vật với tính cách, động lực và mục tiêu",
    icon: UsersIcon,
  },
  {
    key: "arcs",
    agentRole: "outline",
    label: "Mạch truyện",
    description: "Thiết lập mạch chính, phụ và các điểm mốc",
    icon: MapIcon,
  },
  {
    key: "plans",
    agentRole: "writer",
    label: "Kế hoạch chương",
    description: "Lên kế hoạch cho các chương đầu tiên",
    icon: BookOpenIcon,
  },
];

// ─── Model Picker (inline) ──────────────────────────────────

function InlineModelPicker({
  novelId,
  role,
}: {
  novelId: string;
  role: WritingAgentRole;
}) {
  const settings = useWritingSettings(novelId);
  const modelKey = `${role}Model` as const;
  const value = settings?.[modelKey] as StepModelConfig | undefined;
  const providers = useAIProviders();
  const selectedProviderId = value?.providerId ?? "";
  const models = useAIModels(selectedProviderId || undefined);

  const ensureAndUpdate = async (data: Record<string, unknown>) => {
    await getOrCreateWritingSettings(novelId);
    await updateWritingSettings(novelId, data);
  };

  return (
    <div className="grid gap-2 grid-cols-2">
      <NativeSelect
        className="w-full text-xs"
        value={selectedProviderId}
        onChange={(e) => {
          const pid = e.target.value;
          ensureAndUpdate({
            [modelKey]: pid ? { providerId: pid, modelId: "" } : undefined,
          });
        }}
      >
        <NativeSelectOption value="">Mặc định</NativeSelectOption>
        {providers?.map((p) => (
          <NativeSelectOption key={p.id} value={p.id}>
            {p.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <NativeSelect
        className="w-full text-xs"
        value={value?.modelId ?? ""}
        disabled={!selectedProviderId}
        onChange={(e) => {
          if (!selectedProviderId) return;
          ensureAndUpdate({
            [modelKey]: {
              providerId: selectedProviderId,
              modelId: e.target.value,
            },
          });
        }}
      >
        <NativeSelectOption value="">
          {selectedProviderId ? "Chọn model" : "—"}
        </NativeSelectOption>
        {models?.map((m) => (
          <NativeSelectOption key={m.id} value={m.modelId}>
            {m.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────

export function SetupWizard({
  novelId,
  ideaData,
  onCompleteAction,
  startAtStep,
}: {
  novelId: string;
  ideaData: IdeaFormData;
  onCompleteAction: () => void;
  startAtStep?: WizardStep;
}) {
  const [currentStep, setCurrentStep] = useState<WizardStep>(
    startAtStep ?? "world",
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [showConfig, setShowConfig] = useState(false);
  const [wantsRegenerate, setWantsRegenerate] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const novel = useNovel(novelId);
  const characters = useCharacters(novelId);
  const plotArcs = usePlotArcs(novelId);
  const chapterPlans = useChapterPlans(novelId);

  const currentStepIndex = STEPS.findIndex((s) => s.key === currentStep);
  const stepDef = STEPS[currentStepIndex];

  const isStepDone = useCallback(
    (step: WizardStep) => {
      switch (step) {
        case "world":
          return !!(novel?.worldOverview || novel?.factions?.length);
        case "characters":
          return (characters?.length ?? 0) > 0;
        case "arcs":
          return (plotArcs?.length ?? 0) > 0;
        case "plans":
          return (chapterPlans?.length ?? 0) > 0;
      }
    },
    [novel, characters, plotArcs, chapterPlans],
  );

  const stepDone = isStepDone(currentStep);

  const buildContext = useCallback(() => {
    const parts: string[] = [];
    if (novel?.worldOverview) parts.push(`Thế giới: ${novel.worldOverview}`);
    if (novel?.factions?.length)
      parts.push(`Thế lực: ${novel.factions.map((f) => f.name).join(", ")}`);
    if (characters?.length)
      parts.push(
        `Nhân vật: ${characters.map((c) => `${c.name} (${c.role}): ${c.description}`).join("\n")}`,
      );
    if (plotArcs?.length)
      parts.push(
        `Mạch truyện: ${plotArcs.map((a) => `${a.title} (${a.type}): ${a.description}`).join("\n")}`,
      );
    return parts.join("\n\n");
  }, [novel, characters, plotArcs]);

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    const controller = new AbortController();
    abortRef.current = controller;

    const defaultPrompt = STEP_DEFAULT_PROMPTS[currentStep];
    const options = {
      novelId,
      genre: ideaData.genre,
      setting: ideaData.setting,
      idea: ideaData.idea,
      style: ideaData.style,
      systemPrompt:
        customPrompt && customPrompt !== defaultPrompt
          ? customPrompt
          : undefined,
      abortSignal: controller.signal,
    };

    try {
      switch (currentStep) {
        case "world": {
          const result = await generateWorldBuilding(options);
          await saveWorldBuilding(novelId, result);
          break;
        }
        case "characters": {
          const result = await generateCharacters(options, buildContext());
          await saveCharacters(novelId, result);
          break;
        }
        case "arcs": {
          const result = await generatePlotArcs(options, buildContext());
          await savePlotArcs(novelId, result);
          break;
        }
        case "plans": {
          const result = await generateChapterPlans(options, buildContext());
          await saveChapterPlans(novelId, result);
          break;
        }
      }
      setCustomPrompt("");
      setWantsRegenerate(false);
      toast.success(`Đã tạo ${stepDef.label}`);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      toast.error(err instanceof Error ? err.message : "Lỗi không xác định");
    } finally {
      setIsGenerating(false);
    }
  }, [currentStep, novelId, ideaData, customPrompt, buildContext, stepDef]);

  const handleNext = useCallback(() => {
    if (currentStepIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[currentStepIndex + 1].key);
      setCustomPrompt("");
      setShowConfig(false);
      setWantsRegenerate(false);
    } else {
      onCompleteAction();
    }
  }, [currentStepIndex, onCompleteAction]);

  // ── Render step results ───────────────────────────────────

  const sectionCard = (
    icon: React.ComponentType<{ className?: string }>,
    color: string,
    label: string,
    value: string,
    onSave: (v: string) => void,
    multi = true,
  ) => {
    const Icon = icon;
    return (
      <div className="rounded-xl border p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className={cn("inline-flex size-7 items-center justify-center rounded-lg bg-muted", color)}>
            <Icon className="size-3.5" />
          </span>
          <p className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">{label}</p>
        </div>
        <EditableText
          value={value}
          onSave={onSave}
          placeholder={`Chưa có ${label.toLowerCase()}...`}
          multiline={multi}
          displayClassName="text-sm leading-relaxed"
        />
      </div>
    );
  };

  const itemList = (
    items: { name: string; description: string }[],
    icon: React.ComponentType<{ className?: string }>,
    color: string,
    label: string,
    onUpdate: (items: { name: string; description: string }[]) => void,
  ) => {
    const Icon = icon;
    return (
      <div className="rounded-xl border p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className={cn("inline-flex size-7 items-center justify-center rounded-lg bg-muted", color)}>
            <Icon className="size-3.5" />
          </span>
          <p className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">{label}</p>
          {items.length > 0 && (
            <span className="text-[10px] text-muted-foreground/60">({items.length})</span>
          )}
        </div>
        {items.length === 0 ? (
          <p className="py-2 text-center text-xs italic text-muted-foreground/60">Chưa có {label.toLowerCase()} nào</p>
        ) : (
          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={`${item.name}-${i}`} className="group flex items-start gap-3 rounded-lg border border-border/50 bg-background/60 p-3 transition-colors hover:bg-background">
                <span className={cn("mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-md text-[10px] font-bold bg-muted", color)}>
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <EditableText
                    value={item.name}
                    onSave={(v) => { const next = [...items]; next[i] = { ...next[i], name: v }; onUpdate(next); }}
                    displayClassName="text-sm font-medium"
                  />
                  <EditableText
                    value={item.description}
                    onSave={(v) => { const next = [...items]; next[i] = { ...next[i], description: v }; onUpdate(next); }}
                    placeholder="Thêm mô tả..."
                    multiline
                    displayClassName="text-xs leading-relaxed text-muted-foreground"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderStepResult = () => {
    switch (currentStep) {
      case "world":
        return novel?.worldOverview ? (
          <div className="grid gap-3">
            <div className="col-span-1">
              {sectionCard(GlobeIcon, "text-blue-600 dark:text-blue-400", "Tổng quan thế giới", novel.worldOverview ?? "", (v) => updateNovel(novelId, { worldOverview: v }))}
            </div>
            {sectionCard(MapIcon, "text-emerald-600 dark:text-emerald-400", "Bối cảnh", novel.storySetting ?? "", (v) => updateNovel(novelId, { storySetting: v }))}
            {sectionCard(BookOpenIcon, "text-amber-600 dark:text-amber-400", "Thời kỳ", novel.timePeriod ?? "", (v) => updateNovel(novelId, { timePeriod: v }), false)}
            <div className="col-span-1">
              {sectionCard(SparklesIcon, "text-red-600 dark:text-red-400", "Hệ thống sức mạnh", novel.powerSystem ?? "", (v) => updateNovel(novelId, { powerSystem: v }))}
            </div>
            <div className="col-span-1">
              {itemList(novel.factions ?? [], ShieldIcon, "text-violet-600 dark:text-violet-400", "Thế lực", (v) => updateNovel(novelId, { factions: v }))}
            </div>
            <div className="col-span-1">
              {itemList(novel.keyLocations ?? [], MapPinIcon, "text-cyan-600 dark:text-cyan-400", "Địa danh", (v) => updateNovel(novelId, { keyLocations: v }))}
            </div>
          </div>
        ) : null;

      case "characters":
        return characters && characters.length > 0 ? (
          <div className="space-y-2">
            {characters.map((c, i) => (
              <div key={c.id} className="group flex items-start gap-3 rounded-xl border p-4 transition-colors hover:bg-accent/30">
                <span className={cn("mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold bg-muted", "text-violet-600 dark:text-violet-400")}>
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <EditableText value={c.name} onSave={(v) => db.characters.update(c.id, { name: v, updatedAt: new Date() })} displayClassName="text-sm font-semibold" />
                    <Badge variant="secondary" className="text-[10px] font-normal shrink-0">{c.role}</Badge>
                  </div>
                  <EditableText value={c.description} multiline onSave={(v) => db.characters.update(c.id, { description: v, updatedAt: new Date() })} placeholder="Thêm mô tả..." displayClassName="text-xs leading-relaxed text-muted-foreground" />
                  <div className="grid gap-1 pt-1">
                    <div className="rounded-lg bg-muted/50 px-2.5 py-1.5">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 mb-0.5">Tính cách</p>
                      <EditableText value={c.personality ?? ""} onSave={(v) => db.characters.update(c.id, { personality: v, updatedAt: new Date() })} placeholder="Chưa có..." displayClassName="text-xs" />
                    </div>
                    <div className="rounded-lg bg-muted/50 px-2.5 py-1.5">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 mb-0.5">Động lực</p>
                      <EditableText value={c.motivations ?? ""} onSave={(v) => db.characters.update(c.id, { motivations: v, updatedAt: new Date() })} placeholder="Chưa có..." displayClassName="text-xs" />
                    </div>
                    <div className="rounded-lg bg-muted/50 px-2.5 py-1.5">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 mb-0.5">Mục tiêu</p>
                      <EditableText value={c.goals ?? ""} onSave={(v) => db.characters.update(c.id, { goals: v, updatedAt: new Date() })} placeholder="Chưa có..." displayClassName="text-xs" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null;

      case "arcs":
        return plotArcs && plotArcs.length > 0 ? (
          <div className="space-y-2">
            {plotArcs.map((a) => {
              const arcColor = a.type === "main" ? "text-red-600 dark:text-red-400" : a.type === "character" ? "text-violet-600 dark:text-violet-400" : "text-amber-600 dark:text-amber-400";
              return (
                <div key={a.id} className="rounded-xl border p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn("inline-flex size-7 items-center justify-center rounded-lg bg-muted", arcColor)}>
                      <MapIcon className="size-3.5" />
                    </span>
                    <EditableText value={a.title} onSave={(v) => db.plotArcs.update(a.id, { title: v, updatedAt: new Date() })} displayClassName="text-sm font-semibold" />
                    <Badge variant="secondary" className="text-[10px] font-normal shrink-0">{a.type}</Badge>
                  </div>
                  <EditableText value={a.description} multiline onSave={(v) => db.plotArcs.update(a.id, { description: v, updatedAt: new Date() })} placeholder="Thêm mô tả..." displayClassName="text-sm leading-relaxed text-muted-foreground" />
                  {a.plotPoints.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">Điểm mốc</p>
                      {a.plotPoints.map((p, pi) => (
                        <div key={p.id} className="flex items-start gap-2 rounded-lg border border-border/50 bg-background/60 px-3 py-2">
                          <span className={cn("mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded text-[9px] font-bold bg-muted", arcColor)}>
                            {pi + 1}
                          </span>
                          <EditableText value={p.title} onSave={(v) => { const pts = [...a.plotPoints]; pts[pi] = { ...pts[pi], title: v }; db.plotArcs.update(a.id, { plotPoints: pts, updatedAt: new Date() }); }} displayClassName="text-xs" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : null;

      case "plans":
        return chapterPlans && chapterPlans.length > 0 ? (
          <div className="space-y-2">
            {chapterPlans.map((p) => (
              <div key={p.id} className="group flex items-start gap-3 rounded-xl border p-4 transition-colors hover:bg-accent/30">
                <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold bg-muted text-emerald-600 dark:text-emerald-400">
                  {p.chapterOrder}
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <EditableText value={p.title ?? ""} onSave={(v) => db.chapterPlans.update(p.id, { title: v, updatedAt: new Date() })} placeholder="Chưa đặt tên..." displayClassName="text-sm font-semibold" />
                  <EditableText
                    value={p.directions.join("\n")}
                    multiline
                    onSave={(v) => db.chapterPlans.update(p.id, { directions: v.split("\n").map((d) => d.trim()).filter(Boolean), updatedAt: new Date() })}
                    placeholder="Thêm hướng đi..."
                    displayClassName="text-xs leading-relaxed text-muted-foreground"
                  />
                </div>
              </div>
            ))}
          </div>
        ) : null;
    }
  };

  // ── Empty state with inline config ────────────────────────

  const renderEmptyState = () => {
    const Icon = stepDef.icon;
    return (
      <div className="flex flex-col items-center max-w-md mx-auto gap-4">
        <Empty className="border-0">
          <EmptyMedia variant="icon">
            <Icon />
          </EmptyMedia>
          <EmptyHeader>
            <EmptyTitle>{stepDef.label}</EmptyTitle>
            <EmptyDescription>{stepDef.description}</EmptyDescription>
          </EmptyHeader>
        </Empty>

        {/* Inline config panel */}
        <div className="w-full space-y-4">
          {/* Model config */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Mô hình AI</Label>
            <InlineModelPicker novelId={novelId} role={stepDef.agentRole} />
          </div>

          {/* Full prompt editor */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">System Prompt</Label>
              {customPrompt !== STEP_DEFAULT_PROMPTS[currentStep] && (
                <button
                  onClick={() =>
                    setCustomPrompt(STEP_DEFAULT_PROMPTS[currentStep])
                  }
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <RefreshCwIcon className="h-3 w-3" />
                  Khôi phục mặc định
                </button>
              )}
            </div>
            <Textarea
              value={customPrompt || STEP_DEFAULT_PROMPTS[currentStep]}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={8}
              className="text-xs font-mono leading-relaxed resize-y"
            />
          </div>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={isGenerating}
          size="lg"
          className="w-full"
        >
          {isGenerating ? (
            <>
              <Loader2Icon className="h-4 w-4 mr-2 animate-spin" />
              Đang tạo {stepDef.label.toLowerCase()}...
            </>
          ) : (
            <>
              <SparklesIcon className="h-4 w-4 mr-2" />
              Tạo {stepDef.label.toLowerCase()}
            </>
          )}
        </Button>

        {isGenerating && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              abortRef.current?.abort();
              setIsGenerating(false);
            }}
          >
            <XIcon className="h-3 w-3 mr-1" />
            Hủy
          </Button>
        )}
      </div>
    );
  };

  const showFooter = stepDone && !isGenerating && !wantsRegenerate;

  // ── Layout ────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col">
      {/* Header: step pills + progress */}
      <div className="flex items-center justify-center border-b px-4 py-3">
        <div className="flex items-center gap-1">
          {STEPS.map((step, i) => {
            const done = isStepDone(step.key);
            const active = step.key === currentStep;
            const Icon = step.icon;
            return (
              <div key={step.key} className="flex items-center gap-1 sm:gap-2">
                {i > 0 && (
                  <div
                    className={`h-px w-2 sm:w-4 ${i <= currentStepIndex ? "bg-primary" : "bg-border"}`}
                  />
                )}
                <button
                  key={step.key}
                  onClick={() => {
                    setCurrentStep(step.key);
                    setCustomPrompt("");
                    setShowConfig(false);
                    setWantsRegenerate(false);
                  }}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition-all",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : done
                        ? "bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20"
                        : "bg-secondary text-muted-foreground hover:bg-secondary/80",
                  )}
                >
                  {done ? (
                    <CheckCircle2Icon className="h-3 w-3" />
                  ) : (
                    <Icon className="h-3 w-3" />
                  )}
                  <span className="hidden sm:inline">{step.label}</span>
                  <span className="sm:hidden">{i + 1}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <ScrollArea
        className={
          showFooter ? `h-[calc(100dvh-208px)]` : `h-[calc(100dvh-148px)]`
        }
      >
        <div className="p-4 max-w-2xl mx-auto">
          {wantsRegenerate || isGenerating || !stepDone
            ? renderEmptyState()
            : renderStepResult()}
        </div>
      </ScrollArea>

      {/* Footer: actions when step is done */}
      {showFooter && (
        <div className="border-t px-4 py-3">
          <div className="flex items-center gap-2 max-w-2xl mx-auto">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setWantsRegenerate(true)}
                disabled={isGenerating}
              >
                <RefreshCwIcon className="h-3.5 w-3.5 mr-1" />
                Tạo lại
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowConfig(!showConfig)}
              >
                <SettingsIcon className="h-3.5 w-3.5 mr-1" />
                Cài đặt
              </Button>
            </div>

            {showConfig && (
              <div className="flex-1">
                <InlineModelPicker novelId={novelId} role={stepDef.agentRole} />
              </div>
            )}

            {!showConfig && <div className="flex-1" />}

            <Button onClick={handleNext}>
              {currentStepIndex < STEPS.length - 1 ? (
                <>
                  Tiếp theo
                  <ChevronRightIcon className="h-4 w-4 ml-1" />
                </>
              ) : (
                "Hoàn thành → Viết truyện"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
