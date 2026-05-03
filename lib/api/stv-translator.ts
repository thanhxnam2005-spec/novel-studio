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
 * Dịch toàn bộ văn bản tiếng Trung sang tiếng Việt qua STV API.
 *
 * - Tự động chia nhỏ nếu text > 10.000 ký tự.
 * - Rate limit: 10.000 ký tự / 2 giây.
 * - `onProgress` callback để cập nhật UI real-time.
 * - `signal` để hỗ trợ hủy (AbortController).
 */
export async function stvTranslate(
  text: string,
  options?: {
    onProgress?: (progress: STVTranslateProgress) => void;
    signal?: AbortSignal;
  },
): Promise<string> {
  if (!text || !text.trim()) return "";

  const chunks = splitIntoChunks(text, RATE_LIMIT_CHARS);
  const results: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    // Kiểm tra abort
    if (options?.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    const translated = await translateChunk(chunks[i]);
    results.push(translated);

    // Callback progress
    options?.onProgress?.({
      currentChunk: i,
      totalChunks: chunks.length,
      partialResult: results.join(""),
    });
  }

  return results.join("");
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
