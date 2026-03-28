import { useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useSocket } from '../hooks/useSocket';
import { useAudioCapture } from '../hooks/useAudioCapture';
import { useAudioPlayback } from '../hooks/useAudioPlayback';
import { useGameStore, Phase, Role, JudgeMood } from '../store/gameStore';

const ROLE_LABELS: Record<Role, string> = {
  [Role.PROSECUTOR]: 'Prosecutor',
  [Role.DEFENSE]: 'Defense Lawyer',
  [Role.DEFENDANT]: 'Defendant',
  [Role.WITNESS_1]: 'Witness 1',
  [Role.WITNESS_2]: 'Witness 2',
  [Role.JURY_FOREMAN]: 'Jury Foreman',
};

const ROLE_HINTS: Partial<Record<Role, string>> = {
  [Role.PROSECUTOR]: 'Present the evidence. Be persuasive. Be absurd.',
  [Role.DEFENSE]: 'Defend the accused with creativity and flair.',
  [Role.DEFENDANT]: 'You stand accused! Testify when called upon.',
  [Role.WITNESS_1]: 'Wait for the judge to summon you. Improvise wildly.',
  [Role.WITNESS_2]: 'Wait for the judge to summon you. Improvise wildly.',
  [Role.JURY_FOREMAN]: 'Observe the trial. Override the verdict at the end.',
};

const MOOD_DISPLAY: Record<JudgeMood, { emoji: string; label: string }> = {
  [JudgeMood.NEUTRAL]: { emoji: '😐', label: 'Neutral' },
  [JudgeMood.IMPRESSED]: { emoji: '🤩', label: 'Impressed' },
  [JudgeMood.SCEPTICAL]: { emoji: '🤨', label: 'Sceptical' },
  [JudgeMood.OUTRAGED]: { emoji: '😤', label: 'Outraged' },
  [JudgeMood.AMUSED]: { emoji: '😂', label: 'Amused' },
};

