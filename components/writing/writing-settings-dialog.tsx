"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
  useAIModels,
  useAIProviders,
  useWritingSettings,
} from "@/lib/hooks";
import { useDebouncedCallback } from "@/lib/hooks/use-debounce";
import { cn } from "@/lib/utils";
import { getDefaultPrompt } from "@/lib/writing/prompts";
import {
  BookOpenIcon,
  CompassIcon,
  ListTreeIcon,
  PenLineIcon,
  RotateCcwIcon,
  SearchCheckIcon,
} from "lucide-react";
import { useState } from "react";

const AGENT_ROLES: {
  role: WritingAgentRole;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    role: "context",
    label: "Bối cảnh",
    description: "Tổng hợp bối cảnh từ chương trước",
    icon: BookOpenIcon,
  },
  {
    role: "direction",
    label: "Hướng đi",
    description: "Đề xuất hướng phát triển chương",
    icon: CompassIcon,
  },
  {
    role: "outline",
    label: "Giàn ý",
    description: "Tạo cấu trúc phân cảnh chi tiết",
    icon: ListTreeIcon,
  },
  {
    role: "writer",
    label: "Viết truyện",
    description: "Viết nội dung chương hoàn chỉnh",
    icon: PenLineIcon,
  },
  {
    role: "review",
    label: "Đánh giá",
    description: "Đánh giá chương theo 4 tiêu chí",
    icon: SearchCheckIcon,
  },
  {
    role: "rewrite",
    label: "Viết lại",
    description: "Viết lại chương dựa trên đánh giá",
    icon: PenLineIcon,
  },
];

