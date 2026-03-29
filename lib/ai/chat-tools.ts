import { db, type Character } from "@/lib/db";
import { tool } from "ai";
import { z } from "zod";

const MAX_CONTENT_LENGTH = 8000;

/** Resolve a chapter by UUID or by order number within a novel. */
async function resolveChapter(novelId: string, chapterRef: string) {
  // Try UUID lookup first
  const byId = await db.chapters.get(chapterRef);
  if (byId && byId.novelId === novelId) return byId;

  // Try as order number (accepts both 0-based and 1-based)
  const num = Number(chapterRef);
  if (Number.isInteger(num) && num >= 0) {
    const chapters = await db.chapters
      .where("novelId")
      .equals(novelId)
      .sortBy("order");
    // 0 → first chapter, 1 → first chapter, 2 → second, etc.
    const idx = num === 0 ? 0 : num - 1;
    return chapters[idx] ?? null;
  }

  return null;
}

function mapCharacter(c: Character) {
  return {
    name: c.name,
    role: c.role,
    description: c.description,
    notes: c.notes,
    age: c.age,
    sex: c.sex,
    appearance: c.appearance,
    personality: c.personality,
    hobbies: c.hobbies,
    relationshipWithMC: c.relationshipWithMC,
    relationships: c.relationships,
    characterArc: c.characterArc,
    strengths: c.strengths,
    weaknesses: c.weaknesses,
    motivations: c.motivations,
    goals: c.goals,
  };
}

/**
 * Create read-only AI tools scoped to a specific novel.
 * These tools let the LLM autonomously fetch novel data during chat.
 */