export default function GameView() {
  const navigate = useNavigate();
  const { sendAudioChunk } = useSocket();
  const { roomState, socketId, isJudgeSpeaking } = useGameStore();
  const playerAudioCtxRef = useRef<AudioContext | null>(null);
  const playerNextStartRef = useRef(0);

  const isActiveSpeaker = roomState?.activeSpeaker === socketId;
  const myPlayer = roomState?.players.find(p => p.socketId === socketId);


  const { playChunk: playJudgeChunk } = useAudioPlayback();

  const onAudioChunk = useCallback((base64: string) => {
    if (roomState && isActiveSpeaker) {
      sendAudioChunk(roomState.code, base64);
    }
  }, [roomState, isActiveSpeaker, sendAudioChunk]);

  const { start: startMic, stop: stopMic, isCapturing } = useAudioCapture(onAudioChunk);

  useEffect(() => {
    if (!roomState) navigate('/lobby');
  }, [roomState, navigate]);

  useEffect(() => {
    if (roomState?.phase === Phase.SCORING) {
      navigate('/verdict');
    }
  }, [roomState?.phase, navigate]);

  const socketRef = useSocket().socket;

  useEffect(() => {
    const handleJudgeAudio = ({ audio }: { audio: string }) => {
      playJudgeChunk(audio);
    };

    const handlePlayerAudio = ({ audio }: { audio: string }) => {
      playPlayerAudioChunk(audio);
    };

    socketRef.on('judge:audio', handleJudgeAudio);
    socketRef.on('player:audio', handlePlayerAudio);

    return () => {
      socketRef.off('judge:audio', handleJudgeAudio);
      socketRef.off('player:audio', handlePlayerAudio);
    };
  }, [socketRef, playJudgeChunk]);

  const playPlayerAudioChunk = useCallback((base64Audio: string) => {
    if (!playerAudioCtxRef.current || playerAudioCtxRef.current.state === 'closed') {
      playerAudioCtxRef.current = new AudioContext({ sampleRate: 16000 });
      playerNextStartRef.current = 0;
    }

    const ctx = playerAudioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();

    const binaryStr = atob(base64Audio);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768;
    }

    const audioBuffer = ctx.createBuffer(1, float32.length, 16000);
    audioBuffer.copyToChannel(float32, 0);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    const startTime = Math.max(now, playerNextStartRef.current);
    source.start(startTime);
    playerNextStartRef.current = startTime + audioBuffer.duration;
  }, []);

  useEffect(() => {
    return () => {
      playerAudioCtxRef.current?.close();
    };
  }, []);

  // Stop mic if no longer active speaker
  useEffect(() => {
    if (!isActiveSpeaker && isCapturing) {
      stopMic();
    }
  }, [isActiveSpeaker, isCapturing, stopMic]);

  if (!roomState || !myPlayer) return null;

  const activeSpeakerPlayer = roomState.activeSpeaker
    ? roomState.players.find(p => p.socketId === roomState.activeSpeaker)
    : null;

  const mood = MOOD_DISPLAY[roomState.judgeMood] || MOOD_DISPLAY[JudgeMood.NEUTRAL];

  return (
    <div className="min-h-screen p-4 max-w-lg mx-auto flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-serif font-bold text-court-gold">Courtroom Chaos</h1>
          <p className="text-court-muted text-xs">Room: {roomState.code}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl">{mood.emoji}</span>
          <div className="text-right">
            <div className="text-court-muted text-xs">Peter's Mood</div>
            <div className="text-court-text text-sm font-medium">{mood.label}</div>
          </div>
        </div>
      </div>

      {/* Your Role */}
      <div className="bg-court-surface border border-court-border rounded-xl p-4 mb-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-court-muted text-xs uppercase tracking-wider">Your Role</div>
            <div className="text-court-gold text-lg font-bold">
              {myPlayer.role ? ROLE_LABELS[myPlayer.role] : 'Spectator'}
            </div>
          </div>
          {isJudgeSpeaking && (
            <div className="flex items-center gap-2 bg-court-gold/10 px-3 py-1.5 rounded-lg">
              <div className="w-2 h-2 bg-court-gold rounded-full animate-pulse" />
              <span className="text-court-gold text-xs font-medium">Peter Speaking</span>
            </div>
          )}
        </div>
        {myPlayer.role && ROLE_HINTS[myPlayer.role] && (
          <p className="text-court-muted text-sm mt-2">{ROLE_HINTS[myPlayer.role]}</p>
        )}
      </div>

      {/* Case Info */}
      {roomState.caseDetails && (
        <div className="bg-court-surface border border-court-border rounded-xl p-4 mb-3">
          <div className="text-court-muted text-xs uppercase tracking-wider mb-1">The Case</div>
          <p className="text-court-text text-sm">
            <span className="text-court-gold font-bold">{roomState.caseDetails.defendant}</span>{' '}
            is charged with {roomState.caseDetails.crime}
          </p>
        </div>
      )}

      {/* Active Speaker */}
      {isActiveSpeaker ? (
        <div className="bg-court-gold/20 border border-court-gold rounded-xl p-5 mb-3 text-center">
          <div className="text-court-gold text-lg font-bold animate-pulse">
            YOUR TURN TO SPEAK
          </div>
          <p className="text-court-text text-sm mt-1">Peter is listening...</p>
        </div>
      ) : (
        <div className="bg-court-bg border border-court-border rounded-xl p-4 mb-3 text-center">
          <div className="text-court-muted text-sm">
            {activeSpeakerPlayer
              ? (
                <>
                  <span className="text-court-text font-medium">{activeSpeakerPlayer.name}</span>
                  {activeSpeakerPlayer.role && (
                    <span className="text-court-gold ml-1">({ROLE_LABELS[activeSpeakerPlayer.role]})</span>
                  )}
                  <span> is speaking...</span>
                </>
              )
              : 'Waiting for Peter...'}
          </div>
        </div>
      )}

      {/* Mic Button */}
      <div className="flex-1 flex items-center justify-center mb-4">
        {isActiveSpeaker && (
          <button
            onClick={isCapturing ? stopMic : startMic}
            className={`w-28 h-28 rounded-full border-4 transition-all flex items-center justify-center ${
              isCapturing
                ? 'bg-red-500/20 border-red-500 text-red-400 animate-pulse'
                : 'bg-court-gold/20 border-court-gold text-court-gold hover:bg-court-gold/30'
            }`}
          >
            <div className="text-center">
              <div className="text-3xl">{isCapturing ? '🔴' : '🎤'}</div>
              <div className="text-xs mt-1">{isCapturing ? 'Tap to Mute' : 'Tap to Speak'}</div>
            </div>
          </button>
        )}
      </div>

      {/* Players */}
      <div className="bg-court-surface border border-court-border rounded-xl p-4 mb-3">
        <div className="text-court-muted text-xs uppercase tracking-wider mb-2">Players</div>
        <div className="space-y-1.5">
          {roomState.players.map((player) => (
            <div
              key={player.socketId}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                player.socketId === roomState.activeSpeaker
                  ? 'bg-court-gold/10 border border-court-gold/30'
                  : 'bg-court-bg/50'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full ${player.connected ? 'bg-green-400' : 'bg-red-400'}`} />
                <span className="text-court-text">{player.name}</span>
                {player.socketId === socketId && (
                  <span className="text-court-muted text-xs">(You)</span>
                )}
                {player.socketId === roomState.activeSpeaker && (
                  <span className="text-court-gold text-xs animate-pulse">SPEAKING</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {player.role && (
                  <span className="text-xs bg-court-gold/20 text-court-gold px-2 py-0.5 rounded">
                    {ROLE_LABELS[player.role]}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
