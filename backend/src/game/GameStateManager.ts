import { Phase, RoomState, Role } from '../types';

export type PhaseCallback = (room: RoomState) => void;

export class GameStateManager {
  private onPhaseChange: PhaseCallback;

  constructor(onPhaseChange: PhaseCallback) {
    this.onPhaseChange = onPhaseChange;
  }

  startGame(room: RoomState): void {
    room.phase = Phase.TRIAL;
    room.activeSpeaker = null;
    room.phaseTimeRemaining = null;
    this.onPhaseChange(room);
  }

  setActiveSpeaker(room: RoomState, socketId: string | null): void {
    room.activeSpeaker = socketId;
  }

  setActiveSpeakerByRole(room: RoomState, role: Role): string | null {
    const player = room.players.find(p => p.role === role && p.connected);
    if (player) {
      room.activeSpeaker = player.socketId;
      return player.socketId;
    }
    return null;
  }

  endGame(room: RoomState): void {
    room.phase = Phase.SCORING;
    room.activeSpeaker = null;
    room.phaseTimeRemaining = null;
    this.onPhaseChange(room);
  }

  resetForRematch(room: RoomState): void {
    room.phase = Phase.LOBBY;
    room.activeSpeaker = null;
    room.transcript = [];
    room.scores = [];
    room.winner = null;
    room.verdictRationale = null;
    room.phaseTimeRemaining = null;
    room.caseDetails = null;
    room.players.forEach(p => { p.role = null; });
  }
}
