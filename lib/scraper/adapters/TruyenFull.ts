import type { SiteAdapter } from "../types";

/**
 * Adapter for truyenfull.vision (and truyenfull.vn mirrors)
 *
 * Novel page structure:
 * - Title: h3.title (inside .truyen > .col-info-desc)
 * - Author: a[itemprop="author"]
 * - Description: .desc-text
 * - Chapter list: #list-chapter .row a (paginated, but first page has initial chapters)
 *   Chapter URLs: /novel-slug/chuong-N/
 *
 * Chapter page:
 * - Title: a.chapter-title or h2
 * - Content: #chapter-c  (static HTML, no JS loading needed)
 */
export const TruyenFullAdapter: SiteAdapter = {
  name: "TruyenFull",
  urlPattern: /truyenfull\.\w+/,
  // NOTE: #chapter-c exists but content is loaded via JS/AJAX.
  // Do NOT use chapterWaitSelector — let extension use waitForStableContent instead.

  getNovelInfo(html, url) {
    const doc = new DOMParser().parseFromString(html, "text/html");

    // Title
    const title =
      doc.querySelector("h3.title")?.textContent?.trim() ??
      doc.querySelector(".truyen-title")?.textContent?.trim() ??
      doc.querySelector("title")?.textContent?.replace(/ - Truyenfull.*/, "").trim() ??
      "";

    // Author
    const author =
      doc.querySelector('a[itemprop="author"]')?.textContent?.trim() ??
      doc.querySelector(".info a[href*='/tac-gia/']")?.textContent?.trim() ??
      undefined;

    // Description
    const descEl = doc.querySelector(".desc-text");
    const description = descEl?.textContent?.trim() || undefined;

    // Cover
    const coverImage =
      doc.querySelector(".book img")?.getAttribute("src") ??
      doc.querySelector('img[itemprop="image"]')?.getAttribute("src") ??
      undefined;

    // Chapter list from #list-chapter
    const chapterLinks = doc.querySelectorAll("#list-chapter .row a");
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

    // Chapter title
    const chapterTitle =
      doc.querySelector("a.chapter-title")?.textContent?.trim() ??
      doc.querySelector(".chapter-title")?.textContent?.trim() ??
      doc.querySelector("h2")?.textContent?.trim() ??
      doc.querySelector("title")?.textContent?.split(" - ")[0]?.trim() ??
      "";

    // Prefer contentText from live DOM (bypasses any obfuscation)
    if (contentText) {
      const text = contentText.replace(/\n{3,}/g, "\n\n").trim();
      return { title: chapterTitle, content: text };
    }

    // Fallback: parse from HTML
    const contentEl = doc.querySelector("#chapter-c") ?? doc.querySelector(".chapter-c");
    if (!contentEl) return { title: chapterTitle, content: "" };

    // Remove ads and scripts
    contentEl.querySelectorAll("script, style, .ads, .ad, ins, .chapter-nav").forEach((el) => el.remove());
    const text = contentEl.textContent?.replace(/\n{3,}/g, "\n\n").trim() ?? "";

    return { title: chapterTitle, content: text };
  },
};
