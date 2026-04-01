import { db } from "@/lib/db";
import { resolveStep } from "@/lib/ai/resolve-step";
import { withGlobalInstruction } from "@/lib/ai/system-prompt";
import { generateStructured } from "@/lib/ai/structured";
import { jsonSchema } from "ai";
import type { LanguageModel } from "ai";

interface GenerateFrameworkOptions {
  novelId: string;
  genre?: string;
  setting?: string;
  idea: string;
  style?: string;
  systemPrompt?: string;
  abortSignal?: AbortSignal;
  onPhase?: (phase: "world" | "characters" | "arcs" | "plans") => void;
}

interface WorldBuildingResult {
  worldOverview: string;
  powerSystem?: string;
  storySetting: string;
  timePeriod?: string;
  worldRules?: string;
  technologyLevel?: string;
  factions: Array<{ name: string; description: string }>;
  keyLocations: Array<{ name: string; description: string }>;
}

interface CharacterResult {
  characters: Array<{
    name: string;
    role: string;
    description: string;
    personality: string;
    motivations: string;
    goals: string;
  }>;
}

interface PlotArcResult {
  arcs: Array<{
    title: string;
    description: string;
    type: "main" | "subplot" | "character";
    plotPoints: Array<{
      title: string;
      description: string;
      chapterOrder?: number;
    }>;
  }>;
}

interface ChapterPlanResult {
  plans: Array<{
    chapterOrder: number;
    title: string;
    directions: string[];
  }>;
}

const worldSchema = jsonSchema<WorldBuildingResult>({
  type: "object",
  properties: {
    worldOverview: { type: "string" },
    powerSystem: { type: "string" },
    storySetting: { type: "string" },
    timePeriod: { type: "string" },
    worldRules: { type: "string" },
    technologyLevel: { type: "string" },
    factions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
        },
        required: ["name", "description"],
      },
    },
    keyLocations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string" },
        },
        required: ["name", "description"],
      },
    },
  },
  required: ["worldOverview", "storySetting", "factions", "keyLocations"],
});

const characterSchema = jsonSchema<CharacterResult>({
  type: "object",
  properties: {
    characters: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          role: { type: "string" },
          description: { type: "string" },
          personality: { type: "string" },
          motivations: { type: "string" },
          goals: { type: "string" },
        },
        required: [
          "name",
          "role",
          "description",
          "personality",
          "motivations",
          "goals",
        ],
      },
    },
  },
  required: ["characters"],
});

const plotArcSchema = jsonSchema<PlotArcResult>({
  type: "object",
  properties: {
    arcs: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          type: { type: "string", enum: ["main", "subplot", "character"] },
          plotPoints: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                chapterOrder: { type: "number" },
              },
              required: ["title", "description"],
            },
          },
        },
        required: ["title", "description", "type", "plotPoints"],
      },
    },
  },
  required: ["arcs"],
});

const chapterPlanSchema = jsonSchema<ChapterPlanResult>({
  type: "object",
  properties: {
    plans: {
      type: "array",
      items: {
        type: "object",
        properties: {
          chapterOrder: { type: "number" },
          title: { type: "string" },
          directions: { type: "array", items: { type: "string" } },
        },
        required: ["chapterOrder", "title", "directions"],
      },
    },
  },
  required: ["plans"],
});

async function getModel(novelId: string): Promise<LanguageModel> {
  const settings = await db.writingSettings.get(novelId);
  if (settings?.contextModel) {
    const model = await resolveStep(settings.contextModel);
    if (model) return model;
  }
  const chatSettings = await db.chatSettings.get("default");
  if (chatSettings?.providerId && chatSettings?.modelId) {
    const model = await resolveStep({
      providerId: chatSettings.providerId,
      modelId: chatSettings.modelId,
    });
    if (model) return model;
  }
  throw new Error("Không tìm thấy mô hình AI. Vui lòng cấu hình trong Cài đặt.");
}

async function getGlobalInstruction(): Promise<string | undefined> {
  const chatSettings = await db.chatSettings.get("default");
  return chatSettings?.globalSystemInstruction;
}

