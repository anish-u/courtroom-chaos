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

const ROLE_AVATAR: Record<Role, string> = {
  [Role.PROSECUTOR]: 'bg-red-500',
  [Role.DEFENSE]: 'bg-blue-500',
  [Role.DEFENDANT]: 'bg-orange-500',
  [Role.WITNESS_1]: 'bg-purple-500',
  [Role.WITNESS_2]: 'bg-pink-500',
  [Role.JURY_FOREMAN]: 'bg-court-accent',
};

const MOOD_DISPLAY: Record<JudgeMood, { emoji: string; label: string }> = {
  [JudgeMood.NEUTRAL]: { emoji: '😐', label: 'Neutral' },
  [JudgeMood.IMPRESSED]: { emoji: '🤩', label: 'Impressed' },
  [JudgeMood.SCEPTICAL]: { emoji: '🤨', label: 'Sceptical' },
  [JudgeMood.OUTRAGED]: { emoji: '😤', label: 'Outraged' },
  [JudgeMood.AMUSED]: { emoji: '😂', label: 'Amused' },
};

function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  if (p.length >= 2) return (p[0][0] + p[p.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function GameView() {
  const navigate = useNavigate();
  const { sendAudioChunk } = useSocket();
  const { roomState, socketId, isJudgeSpeaking } = useGameStore();
  const playerAudioCtxRef = useRef<AudioContext | null>(null);
  const playerNextStartRef = useRef(0);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [roomState?.transcript]);

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

  const ill = roomState.caseIllustrationStatus;

  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden">
      {/* Top bar */}
      <header className="shrink-0 border-b-4 border-court-border bg-court-panel/90 backdrop-blur px-4 py-3 shadow-[0_4px_0_0_#111827]">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-court-text tracking-tight drop-shadow-sm">
              Courtroom Chaos
            </h1>
            <p className="text-court-muted text-sm font-bold">Room: {roomState.code}</p>
          </div>
          <div className="flex items-center gap-3 fg-card px-4 py-2">
            <span className="text-3xl">{mood.emoji}</span>
            <div>
              <div className="text-court-muted text-xs font-bold uppercase">Peter&apos;s mood</div>
              <div className="text-court-text font-extrabold">{mood.label}</div>
            </div>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto lg:overflow-hidden">
        <div className="mx-auto grid h-full max-w-[1600px] grid-cols-1 gap-4 p-3 md:p-4 lg:min-h-0 lg:grid-cols-12">
        {/* Left: roster + Peter */}
        <aside className="order-1 space-y-3 lg:col-span-3 lg:flex lg:min-h-0 lg:flex-col lg:overflow-y-auto">
          <div className="fg-card p-4">
            <h2 className="text-court-text font-black text-sm uppercase tracking-wider border-b-4 border-court-border pb-2 mb-3">
              Your role
            </h2>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-court-gold font-black text-xl">
                  {myPlayer.role ? ROLE_LABELS[myPlayer.role] : 'Spectator'}
                </div>
                {myPlayer.role && ROLE_HINTS[myPlayer.role] && (
                  <p className="text-court-muted text-xs mt-2 font-semibold leading-snug">{ROLE_HINTS[myPlayer.role]}</p>
                )}
              </div>
              {isJudgeSpeaking && (
                <div className="shrink-0 flex items-center gap-1 bg-court-gold border-2 border-court-border px-2 py-1 rounded-lg">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse border border-court-border" />
                  <span className="text-court-text text-xs font-black">Peter</span>
                </div>
              )}
            </div>
          </div>

          <div className="fg-card-dark p-4">
            <h2 className="text-court-text font-black text-sm uppercase tracking-wider border-b-4 border-court-border pb-2 mb-3">
              Judge Peter
            </h2>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-court-gold border-4 border-court-border flex items-center justify-center text-3xl shadow-[3px_3px_0_0_#111827]">
                ⚖️
              </div>
              <div>
                <div className="font-black text-court-text">Peter Griffin</div>
                <div className="text-xs text-court-muted font-bold">Your Honor (sort of)</div>
              </div>
            </div>
          </div>

          <div className="fg-card p-4">
            <h2 className="text-court-text font-black text-sm uppercase tracking-wider border-b-4 border-court-border pb-2 mb-3">
              Players
            </h2>
            <ul className="space-y-2">
              {roomState.players.map((player) => {
                const speaking = player.socketId === roomState.activeSpeaker;
                const avClass = player.role ? ROLE_AVATAR[player.role] : 'bg-gray-400';
                return (
                  <li
                    key={player.socketId}
                    className={`flex items-center gap-2 rounded-xl border-4 px-2 py-2 transition ${
                      speaking
                        ? 'border-court-accent bg-green-100 shadow-[3px_3px_0_0_#111827]'
                        : 'border-court-border bg-white/80'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-full border-2 border-court-border flex items-center justify-center text-white text-xs font-black shrink-0 ${avClass}`}
                    >
                      {initials(player.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-court-text font-bold text-sm truncate">
                        {player.name}
                        {player.socketId === socketId && (
                          <span className="text-court-muted font-semibold"> (you)</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`w-1.5 h-1.5 rounded-full ${player.connected ? 'bg-green-500' : 'bg-red-500'}`} />
                        {player.role && (
                          <span className="text-[10px] font-black uppercase bg-court-gold border border-court-border px-1.5 rounded">
                            {ROLE_LABELS[player.role]}
                          </span>
                        )}
                        {speaking && (
                          <span className="text-[10px] font-black text-court-accent animate-pulse">SPEAKING</span>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>

        {/* Center: case + illustration + mic at column end */}
        <main className="order-2 flex flex-col gap-3 lg:col-span-5 lg:h-full lg:max-h-full lg:min-h-0 lg:overflow-hidden">
          <div className="flex flex-col gap-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
            {roomState.caseDetails && (
              <div className="fg-card p-4">
                <div className="text-court-muted text-xs font-black uppercase tracking-wider mb-1">The case</div>
                <p className="text-court-text text-sm md:text-base font-bold leading-snug">
                  <span className="text-orange-600">{roomState.caseDetails.defendant}</span>
                  {' '}is charged with {roomState.caseDetails.crime}
                </p>
              </div>
            )}

            <div className="fg-card flex min-h-[200px] flex-col overflow-hidden md:min-h-[280px]">
              <div className="p-3 pb-0 font-black text-xs uppercase tracking-wider text-court-muted">
                Case cartoon
              </div>
              <div className="flex flex-1 items-center justify-center bg-court-bg/30 p-3">
                {ill === 'pending' && (
                  <p className="text-court-muted font-bold text-sm animate-pulse">Drawing the chaos…</p>
                )}
                {ill === 'error' && (
                  <p className="text-center text-sm font-bold text-red-600 px-2">
                    {roomState.caseIllustrationError || 'Image unavailable'}
                  </p>
                )}
                {ill === 'ready' && roomState.caseIllustration && (
                  <img
                    src={roomState.caseIllustration}
                    alt="Cartoon scene for the case"
                    className="w-full max-h-[360px] object-contain rounded-xl border-4 border-court-border"
                  />
                )}
                {!ill && <p className="text-court-muted text-sm font-semibold">Starting…</p>}
              </div>
            </div>

            <div className="fg-card-dark p-4 text-center">
              {isActiveSpeaker ? (
                <>
                  <div className="text-court-text text-lg font-black">YOUR TURN TO SPEAK</div>
                  <p className="mt-1 text-sm font-semibold text-court-muted">Peter is listening…</p>
                </>
              ) : (
                <p className="text-sm font-bold text-court-text">
                  {activeSpeakerPlayer ? (
                    <>
                      <span className="text-orange-700">{activeSpeakerPlayer.name}</span>
                      {activeSpeakerPlayer.role && (
                        <span className="text-court-muted"> ({ROLE_LABELS[activeSpeakerPlayer.role]})</span>
                      )}
                      {' '}is speaking…
                    </>
                  ) : (
                    'Waiting for Peter…'
                  )}
                </p>
              )}
            </div>
          </div>

          {isActiveSpeaker && (
            <div className="flex shrink-0 justify-center border-t-4 border-court-border/40 pt-3 pb-1 lg:pb-2">
              <button
                type="button"
                onClick={isCapturing ? stopMic : startMic}
                className={`flex h-24 w-24 flex-col items-center justify-center rounded-full border-4 border-court-border font-black text-sm shadow-[6px_6px_0_0_#111827] transition-transform active:translate-x-1 active:translate-y-1 active:shadow-none ${
                  isCapturing
                    ? 'animate-pulse bg-red-400 text-court-text'
                    : 'bg-court-gold text-court-text hover:scale-105'
                }`}
              >
                <span className="text-3xl">{isCapturing ? '🔴' : '🎤'}</span>
                <span className="mt-1 text-[10px] uppercase">{isCapturing ? 'Mute' : 'Speak'}</span>
              </button>
            </div>
          )}
        </main>

        {/* Right: transcript — bounded height; scroll inside only */}
        <section className="order-3 flex flex-col lg:col-span-4 lg:h-full lg:min-h-0">
          <div className="fg-card flex max-h-[min(52vh,28rem)] flex-col p-3 lg:max-h-none lg:h-full lg:min-h-0">
            <h2 className="mb-2 shrink-0 border-b-4 border-court-border pb-2 font-black text-sm uppercase tracking-wider text-court-text">
              Transcript
            </h2>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-y-contain pr-1 [scrollbar-gutter:stable]">
              {roomState.transcript.length === 0 && (
                <p className="text-court-muted text-sm font-semibold">Nothing yet — Peter&apos;s warming up.</p>
              )}
              {roomState.transcript.map((e, i) => {
                const isJudge = e.role === 'JUDGE';
                return (
                  <div
                    key={`${e.timestamp}-${i}`}
                    className={`rounded-xl border-4 px-3 py-2 text-sm ${
                      isJudge
                        ? 'bg-amber-50 border-amber-700 ml-0 mr-4'
                        : 'bg-sky-50 border-sky-700 ml-4 mr-0'
                    }`}
                  >
                    <div className="font-black text-xs uppercase text-court-muted mb-0.5">
                      {e.speaker}
                      {e.role !== 'JUDGE' && ` · ${ROLE_LABELS[e.role as Role]}`}
                    </div>
                    <div className="text-court-text font-semibold leading-snug whitespace-pre-wrap">{e.text}</div>
                  </div>
                );
              })}
              <div ref={transcriptEndRef} />
            </div>
          </div>
        </section>
        </div>
      </div>
    </div>
  );
}
