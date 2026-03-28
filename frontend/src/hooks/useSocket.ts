import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useGameStore } from '../store/gameStore';
import type { RoomState, JudgeMood } from '../store/gameStore';

const SOCKET_URL = import.meta.env.DEV ? 'http://localhost:3001' : '';

let socketInstance: Socket | null = null;

function getSocket(): Socket {
  if (!socketInstance) {
    socketInstance = io(SOCKET_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
  }
  return socketInstance;
}

export function useSocket() {
  const socket = useRef(getSocket());
  const {
    setSocketId,
    setRoomState,
    updateJudgeMood,
    setJudgeSpeaking,
  } = useGameStore();

  useEffect(() => {
    const s = socket.current;

    s.on('connect', () => {
      setSocketId(s.id!);

      const savedRoom = sessionStorage.getItem('cc_room');
      const savedName = sessionStorage.getItem('cc_name');
      if (savedRoom && savedName) {
        useGameStore.getState().setPlayerName(savedName);
        s.emit('room:reconnect', { code: savedRoom, playerName: savedName }, (res: any) => {
          if (res?.room) {
            setRoomState(res.room);
          } else {
            sessionStorage.removeItem('cc_room');
            sessionStorage.removeItem('cc_name');
          }
        });
      }
    });

    s.on('room:state', (state: RoomState) => {
      setRoomState(state);
      if (state.code) {
        sessionStorage.setItem('cc_room', state.code);
      }
    });

    s.on('judge:mood', ({ mood }: { mood: JudgeMood }) => {
      updateJudgeMood(mood);
    });

    s.on('judge:audio', () => {
      setJudgeSpeaking(true);
    });

    s.on('room:kicked', () => {
      sessionStorage.removeItem('cc_room');
      sessionStorage.removeItem('cc_name');
      useGameStore.getState().reset();
    });

    s.on('judge:unavailable', ({ message }: { message: string }) => {
      console.warn('[Judge unavailable]', message);
    });

    if (s.connected) {
      setSocketId(s.id!);
    }

    return () => {
      s.off('connect');
      s.off('room:state');
      s.off('judge:mood');
      s.off('judge:audio');
      s.off('room:kicked');
      s.off('judge:unavailable');
    };
  }, [setSocketId, setRoomState, updateJudgeMood, setJudgeSpeaking]);

  const createRoom = useCallback((playerName: string): Promise<{ room?: RoomState; error?: string }> => {
    return new Promise((resolve) => {
      sessionStorage.setItem('cc_name', playerName);
      socket.current.emit('room:create', { playerName }, resolve);
    });
  }, []);

  const joinRoom = useCallback((code: string, playerName: string): Promise<{ room?: RoomState; error?: string }> => {
    return new Promise((resolve) => {
      sessionStorage.setItem('cc_name', playerName);
      socket.current.emit('room:join', { code: code.toUpperCase(), playerName }, resolve);
    });
  }, []);

  const kickPlayer = useCallback((code: string, targetSocketId: string): Promise<{ ok?: boolean; error?: string }> => {
    return new Promise((resolve) => {
      socket.current.emit('room:kick', { code, targetSocketId }, resolve);
    });
  }, []);

  const startGame = useCallback((code: string): Promise<{ ok?: boolean; error?: string }> => {
    return new Promise((resolve) => {
      socket.current.emit('game:start', { code }, resolve);
    });
  }, []);

  const sendAudioChunk = useCallback((code: string, chunk: string) => {
    socket.current.emit('audio:chunk', { code, chunk });
  }, []);

  const foremanOverride = useCallback(
    (code: string, targetPlayerId: string, modifier: number): Promise<{ ok?: boolean; error?: string }> => {
      return new Promise((resolve) => {
        socket.current.emit('verdict:foremanOverride', { code, targetPlayerId, modifier }, resolve);
      });
    },
    []
  );

  const readyForRematch = useCallback((): Promise<{ ok?: boolean; error?: string }> => {
    return new Promise((resolve) => {
      socket.current.emit('game:readyForRematch', {}, resolve);
    });
  }, []);

  const rematch = useCallback((code: string): Promise<{ ok?: boolean; error?: string }> => {
    return new Promise((resolve) => {
      socket.current.emit('game:rematch', { code }, resolve);
    });
  }, []);

  return {
    socket: socket.current,
    createRoom,
    joinRoom,
    kickPlayer,
    startGame,
    sendAudioChunk,
    foremanOverride,
    readyForRematch,
    rematch,
  };
}
