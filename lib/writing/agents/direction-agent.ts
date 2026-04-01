import { generateStructured } from "@/lib/ai/structured";
import { withGlobalInstruction } from "@/lib/ai/system-prompt";
import { directionOutputSchema } from "../schemas";
import type {
  AgentConfig,
  ContextAgentOutput,
  DirectionAgentOutput,
} from "../types";
import type { PlotArc } from "@/lib/db";

export async function runDirectionAgent(
  contextOutput: ContextAgentOutput,
  plotArcs: PlotArc[],
  config: AgentConfig,
): Promise<DirectionAgentOutput> {
  const contextSummary = [
    `Sự kiện trước đó: ${contextOutput.previousEvents}`,
    `Tiến trình cốt truyện: ${contextOutput.plotProgress}`,
    `Tuyến chưa giải quyết: ${contextOutput.unresolvedThreads.join("; ")}`,
    `Trạng thái nhân vật: ${contextOutput.characterStates.map((c) => `${c.name}: ${c.currentState}`).join("; ")}`,
    `Thế giới: ${contextOutput.worldState}`,
  ].join("\n\n");

  const arcSummary =
    plotArcs.length > 0
      ? `\n\nMạch truyện:\n${plotArcs.map((a) => `- ${a.title} (${a.type}, ${a.status}): ${a.description}`).join("\n")}`
      : "";

  const { object } = await generateStructured<DirectionAgentOutput>({
    model: config.model,
    schema: directionOutputSchema,
    system: withGlobalInstruction(config.systemPrompt, config.globalInstruction),
    prompt: `Dựa trên bối cảnh sau, hãy đề xuất 3-5 hướng đi cho chương tiếp theo:\n\n${contextSummary}${arcSummary}`,
    abortSignal: config.abortSignal,
  });

  return object;
}
