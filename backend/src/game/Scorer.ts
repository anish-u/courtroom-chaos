import { PlayerScore, Role, ScoreBreakdown, RoomState } from '../types';

interface RawScore {
  playerId: string;
  creativity: number;
  persuasiveness: number;
  absurdity: number;
}

function extractScoreJson(text: string): string | null {
  const startMarker = '###SCORE_START###';
  const endMarker = '###SCORE_END###';
  const startIdx = text.indexOf(startMarker);
  const endIdx = text.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return null;
  return text.slice(startIdx + startMarker.length, endIdx).trim();
}

export function parseVerdict(text: string): 'GUILTY' | 'NOT_GUILTY' | null {
  const jsonStr = extractScoreJson(text);
  if (!jsonStr) return null;
  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const v = parsed.verdict;
      if (v === 'GUILTY' || v === 'NOT_GUILTY') return v;
    }
  } catch {
    // ignore
  }
  return null;
}

export function parseScores(text: string): RawScore[] | null {
  const jsonStr = extractScoreJson(text);
  if (!jsonStr) return null;

  try {
    const parsed = JSON.parse(jsonStr);

    // New format: { verdict: "...", scores: [...] }
    const arr = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.scores) ? parsed.scores : null);
    if (!arr) return null;

    return arr.map((entry: any) => ({
      playerId: String(entry.playerId || ''),
      creativity: Number(entry.creativity) || 0,
      persuasiveness: Number(entry.persuasiveness) || 0,
      absurdity: Number(entry.absurdity) || 0,
    }));
  } catch {
    return null;
  }
}

export function computeScores(room: RoomState, rawScores: RawScore[] | null): PlayerScore[] {
  const scoredPlayers = room.players.filter(p => p.role && p.role !== Role.JURY_FOREMAN);

  if (!rawScores) {
    return scoredPlayers.map(p => ({
      playerId: p.socketId,
      playerName: p.name,
      role: p.role!,
      scores: { creativity: 50, persuasiveness: 50, absurdity: 50, total: 50 },
    }));
  }

  return scoredPlayers.map(p => {
    const raw = rawScores.find(r => r.playerId === p.socketId || r.playerId === p.name);

    const creativity = raw ? Math.min(100, Math.max(0, raw.creativity)) : 50;
    const persuasiveness = raw ? Math.min(100, Math.max(0, raw.persuasiveness)) : 50;
    const absurdity = raw ? Math.min(100, Math.max(0, raw.absurdity)) : 50;

    const total = Math.round(creativity * 0.3 + persuasiveness * 0.3 + absurdity * 0.4);

    return {
      playerId: p.socketId,
      playerName: p.name,
      role: p.role!,
      scores: { creativity, persuasiveness, absurdity, total },
    };
  });
}

export function applyForemanOverride(
  scores: PlayerScore[],
  overridePlayerId: string,
  modifier: number
): PlayerScore[] {
  const clamped = Math.min(15, Math.max(-15, modifier));
  return scores.map(s => {
    if (s.playerId === overridePlayerId) {
      return {
        ...s,
        scores: { ...s.scores, total: s.scores.total + clamped },
        foremanModifier: clamped,
      };
    }
    return s;
  });
}
