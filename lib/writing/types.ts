import type { LanguageModel } from "ai";

export interface AgentConfig {
  model: LanguageModel;
  systemPrompt: string;
  globalInstruction?: string;
  abortSignal?: AbortSignal;
}

// ─── Context Agent ──────────────────────────────────────────

export interface ContextAgentInput {
  novelId: string;
  chapterOrder: number;
}

export interface ContextAgentOutput {
  previousEvents: string;
  characterStates: Array<{ name: string; currentState: string }>;
  worldState: string;
  plotProgress: string;
  unresolvedThreads: string[];
}

// ─── Direction Agent ────────────────────────────────────────

export interface DirectionOption {
  id: string;
  title: string;
  description: string;
  plotImpact: string;
  characters: string[];
}

export interface DirectionAgentOutput {
  options: DirectionOption[];
}

// ─── Outline Agent ──────────────────────────────────────────

export interface OutlineScene {
  title: string;
  summary: string;
  characters: string[];
  location?: string;
  keyEvents: string[];
  mood: string;
  wordCountTarget: number;
}

export interface OutlineAgentOutput {
  chapterTitle: string;
  synopsis: string;
  scenes: OutlineScene[];
  totalWordCountTarget: number;
}

// ─── Review Agent ───────────────────────────────────────────

export interface ReviewIssue {
  type: "character" | "plot" | "tone" | "world-rules";
  severity: "critical" | "minor" | "suggestion";
  description: string;
  location: string;
  suggestion: string;
}

export interface ReviewAgentOutput {
  overallScore: number;
  issues: ReviewIssue[];
  summary: string;
}

// ─── Rewrite Agent ──────────────────────────────────────────

export interface RewriteAgentOutput {
  rewrittenContent: string;
  changesSummary: string;
}

// ─── Writing Context ────────────────────────────────────────

export type WritingContextDepth = "standard" | "deep";

export interface WritingContext {
  context: string;
  hash: string;
}
