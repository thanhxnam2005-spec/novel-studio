"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db, type ChapterPlan } from "@/lib/db";

export function useChapterPlans(novelId: string | undefined) {
  return useLiveQuery(
    () =>
      novelId
        ? db.chapterPlans
            .where("novelId")
            .equals(novelId)
            .sortBy("chapterOrder")
        : [],
    [novelId],
  );
}

export function useChapterPlan(id: string | undefined) {
  return useLiveQuery(() => (id ? db.chapterPlans.get(id) : undefined), [id]);
}

export async function createChapterPlan(
  data: Omit<ChapterPlan, "id" | "createdAt" | "updatedAt">,
) {
  const now = new Date();
  const id = crypto.randomUUID();
  await db.chapterPlans.add({ ...data, id, createdAt: now, updatedAt: now });
  return id;
}

export async function updateChapterPlan(
  id: string,
  data: Partial<Omit<ChapterPlan, "id" | "createdAt">>,
) {
  await db.chapterPlans.update(id, { ...data, updatedAt: new Date() });
}

export async function deleteChapterPlan(id: string) {
  await db.chapterPlans.delete(id);
}
