import { Player, Role, RoomState, Phase, JudgeMood, MIN_PLAYERS, MAX_PLAYERS, ROLE_ASSIGNMENT_ORDER } from '../types';

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export class RoomManager {
  private rooms: Map<string, RoomState> = new Map();
  private playerToRoom: Map<string, string> = new Map();
  private cleanupTimers: Map<string, NodeJS.Timeout> = new Map();
  private roomTtlMs: number;

  constructor(roomTtlMs = 600_000) {
    this.roomTtlMs = roomTtlMs;
  }

  createRoom(hostSocketId: string, hostName: string): RoomState {
    let code: string;
    do {
      code = generateRoomCode();
    } while (this.rooms.has(code));

    const room: RoomState = {
      code,
      players: [
        {
          socketId: hostSocketId,
          name: hostName,
          role: null,
          isHost: true,
          connected: true,
        },
      ],
      phase: Phase.LOBBY,
      caseDetails: null,
      activeSpeaker: null,
      judgeMood: JudgeMood.NEUTRAL,
      transcript: [],
      scores: [],
      winner: null,
      verdictRationale: null,
      phaseTimeRemaining: null,
    };

    this.rooms.set(code, room);
    this.playerToRoom.set(hostSocketId, code);
    return room;
  }

  joinRoom(code: string, socketId: string, playerName: string): RoomState {
    const room = this.rooms.get(code);
    if (!room) throw new Error('Room not found');
    if (room.phase !== Phase.LOBBY) throw new Error('Game already in progress');
    if (room.players.length >= MAX_PLAYERS) throw new Error('Room is full');
    if (room.players.some(p => p.socketId === socketId)) throw new Error('Already in room');

    room.players.push({
      socketId,
      name: playerName,
      role: null,
      isHost: false,
      connected: true,
    });

    this.playerToRoom.set(socketId, code);
    return room;
  }

  assignRandomRoles(code: string): RoomState {
    const room = this.rooms.get(code);
    if (!room) throw new Error('Room not found');

    const shuffled = shuffle(room.players);
    for (let i = 0; i < shuffled.length; i++) {
      shuffled[i].role = ROLE_ASSIGNMENT_ORDER[i] ?? null;
    }

    return room;
  }

  canStart(code: string): { ok: boolean; reason?: string } {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, reason: 'Room not found' };

    if (room.players.length < MIN_PLAYERS) {
      return { ok: false, reason: `Need at least ${MIN_PLAYERS} players` };
    }
    return { ok: true };
  }

  kickPlayer(code: string, hostSocketId: string, targetSocketId: string): RoomState {
    const room = this.rooms.get(code);
    if (!room) throw new Error('Room not found');

    const host = room.players.find(p => p.socketId === hostSocketId);
    if (!host?.isHost) throw new Error('Only host can kick');

    room.players = room.players.filter(p => p.socketId !== targetSocketId);
    this.playerToRoom.delete(targetSocketId);
    return room;
  }

  leaveRoom(socketId: string): { room: RoomState; wasHost: boolean } | null {
    const code = this.playerToRoom.get(socketId);
    if (!code) return null;

    const room = this.rooms.get(code);
    if (!room) return null;

    const player = room.players.find(p => p.socketId === socketId);
    const wasHost = player?.isHost ?? false;

    if (room.phase === Phase.LOBBY) {
      room.players = room.players.filter(p => p.socketId !== socketId);
    } else {
      const p = room.players.find(p => p.socketId === socketId);
      if (p) p.connected = false;
    }

    this.playerToRoom.delete(socketId);

    if (room.players.filter(p => p.connected).length === 0) {
      this.scheduleCleanup(code);
    }

    if (wasHost && room.players.length > 0) {
      const newHost = room.players.find(p => p.connected);
      if (newHost) newHost.isHost = true;
    }

    return { room, wasHost };
  }

  getRoom(code: string): RoomState | undefined {
    return this.rooms.get(code);
  }

  getRoomByPlayer(socketId: string): RoomState | undefined {
    const code = this.playerToRoom.get(socketId);
    return code ? this.rooms.get(code) : undefined;
  }

  getRoomCode(socketId: string): string | undefined {
    return this.playerToRoom.get(socketId);
  }

  deleteRoom(code: string): void {
    const room = this.rooms.get(code);
    if (room) {
      room.players.forEach(p => this.playerToRoom.delete(p.socketId));
      this.rooms.delete(code);
    }
    const timer = this.cleanupTimers.get(code);
    if (timer) {
      clearTimeout(timer);
      this.cleanupTimers.delete(code);
    }
  }

  private scheduleCleanup(code: string): void {
    if (this.cleanupTimers.has(code)) return;
    const timer = setTimeout(() => {
      this.deleteRoom(code);
    }, this.roomTtlMs);
    this.cleanupTimers.set(code, timer);
  }

  reconnect(socketId: string, code: string, playerName: string): RoomState | null {
    const room = this.rooms.get(code);
    if (!room) return null;

    const player = room.players.find(p => p.name === playerName && !p.connected);
    if (!player) return null;

    const oldSocketId = player.socketId;
    this.playerToRoom.delete(oldSocketId);
    player.socketId = socketId;
    player.connected = true;
    this.playerToRoom.set(socketId, code);

    if (room.activeSpeaker === oldSocketId) {
      room.activeSpeaker = socketId;
    }

    const timer = this.cleanupTimers.get(code);
    if (timer) {
      clearTimeout(timer);
      this.cleanupTimers.delete(code);
    }

    return room;
  }
}
