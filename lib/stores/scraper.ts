import { create } from "zustand";
import { detectAdapter } from "../scraper/adapters";
import {
  sanitizeChapterContent,
  scrapeChapters,
  type ScrapeDebugEntry,
} from "../scraper/engine";
import { extensionFetch, checkExtensionStatus, extensionDownloadSTVChapter } from "../scraper/extension-bridge";
import { novelIndexDebugSummary } from "../scraper/novel-page-diagnostics";
import type {
  ChapterContent,
  NovelInfo,
  SiteAdapter,
} from "../scraper/types";

export type ScraperStep = "url" | "select" | "stv-wait" | "scraping" | "preview";

export interface DebugLog {
  timestamp: string;
  label: string;
  data: string;
}

interface ScraperState {
  step: ScraperStep;
  url: string;
  adapter: SiteAdapter | null;
  extensionAvailable: boolean | null;
  extensionVersion: string | null;
  novelInfo: NovelInfo | null;
  selectedChapterUrls: Set<string>;
  scrapedChapters: ChapterContent[];
  progress: { completed: number; total: number; current: string };
  isLoading: boolean;
  error: string | null;
  abortController: AbortController | null;
  retryingIndex: number | null;
  debugLogs: DebugLog[];
  chapterDelay: number;

  // Actions
  setUrl: (url: string) => void;
  setAdapter: (adapter: SiteAdapter | null) => void;
  checkExtension: () => Promise<void>;
  fetchNovelInfo: () => Promise<void>;
  toggleChapter: (url: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  startScraping: () => Promise<void>;
  confirmSTVReady: () => Promise<void>;
  retryScrapeChapter: (index: number) => Promise<void>;
  abortScraping: () => void;
  setStep: (step: ScraperStep) => void;
  setChapterDelay: (delay: number) => void;
  reset: () => void;
  clearDebugLogs: () => void;
}

const initialState = {
  step: "url" as ScraperStep,
  url: "",
  adapter: null as SiteAdapter | null,
  extensionAvailable: null as boolean | null,
  extensionVersion: null as string | null,
  novelInfo: null as NovelInfo | null,
  selectedChapterUrls: new Set<string>(),
  scrapedChapters: [] as ChapterContent[],
  progress: { completed: 0, total: 0, current: "" },
  isLoading: false,
  error: null as string | null,
  abortController: null as AbortController | null,
  retryingIndex: null as number | null,
  debugLogs: [] as DebugLog[],
  chapterDelay: 2,
};

function addLog(label: string, data: unknown) {
  const log: DebugLog = {
    timestamp: new Date().toLocaleTimeString(),
    label,
    data: typeof data === "string" ? data : JSON.stringify(data, null, 2),
  };
  const prev = useScraperStore.getState().debugLogs;
  useScraperStore.setState({ debugLogs: [...prev, log] });
}

function logChapterIssue(entry: ScrapeDebugEntry) {
  const issue =
    entry.timedOut ||
    !!entry.parsed.warning ||
    entry.parsed.content.length < 100;
  if (!issue) return;

  addLog("Scrape · chapter issue", {
    title: entry.chapterTitle,
    url: entry.url,
    len: entry.parsed.content.length,
    htmlLen: entry.htmlLength,
    timedOut: entry.timedOut,
    ctLen: entry.contentTextLength,
    warning: entry.parsed.warning ?? null,
    wait: entry.waitSelector ?? null,
    click: entry.clickSelector ?? null,
  });
  if (entry.extensionLogs?.length) {
    const tail = entry.extensionLogs.slice(-4).join(" | ");
    addLog("Scrape · chapter · ext tail", tail);
  }
}

export const useScraperStore = create<ScraperState>((set, get) => ({
  ...initialState,

  setUrl: (url) => {
    const adapter = detectAdapter(url);
    // Only auto-detect if no manual override or URL changed domain
    const current = get().adapter;
    set({ url, adapter: adapter ?? current, error: null });
  },

  setAdapter: (adapter) => {
    set({ adapter });
  },

  checkExtension: async () => {
    const { available, version } = await checkExtensionStatus();
    set({ extensionAvailable: available, extensionVersion: version });
  },

  fetchNovelInfo: async () => {
    const { url, adapter } = get();
    if (!adapter) {
      set({ error: "Không tìm thấy adapter cho URL này" });
      return;
    }

    set({ isLoading: true, error: null, debugLogs: [] });
    try {
      const { html, timedOut } = await extensionFetch(url);
      const novelInfo = adapter.getNovelInfo(html, url);

      addLog("Scrape · index", {
        ok: true,
        url,
        adapter: adapter.name,
        title: novelInfo.title,
        chapters: novelInfo.chapters.length,
        cover: Boolean(novelInfo.coverImage),
        htmlLen: html.length,
        timedOut: timedOut ?? false,
      });

      if (novelInfo.chapters.length === 0) {
        addLog("Scrape · index · no chapters", {
          url,
          adapter: adapter.name,
          title: novelInfo.title,
          probe: novelIndexDebugSummary(html, url),
        });
        set({ error: "Không tìm thấy chương nào", isLoading: false });
        return;
      }

      const selectedChapterUrls = new Set(
        novelInfo.chapters.map((ch) => ch.url),
      );

      set({
        novelInfo,
        selectedChapterUrls,
        isLoading: false,
        step: "select",
      });
    } catch (err) {
      addLog("Scrape · index · error", err instanceof Error ? err.message : String(err));
      set({
        error:
          err instanceof Error ? err.message : "Lỗi khi lấy thông tin truyện",
        isLoading: false,
      });
    }
  },

  toggleChapter: (url) => {
    const selected = new Set(get().selectedChapterUrls);
    if (selected.has(url)) selected.delete(url);
    else selected.add(url);
    set({ selectedChapterUrls: selected });
  },

  selectAll: () => {
    const chapters = get().novelInfo?.chapters ?? [];
    set({ selectedChapterUrls: new Set(chapters.map((ch) => ch.url)) });
  },

  deselectAll: () => {
    set({ selectedChapterUrls: new Set() });
  },

  startScraping: async () => {
    const { novelInfo, selectedChapterUrls, adapter } = get();
    if (!novelInfo || !adapter) return;

    const selectedChapters = novelInfo.chapters.filter((ch) =>
      selectedChapterUrls.has(ch.url),
    );
    if (selectedChapters.length === 0) return;

    // STV: hiện bước chờ user mở chương 1 bằng tay
    if (adapter.name === "STV") {
      set({ step: "stv-wait", error: null });
      return;
    }

    const abortController = new AbortController();
    set({
      step: "scraping",
      isLoading: true,
      error: null,
      scrapedChapters: [],
      progress: { completed: 0, total: selectedChapters.length, current: "" },
      abortController,
    });

    try {
      await scrapeChapters(
        selectedChapters,
        adapter,
        (completed, total, currentTitle) => {
          set({ progress: { completed, total, current: currentTitle } });
        },
        abortController.signal,
        (entry) => {
          // Push chapter to store immediately for live UI updates
          const prev = get().scrapedChapters;
          set({ scrapedChapters: [...prev, entry.parsed] });

          logChapterIssue(entry);
        },
        get().chapterDelay * 1000,
      );

      set({
        isLoading: false,
        step: "preview",
        abortController: null,
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        set({ isLoading: false, error: "Đã hủy scraping", abortController: null });
        return;
      }
      addLog("Scrape · batch · error", err instanceof Error ? err.message : String(err));
      set({
        error: err instanceof Error ? err.message : "Lỗi khi scrape",
        isLoading: false,
        abortController: null,
      });
    }
  },

  // STV: user đã mở chương 1 bằng tay, bắt đầu scrape thật
  confirmSTVReady: async () => {
    const { novelInfo, selectedChapterUrls, adapter } = get();
    if (!novelInfo || !adapter) return;

    const selectedChapters = novelInfo.chapters.filter((ch) =>
      selectedChapterUrls.has(ch.url),
    );
    if (selectedChapters.length === 0) return;

    const abortController = new AbortController();
    set({
      step: "scraping",
      isLoading: true,
      error: null,
      scrapedChapters: [],
      progress: { completed: 0, total: selectedChapters.length, current: "" },
      abortController,
    });

    try {
      await scrapeChapters(
        selectedChapters,
        adapter,
        (completed, total, currentTitle) => {
          set({ progress: { completed, total, current: currentTitle } });
        },
        abortController.signal,
        (entry) => {
          const prev = get().scrapedChapters;
          set({ scrapedChapters: [...prev, entry.parsed] });
          logChapterIssue(entry);
        },
        get().chapterDelay * 1000,
      );

      set({
        isLoading: false,
        step: "preview",
        abortController: null,
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        set({ isLoading: false, error: "Đã hủy scraping", abortController: null });
        return;
      }
      set({
        error: err instanceof Error ? err.message : "Lỗi khi scrape",
        isLoading: false,
        abortController: null,
      });
    }
  },

  retryScrapeChapter: async (index) => {
    const { novelInfo, scrapedChapters, adapter } = get();
    if (!novelInfo || !adapter) return;

    const selectedUrls = get().selectedChapterUrls;
    const selectedChapters = novelInfo.chapters.filter((ch) => selectedUrls.has(ch.url));
    const chapterLink = selectedChapters[index];
    if (!chapterLink) return;

    set({ retryingIndex: index });
    try {
      let html = "";
      let contentText: string | undefined = undefined;
      let timedOut = false;
      let logs: string[] = [];

      let extTitle: string | undefined = undefined;
      if (adapter.name === "STV" && chapterLink.id) {
        try {
          const res = await extensionDownloadSTVChapter(chapterLink.id, chapterLink.url);
          html = res.data ?? "";
          contentText = (res as any).contentText ?? res.content ?? undefined;
          timedOut = (res as any).timedOut ?? false;
          extTitle = res.title;
        } catch (err: any) {
          timedOut = true;
          logs.push(err.message);
        }
      } else {
        const fetchRes = await extensionFetch(
          chapterLink.url,
          adapter.chapterWaitSelector,
          adapter.chapterClickSelector,
        );
        html = fetchRes.html;
        contentText = fetchRes.contentText;
        timedOut = fetchRes.timedOut ?? false;
        logs = fetchRes.logs ?? [];
      }

      const content = sanitizeChapterContent(
        adapter.getChapterContent(html, chapterLink.url, contentText),
      );

      // Fallback to title from index page or extension result if extracted title is empty
      if (!content.title || content.title.trim() === "") {
        content.title = extTitle || chapterLink.title;
      }

      if (timedOut) {
        content.warning = `Timeout — nội dung chưa load được (${content.content.length} ký tự)`;
      } else if (content.content.length < 1000) {
        content.warning = `Nội dung quá ngắn (${content.content.length} ký tự) — có thể chưa load được`;
      }
      const updated = [...scrapedChapters];
      updated[index] = content;
      set({ scrapedChapters: updated, retryingIndex: null });

      logChapterIssue({
        chapterTitle: chapterLink.title,
        url: chapterLink.url,
        htmlLength: html.length,
        parsed: content,
        extensionLogs: logs,
        timedOut: timedOut ?? false,
        contentTextLength: contentText?.length ?? 0,
        waitSelector: adapter.chapterWaitSelector,
        clickSelector: adapter.chapterClickSelector,
      });
    } catch (err) {
      set({ retryingIndex: null });
      addLog("Scrape · retry · error", err instanceof Error ? err.message : String(err));
    }
  },

  abortScraping: () => {
    get().abortController?.abort();
  },

  setStep: (step) => set({ step }),

  setChapterDelay: (delay) => set({ chapterDelay: delay }),

  reset: () => set({ ...initialState, debugLogs: [] }),

  clearDebugLogs: () => set({ debugLogs: [] }),
}));
