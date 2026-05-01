import type { SiteAdapter } from "../types";

/**
 * Adapter for sstruyen.com.vn
 *
 * This site is protected by Cloudflare Turnstile, so the extension
 * must load the page in a real browser tab to bypass it.
 *
 * Novel page structure:
 * - Title: h1 or .story-title
 * - Author: a[href*='/tac-gia/']
 * - Chapter list: #list-chapter a or .list-chapter a
 *
 * Chapter page:
 * - Title: h2 or .chapter-title
 * - Content: #chapter-c or .chapter-c
 * - Structure is similar to TruyenFull family
 */
export const SSTruyenAdapter: SiteAdapter = {
  name: "SSTruyen",
  urlPattern: /sstruyen\.com\.vn/,

  getNovelInfo(html, url) {
    const doc = new DOMParser().parseFromString(html, "text/html");

    const title =
      doc.querySelector("h3.title")?.textContent?.trim() ??
      doc.querySelector("h1")?.textContent?.trim() ??
      doc.querySelector(".truyen-title")?.textContent?.trim() ??
      doc.querySelector("title")?.textContent?.replace(/ - SSTruyen.*/, "").trim() ??
      "";

    const author =
      doc.querySelector('a[itemprop="author"]')?.textContent?.trim() ??
      doc.querySelector('a[href*="/tac-gia/"]')?.textContent?.trim() ??
      undefined;

    const descEl = doc.querySelector(".desc-text");
    const description = descEl?.textContent?.trim() || undefined;

    const coverImage =
      doc.querySelector(".book img")?.getAttribute("src") ??
      doc.querySelector('img[itemprop="image"]')?.getAttribute("src") ??
      undefined;

    const chapterLinks = doc.querySelectorAll("#list-chapter .row a, #list-chapter a, .list-chapter a");
    const baseUrl = new URL(url).origin;
    const chapters = [...chapterLinks].map((el, i) => {
      const href = el.getAttribute("href") ?? "";
      const fullUrl = href.startsWith("http") ? href : `${baseUrl}${href}`;
      return {
        title: el.textContent?.trim() ?? `Chương ${i + 1}`,
        url: fullUrl,
        order: i,
      };
    });

    return { title, author, description, coverImage, chapters };
  },

  getChapterContent(html, _url, contentText) {
    const doc = new DOMParser().parseFromString(html, "text/html");

    const chapterTitle =
      doc.querySelector("a.chapter-title")?.textContent?.trim() ??
      doc.querySelector(".chapter-title")?.textContent?.trim() ??
      doc.querySelector("h2")?.textContent?.trim() ??
      doc.querySelector("title")?.textContent?.split(" - ")[0]?.trim() ??
      "";

    if (contentText) {
      const text = contentText.replace(/\n{3,}/g, "\n\n").trim();
      return { title: chapterTitle, content: text };
    }

    const contentEl = doc.querySelector("#chapter-c") ?? doc.querySelector(".chapter-c");
    if (!contentEl) return { title: chapterTitle, content: "" };

    contentEl.querySelectorAll("script, style, .ads, .ad, ins").forEach((el) => el.remove());
    const text = contentEl.textContent?.replace(/\n{3,}/g, "\n\n").trim() ?? "";

    return { title: chapterTitle, content: text };
  },
};
