/**
 * STV (SangTacViet) Translator Service
 *
 * Gửi văn bản tiếng Trung lên server STV để dịch sang tiếng Việt.
 * Áp dụng rate limit: tối đa 10.000 ký tự mỗi 2 giây.
 *
 * Server: POST https://comic.sangtacvietcdn.xyz/tsm.php?cdn=
 * Body:   sajax=trans&content=<text>
 * CORS:   access-control-allow-origin: *  (gọi trực tiếp từ browser)
 */

const STV_API_URL = "https://comic.sangtacvietcdn.xyz/tsm.php?cdn=";

// ── Rate Limiter ────────────────────────────────────────────
// Tối đa 10.000 ký tự mỗi 2 giây
const RATE_LIMIT_CHARS = 10_000;
const RATE_LIMIT_WINDOW_MS = 2_000;

let charsSentInWindow = 0;
let windowStartTime = Date.now();

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForRateLimit(charsToSend: number): Promise<void> {
  while (true) {
    const now = Date.now();
    const elapsed = now - windowStartTime;

    // Reset window nếu đã hết 2 giây
    if (elapsed >= RATE_LIMIT_WINDOW_MS) {
      charsSentInWindow = 0;
      windowStartTime = now;
    }

    // Nếu gửi thêm charsToSend vẫn nằm trong giới hạn → cho phép
    if (charsSentInWindow + charsToSend <= RATE_LIMIT_CHARS) {
      charsSentInWindow += charsToSend;
      return;
    }

    // Chờ hết window hiện tại
    const waitTime = RATE_LIMIT_WINDOW_MS - elapsed + 50;
    await delay(waitTime);
  }
}

// ── Core: gọi API dịch 1 đoạn nhỏ ─────────────────────────

async function translateChunk(text: string): Promise<string> {
  if (!text.trim()) return text; // preserve whitespace-only

  await waitForRateLimit(text.length);

  const postData = new URLSearchParams();
  postData.append("sajax", "trans");
  postData.append("content", text);

  const res = await fetch(STV_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: postData.toString(),
  });

  if (!res.ok) {
    throw new Error(`STV API HTTP ${res.status}`);
  }

  let result = await res.text();
  // Server thường trả kèm \n ở cuối
  if (result.endsWith("\n")) result = result.slice(0, -1);
  return result;
}

// ── Tách text thành chunks ≤ RATE_LIMIT_CHARS ───────────────

function splitIntoChunks(text: string, maxSize: number): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    if (text.length - start <= maxSize) {
      chunks.push(text.substring(start));
      break;
    }

    // Tìm vị trí cắt hợp lý (ưu tiên xuống dòng, dấu chấm, dấu phẩy)
    let splitAt = text.lastIndexOf("\n", start + maxSize);
    if (splitAt <= start) splitAt = text.lastIndexOf("。", start + maxSize);
    if (splitAt <= start) splitAt = text.lastIndexOf(".", start + maxSize);
    if (splitAt <= start) splitAt = text.lastIndexOf("，", start + maxSize);
    if (splitAt <= start) splitAt = start + maxSize;
    else splitAt += 1; // bao gồm ký tự phân cách

    chunks.push(text.substring(start, splitAt));
    start = splitAt;
  }

  return chunks;
}

// ── Public API ──────────────────────────────────────────────

export interface STVTranslateProgress {
  /** Chunk đang xử lý (0-indexed) */
  currentChunk: number;
  /** Tổng số chunks */
  totalChunks: number;
  /** Kết quả tạm thời (các chunk đã dịch xong ghép lại) */
  partialResult: string;
}

/**
 * Tiền xử lý: Thay thế các từ Trung Quốc bằng nghĩa Việt trong từ điển trước khi dịch.
 * Điều này ép STV phải sử dụng nghĩa mà người dùng mong muốn.
 */
