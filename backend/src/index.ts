import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { z } from 'zod';
import { RoomManager } from './rooms/RoomManager';
import { GameStateManager } from './game/GameStateManager';
import { generateCase } from './game/CaseGenerator';
import { GeminiLiveProxy, GeminiProxyCallbacks } from './gemini/GeminiLiveProxy';
import { TranscriptBuilder } from './transcript/TranscriptBuilder';
import { parseScores, computeScores, applyForemanOverride } from './game/Scorer';
import { Phase, Role, RoomState } from './types';

const PORT = parseInt(process.env.PORT || '3001', 10);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

const clientBuildPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(clientBuildPath));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
});

const roomManager = new RoomManager(
  parseInt(process.env.ROOM_TTL_MS || '600000', 10)
);

const geminiProxies: Map<string, GeminiLiveProxy> = new Map();
const transcripts: Map<string, TranscriptBuilder> = new Map();

function broadcastRoomState(room: RoomState): void {
  io.to(room.code).emit('room:state', sanitizeRoom(room));
}

function sanitizeRoom(room: RoomState) {
  return {
    code: room.code,
    players: room.players.map(p => ({
      socketId: p.socketId,
      name: p.name,
      role: p.role,
      isHost: p.isHost,
      connected: p.connected,
    })),
    phase: room.phase,
    caseDetails: room.caseDetails,
    activeSpeaker: room.activeSpeaker,
    judgeMood: room.judgeMood,
    transcript: room.transcript,
    scores: room.scores,
    winner: room.winner,
    verdictRationale: room.verdictRationale,
    phaseTimeRemaining: room.phaseTimeRemaining,
  };
}

const gameStateManager = new GameStateManager(
  (room) => {
    broadcastRoomState(room);
  }
);

const CreateRoomSchema = z.object({ playerName: z.string().min(1).max(30) });
const JoinRoomSchema = z.object({ code: z.string().length(6), playerName: z.string().min(1).max(30) });
const KickPlayerSchema = z.object({ code: z.string().length(6), targetSocketId: z.string() });
const StartGameSchema = z.object({ code: z.string().length(6) });
const AudioChunkSchema = z.object({ code: z.string().length(6), chunk: z.string() });
const ForemanOverrideSchema = z.object({
  code: z.string().length(6),
  targetPlayerId: z.string(),
  modifier: z.number().min(-15).max(15),
});
const RematchSchema = z.object({ code: z.string().length(6) });
const ReconnectSchema = z.object({ code: z.string().length(6), playerName: z.string().min(1).max(30) });

