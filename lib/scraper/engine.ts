import { sanitizeText } from "../utils";
import { extensionFetch, extensionDownloadSTVChapter } from "./extension-bridge";
import type { ChapterContent, ChapterLink, SiteAdapter } from "./types";

export function sanitizeChapterContent(c: ChapterContent): ChapterContent {
  return {
    ...c,
    title: sanitizeText(c.title),
    content: sanitizeText(c.content, true),
  };
}

export interface ScrapeDebugEntry {
  chapterTitle: string;
  url: string;
  htmlLength: number;
  parsed: ChapterContent;
  extensionLogs?: string[];
  timedOut: boolean;
  contentTextLength: number;
  waitSelector?: string;
  clickSelector?: string;
}

/**
 * Scrape selected chapters sequentially through the extension.
 */
export async function scrapeChapters(
  chapters: ChapterLink[],
  adapter: SiteAdapter,
  onProgress?: (completed: number, total: number, currentTitle: string) => void,
  signal?: AbortSignal,
  onDebug?: (entry: ScrapeDebugEntry) => void,
  delayMs: number = 300,
  onPauseCheck?: () => boolean,
): Promise<ChapterContent[]> {
  const results: ChapterContent[] = [];

  for (let i = 0; i < chapters.length; i++) {
    signal?.throwIfAborted();

    const chapter = chapters[i];
    onProgress?.(i, chapters.length, chapter.title);

    // Pause loop
    while (onPauseCheck?.()) {
      await delay(1000);
      signal?.throwIfAborted();
    }


    let html = "";
    let contentText: string | undefined = undefined;
    let timedOut = false;
    let logs: string[] = [];

    let extTitle: string | undefined = undefined;
    if (adapter.name === "STV" && chapter.id) {
      try {
        const res = await extensionDownloadSTVChapter(chapter.id, chapter.url);
        html = res.data ?? "";
        contentText = (res as any).contentText ?? res.content ?? undefined;
        timedOut = (res as any).timedOut ?? false;
        extTitle = res.title;
      } catch (err: any) {
        timedOut = true; // Mark as issue if it fails
        logs.push(err.message);
      }
    } else {
      const fetchRes = await extensionFetch(
        chapter.url,
        adapter.chapterWaitSelector,
        adapter.chapterClickSelector,
      );
      html = fetchRes.html;
      contentText = fetchRes.contentText;
      timedOut = fetchRes.timedOut ?? false;
      logs = fetchRes.logs ?? [];
    }
    const content = sanitizeChapterContent(
      adapter.getChapterContent(html, chapter.url, contentText),
    );

    // Fallback to title from index page or extension result if extracted title is empty
    if (!content.title || content.title.trim() === "") {
      content.title = extTitle || chapter.title;
    }

    if (timedOut) {
      content.warning = `Timeout — nội dung chưa load được (${content.content.length} ký tự)`;
    } else if (content.content.length < 1000) {
      content.warning = `Nội dung quá ngắn (${content.content.length} ký tự)`;
    }
    results.push(content);

    onDebug?.({
      chapterTitle: chapter.title,
      url: chapter.url,
      htmlLength: html.length,
      parsed: content,
      extensionLogs: logs,
      timedOut: timedOut ?? false,
      contentTextLength: contentText?.length ?? 0,
      waitSelector: adapter.chapterWaitSelector,
      clickSelector: adapter.chapterClickSelector,
    });

    if (results.length >= 3) {
      const lastThree = results.slice(-3);
      if (lastThree.every((ch) => ch.warning)) {
        throw new Error(
          "Đã dừng: 3 chương liên tiếp không load được nội dung. Vui lòng mở trang gốc để đảm bảo trang truyện không bị lỗi.",
        );
      }
    }

    if (i < chapters.length - 1) {
      await delay(delayMs);
    }
  }

  onProgress?.(chapters.length, chapters.length, "");
  return results;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
