/**
 * HTML probes for scraper debug when a chapter page times out or returns empty content.
 */

export interface ChapterPageDiagnostics {
  url: string;
  htmlLength: number;
  bodyTextLength: number;
  parserErrors: number;
  titleTag: string | null;
  requestedWaitSelector?: string;
  waitSelectorMatch: {
    exists: boolean;
    textLength: number;
    innerHtmlLength: number;
  };
  selectorCounts: Record<string, number>;
  elementIdsMatching: string[];
  rawHtmlHints: {
    idContentboxDouble: boolean;
    idContentDouble: boolean;
    classContentbox: boolean;
  };
  bodyTextPreview: string;
}

const EXTRA_SELECTORS = [
  "#contentbox",
  ".read .readcontent",
  ".read .readcotent",
  ".read",
  "#content",
  ".content",
  "#ChapterContents",
  "#txtcontent",
  ".read-content",
  "#content-container .contentbox",
  ".article-content",
  "article",
] as const;

export function diagnoseChapterPageHtml(
  html: string,
  url: string,
  waitSelector?: string,
): ChapterPageDiagnostics {
  const doc = new DOMParser().parseFromString(html, "text/html");

  const selectorCounts: Record<string, number> = {};
  for (const sel of EXTRA_SELECTORS) {
    try {
      selectorCounts[sel] = doc.querySelectorAll(sel).length;
    } catch {
      selectorCounts[sel] = -1;
    }
  }

  let exists = false;
  let textLength = 0;
  let innerHtmlLength = 0;
  if (waitSelector) {
    try {
      const el = doc.querySelector(waitSelector);
      exists = !!el;
      textLength = el?.textContent?.trim().length ?? 0;
      innerHtmlLength = el?.innerHTML?.length ?? 0;
    } catch {
      exists = false;
    }
  }

  const elementIdsMatching = [...doc.querySelectorAll("[id]")]
    .map((el) => el.id)
    .filter((id) => /content|chapter|read|text|article|book/i.test(id))
    .slice(0, 40);

  const bodyTextPreview = (doc.body?.textContent ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 400);

  return {
    url,
    htmlLength: html.length,
    bodyTextLength: doc.body?.textContent?.length ?? 0,
    parserErrors: doc.querySelectorAll("parsererror").length,
    titleTag: doc.querySelector("title")?.textContent?.trim().slice(0, 200) ?? null,
    requestedWaitSelector: waitSelector,
    waitSelectorMatch: {
      exists,
      textLength,
      innerHtmlLength,
    },
    selectorCounts,
    elementIdsMatching,
    rawHtmlHints: {
      idContentboxDouble: html.includes('id="contentbox"'),
      idContentDouble: /\bid\s*=\s*["']content["']/i.test(html),
      classContentbox: /class\s*=\s*["'][^"']*content[^"']*box[^"']*["']/i.test(html),
    },
    bodyTextPreview,
  };
}
