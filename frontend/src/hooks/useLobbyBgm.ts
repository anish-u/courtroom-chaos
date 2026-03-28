import { useCallback, useEffect, useRef, useState } from 'react';

const MUTE_KEY = 'cc_bgm_muted';

export function useLobbyBgm() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || muted) {
      return;
    }

    audio.loop = true;
    audio.volume = 0.28;
    audio.preload = 'auto';
    audio.src = '/api/bgm/lobby';

    const tryPlay = () => {
      void audio.play().catch(() => {});
    };

    const onCanPlayThrough = () => tryPlay();
    audio.addEventListener('canplaythrough', onCanPlayThrough);

    const onGesture = () => tryPlay();
    document.addEventListener('pointerdown', onGesture);

    tryPlay();

    return () => {
      audio.removeEventListener('canplaythrough', onCanPlayThrough);
      document.removeEventListener('pointerdown', onGesture);
      audio.pause();
      audio.removeAttribute('src');
      void audio.load();
    };
  }, [muted]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      try {
        localStorage.setItem(MUTE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return { audioRef, muted, toggleMute };
}