export function createChatTools(novelId: string) {
  return {
    getNovelOverview: tool({
      description:
        "Lấy thông tin tổng quan tiểu thuyết: metadata, thể loại, nhãn, xây dựng thế giới, hệ thống sức mạnh, bối cảnh, phe phái, địa danh.",
      inputSchema: z.object({}),
      execute: async () => {
        const novel = await db.novels.get(novelId);
        if (!novel) return { error: "Không tìm thấy tiểu thuyết" };
        return {
          title: novel.title,
          description: novel.description,
          author: novel.author,
          synopsis: novel.synopsis,
          genres: novel.genres,
          tags: novel.tags,
          worldOverview: novel.worldOverview,
          powerSystem: novel.powerSystem,
          storySetting: novel.storySetting,
          timePeriod: novel.timePeriod,
          factions: novel.factions,
          keyLocations: novel.keyLocations,
          worldRules: novel.worldRules,
          technologyLevel: novel.technologyLevel,
        };
      },
    }),

    getWorldBuilding: tool({
      description:
        "Tra cứu chi tiết xây dựng thế giới: phe phái (tên + mô tả), địa danh (tên + mô tả), hệ thống sức mạnh, bối cảnh, quy luật thế giới, trình độ công nghệ, thời kỳ. Có thể lọc theo loại cụ thể.",
      inputSchema: z.object({
        category: z
          .enum([
            "all",
            "factions",
            "locations",
            "powerSystem",
            "storySetting",
            "worldRules",
            "technologyLevel",
            "timePeriod",
          ])
          .optional()
          .describe(
            "Loại thông tin cần lấy (mặc định: all). factions = phe phái, locations = địa danh, powerSystem = hệ thống sức mạnh, storySetting = bối cảnh, worldRules = quy luật, technologyLevel = công nghệ, timePeriod = thời kỳ",
          ),
        search: z
          .string()
          .optional()
          .describe(
            "Từ khóa tìm kiếm trong phe phái/địa danh (lọc theo tên hoặc mô tả)",
          ),
      }),
      execute: async ({ category = "all", search }) => {
        const novel = await db.novels.get(novelId);
        if (!novel) return { error: "Không tìm thấy tiểu thuyết" };

        const filterItems = (items: { name: string; description: string }[] | undefined) => {
          if (!items) return [];
          if (!search) return items;
          const q = search.normalize("NFC").toLowerCase();
          return items.filter(
            (item) =>
              item.name.normalize("NFC").toLowerCase().includes(q) ||
              item.description.normalize("NFC").toLowerCase().includes(q),
          );
        };

        if (category === "all") {
          return {
            worldOverview: novel.worldOverview,
            powerSystem: novel.powerSystem,
            storySetting: novel.storySetting,
            timePeriod: novel.timePeriod,
            worldRules: novel.worldRules,
            technologyLevel: novel.technologyLevel,
            factions: filterItems(novel.factions),
            keyLocations: filterItems(novel.keyLocations),
          };
        }

        switch (category) {
          case "factions":
            return { factions: filterItems(novel.factions) };
          case "locations":
            return { keyLocations: filterItems(novel.keyLocations) };
          case "powerSystem":
            return { powerSystem: novel.powerSystem };
          case "storySetting":
            return { storySetting: novel.storySetting };
          case "worldRules":
            return { worldRules: novel.worldRules };
          case "technologyLevel":
            return { technologyLevel: novel.technologyLevel };
          case "timePeriod":
            return { timePeriod: novel.timePeriod };
        }
      },
    }),

    getChapterDetails: tool({
      description:
        "Lấy chi tiết chương: tiêu đề, tóm tắt, danh sách scene (tiêu đề và số từ). Có thể truyền số thứ tự chương (vd: \"1\", \"2\") hoặc UUID. Bỏ qua để lấy danh sách tất cả chương.",
      inputSchema: z.object({
        chapter: z
          .string()
          .optional()
          .describe("Số thứ tự chương (vd: \"1\") hoặc UUID (bỏ qua để lấy tất cả)"),
      }),
      execute: async ({ chapter: chapterRef }) => {
        if (chapterRef) {
          const chapter = await resolveChapter(novelId, chapterRef);
          if (!chapter)
            return { error: "Không tìm thấy chương" };

          const scenes = await db.scenes
            .where("[chapterId+isActive]")
            .equals([chapter.id, 1])
            .sortBy("order");

          return {
            chapterNumber: chapter.order,
            title: chapter.title,
            summary: chapter.summary,
            scenes: scenes.map((s) => ({
              title: s.title,
              wordCount: s.wordCount,
            })),
          };
        }

        const chapters = await db.chapters
          .where("novelId")
          .equals(novelId)
          .sortBy("order");

        return {
          chapters: chapters.map((c) => ({
            chapterNumber: c.order,
            title: c.title,
            summary: c.summary,
          })),
        };
      },
    }),

    getChapterContent: tool({
      description:
        "Lấy nội dung văn bản đầy đủ của các scene trong một chương. Có thể truyền số thứ tự chương (vd: \"1\") hoặc UUID.",
      inputSchema: z.object({
        chapter: z.string().describe("Số thứ tự chương (vd: \"1\") hoặc UUID"),
      }),
      execute: async ({ chapter: chapterRef }) => {
        const chapter = await resolveChapter(novelId, chapterRef);
        if (!chapter)
          return { error: "Không tìm thấy chương" };

        const scenes = await db.scenes
          .where("[chapterId+isActive]")
          .equals([chapter.id, 1])
          .sortBy("order");

        let totalLength = 0;
        const result: { title: string; content: string }[] = [];

        for (const scene of scenes) {
          const remaining = MAX_CONTENT_LENGTH - totalLength;
          if (remaining <= 0) {
            result.push({
              title: scene.title,
              content: "[Đã bỏ qua do vượt giới hạn ký tự]",
            });
            continue;
          }
          const content =
            scene.content.length > remaining
              ? scene.content.slice(0, remaining) + "\n...[đã cắt bớt]"
              : scene.content;
          totalLength += content.length;
          result.push({ title: scene.title, content });
        }

        return {
          chapterTitle: chapter.title,
          scenes: result,
        };
      },
    }),

    getCharacters: tool({
      description:
        "Lấy thông tin nhân vật: tên, vai trò, mô tả, tính cách, ngoại hình, mối quan hệ, động lực, mục tiêu. Truyền characterId để lấy nhân vật cụ thể hoặc bỏ qua để lấy tất cả.",
      inputSchema: z.object({
        characterId: z
          .string()
          .optional()
          .describe("ID nhân vật cụ thể (bỏ qua để lấy tất cả)"),
      }),
      execute: async ({ characterId }) => {
        if (characterId) {
          const char = await db.characters.get(characterId);
          if (!char || char.novelId !== novelId)
            return { error: "Không tìm thấy nhân vật" };
          return mapCharacter(char);
        }

        const characters = await db.characters
          .where("novelId")
          .equals(novelId)
          .toArray();

        return { characters: characters.map(mapCharacter) };
      },
    }),

    getNovelNotes: tool({
      description:
        "Lấy ghi chú của người dùng về tiểu thuyết (tài liệu tham khảo, ý tưởng, ghi chú cá nhân).",
      inputSchema: z.object({}),
      execute: async () => {
        const notes = await db.notes
          .where("novelId")
          .equals(novelId)
          .toArray();

        return {
          notes: notes.map((n) => ({
            id: n.id,
            title: n.title,
            category: n.category,
            content: n.content,
          })),
        };
      },
    }),

    searchNovelContent: tool({
      description:
        "Tìm kiếm toàn văn (fuzzy) trong nội dung tiểu thuyết: scene, tóm tắt chương, nhân vật, ghi chú. Hỗ trợ tìm gần đúng (typo, dấu).",
      inputSchema: z.object({
        query: z.string().describe("Từ khóa hoặc cụm từ cần tìm"),
      }),
      execute: async ({ query }) => {
        const { globalSearch } = await import("@/lib/search/global-search");
        const hits = await globalSearch(query, {
          novelId,
          limit: 20,
        });

        return {
          query,
          totalResults: hits.length,
          results: hits
            .filter((h) => h.type !== "page")
            .map((h) => ({
              type: h.type,
              location: h.subtitle,
              title: h.title,
              score: h.score,
            })),
        };
      },
    }),
  };
}
