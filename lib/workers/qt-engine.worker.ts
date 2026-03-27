import type {
  ConvertOptions,
  ConvertSegment,
  ConvertSource,
  DictPair,
  QTWorkerRequest,
  QTWorkerResponse,
} from "./qt-engine.types";
import { DEFAULT_CONVERT_OPTIONS } from "./qt-engine.types";

// ─── Helpers ─────────────────────────────────────────────────

/** Pick first non-empty translation from QT-style "a/b/c" alternatives. */
function pickPrimary(value: string): string {
  if (!value.includes("/")) return value;
  const parts = value.split("/");
  for (const p of parts) {
    const trimmed = p.trim();
    if (trimmed) return trimmed;
  }
  return value;
}

function capitalizeWords(str: string): string {
  if (!str) return str;
  return str.replace(/(?<=^|\s)\p{Ll}/gu, (c) => c.toUpperCase());
}

function capitalizeFirst(str: string): string {
  if (!str) return str;
  for (let i = 0; i < str.length; i++) {
    if (/\p{Ll}/u.test(str[i])) {
      return str.slice(0, i) + str[i].toUpperCase() + str.slice(i + 1);
    }
    if (/\p{Lu}/u.test(str[i])) return str;
  }
  return str;
}

const NAME_SOURCES = new Set<ConvertSource>([
  "qt-name",
  "novel-name",
  "global-name",
]);

const SENTENCE_ENDERS = /[.!?。！？…\n：:；;]/;
const CAP_TRIGGERS = /[《«]/;
const CAP_PASSTHROUGH =
  /^[\s\u3000""''「『（(\[{<》」』）\])}>《》«»，、；：,.:;!?。！？…～·\-–—\u201c\u201d\u2018\u2019]+$/;

const NO_SPACE_BEFORE =
  /[,.:;!?。，、；：！？…\u201c\u201d\u2018\u2019」』）\])}>》»～·\-–—\s]/;
