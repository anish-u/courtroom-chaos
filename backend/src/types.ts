export enum Role {
  PROSECUTOR = 'PROSECUTOR',
  DEFENSE = 'DEFENSE',
  DEFENDANT = 'DEFENDANT',
  WITNESS_1 = 'WITNESS_1',
  WITNESS_2 = 'WITNESS_2',
  JURY_FOREMAN = 'JURY_FOREMAN',
}

export enum Phase {
  LOBBY = 'LOBBY',
  TRIAL = 'TRIAL',
  SCORING = 'SCORING',
}

export enum JudgeMood {
  NEUTRAL = 'NEUTRAL',
  IMPRESSED = 'IMPRESSED',
  SCEPTICAL = 'SCEPTICAL',
  OUTRAGED = 'OUTRAGED',
  AMUSED = 'AMUSED',
}

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
  verdictRationale: string | null;
  phaseTimeRemaining: number | null;
}

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 6;

export const ROLE_ASSIGNMENT_ORDER: Role[] = [
  Role.PROSECUTOR,
  Role.DEFENSE,
  Role.DEFENDANT,
  Role.WITNESS_1,
  Role.WITNESS_2,
  Role.JURY_FOREMAN,
];
