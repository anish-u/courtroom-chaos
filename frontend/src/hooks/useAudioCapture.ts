import { useRef, useCallback, useState } from 'react';
import { useGameStore } from '../store/gameStore';

export function useAudioCapture(onChunk: (base64: string) => void) {
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const { setMicPermission, setMicActive } = useGameStore();

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      setMicPermission(true);
      streamRef.current = stream;

      const context = new AudioContext({ sampleRate: 16000 });
      contextRef.current = context;

      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const float32 = e.inputBuffer.getChannelData(0);
        const int16 = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
          const s = Math.max(-1, Math.min(1, float32[i]));
          int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
        }

        const bytes = new Uint8Array(int16.buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        onChunk(base64);
      };

      source.connect(processor);
      processor.connect(context.destination);

      setIsCapturing(true);
      setMicActive(true);
    } catch (err) {
      console.error('Mic capture failed:', err);
      setMicPermission(false);
    }
  }, [onChunk, setMicPermission, setMicActive]);

  const stop = useCallback(() => {
    processorRef.current?.disconnect();
    contextRef.current?.close();
    streamRef.current?.getTracks().forEach(t => t.stop());

    processorRef.current = null;
    contextRef.current = null;
    streamRef.current = null;

    setIsCapturing(false);
    setMicActive(false);
  }, [setMicActive]);

  return { start, stop, isCapturing };
}
