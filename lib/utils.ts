import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

/** Convert basic markdown to HTML (bold, italic, links, inline code) */
export function markdownToHtml(md: string): string {
  return md
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      (_match, text: string, url: string) => {
        if (/^https?:\/\//.test(url)) {
          return `<a href="${url}" class="underline font-medium hover:opacity-80" target="_blank" rel="noopener noreferrer">${text}</a>`;
        }
        if (/^\/[^/]/.test(url) || url.startsWith("#")) {
          return `<a href="${url}" class="underline font-medium hover:opacity-80">${text}</a>`;
        }
        return text;
      },
    )
    .replace(/\n/g, "<br />");
}

/**
 * Strips all HTML tags, decodes basic HTML entities, and extracts text content from HTML or Markdown.
 * Handles: tags, common entities, line breaks, inline code, emphasis, links, and basic markdown syntax.
 */
export function sanitizeText(text: string): string {
  if (!text) return "";
  let output = text;

  output = output.replace(/<br\s*\/?>/gi, " ");
  output = output.replace(
    /<\/(p|div|li|h\d|tr|section|article|ul|ol|table)>/gi,
    "\n",
  );
  output = output.replace(/<[^>]+>/g, "");
  output = output
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x2F;/gi, "/");
  output = output
    .replace(/[*_]{2}([^*_]+)[*_]{2}/g, "$1")
    .replace(/[*_]([^*_]+)[*_]/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/`([^`]+)`/g, "$1");

  output = output.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  output = output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");

  output = output.replace(/\s+/g, " ").trim();

  return output;
}

export function isHex(v: string) {
  return /^#([0-9a-fA-F]{3,8})$/.test(v);
}
