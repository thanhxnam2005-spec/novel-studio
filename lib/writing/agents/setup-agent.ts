import { tool } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";

/**
 * Create tool-calling tools for Phase A novel setup.
 * Mirrors the aggregationTools/characterTools pattern from lib/analysis/incremental-tools.ts.
 */
export function createSetupTools(novelId: string) {
  return {
    updateWorldBuilding: tool({
      description:
        "Cập nhật thông tin xây dựng thế giới: tổng quan, hệ thống sức mạnh, bối cảnh, quy tắc, công nghệ, thời kỳ",
      inputSchema: z.object({
        worldOverview: z.string().optional().describe("Tổng quan thế giới"),
        powerSystem: z
          .string()
          .optional()
          .describe("Hệ thống sức mạnh/phép thuật"),
        storySetting: z.string().optional().describe("Bối cảnh chính"),
        timePeriod: z.string().optional().describe("Thời kỳ/niên đại"),
        worldRules: z
          .string()
          .optional()
          .describe("Quy tắc đặc biệt của thế giới"),
        technologyLevel: z.string().optional().describe("Trình độ công nghệ"),
      }),
      execute: async (args) => {
        await db.novels.update(novelId, {
          ...args,
          updatedAt: new Date(),
        });
        return { success: true };
      },
    }),

    addFaction: tool({
      description: "Thêm một thế lực/phe phái mới",
      inputSchema: z.object({
        name: z.string().describe("Tên thế lực"),
        description: z.string().describe("Mô tả thế lực"),
      }),
      execute: async ({ name, description }) => {
        const novel = await db.novels.get(novelId);
        const factions = [...(novel?.factions ?? []), { name, description }];
        await db.novels.update(novelId, { factions, updatedAt: new Date() });
        return { success: true, faction: { name, description } };
      },
    }),

    addLocation: tool({
      description: "Thêm một địa danh quan trọng",
      inputSchema: z.object({
        name: z.string().describe("Tên địa danh"),
        description: z.string().describe("Mô tả địa danh"),
      }),
      execute: async ({ name, description }) => {
        const novel = await db.novels.get(novelId);
        const keyLocations = [
          ...(novel?.keyLocations ?? []),
          { name, description },
        ];
        await db.novels.update(novelId, {
          keyLocations,
          updatedAt: new Date(),
        });
        return { success: true, location: { name, description } };
      },
    }),

    addCharacter: tool({
      description: "Thêm nhân vật mới vào truyện",
      inputSchema: z.object({
        name: z.string().describe("Tên nhân vật"),
        role: z
          .string()
          .describe("Vai trò (nhân vật chính/phản diện/phụ/mentor...)"),
        description: z.string().describe("Mô tả nhân vật"),
        personality: z.string().optional().describe("Tính cách"),
        motivations: z.string().optional().describe("Động lực"),
        goals: z.string().optional().describe("Mục tiêu"),
      }),
      execute: async (args) => {
        const now = new Date();
        const id = crypto.randomUUID();
        await db.characters.add({
          ...args,
          id,
          novelId,
          notes: "",
          createdAt: now,
          updatedAt: now,
        });
        return { success: true, characterId: id };
      },
    }),

    updateCharacter: tool({
      description: "Cập nhật thông tin nhân vật đã có",
      inputSchema: z.object({
        characterId: z.string().describe("ID nhân vật"),
        personality: z.string().optional(),
        motivations: z.string().optional(),
        goals: z.string().optional(),
        strengths: z.string().optional(),
        weaknesses: z.string().optional(),
        appearance: z.string().optional(),
      }),
      execute: async ({ characterId, ...updates }) => {
        await db.characters.update(characterId, {
          ...updates,
          updatedAt: new Date(),
        });
        return { success: true };
      },
    }),

    addPlotArc: tool({
      description: "Thêm mạch truyện (chính/phụ/nhân vật)",
      inputSchema: z.object({
        title: z.string().describe("Tiêu đề mạch truyện"),
        description: z.string().describe("Mô tả mạch truyện"),
        type: z
          .enum(["main", "subplot", "character"])
          .describe("Loại: main/subplot/character"),
        plotPoints: z
          .array(
            z.object({
              title: z.string(),
              description: z.string(),
              chapterOrder: z.number().optional(),
            }),
          )
          .optional()
          .describe("Các điểm mốc trong mạch truyện"),
      }),
      execute: async ({ title, description, type, plotPoints }) => {
        const now = new Date();
        const id = crypto.randomUUID();
        await db.plotArcs.add({
          id,
          novelId,
          title,
          description,
          type,
          plotPoints: (plotPoints ?? []).map((p) => ({
            ...p,
            id: crypto.randomUUID(),
            status: "planned" as const,
          })),
          status: "active",
          createdAt: now,
          updatedAt: now,
        });
        return { success: true, plotArcId: id };
      },
    }),

    addChapterPlan: tool({
      description: "Thêm kế hoạch cho một chương",
      inputSchema: z.object({
        chapterOrder: z.number().describe("Số thứ tự chương"),
        title: z.string().optional().describe("Tiêu đề tạm"),
        directions: z
          .array(z.string())
          .optional()
          .describe("Hướng đi chính của chương"),
      }),
      execute: async ({ chapterOrder, title, directions }) => {
        const now = new Date();
        const id = crypto.randomUUID();
        await db.chapterPlans.add({
          id,
          novelId,
          chapterOrder,
          title,
          directions: directions ?? [],
          outline: "",
          scenes: [],
          status: "planned",
          createdAt: now,
          updatedAt: now,
        });
        return { success: true, chapterPlanId: id };
      },
    }),

    updateChapterPlan: tool({
      description: "Cập nhật kế hoạch chương",
      inputSchema: z.object({
        chapterPlanId: z.string().describe("ID kế hoạch chương"),
        title: z.string().optional(),
        directions: z.array(z.string()).optional(),
      }),
      execute: async ({ chapterPlanId, ...updates }) => {
        await db.chapterPlans.update(chapterPlanId, {
          ...updates,
          updatedAt: new Date(),
        });
        return { success: true };
      },
    }),
  };
}
