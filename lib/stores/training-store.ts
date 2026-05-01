import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { TrainingSuggestion } from "@/lib/ai/training-tools";
import type { ConvertSegment } from "@/lib/workers/qt-engine.types";

interface TrainingState {
  input: string;
  output: string;
  segments: ConvertSegment[];
  isTraining: boolean;
  lastProcessedIndex: number;
  trainingSuggestions: TrainingSuggestion[];
  batchProgress: { current: number; total: number } | null;
  isAutoNext: boolean;
  checklistCounts: Record<string, number>;
  
  // Actions
  setInput: (input: string) => void;
  setOutput: (output: string) => void;
  setSegments: (segments: ConvertSegment[]) => void;
  setIsTraining: (isTraining: boolean) => void;
  setLastProcessedIndex: (index: number) => void;
  setTrainingSuggestions: (suggestions: TrainingSuggestion[]) => void;
  setBatchProgress: (progress: { current: number; total: number } | null) => void;
  setIsAutoNext: (isAutoNext: boolean) => void;
  incrementChecklistCount: (category: string) => void;
  resetTraining: () => void;
}

export const useTrainingStore = create<TrainingState>()(
  persist(
    (set) => ({
      input: "",
      output: "",
      segments: [],
      isTraining: false,
      lastProcessedIndex: 0,
      trainingSuggestions: [],
      batchProgress: null,
      isAutoNext: false,
      checklistCounts: {},

      setInput: (input) => set({ input }),
      setOutput: (output) => set({ output }),
      setSegments: (segments) => set({ segments }),
      setIsTraining: (isTraining) => set({ isTraining }),
      setLastProcessedIndex: (lastProcessedIndex) => set({ lastProcessedIndex }),
      setTrainingSuggestions: (trainingSuggestions) => set({ trainingSuggestions }),
      setBatchProgress: (batchProgress) => set({ batchProgress }),
      setIsAutoNext: (isAutoNext) => set({ isAutoNext }),
      incrementChecklistCount: (category) => set((state) => ({
        checklistCounts: {
          ...state.checklistCounts,
          [category]: (state.checklistCounts[category] || 0) + 1
        }
      })),
      resetTraining: () => set({
        isTraining: false,
        lastProcessedIndex: 0,
        trainingSuggestions: [],
        batchProgress: null,
        checklistCounts: {},
      }),
    }),
    {
      name: "training-storage",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (state) => ({
        input: state.input,
        output: state.output,
        lastProcessedIndex: state.lastProcessedIndex,
        isAutoNext: state.isAutoNext,
        checklistCounts: state.checklistCounts,
      }),
    }
  )
);