/**
 * Generate world-building from an idea.
 */
export async function generateWorldBuilding(
  options: GenerateFrameworkOptions,
): Promise<WorldBuildingResult> {
  const model = await getModel(options.novelId);
  const globalInstruction = await getGlobalInstruction();

  const { object } = await generateStructured<WorldBuildingResult>({
    model,
    schema: worldSchema,
    system: withGlobalInstruction(
      options.systemPrompt ?? `Bạn là nhà xây dựng thế giới chuyên nghiệp cho tiểu thuyết. Tạo thế giới quan chi tiết dựa trên ý tưởng. Trả lời bằng Tiếng Việt.`,
      globalInstruction,
    ),
    prompt: `Thể loại: ${options.genre ?? "Tự suy luận"}\nBối cảnh: ${options.setting ?? "Tự suy luận"}\nÝ tưởng: ${options.idea}\n${options.style ? `Phong cách: ${options.style}` : ""}`,
    abortSignal: options.abortSignal,
  });
  return object;
}

/**
 * Generate characters from idea + world-building.
 */
export async function generateCharacters(
  options: GenerateFrameworkOptions,
  worldContext: string,
): Promise<CharacterResult> {
  const model = await getModel(options.novelId);
  const globalInstruction = await getGlobalInstruction();

  const { object } = await generateStructured<CharacterResult>({
    model,
    schema: characterSchema,
    system: withGlobalInstruction(
      options.systemPrompt ?? `Bạn là nhà văn chuyên tạo nhân vật cho tiểu thuyết. Tạo 4-6 nhân vật phù hợp với thế giới và ý tưởng. Trả lời bằng Tiếng Việt.`,
      globalInstruction,
    ),
    prompt: `Ý tưởng: ${options.idea}\n\nThế giới:\n${worldContext}`,
    abortSignal: options.abortSignal,
  });
  return object;
}

/**
 * Generate plot arcs from idea + world + characters.
 */
export async function generatePlotArcs(
  options: GenerateFrameworkOptions,
  context: string,
): Promise<PlotArcResult> {
  const model = await getModel(options.novelId);
  const globalInstruction = await getGlobalInstruction();

  const { object } = await generateStructured<PlotArcResult>({
    model,
    schema: plotArcSchema,
    system: withGlobalInstruction(
      options.systemPrompt ?? `Bạn là nhà biên kịch chuyên nghiệp. Tạo mạch truyện chính và phụ với các điểm mốc cụ thể. Trả lời bằng Tiếng Việt.`,
      globalInstruction,
    ),
    prompt: `Ý tưởng: ${options.idea}\n\n${context}`,
    abortSignal: options.abortSignal,
  });
  return object;
}

/**
 * Generate chapter plans from full context.
 */
export async function generateChapterPlans(
  options: GenerateFrameworkOptions,
  context: string,
  chapterCount: number = 8,
): Promise<ChapterPlanResult> {
  const model = await getModel(options.novelId);
  const globalInstruction = await getGlobalInstruction();

  const { object } = await generateStructured<ChapterPlanResult>({
    model,
    schema: chapterPlanSchema,
    system: withGlobalInstruction(
      options.systemPrompt ?? `Bạn là nhà văn chuyên lập kế hoạch tiểu thuyết. Tạo kế hoạch cho ${chapterCount} chương đầu tiên. Mỗi chương cần tiêu đề và 2-3 hướng đi chính. Trả lời bằng Tiếng Việt.`,
      globalInstruction,
    ),
    prompt: `Ý tưởng: ${options.idea}\n\n${context}`,
    abortSignal: options.abortSignal,
  });
  return object;
}

/**
 * Save world-building result to Novel entity.
 */
export async function saveWorldBuilding(
  novelId: string,
  world: WorldBuildingResult,
) {
  await db.novels.update(novelId, {
    worldOverview: world.worldOverview,
    powerSystem: world.powerSystem,
    storySetting: world.storySetting,
    timePeriod: world.timePeriod,
    worldRules: world.worldRules,
    technologyLevel: world.technologyLevel,
    factions: world.factions,
    keyLocations: world.keyLocations,
    updatedAt: new Date(),
  });
}

