"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { AIModel, AIProvider } from "@/lib/db";
import { cn } from "@/lib/utils";
import { CheckIcon, ChevronDownIcon, SparklesIcon } from "lucide-react";
import { useState } from "react";
import { ProviderIcon } from "../provider-icon";

export function ModelSelectorButton({
  providers,
  models,
  selectedProviderId,
  selectedModelId,
  onProviderChange,
  onModelChange,
  disabled,
}: {
  providers: AIProvider[];
  models: AIModel[] | undefined;
  selectedProviderId: string;
  selectedModelId: string;
  onProviderChange: (id: string) => void;
  onModelChange: (id: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selectedModel = models?.find((m) => m.modelId === selectedModelId);
  const providerType = providers.find(
    (p) => p.id === selectedProviderId,
  )?.providerType;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled || !providers.length}
          className="flex min-w-0 items-center gap-1.5 rounded-full border bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
        >
          {providerType ? (
            <ProviderIcon iconKey={providerType} className="size-3" />
          ) : (
            <SparklesIcon className="size-3 shrink-0" />
          )}
          <span className="max-w-[110px] truncate">
            {selectedModel?.name ?? "Chọn model"}
          </span>
          <ChevronDownIcon className="size-3 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="flex w-64 flex-col p-0 shadow-lg"
        style={{ maxHeight: "min(420px, 80vh)" }}
        side="top"
        align="start"
        sideOffset={10}
      >
        {/* Provider section — fixed, never scrolls */}
        <div className="shrink-0 border-b p-2">
          <p className="mb-1.5 px-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
            Nhà cung cấp
          </p>
          <div className="space-y-0.5">
            {providers.map((provider) => {
              const isSelected = provider.id === selectedProviderId;
              return (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => {
                    if (!isSelected) onProviderChange(provider.id);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                    isSelected
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent/60 hover:text-accent-foreground",
                  )}
                >
                  <div
                    className={cn(
                      "flex size-3.5 shrink-0 items-center justify-center rounded-full border transition-colors",
                      isSelected
                        ? "border-primary bg-primary"
                        : "border-muted-foreground/40",
                    )}
                  >
                    {isSelected && (
                      <div className="size-1.5 rounded-full bg-primary-foreground" />
                    )}
                  </div>
                  <span className="truncate">{provider.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Model section — scrollable, takes remaining space */}
        <div className="flex min-h-0 flex-1 flex-col p-2 pr-0">
          <p className="mb-1.5 shrink-0 px-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
            Mô hình
          </p>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1.5">
            {!models?.length ? (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                Chưa có mô hình nào
              </p>
            ) : (
              <div className="space-y-0.5">
                {models.map((model) => {
                  const isSelected = model.modelId === selectedModelId;
                  return (
                    <button
                      key={model.id}
                      type="button"
                      onClick={() => {
                        onModelChange(model.modelId);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors",
                        isSelected
                          ? "bg-accent text-accent-foreground font-medium"
                          : "hover:bg-accent/60 hover:text-accent-foreground",
                      )}
                    >
                      <CheckIcon
                        className={cn(
                          "size-3.5 shrink-0 text-primary",
                          isSelected ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <span className="truncate">{model.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
