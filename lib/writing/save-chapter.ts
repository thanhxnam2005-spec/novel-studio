import { db } from "@/lib/db";
import { countWords } from "@/lib/utils";
import type { OutlineAgentOutput } from "./types";

/**
 * Save the completed chapter to existing Chapter + Scene entities.
 * Uses rewrite content if available, otherwise writer content.
 */
export async function saveGeneratedChapter(options: {
  novelId: string;
  sessionId: string;
  chapterPlanId: string;
  outline: OutlineAgentOutput;
}): Promise<string> {
  const { novelId, sessionId, chapterPlanId, outline } = options;

  const chapterPlan = await db.chapterPlans.get(chapterPlanId);
  if (!chapterPlan) throw new Error("Chapter plan not found");

  // Prefer rewrite content over writer content
  const rewriteResult = await db.writingStepResults
    .where("[sessionId+role]")
    .equals([sessionId, "rewrite"])
    .first();
  const writerResult = await db.writingStepResults
    .where("[sessionId+role]")
    .equals([sessionId, "writer"])
    .first();

  const finalContent =
    rewriteResult?.status === "completed" && rewriteResult.output
      ? rewriteResult.output
      : writerResult?.output ?? "";

  if (!finalContent) throw new Error("No content to save");

  const now = new Date();

  // Create Chapter
  const chapterId = crypto.randomUUID();
  await db.chapters.add({
    id: chapterId,
    novelId,
    title: outline.chapterTitle,
    order: chapterPlan.chapterOrder,
    summary: outline.synopsis,
    createdAt: now,
    updatedAt: now,
  });

  // Create Scene (single scene with all content)
  const sceneId = crypto.randomUUID();
  await db.scenes.add({
    id: sceneId,
    chapterId,
    novelId,
    title: outline.chapterTitle,
    content: finalContent,
    order: 1,
    wordCount: countWords(finalContent),
    version: 1,
    versionType: "ai-write",
    isActive: 1,
    createdAt: now,
    updatedAt: now,
  });

  // Link ChapterPlan to Chapter
  await db.chapterPlans.update(chapterPlanId, {
    chapterId,
    status: "saved",
    updatedAt: now,
  });

  return chapterId;
}
