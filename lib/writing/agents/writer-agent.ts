import { streamText } from "ai";
import { withGlobalInstruction } from "@/lib/ai/system-prompt";
import type { AgentConfig, ContextAgentOutput, OutlineAgentOutput } from "../types";

export async function runWriterAgent(
  contextOutput: ContextAgentOutput,
  outline: OutlineAgentOutput,
  config: AgentConfig,
  onChunk?: (text: string) => void,
): Promise<string> {
  const contextSummary = [
    `Sự kiện trước đó: ${contextOutput.previousEvents}`,
    `Trạng thái nhân vật: ${contextOutput.characterStates.map((c) => `${c.name}: ${c.currentState}`).join("; ")}`,
    `Thế giới: ${contextOutput.worldState}`,
  ].join("\n");

  const outlineText = outline.scenes
    .map(
      (s, i) =>
        `### Phân cảnh ${i + 1}: ${s.title}
Tóm tắt: ${s.summary}
Nhân vật: ${s.characters.join(", ")}
${s.location ? `Địa điểm: ${s.location}` : ""}
Sự kiện: ${s.keyEvents.join("; ")}
Tâm trạng: ${s.mood}
Số từ: ~${s.wordCountTarget} từ`,
    )
    .join("\n\n");

  const result = streamText({
    model: config.model,
    system: withGlobalInstruction(config.systemPrompt, config.globalInstruction),
    prompt: `Viết chương truyện "${outline.chapterTitle}" dựa trên giàn ý chi tiết sau.

## Tóm tắt chương
${outline.synopsis}

## Bối cảnh
${contextSummary}

## Giàn ý chi tiết
${outlineText}

## Yêu cầu
- Tổng số từ mục tiêu: ${outline.totalWordCountTarget} từ
- Viết văn xuôi thuần túy, không dùng markdown
- Viết bằng Tiếng Việt`,
    abortSignal: config.abortSignal,
  });

  let accumulated = "";

  for await (const chunk of result.textStream) {
    accumulated += chunk;
    onChunk?.(chunk);
  }

  return accumulated;
}
