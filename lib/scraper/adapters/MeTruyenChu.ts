import type { SiteAdapter } from "../types";

/**
 * Adapter for metruyenchu.com.vn
 *
 * Novel page structure:
 * - URL pattern: /truyen/novel-slug
 * - Title: h1.story-title or h1
 * - Author: a[href*='/tac-gia/'] or .info a
 * - Chapter list: #list-chapter a or ul.list-chapter a
 *   Chapter URLs: /novel-slug/chuong-N-HASH
 *
 * Chapter page:
 * - Title: h2 or .chapter-title
 * - Content: #chapter-c or .chapter-c
 */
export const MeTruyenChuAdapter: SiteAdapter = {
  name: "MeTruyenChu",
  urlPattern: /metruyenchu\.com\.vn/,

  getNovelInfo(html, url) {
    const doc = new DOMParser().parseFromString(html, "text/html");

    // Title
    const title =
      doc.querySelector("h1.story-title")?.textContent?.trim() ??
      doc.querySelector("h1")?.textContent?.trim() ??
      doc.querySelector("title")?.textContent?.replace(/ - MeTruyenChu.*/, "").trim() ??
      "";

    // Author
    const author =
      doc.querySelector('a[href*="/tac-gia/"]')?.textContent?.trim() ??
      undefined;

    // Description
    const descEl =
      doc.querySelector(".desc-text") ??
      doc.querySelector(".story-desc") ??
      doc.querySelector('meta[property="og:description"]');
    const description =
      descEl?.textContent?.trim() ||
      descEl?.getAttribute("content")?.trim() ||
      undefined;

    // Cover
    const coverImage =
      doc.querySelector(".book img")?.getAttribute("src") ??
      doc.querySelector('img[itemprop="image"]')?.getAttribute("src") ??
      undefined;

    // Chapter list
    const chapterLinks = doc.querySelectorAll("#list-chapter a, ul.list-chapter a, .list-chapter a, .list-chap a, a[href*='chuong-'], a[href*='/chuong']");
    const baseUrl = new URL(url).origin;
    const chapters = [...chapterLinks]
      .filter((el) => {
        const href = el.getAttribute("href") ?? "";
        // Only include links that look like chapter links (contain /chuong-)
        return href.includes("/chuong-") || href.includes("chuong");
      })
      .map((el, i) => {
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
      doc.querySelector(".chapter-title")?.textContent?.trim() ??
      doc.querySelector("h2")?.textContent?.trim() ??
      doc.querySelector("title")?.textContent?.split(" - ")[0]?.trim() ??
      "";

    // Prefer contentText from live DOM
    if (contentText) {
      const text = contentText.replace(/\n{3,}/g, "\n\n").trim();
      return { title: chapterTitle, content: text };
    }

    // Fallback: parse from HTML
    const contentEl =
      doc.querySelector("#chapter-c") ??
      doc.querySelector(".chapter-c") ??
      doc.querySelector(".chapter-content");
    if (!contentEl) return { title: chapterTitle, content: "" };

    contentEl.querySelectorAll("script, style, .ads, .ad, ins").forEach((el) => el.remove());
    const text = contentEl.textContent?.replace(/\n{3,}/g, "\n\n").trim() ?? "";

    return { title: chapterTitle, content: text };
  },
};
