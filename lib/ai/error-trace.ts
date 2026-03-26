import { APICallError } from "ai";

/**
 * Generic AI error trace — captures all relevant context when an AI call fails.
 * Designed to be used across any module that calls AI (chat, analysis, chapter tools, etc.).
 */
export interface AIErrorTrace {
  /** ISO timestamp */
  timestamp: string;
  /** Which module triggered the call (e.g. "chat", "analysis", "chapter-tools") */
  module: string;
  /** Provider metadata (name, type, baseUrl — never the API key) */
  provider: {
    name: string;
    type: string;
    baseUrl: string;
  };
  /** Model ID used */
  modelId: string;
  /** Categorized error info */
  error: {
    type: string;
    message: string;
    statusCode?: number;
    responseBody?: string;
    cause?: string;
    stack?: string;
  };
  /** Request context — system prompt, message count, temperature, etc. */
  request?: {
    systemPrompt?: string;
    messageCount?: number;
    temperature?: number;
    lastUserMessage?: string;
  };
}

/**
 * Build an AIErrorTrace from a caught error and call context.
 */
export function buildErrorTrace(
  err: unknown,
  context: {
    module: string;
    provider: { name: string; type: string; baseUrl: string };
    modelId: string;
    request?: AIErrorTrace["request"];
  },
): AIErrorTrace {
  const trace: AIErrorTrace = {
    timestamp: new Date().toISOString(),
    module: context.module,
    provider: context.provider,
    modelId: context.modelId,
    error: extractErrorInfo(err),
    request: context.request,
  };
  return trace;
}

function extractErrorInfo(err: unknown): AIErrorTrace["error"] {
  if (APICallError.isInstance(err)) {
    return {
      type: "APICallError",
      message: err.message,
      statusCode: err.statusCode,
      responseBody:
        typeof err.responseBody === "string"
          ? err.responseBody
          : JSON.stringify(err.responseBody),
      cause:
        err.cause instanceof Error ? err.cause.message : undefined,
      stack: err.stack,
    };
  }

  if (err instanceof Error) {
    return {
      type: err.constructor.name || "Error",
      message: err.message,
      cause:
        err.cause instanceof Error ? err.cause.message : undefined,
      stack: err.stack,
    };
  }

  return {
    type: "Unknown",
    message: String(err),
  };
}

/**
 * In-memory store for error traces, keyed by an arbitrary ID (e.g. message ID).
 * Ephemeral — lost on page refresh. Kept small via auto-eviction.
 */
const traceStore = new Map<string, AIErrorTrace>();
const MAX_TRACES = 50;

export function storeErrorTrace(id: string, trace: AIErrorTrace) {
  if (traceStore.size >= MAX_TRACES) {
    // Evict oldest entry
    const first = traceStore.keys().next().value;
    if (first !== undefined) traceStore.delete(first);
  }
  traceStore.set(id, trace);
}

export function getErrorTrace(id: string): AIErrorTrace | undefined {
  return traceStore.get(id);
}

/**
 * Download a trace as a JSON file.
 */
export function downloadErrorTrace(trace: AIErrorTrace) {
  const blob = new Blob([JSON.stringify(trace, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ai-error-trace_${trace.module}_${trace.timestamp.replace(/[:.]/g, "-")}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
