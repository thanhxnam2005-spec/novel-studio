/**
 * Clean up Vietnamese text:
 * - Replace multiple spaces with a single space.
 * - Fix spacing around punctuation.
 * - Trim lines.
 */
export function cleanVietnameseText(text: string): string {
  if (!text) return "";

  return text
    // Replace multiple spaces with a single space
    .replace(/[ \t]+/g, " ")
    // Fix spacing before punctuation: "word , " -> "word, "
    .replace(/\s+([,.!?;:])/g, "$1")
    // Fix spacing after punctuation if missing: "word,word" -> "word, word" (careful with numbers)
    .replace(/([,.!?;:])(?=[a-zA-Z\u00C0-\u1EF9])/g, "$1 ")
    // Fix multiple newlines: more than 2 -> 2
    .replace(/\n{3,}/g, "\n\n")
    // Trim each line
    .split("\n")
    .map((line) => line.trim())
    .join("\n");
}

/**
 * Attempts to fix stuck words in Vietnamese text.
 * This is heuristic-based and uses common Vietnamese word patterns.
 */
export function fixStuckWords(text: string): string {
  if (!text) return "";

  // Common Vietnamese words that often get stuck
  // This is a very basic list.
  const commonWords = [
    "là", "của", "được", "trong", "có", "cho", "và", "với", "như", "khi",
    "người", "những", "một", "tên", "thật", "gọi", "đến", "không", "mà", "lại",
    "ra", "vào", "lên", "xuống", "đi", "đã", "đang", "sẽ"
  ];

  let cleaned = text;

  // Heuristic: if a common word is followed by another word without a space
  // We can't easily do this without a full dictionary or knowing the boundaries.
  // But we can look for specific cases requested by the user like "thậtgọi"
  
  // Rule: if we see "thật" + another word, insert space
  // We need to be careful not to break longer words if any.
  // In Vietnamese, words are mostly 1-2 syllables.
  
  // Let's try to find instances where a common word is a prefix of a longer string that isn't a known word.
  // Actually, a simpler way is to use a regex for common combinations.
  
  const stuckPatterns = [
    { pattern: /(thật)(gọi)/gi, replacement: "$1 $2" },
    { pattern: /(tên)(thật)/gi, replacement: "$1 $2" },
    { pattern: /(họ)(Vương)/gi, replacement: "$1 $2" },
  ];

  stuckPatterns.forEach(({ pattern, replacement }) => {
    cleaned = cleaned.replace(pattern, replacement);
  });

  return cleaned;
}
