import { create } from 'zustand';

export const Role = {
  PROSECUTOR: 'PROSECUTOR',
  DEFENSE: 'DEFENSE',
  DEFENDANT: 'DEFENDANT',
  WITNESS_1: 'WITNESS_1',
  WITNESS_2: 'WITNESS_2',
  JURY_FOREMAN: 'JURY_FOREMAN',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const Phase = {
  LOBBY: 'LOBBY',
  TRIAL: 'TRIAL',
  SCORING: 'SCORING',
} as const;
export type Phase = (typeof Phase)[keyof typeof Phase];

export const JudgeMood = {
  NEUTRAL: 'NEUTRAL',
  IMPRESSED: 'IMPRESSED',
  SCEPTICAL: 'SCEPTICAL',
  OUTRAGED: 'OUTRAGED',
  AMUSED: 'AMUSED',
} as const;
export type JudgeMood = (typeof JudgeMood)[keyof typeof JudgeMood];

export interface Player {
  socketId: string;
  name: string;
  role: Role | null;
  isHost: boolean;
  connected: boolean;
}

export interface CaseDetails {
  defendant: string;
  crime: string;
  evidence: string[];
}

export interface TranscriptEntry {
  speaker: string;
  role: Role | 'JUDGE';
  text: string;
  timestamp: number;
}

export interface ScoreBreakdown {
  creativity: number;
  persuasiveness: number;
  absurdity: number;
  total: number;
}

export interface PlayerScore {
  playerId: string;
  playerName: string;
  role: Role;
  scores: ScoreBreakdown;
  foremanModifier?: number;
}

export type CaseIllustrationStatus = 'pending' | 'ready' | 'error' | null;

export interface RoomState {
  code: string;
  players: Player[];
  phase: Phase;
  caseDetails: CaseDetails | null;
  activeSpeaker: string | null;
  judgeMood: JudgeMood;
  transcript: TranscriptEntry[];
  scores: PlayerScore[];
  winner: string | null;
  caseVerdict: 'GUILTY' | 'NOT_GUILTY' | null;
  verdictRationale: string | null;
  rematchReady: string[];
  phaseTimeRemaining: number | null;
  caseIllustration: string | null;
  caseIllustrationStatus: CaseIllustrationStatus;
  caseIllustrationError: string | null;
}

interface GameStore {
  socketId: string | null;
  playerName: string;
  roomState: RoomState | null;
  isJudgeSpeaking: boolean;
  isMicActive: boolean;
  micPermissionGranted: boolean;

  setSocketId: (id: string) => void;
  setPlayerName: (name: string) => void;
  setRoomState: (state: RoomState) => void;
  setJudgeSpeaking: (speaking: boolean) => void;
  setMicActive: (active: boolean) => void;
  setMicPermission: (granted: boolean) => void;
  updateJudgeMood: (mood: JudgeMood) => void;
  addTranscriptEntry: (entry: TranscriptEntry) => void;
  reset: () => void;
}

const initialState = {
  socketId: null as string | null,
  playerName: '',
  roomState: null as RoomState | null,
  isJudgeSpeaking: false,
  isMicActive: false,
  micPermissionGranted: false,
};

export const useGameStore = create<GameStore>((set) => ({
  ...initialState,

  setSocketId: (id) => set({ socketId: id }),
  setPlayerName: (name) => set({ playerName: name }),
  setRoomState: (state) => set({ roomState: state }),
  setJudgeSpeaking: (speaking) => set({ isJudgeSpeaking: speaking }),
  setMicActive: (active) => set({ isMicActive: active }),
  setMicPermission: (granted) => set({ micPermissionGranted: granted }),

  updateJudgeMood: (mood) =>
    set((state) => ({
      roomState: state.roomState ? { ...state.roomState, judgeMood: mood } : null,
    })),

  addTranscriptEntry: (entry) =>
    set((state) => ({
      roomState: state.roomState
        ? { ...state.roomState, transcript: [...state.roomState.transcript, entry] }
        : null,
    })),

  reset: () => set(initialState),
}));
