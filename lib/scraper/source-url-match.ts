/**
 * Compare stored novel sourceUrl with the current scraper index URL (www, trailing slash, chapter vs index).
 */

export function normalizeNovelSourceUrl(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    const path = u.pathname.replace(/\/+/g, "/").replace(/\/$/, "") || "";
    return `https://${host}${path}`;
  } catch {
    return s.toLowerCase().replace(/\/+$/, "");
  }
}

export function sourceUrlsMatch(a: string, b: string): boolean {
  const na = normalizeNovelSourceUrl(a);
  const nb = normalizeNovelSourceUrl(b);
  if (na && nb) return na === nb;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Same novel page, or one URL is a subpath of the other (e.g. chapter under same book root). */
export function novelSourceUrlsMatch(stored: string, current: string): boolean {
  if (sourceUrlsMatch(stored, current)) return true;
  const ns = normalizeNovelSourceUrl(stored);
  const nc = normalizeNovelSourceUrl(current);
  if (!ns || !nc) return false;
  return nc.startsWith(`${ns}/`) || ns.startsWith(`${nc}/`);
}

export function findNovelBySourceUrl<T extends { id: string; sourceUrl?: string }>(
  novels: T[] | undefined,
  currentUrl: string,
): T | undefined {
  if (!novels?.length || !currentUrl.trim()) return undefined;
  let fallback: T | undefined;
  for (const n of novels) {
    const s = n.sourceUrl?.trim();
    if (!s) continue;
    if (sourceUrlsMatch(s, currentUrl)) return n;
    if (novelSourceUrlsMatch(s, currentUrl)) fallback ??= n;
  }
  return fallback;
}
