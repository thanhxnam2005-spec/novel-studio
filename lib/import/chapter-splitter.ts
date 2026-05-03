export interface ChapterCandidate {
  title: string;
  content: string;
  wordCount: number;
}

function countWords(text: string): number {
  // Handles both CJK (count characters) and Latin (count whitespace-separated words)
  const cjk = text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g);
  const latin = text
    .replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return (cjk?.length ?? 0) + latin.length;
}

/**
 * Split raw text into chapters using a regex pattern.
 * The pattern should match chapter headings (e.g. "Chapter 1: Introduction").
 * Text before the first match becomes a "Prologue" chapter if non-empty.
 */
export function splitChapters(
  text: string,
  pattern: RegExp,
): ChapterCandidate[] {
  // Ensure global flag is set
  const flags = pattern.flags.includes("g")
    ? pattern.flags
    : pattern.flags + "g";
  const regex = new RegExp(pattern.source, flags);

  const matches: { title: string; index: number; end: number }[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    matches.push({
      title: match[0].trim(),
      index: match.index,
      end: match.index + match[0].length,
    });
  }

  if (matches.length === 0) {
    // No chapters found — return entire text as single chapter
    const content = text.trim();
    if (!content) return [];
    return [{ title: "Chapter 1", content, wordCount: countWords(content) }];
  }

  const chapters: ChapterCandidate[] = [];

  // Text before first match → Prologue
  const prologueText = text.slice(0, matches[0].index).trim();
  if (prologueText) {
    chapters.push({
      title: "Prologue",
      content: prologueText,
      wordCount: countWords(prologueText),
    });
  }

  // Each match to the next match (or end of text)
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].end;
    const end = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const content = text.slice(start, end).trim();

    chapters.push({
      title: matches[i].title,
      content,
      wordCount: countWords(content),
    });
  }

  return chapters;
}

/**
 * Test a pattern against text and return the number of matches.
 */
export function testPattern(text: string, pattern: RegExp): number {
  const flags = pattern.flags.includes("g")
    ? pattern.flags
    : pattern.flags + "g";
  const regex = new RegExp(pattern.source, flags);
  const matches = text.match(regex);
  return matches?.length ?? 0;
}

/**
 * Create a RegExp from a user-provided string. Returns null if invalid.
 */
export function parseCustomRegex(input: string): RegExp | null {
  try {
    // Check if user provided flags like /pattern/flags
    const match = input.match(/^\/(.+)\/([gimsuy]*)$/);
    if (match) {
      const flags = match[2].includes("g") ? match[2] : match[2] + "g";
      return new RegExp(match[1], flags.includes("m") ? flags : flags + "m");
    }
    // Plain string — treat as regex with gm flags
    return new RegExp(input, "gm");
  } catch {
    return null;
  }
}

/**
 * Split text into chunks of fixed length.
 */
export function splitByLength(
  text: string,
  chunkSize: number,
): ChapterCandidate[] {
  const chapters: ChapterCandidate[] = [];
  let currentPos = 0;
  let index = 1;

  while (currentPos < text.length) {
    const end = Math.min(currentPos + chunkSize, text.length);
    const content = text.slice(currentPos, end).trim();

    if (content) {
      chapters.push({
        title: `Chương ${index}`,
        content,
        wordCount: countWords(content),
      });
      index++;
    }
    currentPos = end;
  }

  return chapters;
}

