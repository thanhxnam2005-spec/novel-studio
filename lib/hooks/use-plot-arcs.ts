"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db, type PlotArc } from "@/lib/db";

export function usePlotArcs(novelId: string | undefined) {
  return useLiveQuery(
    () =>
      novelId
        ? db.plotArcs.where("novelId").equals(novelId).sortBy("createdAt")
        : [],
    [novelId],
  );
}

export function usePlotArc(id: string | undefined) {
  return useLiveQuery(() => (id ? db.plotArcs.get(id) : undefined), [id]);
}

export async function createPlotArc(
  data: Omit<PlotArc, "id" | "createdAt" | "updatedAt">,
) {
  const now = new Date();
  const id = crypto.randomUUID();
  await db.plotArcs.add({ ...data, id, createdAt: now, updatedAt: now });
  return id;
}

export async function updatePlotArc(
  id: string,
  data: Partial<Omit<PlotArc, "id" | "createdAt">>,
) {
  await db.plotArcs.update(id, { ...data, updatedAt: new Date() });
}

export async function deletePlotArc(id: string) {
  await db.plotArcs.delete(id);
}
