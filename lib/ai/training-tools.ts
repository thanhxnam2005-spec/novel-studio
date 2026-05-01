import { generateStructured } from "@/lib/ai";
import { jsonSchema } from "ai";
import type { LanguageModel } from "ai";

export interface TrainingSuggestion {
  chinese: string;
  vietnamese: string;
  reason: string;
  category: string;
}

const trainingSchema = jsonSchema<{ suggestions: TrainingSuggestion[] }>({
  type: "object",
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          chinese: { type: "string" },
          vietnamese: { type: "string" },
          reason: { type: "string" },
          category: { type: "string" },
        },
        required: ["chinese", "vietnamese", "reason", "category"],
      },
    },
  },
  required: ["suggestions"],
});

export async function runTranslationTraining(opts: {
  model: LanguageModel;
  sourceText: string;
  qtTranslated: string;
  aiTranslated: string;
}): Promise<TrainingSuggestion[]> {
  const prompt = `
<role>
Bạn là chuyên gia huấn luyện hệ thống dịch thuật Trung-Việt, có kiến thức sâu sắc về văn học và tu tiên.
</role>

<task>
So sánh bản dịch máy (QT) và bản dịch AI chuyên nghiệp bên dưới để tìm ra các từ/cụm từ mà QT dịch chưa tốt, sai nghĩa, hoặc quá thô. 
Đề xuất các mục từ điển mới (Hán-Việt hoặc nghĩa chuẩn hơn) để bổ sung vào từ điển giúp bản dịch QT lần sau tốt hơn.
</task>

<source_text lang="zh">
${opts.sourceText.slice(0, 3000)}
</source_text>

<qt_translation lang="vi">
${opts.qtTranslated.slice(0, 3000)}
</qt_translation>

<ai_professional_translation lang="vi">
${opts.aiTranslated.slice(0, 3000)}
</ai_professional_translation>

<requirements>
1. Chỉ đề xuất các mục thực sự cải thiện được bản dịch máy (biến nó giống với bản dịch chuyên nghiệp hơn).
2. Phân loại theo các nhóm: nhân vật, thuật ngữ tu tiên, cụm hành động, cụm cảm xúc, từ nối, v.v.
3. Chú trọng vào việc sử dụng từ Hán-Việt cho các thuật ngữ tu tiên, chiêu thức và tên riêng để giữ đúng phong cách tiên hiệp/huyền huyễn.
4. Tránh dịch quá "thuần Việt" (quá hiện đại hoặc bình dân) cho các bối cảnh cổ đại/tu tiên.
5. Mỗi đề xuất phải có { chinese, vietnamese, reason, category }.
</requirements>

<output_format>Trả về JSON chứa mảng "suggestions". Không giải thích gì thêm.</output_format>
`;

  const result = await generateStructured({
    model: opts.model,
    schema: trainingSchema,
    system: "Bạn là chuyên gia huấn luyện hệ thống dịch thuật Trung-Việt.",
    prompt,
  });

  return result.object.suggestions;
}
