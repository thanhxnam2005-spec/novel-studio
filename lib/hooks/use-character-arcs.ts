"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db, type CharacterArc } from "@/lib/db";

export function useCharacterArcs(novelId: string | undefined) {
  return useLiveQuery(
    () =>
      novelId
        ? db.characterArcs.where("novelId").equals(novelId).toArray()
        : [],
    [novelId],
  );
}

export function useCharacterArcByCharacter(characterId: string | undefined) {
  return useLiveQuery(
    () =>
      characterId
        ? db.characterArcs.where("characterId").equals(characterId).first()
        : undefined,
    [characterId],
  );
}

export async function createCharacterArc(
  data: Omit<CharacterArc, "id" | "createdAt" | "updatedAt">,
) {
  const now = new Date();
  const id = crypto.randomUUID();
  await db.characterArcs.add({ ...data, id, createdAt: now, updatedAt: now });
  return id;
}

export async function updateCharacterArc(
  id: string,
  data: Partial<Omit<CharacterArc, "id" | "createdAt">>,
) {
  await db.characterArcs.update(id, { ...data, updatedAt: new Date() });
}
