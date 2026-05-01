"use client";

import { useTrainingStore } from "@/lib/stores/training-store";
import { convertText, refreshQTEngine } from "@/lib/hooks/use-qt-engine";
import { getModel } from "@/lib/ai/provider";
import { runTranslationTraining } from "@/lib/ai/training-tools";
import { useAIProviders } from "@/lib/hooks/use-ai-providers";
import { useConvertSettings } from "@/lib/hooks/use-convert-settings";
import { toast } from "sonner";
import { useRef } from "react";
import { sify } from "chinese-conv";
import { db } from "@/lib/db";

const BATCH_SIZE = 10000;

export function useBackgroundTraining() {
  const store = useTrainingStore();
  const providers = useAIProviders();
  const settings = useConvertSettings();
  const trainingRef = useRef(false);

  const handleTrain = async (startIndex?: number) => {
    if (trainingRef.current) return;
    
    const startIdx = startIndex ?? store.lastProcessedIndex;
    const input = store.input;
    if (!input) {
      toast.error("Vui lòng nhập văn bản");
      return;
    }

    const providerId = settings.trainingProviderId;
    const modelId = settings.trainingModelId;
    const provider = providers?.find(p => p.id === providerId);

    if (!provider || !modelId) {
      toast.error("Vui lòng cấu hình AI trong phần Cài đặt");
      return;
    }

    store.setIsTraining(true);
    trainingRef.current = true;
    
    try {
      const model = await getModel(provider, modelId);
      const { generateText } = await import("ai");

      const systemPrompt = `
<role>
Bạn là dịch giả văn học chuyên nghiệp, chuyên dịch tiểu thuyết Trung Quốc sang Tiếng Việt. Nhiệm vụ của bạn là tạo bản dịch tự nhiên, trung thành và nhất quán.
</role>

<task>
Dịch chương truyện được cung cấp sang Tiếng Việt. Ưu tiên sự tự nhiên và mượt mà của ngôn ngữ đích trong khi giữ trung thành với nội dung gốc.
</task>

<translation_rules>
  <rule id="structure">Giữ nguyên cấu trúc đoạn văn, định dạng và dấu ngắt dòng của bản gốc.</rule>
  <rule id="proper_names">Tên riêng: sử dụng âm Hán-Việt (ví dụ: Vương Lâm, không phải Rừng Vương). Nhất quán cách dịch xuyên suốt chương.</rule>
  <rule id="style">Sử dụng văn phong tiểu thuyết mạng Trung Quốc (Tiên Hiệp/Ngôn Tình), ưu tiên các từ Hán-Việt trang trọng cho bối cảnh tu tiên/cổ đại. Tránh dùng từ ngữ quá hiện đại hoặc bình dân thuần Việt.</rule>
  <rule id="naturalness">Văn phong mượt mà nhưng vẫn giữ được "chất" truyện dịch, tránh dịch word-by-word.</rule>
  <rule id="dialogue_register">Giữ đúng ngữ điệu: lời thoại trang trọng (ví dụ: "Tiền bối", "Vãn bối") giữ đúng sắc thái.</rule>
  <rule id="terminology">Thuật ngữ tu tiên (Linh khí, Trúc Cơ, Đan dược) phải dùng đúng từ Hán-Việt tiêu chuẩn.</rule>
  <rule id="fidelity">Không thêm, bớt, giải thích, hoặc chú thích nội dung gốc.</rule>
  <rule id="special_chars">Giữ nguyên các ký hiệu đặc biệt (★, ※, ─, v.v.).</rule>
</translation_rules>

<context_usage>Nếu được cung cấp ngữ cảnh về tên nhân vật, địa danh: sử dụng nhất quán theo ngữ cảnh đó.</context_usage>

<output_format>Chỉ trả về bản dịch hoàn chỉnh. Không kèm giải thích, ghi chú, hoặc bình luận.</output_format>`;

      let currentStart = startIdx;
      const totalChars = input.length;

      while (currentStart < totalChars && trainingRef.current) {
        const currentEnd = Math.min(currentStart + BATCH_SIZE, totalChars);
        const chunkRaw = input.slice(currentStart, currentEnd);
        const chunk = sify(chunkRaw) || chunkRaw;
        
        // Use store to track current chunk for UI
        const numBatches = Math.ceil(totalChars / BATCH_SIZE);
        const currentBatch = Math.floor(currentStart / BATCH_SIZE) + 1;
        store.setBatchProgress({ current: currentBatch, total: numBatches });
        store.setLastProcessedIndex(currentStart);

        // Fetch latest global names
        const globalNames = await db.nameEntries.where("scope").equals("global").toArray();

        // 1. Get QT result (with global names)
        const qtResult = await convertText(chunk, { globalNames, options: settings });
        
        // 2. Get AI Professional result
        const { text: aiTranslated } = await generateText({
          model,
          system: systemPrompt,
          prompt: chunk,
        });

        // 3. Find suggestions
        const suggestions = await runTranslationTraining({
          model,
          sourceText: chunk,
          qtTranslated: qtResult.plainText,
          aiTranslated,
        });

        if (suggestions.length > 0) {
          store.setTrainingSuggestions(suggestions);
          // If NOT auto-next, we STOP here to let user review
          if (!store.isAutoNext) {
            toast.info(`Tìm thấy ${suggestions.length} đề xuất từ điển mới.`);
            break;
          }
        }

        // Move to next chunk
        currentStart = currentEnd;
        store.setLastProcessedIndex(currentStart);

        // Wait a bit to avoid Rate Limit (Free Tier)
        if (trainingRef.current) {
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }
      
      if (currentStart >= totalChars) {
        toast.success("Đã hoàn thành huấn luyện toàn bộ văn bản");
      }
    } catch (err) {
      toast.error("Huấn luyện thất bại: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      store.setIsTraining(false);
      trainingRef.current = false;
      store.setBatchProgress(null);
    }
  };

  const stopTraining = () => {
    trainingRef.current = false;
    store.setIsTraining(false);
  };

  return {
    handleTrain,
    stopTraining,
  };
}
