// ─── Chapter Analysis ────────────────────────────────────────

export interface ChapterSceneResult {
  title: string;
  description: string;
}

export interface ChapterCharacterMention {
  name: string;
  role: string;
  noteInChapter: string;
}

export interface ChapterAnalysisResult {
  summary: string;
  keyScenes: ChapterSceneResult[];
  characters: ChapterCharacterMention[];
}

export interface BatchChapterAnalysisResult {
  chapters: ChapterAnalysisResult[];
}

export interface IntermediateSummaryResult {
  summary: string;
}

// ─── Novel Aggregation ──────────────────────────────────────

export interface FactionResult {
  name: string;
  description: string;
}

export interface LocationResult {
  name: string;
  description: string;
}

export interface NovelAggregationResult {
  genres: string[];
  tags: string[];
  synopsis: string;
  worldOverview: string;
  powerSystem: string | null;
  storySetting: string;
  timePeriod: string | null;
  factions: FactionResult[];
  keyLocations: LocationResult[];
  worldRules: string | null;
  technologyLevel: string | null;
}

// ─── Character Profiling ────────────────────────────────────

export interface CharacterRelationshipResult {
  characterName: string;
  description: string;
}

export interface CharacterProfileResult {
  name: string;
  age: string;
  sex: string;
  role: string;
  appearance: string;
  personality: string;
  hobbies: string;
  relationshipWithMC: string;
  relationships: CharacterRelationshipResult[];
  characterArc: string;
  strengths: string;
  weaknesses: string;
  motivations: string;
  goals: string;
  description: string;
}

export interface CharacterProfilingResult {
  characters: CharacterProfileResult[];
}

// ─── Progress & Errors ──────────────────────────────────────

export type AnalysisPhase =
  | "chapters"
  | "aggregation"
  | "characters"
  | "complete";

export interface AnalysisError {
  phase: string;
  chapterTitle?: string;
  message: string;
}

export interface AnalysisProgress {
  phase: AnalysisPhase;
  chaptersCompleted: number;
  totalChapters: number;
  error?: AnalysisError;
}
