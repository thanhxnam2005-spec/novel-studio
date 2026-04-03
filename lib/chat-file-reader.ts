import type { ChatFile } from "./db";

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export const SUPPORTED_FILE_MIMETYPES = new Set([
  "text/plain",
  "text/markdown",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export const FILE_INPUT_ACCEPT =
  ".txt,.md,.pdf,.docx,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function isSupportedFile(file: File): boolean {
  return (
    SUPPORTED_FILE_MIMETYPES.has(file.type) ||
    /\.(txt|md|pdf|docx)$/i.test(file.name)
  );
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function readFileAsChat(file: File): Promise<ChatFile> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `"${file.name}" vượt quá giới hạn 5 MB (${formatFileSize(file.size)}).`,
    );
  }

  let content: string;

  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    content = await extractPdfText(file);
  } else if (
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    /\.docx$/i.test(file.name)
  ) {
    content = await extractDocxText(file);
  } else {
    content = await file.text();
  }

  return { name: file.name, mimeType: file.type || "text/plain", size: file.size, content };
}

async function extractPdfText(file: File): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .trim();
    if (pageText) pages.push(pageText);
  }

  return pages.join("\n\n");
}

async function extractDocxText(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}
