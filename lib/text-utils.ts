/**
 * Clean up Vietnamese text:
 * - Replace multiple spaces with a single space.
 * - Fix spacing around punctuation.
 * - Trim lines.
 */
export function cleanVietnameseText(text: string): string {
  if (!text) return "";

  return text
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .replace(/([,.!?;:])(?=[a-zA-Z\u00C0-\u1EF9])/g, "$1 ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n");
}

// ── Vietnamese phonotactic helpers ──────────────────────────

const VIET_LETTER_RE =
  /^[a-zA-ZđĐàáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴ]$/;

function isSingleVietnameseLetter(token: string): boolean {
  return token.length === 1 && VIET_LETTER_RE.test(token);
}

/** Vietnamese consonant letters (lowercase) */
const CONSONANTS = new Set("bcdfghjklmnpqrstvwxzđ".split(""));

/** Valid 2-letter initial consonant clusters */
const VALID_INITIALS = new Set([
  "ch", "gh", "gi", "kh", "ng", "nh", "ph", "qu", "th", "tr",
]);

/** Valid Vietnamese syllable-final consonant clusters */
const VALID_FINALS = new Set([
  "c", "ch", "m", "n", "ng", "nh", "p", "t",
]);

/**
 * Merge Vietnamese syllables that were split apart by the STV API.
 *
 * STV sometimes returns "t rắn g" instead of "trắng".
 * This uses phonotactic rules to decide merge direction:
 *
 * 1. If single consonant + next token forms a valid initial (tr, ph, ch…) → merge RIGHT
 * 2. If prev's last char(s) + this letter forms a valid final (ng, nh…) → merge LEFT
 * 3. If next starts with vowel AND prev doesn't claim this as a final → merge RIGHT
 * 4. Default → merge LEFT (treat as final consonant)
 */