function StepModelPicker({
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

  const handleProviderChange = (providerId: string) => {
    if (!providerId) {
      updateWritingSettings(novelId, { [modelKey]: undefined });
      return;
    }
    updateWritingSettings(novelId, {
      [modelKey]: { providerId, modelId: "" },
    });
  };

  const handleModelChange = (modelId: string) => {
    if (!selectedProviderId) return;
    updateWritingSettings(novelId, {
      [modelKey]: { providerId: selectedProviderId, modelId },
    });
  };

  return (
    <div className="grid gap-2 grid-cols-2">
      <div>
        <Label className="text-xs text-muted-foreground">Nhà cung cấp</Label>
        <NativeSelect
          className="mt-1 w-full"
          value={selectedProviderId}
          onChange={(e) => handleProviderChange(e.target.value)}
        >
          <NativeSelectOption value="">Mặc định (Chat)</NativeSelectOption>
          {providers?.map((p) => (
            <NativeSelectOption key={p.id} value={p.id}>
              {p.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Mô hình</Label>
        <NativeSelect
          className="mt-1 w-full"
          value={value?.modelId ?? ""}
          onChange={(e) => handleModelChange(e.target.value)}
          disabled={!selectedProviderId}
        >
          <NativeSelectOption value="">
            {selectedProviderId ? "Chọn mô hình" : "—"}
          </NativeSelectOption>
          {models?.map((m) => (
            <NativeSelectOption key={m.id} value={m.modelId}>
              {m.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
    </div>
  );
}

export function WritingSettingsDialog({
  novelId,
  open,
  onOpenChangeAction,
}: {
  novelId: string;
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
}) {
  const settings = useWritingSettings(novelId);
  const chapterLength = settings?.chapterLength ?? 3000;
  const [activeRole, setActiveRole] = useState<WritingAgentRole>("context");

  if (open && !settings) {
    getOrCreateWritingSettings(novelId);
  }

  const debouncedPromptChange = useDebouncedCallback(
    async (role: WritingAgentRole, value: string) => {
      const key = `${role}Prompt` as const;
      const defaultPrompt = getDefaultPrompt(role);
      // Store undefined if identical to default (saves space, always uses latest default)
      await updateWritingSettings(novelId, {
        [key]: value === defaultPrompt ? undefined : value,
      });
    },
    500,
  );

  const handleLengthChange = async (value: number) => {
    await updateWritingSettings(novelId, { chapterLength: value });
  };

  const handleResetPrompt = async (role: WritingAgentRole) => {
    const key = `${role}Prompt` as const;
    await updateWritingSettings(novelId, { [key]: undefined });
  };

  // Get the current prompt value — custom or default
  const getPromptValue = (role: WritingAgentRole): string => {
    const key = `${role}Prompt` as const;
    const custom = settings?.[key] as string | undefined;
    return custom || getDefaultPrompt(role);
  };

  const isCustomPrompt = (role: WritingAgentRole): boolean => {
    const key = `${role}Prompt` as const;
    return !!(settings?.[key] as string | undefined);
  };

  const activeConfig = AGENT_ROLES.find((r) => r.role === activeRole)!;

  return (
    <Dialog open={open} onOpenChange={onOpenChangeAction}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>Cài đặt viết truyện</DialogTitle>
          <DialogDescription>
            Cấu hình mô hình AI và prompt cho từng bước trong pipeline viết
            truyện.
          </DialogDescription>
        </DialogHeader>

        {/* Chapter length — top bar */}
        <div className="flex items-center gap-3 px-6 pb-2 border-b">
          <Label className="text-sm shrink-0">Độ dài chương</Label>
          <Input
            type="number"
            value={chapterLength}
            onChange={(e) => handleLengthChange(Number(e.target.value) || 3000)}
            min={500}
            max={10000}
            step={500}
            className="w-24"
          />
          <span className="text-xs text-muted-foreground">từ / chương</span>
        </div>

        {/* Two-column layout: role tabs + config panel */}
        <div className="flex min-h-0 flex-1">
          {/* Left: role selector */}
          <div className="w-48 shrink-0 border-r bg-muted/30">
            <div className="p-2 space-y-0.5">
              {AGENT_ROLES.map(({ role, label, icon: Icon }) => {
                const hasCustom = isCustomPrompt(role);
                const hasModel = !!(settings?.[`${role}Model` as const] as
                  | StepModelConfig
                  | undefined);
                return (
                  <button
                    key={role}
                    onClick={() => setActiveRole(role)}
                    className={cn(
                      "flex items-center gap-2.5 w-full rounded-md px-3 py-2 text-left text-sm transition-colors",
                      activeRole === role
                        ? "bg-background shadow-sm font-medium"
                        : "hover:bg-background/60 text-muted-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 truncate">{label}</span>
                    {(hasCustom || hasModel) && (
                      <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: active role config */}
          <ScrollArea className="flex-1 h-[70vh]">
            <div className="p-5 space-y-5">
              {/* Role header */}
              <div>
                <div className="flex items-center gap-2">
                  <activeConfig.icon className="h-4 w-4" />
                  <h3 className="text-sm font-medium">{activeConfig.label}</h3>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {activeConfig.description}
                </p>
              </div>

              {/* Model picker */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">Mô hình AI</Label>
                <StepModelPicker novelId={novelId} role={activeRole} />
              </div>

              {/* Prompt editor — pre-filled with default, directly editable */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">System Prompt</Label>
                  {isCustomPrompt(activeRole) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs text-muted-foreground"
                      onClick={() => handleResetPrompt(activeRole)}
                    >
                      <RotateCcwIcon className="h-3 w-3 mr-1" />
                      Khôi phục mặc định
                    </Button>
                  )}
                </div>
                <Textarea
                  key={activeRole}
                  defaultValue={getPromptValue(activeRole)}
                  onChange={(e) =>
                    debouncedPromptChange.run(activeRole, e.target.value)
                  }
                  rows={12}
                  className="text-xs font-mono leading-relaxed resize-y"
                />
                {!isCustomPrompt(activeRole) && (
                  <p className="text-xs text-muted-foreground">
                    Đây là prompt mặc định. Chỉnh sửa trực tiếp để tùy biến.
                  </p>
                )}
              </div>
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