const NO_SPACE_AFTER = /[\u201c\u201d\u2018\u2019「『（\[({<《«\s]/;
const DIGIT_TRAILING = /\d$/;
const DIGIT_LEADING = /^\d/;

// ─── Full-width → ASCII punctuation ─────────────────────────

const FULLWIDTH_PUNCT: Record<string, string> = {
  "，": ",",
  "。": ".",
  "：": ":",
  "；": ";",
  "！": "!",
  "？": "?",
  "（": "(",
  "）": ")",
  "【": "[",
  "】": "]",
  "、": ",",
  "～": "~",
  "\u3000": " ",
  "……": "...",
};

const FULLWIDTH_RE = new RegExp(
  Object.keys(FULLWIDTH_PUNCT)
    .sort((a, b) => b.length - a.length)
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|"),
  "g",
);

function normalizeFullwidthPunct(text: string): string {
  return text.replace(FULLWIDTH_RE, (m) => FULLWIDTH_PUNCT[m] ?? m);
}

// ─── Particle overrides ──────────────────────────────────────

const PARTICLE_OVERRIDES: Record<string, string> = {
  的: "của",
  了: "",
  着: "đang",
  过: "qua",
  吗: "sao",
  呢: "đây",
  吧: "đi",
  啊: "a",
  哦: "ồ",
  嗯: "ừ",
  哈: "ha",
  啦: "rồi",
  嘛: "mà",
  呀: "a",
  哩: "lý",
  喽: "rồi",
};

// ─── State ───────────────────────────────────────────────────

let namesMap: Map<string, string>;
let vietPhraseMap: Map<string, string>;
let phienAmMap: Map<string, string>;
let luatNhanPatterns: Array<{
  prefix: string;
  suffix: string;
  template: string;
}>;
let luatNhanPrefixIndex: Map<string, number[]>;
let maxKeyLength = 0;
let maxNameLength = 0;

// ─── Init ────────────────────────────────────────────────────

function initDicts(dictData: Record<string, DictPair[]>): void {
  namesMap = new Map<string, string>();
  vietPhraseMap = new Map<string, string>();
  phienAmMap = new Map<string, string>();
  luatNhanPatterns = [];
  luatNhanPrefixIndex = new Map();

  for (const e of dictData.names ?? [])
    namesMap.set(e.chinese, capitalizeWords(pickPrimary(e.vietnamese)));
  for (const e of dictData.names2 ?? [])
    namesMap.set(e.chinese, capitalizeWords(pickPrimary(e.vietnamese)));

  for (const e of dictData.vietphrase ?? []) {
    if (e.chinese in PARTICLE_OVERRIDES) {
      vietPhraseMap.set(e.chinese, PARTICLE_OVERRIDES[e.chinese]);
    } else {
      vietPhraseMap.set(e.chinese, pickPrimary(e.vietnamese));
    }
  }

  for (const e of dictData.phienam ?? [])
    phienAmMap.set(e.chinese, pickPrimary(e.vietnamese));

  for (const e of dictData.luatnhan ?? []) {
    const idx = e.chinese.indexOf("{0}");
    if (idx < 0) continue;
    const prefix = e.chinese.slice(0, idx);
    const suffix = e.chinese.slice(idx + 3);
    luatNhanPatterns.push({
      prefix,
      suffix,
      template: pickPrimary(e.vietnamese),
    });
  }

  for (let i = 0; i < luatNhanPatterns.length; i++) {
    const p = luatNhanPatterns[i];
    if (p.prefix.length > 0) {
      const firstChar = p.prefix[0];
      if (!luatNhanPrefixIndex.has(firstChar)) {
        luatNhanPrefixIndex.set(firstChar, []);
      }
      luatNhanPrefixIndex.get(firstChar)!.push(i);
    }
  }

  maxKeyLength = 0;
  for (const k of namesMap.keys())
    if (k.length > maxKeyLength) maxKeyLength = k.length;
  for (const k of vietPhraseMap.keys())
    if (k.length > maxKeyLength) maxKeyLength = k.length;

  maxNameLength = 0;
  for (const k of namesMap.keys())
    if (k.length > maxNameLength) maxNameLength = k.length;
}

// ─── Convert ─────────────────────────────────────────────────

function convert(
  text: string,
  novelNames?: DictPair[],
  globalNames?: DictPair[],
  opts?: ConvertOptions,
): ConvertSegment[] {
  const o = { ...DEFAULT_CONVERT_OPTIONS, ...opts };

  const novelNamesMap = novelNames?.length
    ? new Map(
        novelNames.map((e) => [
          e.chinese,
          capitalizeWords(pickPrimary(e.vietnamese)),
        ]),
      )
    : null;
  const globalNamesMap = globalNames?.length
    ? new Map(
        globalNames.map((e) => [
          e.chinese,
          capitalizeWords(pickPrimary(e.vietnamese)),
        ]),
      )
    : null;

  let filteredVP = vietPhraseMap;
  if (o.vpLengthPriority !== "none") {
    const minLen =
      o.vpLengthPriority === "vp-gt-3"
        ? 4
        : o.vpLengthPriority === "vp-gt-4"
          ? 5
          : 0;
    if (minLen > 0) {
      filteredVP = new Map();
      for (const [k, v] of vietPhraseMap) {
        if (k.length >= minLen) filteredVP.set(k, v);
      }
      for (const [k, v] of vietPhraseMap) {
        if (k.length === 1 && !filteredVP.has(k)) filteredVP.set(k, v);
      }
    }
  }

  type PriorityEntry = [ConvertSource, Map<string, string>];
  const priorityMaps: PriorityEntry[] = [];

  const orderedNameMaps: PriorityEntry[] = [];
  if (o.scopePriority === "novel-first") {
    if (novelNamesMap) orderedNameMaps.push(["novel-name", novelNamesMap]);
    if (globalNamesMap) orderedNameMaps.push(["global-name", globalNamesMap]);
  } else {
    if (globalNamesMap) orderedNameMaps.push(["global-name", globalNamesMap]);
    if (novelNamesMap) orderedNameMaps.push(["novel-name", novelNamesMap]);
  }
  orderedNameMaps.push(["qt-name", namesMap]);

  if (o.nameVsPriority === "name-first") {
    priorityMaps.push(...orderedNameMaps);
    priorityMaps.push(["vietphrase", filteredVP]);
  } else {
    priorityMaps.push(["vietphrase", filteredVP]);
    priorityMaps.push(...orderedNameMaps);
  }

  const allNames = new Map(namesMap);
  if (globalNamesMap) for (const [k, v] of globalNamesMap) allNames.set(k, v);
  if (novelNamesMap) for (const [k, v] of novelNamesMap) allNames.set(k, v);

  let effectiveMaxKey = Math.min(maxKeyLength, o.maxPhraseLength);
  let effectiveMaxName = maxNameLength;
  if (novelNamesMap)
    for (const k of novelNamesMap.keys()) {
      if (k.length > effectiveMaxKey)
        effectiveMaxKey = Math.min(k.length, o.maxPhraseLength);
      if (k.length > effectiveMaxName) effectiveMaxName = k.length;
    }
  if (globalNamesMap)
    for (const k of globalNamesMap.keys()) {
      if (k.length > effectiveMaxKey)
        effectiveMaxKey = Math.min(k.length, o.maxPhraseLength);
      if (k.length > effectiveMaxName) effectiveMaxName = k.length;
    }

  const segments: ConvertSegment[] = [];
  let i = 0;

  while (i < text.length) {
    let matched = false;

    // 1. LuatNhan patterns
    const char = text[i];
    const patternIndices =
      o.luatNhanMode !== "off" ? luatNhanPrefixIndex.get(char) : undefined;
    if (patternIndices) {
      for (const pi of patternIndices) {
        const pattern = luatNhanPatterns[pi];
        if (!text.startsWith(pattern.prefix, i)) continue;

        const searchStart = i + pattern.prefix.length;
        for (
          let nameLen = Math.min(effectiveMaxName, text.length - searchStart);
          nameLen >= 1;
          nameLen--
        ) {
          const candidate = text.slice(searchStart, searchStart + nameLen);
          const luatNhanMatch =
            allNames.has(candidate) ||
            (o.luatNhanMode === "name-and-pronouns" &&
              filteredVP.has(candidate));
          if (!luatNhanMatch) continue;

          const suffixStart = searchStart + nameLen;
          if (!text.startsWith(pattern.suffix, suffixStart)) continue;

          const translatedName =
            allNames.get(candidate) ?? filteredVP.get(candidate) ?? candidate;
          const translation = pattern.template.replace("{0}", translatedName);
          const matchEnd = suffixStart + pattern.suffix.length;
          segments.push({
            original: text.slice(i, matchEnd),
            translated: translation,
            source: "luatnhan",
          });
          i = matchEnd;
          matched = true;
          break;
        }
        if (matched) break;
      }
    }

    // 2. Priority Maps (longest match first)
    if (!matched) {
      const maxLen = Math.min(effectiveMaxKey, text.length - i);
      for (let j = maxLen; j >= 1; j--) {
        const sub = text.slice(i, i + j);
        for (const [source, map] of priorityMaps) {
          if (map.has(sub)) {
            segments.push({ original: sub, translated: map.get(sub)!, source });
            i += j;
            matched = true;
            break;
          }
        }
        if (matched) break;
      }
    }

    // 3. PhienAm fallback
    if (!matched) {
      const c = text[i];
      if (phienAmMap.has(c)) {
        segments.push({
          original: c,
          translated: phienAmMap.get(c)!,
          source: "phienam",
        });
      } else {
        segments.push({ original: c, translated: c, source: "unknown" });
      }
      i += 1;
    }
  }

  capitalizeNameAdjacent(segments);
  capitalizeSentences(segments);
  if (o.capitalizeBrackets) capitalizeBracketContent(segments);

  return segments;
}

// ─── Post-processing ─────────────────────────────────────────

/** Chinese suffixes that capitalize when following a name (geographic, titles, orgs) */
const NAME_SUFFIXES = new Set(
  "省市县区镇村山河湖海岛峰谷关城宫殿阁楼塔寺庙庄府院堂门派宗帝王皇后妃侯公伯子爵将帅族氏家國国".split(
    "",
  ),
);

function capitalizeNameAdjacent(segments: ConvertSegment[]): void {
  for (let i = 1; i < segments.length; i++) {
    const prev = segments[i - 1];
    const seg = segments[i];
    if (
      NAME_SOURCES.has(prev.source) &&
      !NAME_SOURCES.has(seg.source) &&
      seg.source !== "unknown" &&
      seg.original.length === 1 &&
      NAME_SUFFIXES.has(seg.original)
    ) {
      const capped = capitalizeWords(seg.translated);
      if (capped !== seg.translated)
        segments[i] = { ...seg, translated: capped };
    }
  }
}

const BRACKET_OPEN = /[《«]/;
const BRACKET_CLOSE = /[》»]/;

function capitalizeBracketContent(segments: ConvertSegment[]): void {
  let inside = false;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const text = seg.source === "unknown" ? seg.original : seg.translated;
    if (BRACKET_OPEN.test(text)) {
      inside = true;
      continue;
    }
    if (BRACKET_CLOSE.test(text)) {
      inside = false;
      continue;
    }
    if (inside && seg.source !== "unknown") {
      const capped = capitalizeWords(seg.translated);
      if (capped !== seg.translated)
        segments[i] = { ...seg, translated: capped };
    }
  }
}

function capitalizeSentences(segments: ConvertSegment[]): void {
  let needsCap = true;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const text = seg.source === "unknown" ? seg.original : seg.translated;

    if (needsCap) {
      if (NAME_SOURCES.has(seg.source)) {
        needsCap = false;
      } else if (seg.source !== "unknown") {
        const capped = capitalizeFirst(seg.translated);
        if (capped !== seg.translated)
          segments[i] = { ...seg, translated: capped };
        needsCap = false;
      } else if (CAP_PASSTHROUGH.test(seg.original)) {
        // Punctuation/whitespace — pass through, keep needsCap
      } else {
        needsCap = false;
      }
    }

    if (SENTENCE_ENDERS.test(text) || CAP_TRIGGERS.test(text)) {
      needsCap = true;
    }
  }
}

// ─── Plain text assembly ─────────────────────────────────────

function segmentsToPlainText(segments: ConvertSegment[]): string {
  const parts: string[] = [];

  for (const seg of segments) {
    if (seg.source === "unknown") {
      parts.push(normalizeFullwidthPunct(seg.original));
      continue;
    }

    const translated = seg.translated;
    if (!translated) continue;

    if (parts.length > 0) {
      const prev = parts[parts.length - 1];
      const lastChar = prev.slice(-1);
      const firstChar = translated[0];

      const shouldAddSpace =
        lastChar !== undefined &&
        firstChar !== undefined &&
        lastChar !== " " &&
        lastChar !== "\n" &&
        lastChar !== "\u3000" &&
        !NO_SPACE_AFTER.test(lastChar) &&
        !NO_SPACE_BEFORE.test(firstChar) &&
        !(DIGIT_TRAILING.test(lastChar) && DIGIT_LEADING.test(firstChar));

      if (shouldAddSpace) parts.push(" ");
    }

    parts.push(translated);
  }

  return parts.join("").replace(/ {2,}/g, " ");
}

// ─── Message Handler ─────────────────────────────────────────

function post(msg: QTWorkerResponse) {
  self.postMessage(msg);
}

self.onmessage = (event: MessageEvent<QTWorkerRequest>) => {
  const msg = event.data;

  switch (msg.type) {
    case "init": {
      try {
        initDicts(msg.dictData);
        post({ type: "ready" });
      } catch (err) {
        post({
          type: "error",
          id: "",
          message: `Init failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
      break;
    }

    case "convert": {
      try {
        const segments = convert(
          msg.text,
          msg.novelNames,
          msg.globalNames,
          msg.options,
        );
        const plainText = segmentsToPlainText(segments);
        post({ type: "result", id: msg.id, segments, plainText });
      } catch (err) {
        post({
          type: "error",
          id: msg.id,
          message: `Convert failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
      break;
    }

    case "convert-batch": {
      try {
        for (const item of msg.items) {
          const segments = convert(
            item.text,
            msg.novelNames,
            msg.globalNames,
            msg.options,
          );
          const plainText = segmentsToPlainText(segments);
          post({
            type: "batch-progress",
            id: msg.id,
            itemId: item.itemId,
            segments,
            plainText,
          });
        }
        post({ type: "batch-complete", id: msg.id });
      } catch (err) {
        post({
          type: "error",
          id: msg.id,
          message: `Batch failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
      break;
    }
  }
};