io.on('connection', (socket) => {
  console.log('Connected:', socket.id);

  socket.on('room:create', (data, ack) => {
    const parsed = CreateRoomSchema.safeParse(data);
    if (!parsed.success) return ack?.({ error: parsed.error.message });

    try {
      const room = roomManager.createRoom(socket.id, parsed.data.playerName);
      socket.join(room.code);
      broadcastRoomState(room);
      ack?.({ room: sanitizeRoom(room) });
    } catch (err: any) {
      ack?.({ error: err.message });
    }
  });

  socket.on('room:join', (data, ack) => {
    const parsed = JoinRoomSchema.safeParse(data);
    if (!parsed.success) return ack?.({ error: parsed.error.message });

    try {
      const room = roomManager.joinRoom(parsed.data.code, socket.id, parsed.data.playerName);
      socket.join(room.code);
      broadcastRoomState(room);
      ack?.({ room: sanitizeRoom(room) });
    } catch (err: any) {
      ack?.({ error: err.message });
    }
  });

  socket.on('room:reconnect', (data, ack) => {
    const parsed = ReconnectSchema.safeParse(data);
    if (!parsed.success) return ack?.({ error: parsed.error?.message });

    const room = roomManager.reconnect(socket.id, parsed.data.code, parsed.data.playerName);
    if (!room) return ack?.({ error: 'Could not reconnect' });

    socket.join(room.code);
    broadcastRoomState(room);
    ack?.({ room: sanitizeRoom(room) });
  });

  socket.on('room:kick', (data, ack) => {
    const parsed = KickPlayerSchema.safeParse(data);
    if (!parsed.success) return ack?.({ error: parsed.error.message });

    try {
      const room = roomManager.kickPlayer(parsed.data.code, socket.id, parsed.data.targetSocketId);
      io.sockets.sockets.get(parsed.data.targetSocketId)?.leave(room.code);
      io.to(parsed.data.targetSocketId).emit('room:kicked');
      broadcastRoomState(room);
      ack?.({ ok: true });
    } catch (err: any) {
      ack?.({ error: err.message });
    }
  });

  socket.on('game:start', async (data, ack) => {
    const parsed = StartGameSchema.safeParse(data);
    if (!parsed.success) return ack?.({ error: parsed.error.message });

    const room = roomManager.getRoom(parsed.data.code);
    if (!room) return ack?.({ error: 'Room not found' });

    const host = room.players.find(p => p.socketId === socket.id);
    if (!host?.isHost) return ack?.({ error: 'Only host can start' });

    const canStart = roomManager.canStart(parsed.data.code);
    if (!canStart.ok) return ack?.({ error: canStart.reason });

    roomManager.assignRandomRoles(parsed.data.code);

    const caseDetails = generateCase();
    const defendant = room.players.find(p => p.role === Role.DEFENDANT);
    if (defendant) {
      caseDetails.defendant = defendant.name;
    }
    room.caseDetails = caseDetails;

    const transcript = new TranscriptBuilder();
    transcripts.set(room.code, transcript);

    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'your_api_key_here') {
      let verdictText = '';

      const callbacks: GeminiProxyCallbacks = {
        onAudio: (base64Audio) => {
          io.to(room.code).emit('judge:audio', { audio: base64Audio });
        },
        onText: (text) => {
          transcript.append('Judge Peter Griffin', 'JUDGE', text);
          room.transcript = transcript.getAll();
          verdictText += text;
          broadcastRoomState(room);
        },
        onMoodChange: (mood) => {
          room.judgeMood = mood;
          io.to(room.code).emit('judge:mood', { mood });
          broadcastRoomState(room);
        },
        onScoreBlock: (text) => {
          if (verdictText) {
            const cleaned = verdictText
              .replace(/MOOD:\w+/g, '')
              .replace(/CALL:\w+/g, '')
              .replace(/###SCORE_START###[\s\S]*###SCORE_END###/g, '')
              .trim();
            const sentences = cleaned.split(/[.!?]+/).filter(s => s.trim().length > 10);
            room.verdictRationale = sentences.length > 0
              ? sentences[sentences.length - 1].trim() + '.'
              : cleaned.slice(0, 200);
          }

          const rawScores = parseScores(text);
          room.scores = computeScores(room, rawScores);
          if (room.scores.length > 0) {
            const winner = room.scores.reduce((a, b) => a.scores.total > b.scores.total ? a : b);
            room.winner = winner.playerName;
          }

          gameStateManager.endGame(room);
        },
        onSpeakerCall: (role: Role) => {
          const socketId = gameStateManager.setActiveSpeakerByRole(room, role);
          if (socketId) {
            const player = room.players.find(p => p.socketId === socketId);
            console.log(`[Speaker] AI called on ${player?.name} (${role})`);
          }
          broadcastRoomState(room);
        },
        onReady: () => {
          console.log('[Gemini] Session ready -- sending initial prompt to start trial');
          const p = geminiProxies.get(room.code);
          if (p) {
            const byRole = (r: Role) => room.players.find(pl => pl.role === r)?.name;
            const parts = [
              `The trial is now in session.`,
              `${caseDetails.defendant} is the defendant, charged with ${caseDetails.crime}.`,
              `${byRole(Role.PROSECUTOR)} is the prosecutor.`,
              `${byRole(Role.DEFENSE)} is the defense attorney.`,
            ];
            const w1 = byRole(Role.WITNESS_1);
            const w2 = byRole(Role.WITNESS_2);
            if (w1) parts.push(`${w1} is Witness 1.`);
            if (w2) parts.push(`${w2} is Witness 2.`);
            const foreman = byRole(Role.JURY_FOREMAN);
            if (foreman) parts.push(`${foreman} is the Jury Foreman.`);
            parts.push(`Begin your introduction, Your Honor Peter Griffin!`);
            p.sendText(parts.join(' '));
          }
        },
        onError: (error) => {
          console.error('[Gemini] Error:', error);
          io.to(room.code).emit('judge:unavailable', { message: 'Judge is considering their ruling...' });
        },
      };

      const proxy = new GeminiLiveProxy(
        apiKey,
        process.env.GEMINI_MODEL || 'gemini-3.1-flash-live-preview',
        process.env.GEMINI_VOICE || 'Charon',
        callbacks,
        transcript
      );

      try {
        await proxy.connect(caseDetails, room);
        geminiProxies.set(room.code, proxy);
      } catch (err) {
        console.error('[Gemini] Failed to connect:', err);
      }
    }

    gameStateManager.startGame(room);
    broadcastRoomState(room);
    ack?.({ ok: true });
  });

  socket.on('audio:chunk', (data) => {
    const parsed = AudioChunkSchema.safeParse(data);
    if (!parsed.success) return;

    const room = roomManager.getRoom(parsed.data.code);
    if (!room) return;
    if (room.activeSpeaker !== socket.id) return;

    const player = room.players.find(p => p.socketId === socket.id);

    const proxy = geminiProxies.get(room.code);
    if (proxy) {
      proxy.sendAudio(parsed.data.chunk);
    }

    socket.to(room.code).emit('player:audio', {
      audio: parsed.data.chunk,
      speakerId: socket.id,
      speakerName: player?.name ?? 'Unknown',
      speakerRole: player?.role ?? null,
    });
  });

  socket.on('verdict:foremanOverride', (data, ack) => {
    const parsed = ForemanOverrideSchema.safeParse(data);
    if (!parsed.success) return ack?.({ error: parsed.error.message });

    const room = roomManager.getRoom(parsed.data.code);
    if (!room) return ack?.({ error: 'Room not found' });

    const player = room.players.find(p => p.socketId === socket.id);
    if (!player || player.role !== Role.JURY_FOREMAN) return ack?.({ error: 'Only jury foreman can override' });

    room.scores = applyForemanOverride(room.scores, parsed.data.targetPlayerId, parsed.data.modifier);
    if (room.scores.length > 0) {
      const winner = room.scores.reduce((a, b) => a.scores.total > b.scores.total ? a : b);
      room.winner = winner.playerName;
    }
    broadcastRoomState(room);
    ack?.({ ok: true });
  });

  socket.on('game:rematch', (data, ack) => {
    const parsed = RematchSchema.safeParse(data);
    if (!parsed.success) return ack?.({ error: parsed.error.message });

    const room = roomManager.getRoom(parsed.data.code);
    if (!room) return ack?.({ error: 'Room not found' });

    const proxy = geminiProxies.get(room.code);
    if (proxy) {
      proxy.disconnect();
      geminiProxies.delete(room.code);
    }

    transcripts.delete(room.code);
    gameStateManager.resetForRematch(room);
    broadcastRoomState(room);
    ack?.({ ok: true });
  });

  socket.on('disconnect', () => {
    console.log('Disconnected:', socket.id);
    const result = roomManager.leaveRoom(socket.id);
    if (result) {
      broadcastRoomState(result.room);
    }
  });
});

// Fallback middleware for serving frontend SPA in production (avoids path-to-regexp issues)
app.use((_req, res) => {
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});

httpServer.listen(PORT, () => {
  console.log(`Courtroom Chaos server running on http://localhost:${PORT}`);
});
