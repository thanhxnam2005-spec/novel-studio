"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db, type WritingStepResult, type WritingAgentRole } from "@/lib/db";

export function useStepResults(sessionId: string | undefined) {
  return useLiveQuery(
    () =>
      sessionId
        ? db.writingStepResults.where("sessionId").equals(sessionId).toArray()
        : [],
    [sessionId],
  );
}

export function useStepResult(
  sessionId: string | undefined,
  role: WritingAgentRole | undefined,
) {
  return useLiveQuery(
    () =>
      sessionId && role
        ? db.writingStepResults
            .where("[sessionId+role]")
            .equals([sessionId, role])
            .first()
        : undefined,
    [sessionId, role],
  );
}

export async function createStepResult(
  data: Omit<WritingStepResult, "id">,
) {
  const id = crypto.randomUUID();
  await db.writingStepResults.add({ ...data, id });
  return id;
}

export async function updateStepResult(
  id: string,
  data: Partial<Omit<WritingStepResult, "id">>,
) {
  await db.writingStepResults.update(id, data);
}
