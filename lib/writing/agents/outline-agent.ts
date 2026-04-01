import { generateStructured } from "@/lib/ai/structured";
import { withGlobalInstruction } from "@/lib/ai/system-prompt";
import { outlineOutputSchema } from "../schemas";
import type {
  AgentConfig,
  ContextAgentOutput,
  OutlineAgentOutput,
} from "../types";

export async function runOutlineAgent(
  contextOutput: ContextAgentOutput,
  selectedDirections: string[],
  chapterLength: number,
  config: AgentConfig,
): Promise<OutlineAgentOutput> {
  const contextSummary = [
    `Sự kiện trước đó: ${contextOutput.previousEvents}`,
    `Trạng thái nhân vật: ${contextOutput.characterStates.map((c) => `${c.name}: ${c.currentState}`).join("; ")}`,
    `Thế giới: ${contextOutput.worldState}`,
  ].join("\n\n");

  const directionText = selectedDirections
    .map((d, i) => `${i + 1}. ${d}`)
    .join("\n");

  const { object } = await generateStructured<OutlineAgentOutput>({
    model: config.model,
    schema: outlineOutputSchema,
    system: withGlobalInstruction(config.systemPrompt, config.globalInstruction),
    prompt: `Dựa trên bối cảnh và hướng đi đã chọn, hãy tạo giàn ý chi tiết cho chương mới.

## Bối cảnh
${contextSummary}

## Hướng đi đã chọn
${directionText}

## Yêu cầu
- Tổng số từ mục tiêu: ${chapterLength} từ
- Phân bổ số từ hợp lý cho mỗi phân cảnh`,
    abortSignal: config.abortSignal,
  });

  return object;
}
