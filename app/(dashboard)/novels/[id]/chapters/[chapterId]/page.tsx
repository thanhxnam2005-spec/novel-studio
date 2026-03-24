"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { ArrowLeftIcon, SaveIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useChapter, updateChapter, useScenes, updateScene } from "@/lib/hooks";

export default function ChapterEditorPage() {
  const { id: novelId, chapterId } = useParams<{
    id: string;
    chapterId: string;
  }>();
  const chapter = useChapter(chapterId);
  const scenes = useScenes(chapterId);
  const scene = scenes?.[0];

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [titleInit, setTitleInit] = useState(false);
  const [contentInit, setContentInit] = useState(false);
  const [saving, setSaving] = useState(false);

  // Initialize from DB — track separately since chapter and scene load independently
  useEffect(() => {
    if (chapter && !titleInit) {
      setTitle(chapter.title);
      setTitleInit(true);
    }
  }, [chapter, titleInit]);

  useEffect(() => {
    if (scene && !contentInit) {
      setContent(scene.content);
      setContentInit(true);
    }
  }, [scene, contentInit]);

  const isDirty =
    (titleInit && title !== chapter?.title) ||
    (contentInit && content !== scene?.content);

  const wordCount = content
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  const handleSave = useCallback(async () => {
    if (!chapter || !scene) return;
    setSaving(true);
    try {
      if (title !== chapter.title) {
        await updateChapter(chapterId, { title: title.trim() });
      }
      if (content !== scene.content) {
        await updateScene(scene.id, { content });
      }
      toast.success("Đã lưu");
    } catch {
      toast.error("Lưu thất bại");
    } finally {
      setSaving(false);
    }
  }, [chapter, scene, chapterId, title, content]);

  if (chapter === undefined) {
    return (
      <main className="mx-auto w-full max-w-4xl px-6 py-8">
        <Skeleton className="mb-4 h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </main>
    );
  }

  if (!chapter) {
    return (
      <main className="mx-auto w-full max-w-4xl px-6 py-8">
        <p className="text-muted-foreground">Không tìm thấy chương.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex h-full w-full max-w-4xl flex-col px-6 py-4">
      {/* Toolbar */}
      <div className="mb-4 flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href={`/novels/${novelId}`}>
            <ArrowLeftIcon className="size-4" />
          </Link>
        </Button>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 font-heading text-lg font-semibold"
          placeholder="Tiêu đề chương"
        />
        <span className="text-xs text-muted-foreground">
          {wordCount.toLocaleString()} từ
        </span>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!isDirty || saving}
        >
          <SaveIcon className="mr-1.5 size-3.5" />
          {saving ? "Đang lưu..." : "Lưu"}
        </Button>
      </div>

      {/* Editor */}
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="flex-1 resize-none rounded-lg border bg-transparent p-4 font-mono text-sm leading-relaxed outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring/50"
        placeholder="Bắt đầu viết..."
      />
    </main>
  );
}
