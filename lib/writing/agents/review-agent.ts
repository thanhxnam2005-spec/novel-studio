import { generateStructured } from "@/lib/ai/structured";
import { withGlobalInstruction } from "@/lib/ai/system-prompt";
import { reviewOutputSchema } from "../schemas";
import type { AgentConfig, ContextAgentOutput, ReviewAgentOutput } from "../types";

export async function runReviewAgent(
  contextOutput: ContextAgentOutput,
  chapterContent: string,
  config: AgentConfig,
): Promise<ReviewAgentOutput> {
  const contextSummary = [
    `Sự kiện trước đó: ${contextOutput.previousEvents}`,
    `Trạng thái nhân vật: ${contextOutput.characterStates.map((c) => `${c.name}: ${c.currentState}`).join("; ")}`,
    `Thế giới: ${contextOutput.worldState}`,
    `Tiến trình cốt truyện: ${contextOutput.plotProgress}`,
    `Tuyến chưa giải quyết: ${contextOutput.unresolvedThreads.join("; ")}`,
  ].join("\n");

  const { object } = await generateStructured<ReviewAgentOutput>({
    model: config.model,
    schema: reviewOutputSchema,
    system: withGlobalInstruction(config.systemPrompt, config.globalInstruction),
    prompt: `Đánh giá chương truyện sau dựa trên bối cảnh đã thiết lập.

## Bối cảnh đã thiết lập
${contextSummary}

## Nội dung chương cần đánh giá
${chapterContent}`,
    abortSignal: config.abortSignal,
  });

  return object;
}
