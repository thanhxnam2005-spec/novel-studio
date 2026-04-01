import type { SceneVersionType } from "@/lib/db";

export const VERSION_TYPE_LABELS: Record<SceneVersionType, string> = {
  "ai-translate": "Dịch AI",
  "ai-edit": "Sửa AI",
  "ai-write": "Viết AI",
  manual: "Thủ công",
  "qt-convert": "Convert QT",
  "find-replace": "Thay thế",
};

export const VERSION_TYPE_VARIANTS: Record<
  SceneVersionType,
  "default" | "secondary" | "outline"
> = {
  "ai-translate": "default",
  "ai-edit": "secondary",
  "ai-write": "default",
  manual: "outline",
  "qt-convert": "secondary",
  "find-replace": "secondary",
};

export function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "vừa xong";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}
