import { useRef, useCallback, useEffect } from 'react';
import { useGameStore } from '../store/gameStore';

export function useAudioPlayback() {
  const contextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const { setJudgeSpeaking } = useGameStore();
  const speakingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ensureContext = useCallback(() => {
    if (!contextRef.current || contextRef.current.state === 'closed') {
      const ctx = new AudioContext({ sampleRate: 24000 });
      contextRef.current = ctx;
      nextStartTimeRef.current = 0;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const gain = ctx.createGain();
      gain.gain.value = 1.0;
      gainRef.current = gain;

      analyser.connect(gain);
      gain.connect(ctx.destination);
    }
    return contextRef.current;
  }, []);

  const playChunk = useCallback((base64Audio: string) => {
    const ctx = ensureContext();
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

    const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
    audioBuffer.copyToChannel(float32, 0);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(analyserRef.current!);

    const now = ctx.currentTime;
    const startTime = Math.max(now, nextStartTimeRef.current);
    source.start(startTime);
    nextStartTimeRef.current = startTime + audioBuffer.duration;

    setJudgeSpeaking(true);

    if (speakingTimeoutRef.current) clearTimeout(speakingTimeoutRef.current);
    speakingTimeoutRef.current = setTimeout(() => {
      setJudgeSpeaking(false);
    }, 500);
  }, [ensureContext, setJudgeSpeaking]);

  const setVolume = useCallback((volume: number) => {
    if (gainRef.current) {
      gainRef.current.gain.value = Math.max(0, Math.min(2, volume));
    }
  }, []);

  const getAnalyser = useCallback((): AnalyserNode | null => {
    return analyserRef.current;
  }, []);

  useEffect(() => {
    return () => {
      if (contextRef.current) {
        contextRef.current.close();
      }
    };
  }, []);

  return { playChunk, setVolume, getAnalyser };
}