function mergeSplitSyllables(text: string): string {
  // Pre-process: separate punctuation from letters so "g," becomes "g ,"
  const separated = text.replace(
    /([a-zA-ZđĐ\u00C0-\u1EF9])([,.!?;:"""''…。，！？])/g,
    "$1 $2",
  );

  return separated
    .split("\n")
    .map((line) => {
      if (!line.trim()) return line;

      const tokens = line.split(" ");
      const merged: string[] = [];

      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (!isSingleVietnameseLetter(token)) {
          merged.push(token);
          continue;
        }

        // It's a single Vietnamese letter — decide direction
        const lower = token.toLowerCase();
        const isConsonant = CONSONANTS.has(lower);
        const next = i + 1 < tokens.length ? tokens[i + 1] : undefined;
        const prevIdx = merged.length - 1;
        const prevToken = prevIdx >= 0 ? merged[prevIdx] : "";
        const prevLast = prevToken[prevToken.length - 1]?.toLowerCase() ?? "";

        if (isConsonant && next) {
          const nextFirst = next[0]?.toLowerCase() ?? "";
          const pair = lower + nextFirst;

          // Rule 1: valid initial cluster → merge RIGHT
          // Exception: "gh" is only valid before e, ê, i, y
          const GH_VOWELS = /^[eêéèẻẽẹếềểễệiíìỉĩịyýỳỷỹỵ]/i;
          if (VALID_INITIALS.has(pair) && !(pair === "gh" && !GH_VOWELS.test(next.slice(1)))) {
            // But first check: would this letter be a better final for prev?
            const finalCluster = prevLast + lower;
            if (prevToken && VALID_FINALS.has(finalCluster) &&
                /[aăâeêioôơuưyàáảãạắằẳẵặấầẩẫậèéẻẽẹếềểễệìíỉĩịòóỏõọốồổỗộớờởỡợùúủũụứừửữựỳýỷỹỵ]/i.test(prevToken)) {
              // prev wants this as a final AND pair is valid initial → prefer final
              // (e.g. "từn" + "g" + "hạt": ng is final, gh before ạ is invalid anyway)
              merged[prevIdx] = prevToken + token;
              continue;
            }
            tokens[i + 1] = token + next;
            continue;
          }

          // Rule 2: forms a valid final with prev → merge LEFT
          const finalCluster = prevLast + lower;
          if (VALID_FINALS.has(finalCluster) || VALID_FINALS.has(lower)) {
            // Check: does prev token contain at least one vowel?
            // (a valid syllable to receive a final consonant)
            if (prevToken && /[aăâeêioôơuưyàáảãạắằẳẵặấầẩẫậèéẻẽẹếềểễệìíỉĩịòóỏõọốồổỗộớờởỡợùúủũụứừửữựỳýỷỹỵ]/i.test(prevToken)) {
              merged[prevIdx] = prevToken + token;
              continue;
            }
          }

          // Rule 3: next starts with vowel → merge RIGHT
          const nextIsVowel = nextFirst !== "" && !CONSONANTS.has(nextFirst);
          if (nextIsVowel) {
            tokens[i + 1] = token + next;
            continue;
          }
        }

        // Default: merge LEFT if possible
        if (prevIdx >= 0) {
          merged[prevIdx] = merged[prevIdx] + token;
          continue;
        }

        merged.push(token);
      }

      return merged.join(" ");
    })
    .join("\n");
}

/**
 * Fix stuck words and split words in Vietnamese text.
 *
 * 1. Split syllables: "t rắn g" → "trắng" (STV API artifact)
 * 2. Stuck words: "bìnhthường" → "bình thường" (missing spaces)
 */
export function fixStuckWords(text: string): string {
  if (!text) return "";

  // Phase 1: Merge split syllables (run twice for cascading merges)
  let cleaned = mergeSplitSyllables(text);
  cleaned = mergeSplitSyllables(cleaned);

  // Phase 2: Split stuck words
  // Rule A: Invalid Consonant-Consonant sequences
  const CONSONANTS_STR = "bcdfghjklmnpqrstvwxzđBCDFGHJKLMNPQRSTVWXZĐ";
  const VALID_PAIRS = new Set(["ch", "gh", "kh", "ng", "nh", "ph", "th", "tr", "CH", "GH", "KH", "NG", "NH", "PH", "TH", "TR", "Ch", "Gh", "Kh", "Ng", "Nh", "Ph", "Th", "Tr"]);
  
  cleaned = cleaned.replace(
    new RegExp(`([${CONSONANTS_STR}])(?=([${CONSONANTS_STR}]))`, 'g'),
    (match, c1, c2) => {
      const pair = (c1 + c2).toLowerCase();
      if (VALID_PAIRS.has(pair)) {
        return c1;
      }
      return `${c1} `;
    }
  );

  // Rule B: Exception for 'gh' -> only valid before e, ê, i, y.
  cleaned = cleaned.replace(/gh(?![eéèẻẽẹêếềểễệiíìỉĩịyýỳỷỹỵ])/gi, "g h");

  // Rule C: Invalid Vowel-Consonant sequences (Consonant is not a valid final)
  const VOWELS = "aáàảãạăắằẳẵặâấầẩẫậeéèẻẽẹêếềểễệiíìỉĩịoóòỏõọôốồổỗộơớờởỡợuúùủũụưứừửữựyýỳỷỹỵAÁÀẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬEÉÈẺẼẸÊẾỀỂỄỆIÍÌỈĨỊOÓÒỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢUÚÙỦŨỤƯỨỪỬỮỰYÝỲỶỸỴ";
  const INVALID_FINALS = "bdđghklqrsvxBDĐGHKLQRSVX";
  cleaned = cleaned.replace(
    new RegExp(`([${VOWELS}])(?=[${INVALID_FINALS}])`, 'g'),
    "$1 "
  );

  // lowercase followed by Uppercase (e.g. làTòng → là Tòng)
  cleaned = cleaned.replace(
    /[\p{Ll}][\p{Lu}]/gu,
    (match) => match[0] + " " + match[1],
  );

  // Phase 3: Common Vietnamese words stuck to previous word
  cleaned = cleaned.replace(
    /([a-zđàáảãạăắằẳẵặâấầẩẫậèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ])(là|không|có|cũng|theo|tại|khỏi|rất|như|thế|cái|mấy|với|mà|của|được|những|một|đã|đang|sẽ|rời|định|cảnh|mặc|nghĩ|nhận|coi|tiếp|vừa|vẫn|còn|nữa|chuyên|môn|bình|thường|thật|nhiên|thiếu|niên|đường|nuôi|tập|tục|xưng|vọng|mộc|tượng|xuất|thân|huyện|thành|phẩm|cửa|hàng|trong|ngoài|trên|dưới|giữa|phải|trước|sau|khi|nếu|thì|nhưng|hoặc|bởi|ngay|xong|luôn|nghe|nhìn|biết|nên|bên|liền|người|chính|giống|hiện|nơi|khắp|ánh|sáng|sinh|vật|nhanh|chóng|không|khí|đó|từng|hạt|giọt|nước|tựa|rực|rỡ|ngọc|trai|khỏa|đặt|vào|hào|quang|yêu|dị)\b/gi,
    "$1 $2",
  );

  return cleaned;
}
