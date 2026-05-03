import type { SiteAdapter } from "../types";

export const CuocengAdapter: SiteAdapter = {
  name: "错层文学",
  urlPattern: /cuoceng\.com/i,
  chapterWaitSelector: ".readBody",

  getNovelInfo(html, url) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const base = new URL(url);

    const title = doc.querySelector("h1")?.textContent?.trim() || "";
    const author = doc.querySelector("a.author")?.textContent?.trim() || undefined;
    const description = doc.querySelector("div.intro")?.textContent?.trim() || undefined;
    
    const coverImg = doc.querySelector("a.book_cover img");
    const coverImage = coverImg ? new URL(coverImg.getAttribute("src") || "", base).href : undefined;

    // Chapters are usually in <div class="dirList"> -> <a> or similar
    const chapterLinks = doc.querySelectorAll(".dirList a[href*='/book/'], .chapterlist a[href*='/book/'], .index_area a[href*='/book/']");
    const chapters = Array.from(chapterLinks).map((a, i) => {
      // Sometimes title is in a span inside a
      const chTitle = a.querySelector("span")?.textContent?.trim() || a.textContent?.trim() || `Chương ${i + 1}`;
      return {
        title: chTitle,
        url: new URL(a.getAttribute("href") || "", base).href,
        order: i,
      };
    });

    return { title, author, description, coverImage, chapters };
  },

  getChapterContent(html, _url, contentText) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const chapterTitle = doc.querySelector("h1")?.textContent?.trim() || "";

    // Prefer contentText from extension
    let text = contentText || "";
    if (!text) {
      const contentEl = doc.querySelector(".readBody");
      if (contentEl) {
        contentEl.querySelectorAll("script, style").forEach((el) => el.remove());
        text = contentEl.textContent || "";
      }
    }

    // Clean up
    text = text
      .replace(/错层文学/g, "")
      .replace(/www\.cuoceng\.com/g, "")
      .trim();

    return { title: chapterTitle, content: text };
  },
};
