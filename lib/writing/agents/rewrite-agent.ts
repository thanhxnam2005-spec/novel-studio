import { streamText } from "ai";
import { withGlobalInstruction } from "@/lib/ai/system-prompt";
import type { AgentConfig, ReviewAgentOutput } from "../types";

/**
 * Rewrite agent: takes the original chapter content + review feedback,
 * rewrites the chapter to fix identified issues.
 * Uses streaming for real-time display (same as writer agent).
 */
export async function runRewriteAgent(
  originalContent: string,
  review: ReviewAgentOutput,
  config: AgentConfig,
  onChunk?: (text: string) => void,
): Promise<string> {
  const issuesList = review.issues
    .map(
      (issue) =>
        `- [${issue.severity}] ${issue.type}: ${issue.description} (${issue.location}) → ${issue.suggestion}`,
    )
    .join("\n");

  const result = streamText({
    model: config.model,
    system: withGlobalInstruction(config.systemPrompt, config.globalInstruction),
    prompt: `Dựa trên đánh giá của biên tập viên, hãy viết lại chương truyện để khắc phục các vấn đề.

## Đánh giá (${review.overallScore}/10)
${review.summary}

## Các vấn đề cần sửa
${issuesList}

## Nội dung gốc
${originalContent}

## Yêu cầu
- Viết lại TOÀN BỘ chương, không chỉ sửa từng phần nhỏ
- Giữ nguyên cốt truyện, nhân vật và sự kiện
- Khắc phục tất cả vấn đề được nêu trong đánh giá
- Giữ nguyên phong cách và giọng văn của tác giả
- KHÔNG dùng markdown, chỉ văn xuôi thuần túy`,
    abortSignal: config.abortSignal,
  });

  let accumulated = "";
  for await (const chunk of result.textStream) {
    accumulated += chunk;
    onChunk?.(chunk);
  }

  return accumulated;
}