export function applyDictionaryPreTranslate(
  text: string,
  dict: Array<{ chinese: string; vietnamese: string }>,
): string {
  if (!text || dict.length === 0) return text;

  // Sắp xếp từ dài nhất lên trước để tránh thay thế nhầm
  const sortedDict = [...dict].sort((a, b) => b.chinese.length - a.chinese.length);
  
  let result = text;
  for (const entry of sortedDict) {
    if (!entry.chinese || !entry.vietnamese) continue;
    // Sử dụng regex để thay thế tất cả các cụm từ Trung Quốc tương ứng
    // Chúng ta không dùng bọc dấu vì STV có thể bị rối, 
    // STV thường giữ nguyên các từ đã là Tiếng Việt.
    const regex = new RegExp(entry.chinese, "g");
    result = result.replace(regex, entry.vietnamese);
  }
  return result;
}

/**
 * Dịch toàn bộ văn bản tiếng Trung sang tiếng Việt qua STV API.
 * Bảo toàn cấu trúc xuống dòng bằng cách xử lý theo từng đoạn văn.
 */
export async function stvTranslate(
  text: string,
  options?: {
    onProgress?: (progress: STVTranslateProgress) => void;
    signal?: AbortSignal;
    dictionary?: Array<{ chinese: string; vietnamese: string }>;
  },
): Promise<string> {
  if (!text || !text.trim()) return "";

  // 1. Áp dụng từ điển trước khi gửi đi (Tiền xử lý)
  let processedText = text;
  if (options?.dictionary && options.dictionary.length > 0) {
    processedText = applyDictionaryPreTranslate(text, options.dictionary);
  }

  const lines = processedText.split("\n");
  const results: string[] = [];
  
  const batches: string[][] = [];
  let currentBatch: string[] = [];
  let currentBatchLen = 0;

  for (const line of lines) {
    if (line.length > RATE_LIMIT_CHARS) {
      if (currentBatch.length > 0) batches.push(currentBatch);
      batches.push([line]);
      currentBatch = [];
      currentBatchLen = 0;
      continue;
    }

    if (currentBatchLen + line.length + 1 > 8000) {
      batches.push(currentBatch);
      currentBatch = [line];
      currentBatchLen = line.length;
    } else {
      currentBatch.push(line);
      currentBatchLen += line.length + 1;
    }
  }
  if (currentBatch.length > 0) batches.push(currentBatch);

  for (let i = 0; i < batches.length; i++) {
    if (options?.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const batchText = batches[i].join("\n");
    const translated = await translateChunk(batchText);
    results.push(translated);

    options?.onProgress?.({
      currentChunk: i,
      totalChunks: batches.length,
      partialResult: results.join("\n"),
    });
  }

  return results.join("\n");
}

/**
 * Dịch từng dòng (giữ nguyên cấu trúc xuống dòng).
 * Mỗi dòng được gửi riêng để kết quả mapping chính xác.
 * Phù hợp cho chế độ live compare.
 */
export async function stvTranslatePreserveLines(
  text: string,
  options?: {
    onProgress?: (progress: STVTranslateProgress) => void;
    signal?: AbortSignal;
  },
): Promise<string> {
  if (!text || !text.trim()) return "";

  // Tách dòng, gom thành các batch ≤ RATE_LIMIT_CHARS
  // dùng delimiter =|==|= để server dịch từng phần riêng
  const lines = text.split("\n");
  const DELIMITER = "=|==|=";
  const batches: string[][] = [];
  let currentBatch: string[] = [];
  let currentLen = 0;

  for (const line of lines) {
    const addLen = line.length + (currentBatch.length > 0 ? DELIMITER.length : 0);
    if (currentLen + addLen > RATE_LIMIT_CHARS && currentBatch.length > 0) {
      batches.push(currentBatch);
      currentBatch = [];
      currentLen = 0;
    }
    currentBatch.push(line);
    currentLen += addLen;
  }
  if (currentBatch.length > 0) batches.push(currentBatch);

  const allTranslatedLines: string[] = [];

  for (let i = 0; i < batches.length; i++) {
    if (options?.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const batchText = batches[i].join(DELIMITER);
    const translated = await translateChunk(batchText);
    const translatedLines = translated.split(DELIMITER);

    // Đảm bảo số dòng khớp
    for (let j = 0; j < batches[i].length; j++) {
      allTranslatedLines.push(translatedLines[j]?.trim() ?? "");
    }

    options?.onProgress?.({
      currentChunk: i,
      totalChunks: batches.length,
      partialResult: allTranslatedLines.join("\n"),
    });
  }

  return allTranslatedLines.join("\n");
}
