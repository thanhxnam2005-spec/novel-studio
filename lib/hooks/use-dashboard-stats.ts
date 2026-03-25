"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";

export function useDashboardStats() {
  return useLiveQuery(async () => {
    const [novelCount, chapterCount, characterCount] = await Promise.all([
      db.novels.count(),
      db.chapters.count(),
      db.characters.count(),
    ]);

    // Sum wordCount via cursor to avoid loading all scene content into memory
    let wordCount = 0;
    await db.scenes.each((s) => {
      wordCount += s.wordCount;
    });

    return { novelCount, chapterCount, wordCount, characterCount };
  }, []);
}

export function useRecentChapters(limit = 8) {
  return useLiveQuery(async () => {
    const chapters = await db.chapters
      .orderBy("updatedAt")
      .reverse()
      .limit(limit)
      .toArray();

    const novelIds = [...new Set(chapters.map((c) => c.novelId))];
    const chapterIds = chapters.map((c) => c.id);

    // Fetch novels and scenes in parallel
    const [novels, scenes] = await Promise.all([
      db.novels.bulkGet(novelIds),
      db.scenes.where("chapterId").anyOf(chapterIds).toArray(),
    ]);

    const novelMap = new Map(
      novels.filter(Boolean).map((n) => [n!.id, n!]),
    );

    const wordCountMap = new Map<string, number>();
    for (const s of scenes) {
      wordCountMap.set(
        s.chapterId,
        (wordCountMap.get(s.chapterId) ?? 0) + s.wordCount,
      );
    }

    return chapters.map((ch) => {
      const novel = novelMap.get(ch.novelId);
      return {
        ...ch,
        novelTitle: novel?.title ?? "—",
        novelColor: novel?.color,
        wordCount: wordCountMap.get(ch.id) ?? 0,
      };
    });
  }, [limit]);
}

export function useTopNovelsByChapters(limit = 5) {
  return useLiveQuery(async () => {
    // Count chapters per novel via cursor (avoids loading all chapter objects)
    const countMap = new Map<string, number>();
    await db.chapters.each((ch) => {
      countMap.set(ch.novelId, (countMap.get(ch.novelId) ?? 0) + 1);
    });

    // Sort and take top N, then fetch only those novels
    const topEntries = [...countMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

    if (topEntries.length === 0) return [];

    const novels = await db.novels.bulkGet(topEntries.map(([id]) => id));

    return topEntries
      .map(([novelId, chapterCount]) => ({
        novel: novels.find((n) => n?.id === novelId),
        chapterCount,
      }))
      .filter((item): item is { novel: NonNullable<typeof item.novel>; chapterCount: number } =>
        item.novel != null,
      );
  }, [limit]);
}
