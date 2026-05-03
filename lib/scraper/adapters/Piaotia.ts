import type { SiteAdapter } from "../types";

export const PiaotiaAdapter: SiteAdapter = {
  name: "飘天文学",
  urlPattern: /piaotia\.com/i,
  chapterWaitSelector: "#content",

  getNovelInfo(html, url) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const base = new URL(url);

    const title = doc.querySelector("h1")?.textContent?.trim() || "";
    
    // Author and Description are in <td> elements with specific labels
    let author = "";
    let description = "";
    const tds = doc.querySelectorAll("td");
    tds.forEach((td) => {
      const text = td.textContent || "";
      if (text.includes("作    者：")) {
        author = text.split("：")[1]?.trim() || "";
      }
      if (text.includes("内容简介：")) {
        description = text.split("：")[1]?.trim() || "";
      }
    });

    const coverImg = doc.querySelector("img[src*='/bookimage/']");
    const coverImage = coverImg ? new URL(coverImg.getAttribute("src") || "", base).href : undefined;

    // Chapters are usually in <div class="centent"> -> <ul><li><a> or <table><td><a>
    const chapterLinks = doc.querySelectorAll(".centent a[href$='.html']");
    const chapters = Array.from(chapterLinks).map((a, i) => ({
      title: a.textContent?.trim() || `Chương ${i + 1}`,
      url: new URL(a.getAttribute("href") || "", base).href,
      order: i,
    }));

    return { title, author, description, coverImage, chapters };
  },

  getChapterContent(html, _url, contentText) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const chapterTitle = doc.querySelector("h1")?.textContent?.trim() || "";

    // Prefer contentText from extension
    let text = contentText || "";
    if (!text) {
      const contentEl = doc.querySelector("#content");
      if (contentEl) {
        // Remove ads/scripts if any
        contentEl.querySelectorAll("script, style, .ads").forEach((el) => el.remove());
        text = contentEl.textContent || "";
      }
    }

    // Clean up
    text = text
      .replace(/&nbsp;/g, " ")
      .replace(/飘天文学/g, "")
      .replace(/www\.piaotia\.com/g, "")
      .trim();

    return { title: chapterTitle, content: text };
  },
};
