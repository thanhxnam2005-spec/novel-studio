/**
 * Serializable probes for scraper debug logs when chapter list parsing fails
 * or to verify HTML shape after extension fetch.
 */

export interface NovelPageDiagnostics {
  url: string;
  bookIdFromUrl: string | null;
  htmlLength: number;
  bodyTextLength: number;
  parserErrors: number;
  titleTag: string | null;
  rawHtmlHints: {
    idChapterListDouble: boolean;
    idChapterListSingle: boolean;
    idChapterListLoose: boolean;
    classChapterList: boolean;
  };
  selectorCounts: Record<string, number>;
  elementIdsMatching: string[];
  bookScopedChapterLinks: number;
  sampleBookLinks: { href: string | null; text: string }[];
  scriptSnippetsMatchingChapter: string[];
  /** First chars of body text — detects empty shell / Cloudflare challenge copy */
  bodyTextPreview: string;
}

const PROBE_SELECTORS: Record<string, string> = {
  "#chapterList": "#chapterList",
  "#chapterList > li": "#chapterList > li",
  "#chapterList > li > a": "#chapterList > li > a",
  "#chapterlist > li > a": "#chapterlist > li > a",
  ".chapterlist a": ".chapterlist a",
  "#list dd a": "#list dd a",
  "dd.jieshao_content": "dd.jieshao_content",
  "a.bookImg img": "a.bookImg img",
  ".ajaxchapterlist a": ".ajaxchapterlist a",
  "#readerlists a": "#readerlists a",
  "ul.catalog-list a": "ul.catalog-list a",
};

export function diagnoseNovelPageHtml(html: string, url: string): NovelPageDiagnostics {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const bookIdFromUrl = url.match(/\/book\/(\d+)/)?.[1] ?? null;

  const selectorCounts: Record<string, number> = {};
  for (const [key, sel] of Object.entries(PROBE_SELECTORS)) {
    try {
      selectorCounts[key] = doc.querySelectorAll(sel).length;
    } catch {
      selectorCounts[key] = -1;
    }
  }

  const elementIdsMatching = [...doc.querySelectorAll("[id]")]
    .map((el) => el.id)
    .filter((id) => /chapter|list|mulu|catalog|volume|reader|ajax/i.test(id))
    .slice(0, 50);

  const bookScopedSelector =
    bookIdFromUrl !== null
      ? `a[href*="/book/${bookIdFromUrl}/"][href$=".html"]`
      : 'a[href*="/book/"][href$=".html"]';

  let bookScopedChapterLinks = 0;
  try {
    bookScopedChapterLinks = doc.querySelectorAll(bookScopedSelector).length;
  } catch {
    bookScopedChapterLinks = -1;
  }

  const sampleBookLinks = [...doc.querySelectorAll('a[href*="/book/"]')]
    .slice(0, 12)
    .map((el) => ({
      href: el.getAttribute("href"),
      text: (el.textContent?.trim() ?? "").slice(0, 80),
    }));

  const scriptSnippetsMatchingChapter = extractScriptHints(html);
  const bodyTextPreview = (doc.body?.textContent ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);

  return {
    url,
    bookIdFromUrl,
    htmlLength: html.length,
    bodyTextLength: doc.body?.textContent?.length ?? 0,
    parserErrors: doc.querySelectorAll("parsererror").length,
    titleTag: doc.querySelector("title")?.textContent?.trim().slice(0, 240) ?? null,
    rawHtmlHints: {
      idChapterListDouble: html.includes('id="chapterList"'),
      idChapterListSingle: html.includes("id='chapterList'"),
      idChapterListLoose: /id\s*=\s*["'][^"']*chapter[^"']*list[^"']*["']/i.test(html),
      classChapterList: /class\s*=\s*["'][^"']*chapter[^"']*list[^"']*["']/i.test(html),
    },
    selectorCounts,
    elementIdsMatching,
    bookScopedChapterLinks,
    sampleBookLinks,
    scriptSnippetsMatchingChapter,
    bodyTextPreview,
  };
}

function extractScriptHints(html: string): string[] {
  const patterns = [
    /chapterList/gi,
    /chapterlist/gi,
    /getChapter/gi,
    /chapter_url/gi,
    /\/modules\/article/gi,
  ];
  const found = new Set<string>();
  for (const re of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null && found.size < 15) {
      const start = Math.max(0, m.index - 40);
      const end = Math.min(html.length, m.index + 80);
      found.add(html.slice(start, end).replace(/\s+/g, " ").trim());
    }
  }
  return [...found].slice(0, 15);
}

/** Compact subset for bug reports when the index yields 0 chapters */
export function novelIndexDebugSummary(html: string, url: string) {
  const d = diagnoseNovelPageHtml(html, url);
  return {
    htmlLen: d.htmlLength,
    listA: d.selectorCounts["#chapterList > li > a"],
    classChapA: d.selectorCounts[".chapterlist a"],
    bookScoped: d.bookScopedChapterLinks,
    listIds: d.elementIdsMatching.slice(0, 8),
  };
}
