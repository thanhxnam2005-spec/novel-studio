"use client";

import { cn, markdownToHtml, isHex } from "@/lib/utils";
import DOMPurify from "dompurify";
import { BellIcon, XIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const AUTO_WRITE_PATH = /^\/novels\/[^/]+\/auto-write/;

interface Announcement {
  id: string;
  enabled: boolean;
  type: "info" | "warning" | "error";
  content: string;
  textColor?: string;
  bgColor?: string;
}

interface AnnouncementsData {
  announcements: Announcement[];
}

const DISMISS_KEY_PREFIX = "announcement-dismissed:";
const VALID_TYPES = new Set(["info", "warning", "error"]);

function isValidAnnouncement(a: unknown): a is Announcement {
  if (typeof a !== "object" || a === null) return false;
  const obj = a as Record<string, unknown>;
  return (
    typeof obj.id === "string" &&
    typeof obj.enabled === "boolean" &&
    typeof obj.content === "string" &&
    VALID_TYPES.has(obj.type as string) &&
    (obj.textColor === undefined || typeof obj.textColor === "string") &&
    (obj.bgColor === undefined || typeof obj.bgColor === "string")
  );
}

const typeStyles: Record<Announcement["type"], string> = {
  info: "bg-primary/10 text-primary dark:bg-primary/15 dark:text-primary",
  warning:
    "bg-yellow-500/10 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-200",
  error:
    "bg-destructive/10 text-destructive dark:bg-destructive/15 dark:text-destructive",
};

export function AnnouncementBanner() {
  const pathname = usePathname();
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch("/announcements.json")
      .then((res) =>
        res.ok ? (res.json() as Promise<AnnouncementsData>) : null,
      )
      .then((data) => {
        if (!data?.announcements || !Array.isArray(data.announcements)) return;
        const active = data.announcements
          .filter(isValidAnnouncement)
          .find(
            (a) =>
              a.enabled &&
              sessionStorage.getItem(DISMISS_KEY_PREFIX + a.id) !== "true",
          );
        if (active) setAnnouncement(active);
      })
      .catch(() => {
        // Static file missing or malformed — silently ignore
      });
  }, []);

  const dismiss = useCallback(() => {
    if (!announcement) return;
    sessionStorage.setItem(DISMISS_KEY_PREFIX + announcement.id, "true");
    setDismissed(true);
  }, [announcement]);

  if (AUTO_WRITE_PATH.test(pathname)) return null;
  if (!announcement || dismissed) return null;

  const sanitizedHtml = DOMPurify.sanitize(
    markdownToHtml(announcement.content),
    {
      ALLOWED_TAGS: ["strong", "em", "a", "code", "br"],
      ALLOWED_ATTR: ["href", "class", "target", "rel"],
    },
  );

  const customColorClasses = [
    announcement.bgColor && !isHex(announcement.bgColor)
      ? announcement.bgColor
      : undefined,
    announcement.textColor && !isHex(announcement.textColor)
      ? announcement.textColor
      : undefined,
  ];
  const hasCustomColors = announcement.bgColor || announcement.textColor;
  const inlineStyle: React.CSSProperties = {
    ...(announcement.bgColor && isHex(announcement.bgColor)
      ? { backgroundColor: announcement.bgColor }
      : {}),
    ...(announcement.textColor && isHex(announcement.textColor)
      ? { color: announcement.textColor }
      : {}),
  };

  return (
    <div
      role={announcement.type === "info" ? "status" : "alert"}
      style={inlineStyle}
      className={cn(
        "flex items-center justify-between gap-2 border-b px-4 py-2 text-sm",
        !hasCustomColors && (typeStyles[announcement.type] ?? typeStyles.info),
        ...customColorClasses,
      )}
    >
      <BellIcon className="size-4" />
      <div
        className="min-w-0 flex-1 [&_code]:rounded [&_code]:bg-black/5 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs dark:[&_code]:bg-white/10 text-center"
        dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
      />
      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 rounded-md p-0.5 opacity-60 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Đóng thông báo"
      >
        <XIcon className="size-4" />
      </button>
    </div>
  );
}
