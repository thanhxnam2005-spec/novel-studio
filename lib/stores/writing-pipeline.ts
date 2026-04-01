import { create } from "zustand";

interface WritingPipelineState {
  activeSessionId: string | null;
  isRunning: boolean;
  abortController: AbortController | null;
  activePanel: "pipeline" | "outline" | "content" | "review";
  streamingContent: string;

  // Actions
  startPipeline: (sessionId: string) => AbortController;
  pausePipeline: () => void;
  cancelPipeline: () => void;
  setActivePanel: (
    panel: "pipeline" | "outline" | "content" | "review",
  ) => void;
  appendStreamingContent: (chunk: string) => void;
  clearStreamingContent: () => void;
  reset: () => void;
}

export const useWritingPipelineStore = create<WritingPipelineState>(
  (set, get) => ({
    activeSessionId: null,
    isRunning: false,
    abortController: null,
    activePanel: "pipeline",
    streamingContent: "",

    startPipeline: (sessionId) => {
      const controller = new AbortController();
      set({
        activeSessionId: sessionId,
        isRunning: true,
        abortController: controller,
        streamingContent: "",
      });
      return controller;
    },

    pausePipeline: () => {
      const { abortController } = get();
      abortController?.abort();
      set({ isRunning: false, abortController: null });
    },

    cancelPipeline: () => {
      const { abortController } = get();
      abortController?.abort();
      set({
        isRunning: false,
        abortController: null,
        activeSessionId: null,
        streamingContent: "",
      });
    },

    setActivePanel: (panel) => set({ activePanel: panel }),

    appendStreamingContent: (chunk) =>
      set((state) => ({
        streamingContent: state.streamingContent + chunk,
      })),

    clearStreamingContent: () => set({ streamingContent: "" }),

    reset: () =>
      set({
        activeSessionId: null,
        isRunning: false,
        abortController: null,
        activePanel: "pipeline",
        streamingContent: "",
      }),
  }),
);