/**
 * Save characters result to Character entities.
 */
export async function saveCharacters(
  novelId: string,
  result: CharacterResult,
) {
  const now = new Date();
  const entries = result.characters.map((char) => ({
    id: crypto.randomUUID(),
    novelId,
    name: char.name,
    role: char.role,
    description: char.description,
    personality: char.personality,
    motivations: char.motivations,
    goals: char.goals,
    notes: "",
    createdAt: now,
    updatedAt: now,
  }));
  await db.characters.bulkAdd(entries);
  return entries.map((e) => e.id);
}

/**
 * Save plot arcs result to PlotArc entities.
 */
export async function savePlotArcs(
  novelId: string,
  result: PlotArcResult,
) {
  const now = new Date();
  const entries = result.arcs.map((arc) => ({
    id: crypto.randomUUID(),
    novelId,
    title: arc.title,
    description: arc.description,
    type: arc.type,
    plotPoints: arc.plotPoints.map((p) => ({
      ...p,
      id: crypto.randomUUID(),
      status: "planned" as const,
    })),
    status: "active" as const,
    createdAt: now,
    updatedAt: now,
  }));
  await db.plotArcs.bulkAdd(entries);
  return entries.map((e) => e.id);
}

/**
 * Save chapter plans result to ChapterPlan entities.
 */
export async function saveChapterPlans(
  novelId: string,
  result: ChapterPlanResult,
) {
  const now = new Date();
  const entries = result.plans.map((plan) => ({
    id: crypto.randomUUID(),
    novelId,
    chapterOrder: plan.chapterOrder,
    title: plan.title,
    directions: plan.directions,
    outline: "",
    scenes: [] as import("@/lib/db").ChapterPlanScene[],
    status: "planned" as const,
    createdAt: now,
    updatedAt: now,
  }));
  await db.chapterPlans.bulkAdd(entries);
  return entries.map((e) => e.id);
}

/**
 * Generate plot arcs and chapter plans from existing novel data.
 * Used for continuation mode (State B).
 */
export async function generateFromExisting(
  novelId: string,
  abortSignal?: AbortSignal,
  onPhase?: (phase: "arcs" | "plans") => void,
) {
  const [novel, chapters, characters] = await Promise.all([
    db.novels.get(novelId),
    db.chapters.where("novelId").equals(novelId).sortBy("order"),
    db.characters.where("novelId").equals(novelId).toArray(),
  ]);

  if (!novel) throw new Error("Novel not found");

  const context = [
    novel.synopsis ? `Tóm tắt: ${novel.synopsis}` : "",
    novel.worldOverview ? `Thế giới: ${novel.worldOverview}` : "",
    characters.length > 0
      ? `Nhân vật: ${characters.map((c) => `${c.name} (${c.role})`).join(", ")}`
      : "",
    chapters.length > 0
      ? `Chương đã có:\n${chapters.map((ch) => `${ch.order}. ${ch.title}${ch.summary ? `: ${ch.summary}` : ""}`).join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const idea = novel.synopsis || novel.description || novel.title;
  const nextChapter = chapters.length + 1;

  // Generate arcs
  onPhase?.("arcs");
  const arcsResult = await generatePlotArcs(
    { novelId, idea, abortSignal },
    context,
  );
  await savePlotArcs(novelId, arcsResult);

  // Generate plans for next 5 chapters
  onPhase?.("plans");
  const arcContext =
    context +
    `\n\nMạch truyện:\n${arcsResult.arcs.map((a) => `- ${a.title} (${a.type}): ${a.description}`).join("\n")}`;
  const plansResult = await generateChapterPlans(
    { novelId, idea, abortSignal },
    arcContext,
    5,
  );
  // Offset chapter orders to continue from where we left off
  plansResult.plans = plansResult.plans.map((p, i) => ({
    ...p,
    chapterOrder: nextChapter + i,
  }));
  await saveChapterPlans(novelId, plansResult);

  return { arcs: arcsResult, plans: plansResult };
}
