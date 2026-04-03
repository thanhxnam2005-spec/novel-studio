"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { updateConversation, useNovels } from "@/lib/hooks";
import { useChatPanel } from "@/lib/stores/chat-panel";
import {
  BookOpenIcon,
  PaperclipIcon,
  PlusIcon,
  SearchIcon,
} from "lucide-react";
import { useState } from "react";

export function AttachMenuButton({
  onFileClick,
  disabled,
}: {
  onFileClick: () => void;
  disabled?: boolean;
}) {
  const { attachedNovelId, activeConversationId, setAttachedContext } =
    useChatPanel();
  const novels = useNovels();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = novels?.filter((n) =>
    n.title.toLowerCase().includes(search.toLowerCase()),
  );

  const handleNovelSelect = async (novelId: string) => {
    setAttachedContext(novelId, null);
    setDialogOpen(false);
    setSearch("");
    if (activeConversationId) {
      await updateConversation(activeConversationId, {
        novelId,
        chapterId: undefined,
      });
    }
  };

  return (
    <>
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            title="Đính kèm"
            className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            <PlusIcon size={14} />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-52 p-1.5 gap-0"
          side="top"
          align="start"
          sideOffset={10}
        >
          {/* File */}
          <button
            type="button"
            onClick={() => {
              onFileClick();
              setMenuOpen(false);
            }}
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
          >
            <PaperclipIcon className="size-4 shrink-0 text-muted-foreground" />
            <span>Đính kèm tệp</span>
          </button>

          {/* Novel — hidden when already attached */}
          {!attachedNovelId && (
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setDialogOpen(true);
              }}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
            >
              <BookOpenIcon className="size-4 shrink-0 text-muted-foreground" />
              <span>Đính kèm tiểu thuyết</span>
            </button>
          )}
        </PopoverContent>
      </Popover>

      {/* Novel selection dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setSearch("");
        }}
      >
        <DialogContent className="sm:max-w-lg p-0 gap-0">
          <DialogHeader className="border-b px-4 py-3">
            <DialogTitle className="text-sm font-medium">
              Chọn tiểu thuyết
            </DialogTitle>
          </DialogHeader>

          {/* Search */}
          <div className="border-b px-3 py-2">
            <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-2.5 py-1.5">
              <SearchIcon className="size-3.5 shrink-0 text-muted-foreground/60" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm kiếm..."
                autoFocus
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
              />
            </div>
          </div>

          {/* Novel list */}
          <div className="max-h-72 overflow-y-auto p-1.5">
            {!filtered?.length ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {search ? "Không tìm thấy kết quả" : "Chưa có tiểu thuyết nào"}
              </p>
            ) : (
              filtered.map((novel) => (
                <button
                  key={novel.id}
                  type="button"
                  onClick={() => handleNovelSelect(novel.id)}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left hover:bg-accent hover:text-accent-foreground"
                >
                  <BookOpenIcon className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {novel.title}
                    </p>
                    {novel.description && (
                      <p className="truncate text-xs text-muted-foreground">
                        {novel.description}
                      </p>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
