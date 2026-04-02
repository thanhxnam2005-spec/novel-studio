import { create } from "zustand";
import type { Sentence } from "@/lib/tts/providers/types";
import type { TTSSettings } from "@/lib/db";
import { Player } from "@/lib/tts/player";
import { getProvider } from "@/lib/tts/providers/registry";
import { updateTTSSettings } from "@/lib/hooks/use-tts-settings";
// Side-effect: ensure all providers are registered
import "@/lib/tts";

export const PANEL_MIN_WIDTH = 280;
export const PANEL_MAX_WIDTH = 700;

const WIDTH_STORAGE_KEY = "reader-panel-width";

function loadWidth(): number {
  if (typeof window === "undefined") return 360;
  try {
    const raw = localStorage.getItem(WIDTH_STORAGE_KEY);
    if (raw) {
      const w = Number(raw);
      if (!Number.isNaN(w))
        return Math.max(PANEL_MIN_WIDTH, Math.min(w, PANEL_MAX_WIDTH));
    }
  } catch {
    // ignore
  }
  return 360;
}

function saveWidth(width: number) {
  try {
    localStorage.setItem(WIDTH_STORAGE_KEY, String(width));
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Singleton Player instance (created lazily on first play)
// ---------------------------------------------------------------------------

let player: Player | null = null;

function getPlayer(): Player {
  if (!player) {
    player = new Player();
  }
  return player;
}

/**
 * Configure the player with TTS settings from Dexie.
 */
function configurePlayer(
  p: Player,
  settings: Pick<
    TTSSettings,
    "providerId" | "voiceId" | "rate" | "pitch" | "fluencyAdjust" | "providerApiKeys"
  >,
): void {
  const { providerId, voiceId, rate, pitch, fluencyAdjust, providerApiKeys } =
    settings;
  if (!providerId) return;

  try {
    const provider = getProvider(providerId);

    // Inject API key if the provider needs one
    if (provider.requiresApiKey && provider.setApiKey && providerApiKeys?.[providerId]) {
      provider.setApiKey(providerApiKeys[providerId]);
    }

    p.setProviderInstance(provider);
  } catch (err) {
    console.error("[TTS] Failed to set provider:", err);
    return;
  }

  const parsed = isNaN(Number(voiceId)) ? voiceId : Number(voiceId);
  p.setVoice(parsed);
  p.setRate(rate);
  p.setPitch(pitch);
  p.setFluencyEffectiveness(fluencyAdjust);
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface ReaderPanelState {
  // Panel
  isOpen: boolean;
  panelWidth: number;

  // Playback
  isPlaying: boolean;
  isPaused: boolean;
  isLoading: boolean;
  currentSentenceIndex: number;
  sentences: Sentence[];

  // When true, play() is triggered automatically on the next setSentences call
  autoPlayOnLoad: boolean;

  // TTS settings snapshot (synced from Dexie by the UI)
  ttsSettings: TTSSettings;

  // Callback invoked when TTS finishes the current content (e.g. to auto-advance chapter)
  onFinishChapter?: () => void;

  // Actions
  toggle: () => void;
  setOpen: (open: boolean) => void;
  play: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  jumpTo: (index: number) => void;
  setSentences: (sentences: Sentence[]) => void;
  setCurrentSentenceIndex: (index: number) => void;
  syncSettings: (settings: TTSSettings) => void;
  updateSettings: (partial: Partial<Omit<TTSSettings, "id">>) => void;
  setPanelWidth: (width: number) => void;
  setOnFinishChapter: (fn: (() => void) | undefined) => void;
  setAutoPlayOnLoad: (value: boolean) => void;
}

const DEFAULT_TTS: TTSSettings = {
  id: "default",
  providerId: "GoogleCloudTTS",
  voiceId: "0",
  rate: 1.0,
  pitch: 1.0,
  highlightColor: "#dbeafe",
  fluencyAdjust: 1.0,
  providerApiKeys: {},
};

export const useReaderPanel = create<ReaderPanelState>((set, get) => ({
  isOpen: false,
  panelWidth: loadWidth(),
  isPlaying: false,
  isPaused: false,
  isLoading: false,
  currentSentenceIndex: 0,
  sentences: [],
  autoPlayOnLoad: false,
  ttsSettings: DEFAULT_TTS,

  toggle: () => set((s) => ({ isOpen: !s.isOpen })),

  setOpen: (open) => set({ isOpen: open }),

  play: () => {
    const { sentences, currentSentenceIndex, ttsSettings } = get();
    if (sentences.length === 0) return;

    const p = getPlayer();

    p.setCallbacks({
      onSentenceStart: (index) => {
        set({ currentSentenceIndex: index, isLoading: true });
      },
      onAudioPlay: () => {
        set({ isLoading: false });
      },
      onPlayStateChange: (state) => {
        switch (state) {
          case "playing":
            set({ isPlaying: true, isPaused: false });
            break;
          case "paused":
            set({ isPlaying: false, isPaused: true, isLoading: false });
            break;
          case "stopped":
            set({ isPlaying: false, isPaused: false, isLoading: false });
            break;
        }
      },
      onFinish: () => {
        set({ isPlaying: false, isPaused: false, isLoading: false, currentSentenceIndex: 0 });
        get().onFinishChapter?.();
      },
      onError: (err) => {
        console.error("[TTS] Playback error:", err);
        set({ isPlaying: false, isPaused: false, isLoading: false });
      },
    });

    configurePlayer(p, ttsSettings);
    set({ isLoading: true, isPlaying: true, isPaused: false });
    p.start(sentences, currentSentenceIndex);
  },

  pause: () => {
    player?.pause();
    set({ isPlaying: false, isPaused: true });
  },

  resume: () => {
    player?.resume();
    set({ isPlaying: true, isPaused: false });
  },

  stop: () => {
    player?.stop();
    set({ isPlaying: false, isPaused: false, isLoading: false, currentSentenceIndex: 0 });
  },

  jumpTo: (index) => {
    const { sentences, isPlaying } = get();
    if (index < 0 || index >= sentences.length) return;
    set({ currentSentenceIndex: index });
    if (isPlaying && player) {
      player.jumpTo(index);
    }
  },

  setSentences: (sentences) => {
    set({ sentences, currentSentenceIndex: 0 });
    if (get().autoPlayOnLoad) {
      set({ autoPlayOnLoad: false });
      get().play();
    }
  },

  setCurrentSentenceIndex: (index) => set({ currentSentenceIndex: index }),

  /** Called by the UI component to keep the store in sync with Dexie data. */
  syncSettings: (settings) => set({ ttsSettings: settings }),

  /** Persist partial settings update to Dexie (async, fire-and-forget). */
  updateSettings: (partial) => {
    const next = { ...get().ttsSettings, ...partial };
    set({ ttsSettings: next });
    updateTTSSettings(partial);

    // Live-update player if currently playing
    if (player && get().isPlaying) {
      configurePlayer(player, next);
    }
  },

  setOnFinishChapter: (fn) => set({ onFinishChapter: fn }),

  setAutoPlayOnLoad: (value) => set({ autoPlayOnLoad: value }),

  setPanelWidth: (width) => {
    const clamped = Math.max(
      PANEL_MIN_WIDTH,
      Math.min(width, PANEL_MAX_WIDTH),
    );
    if (clamped !== get().panelWidth) {
      saveWidth(clamped);
      set({ panelWidth: clamped });
    }
  },
}));
