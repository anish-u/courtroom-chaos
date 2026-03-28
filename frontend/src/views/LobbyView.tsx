import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { useSocket } from '../hooks/useSocket';
import { useGameStore, Phase } from '../store/gameStore';

export default function LobbyView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { createRoom, joinRoom, kickPlayer, startGame } = useSocket();
  const { roomState, playerName, setPlayerName, socketId } = useGameStore();

  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const code = searchParams.get('join');
    if (code && !roomState) {
      setJoinCode(code.toUpperCase());
    }
  }, [searchParams, roomState]);

  const isHost = roomState?.players.find(p => p.socketId === socketId)?.isHost ?? false;
  const canStart = (roomState?.players.length ?? 0) >= 3;

  useEffect(() => {
    if (roomState && roomState.phase !== Phase.LOBBY) {
      navigate('/game');
    }
  }, [roomState, navigate]);

  const handleCreate = async () => {
    if (!playerName.trim()) {
      setError('Enter your name');
      return;
    }
    setIsLoading(true);
    setError('');
    const result = await createRoom(playerName.trim());
    setIsLoading(false);
    if (result.error) {
      setError(result.error);
    }
  };

  const handleJoin = async () => {
    if (!playerName.trim()) {
      setError('Enter your name');
      return;
    }
    if (!joinCode.trim()) {
      setError('Enter a room code');
      return;
    }
    setIsLoading(true);
    setError('');
    const result = await joinRoom(joinCode.trim(), playerName.trim());
    setIsLoading(false);
    if (result.error) {
      setError(result.error);
    }
  };

  const handleKick = async (targetSocketId: string) => {
    if (!roomState) return;
    await kickPlayer(roomState.code, targetSocketId);
  };

  const handleStart = async () => {
    if (!roomState) return;
    setIsLoading(true);
    const result = await startGame(roomState.code);
    setIsLoading(false);
    if (result.error) {
      setError(result.error);
    }
  };

  if (!roomState) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-10">
            <h1 className="text-5xl font-serif font-bold text-court-gold mb-2 tracking-tight">
              Courtroom Chaos
            </h1>
            <p className="text-court-muted text-lg">
              Judge Peter Griffin Presiding
            </p>
          </div>

          <div className="bg-court-surface border border-court-border rounded-2xl p-8 space-y-6">
            <div>
              <label className="block text-sm text-court-muted mb-2">Your Name</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name..."
                maxLength={30}
                className="w-full bg-court-bg border border-court-border rounded-lg px-4 py-3 text-court-text placeholder:text-court-muted/50 focus:outline-none focus:border-court-gold transition"
              />
            </div>

            <button
              onClick={handleCreate}
              disabled={isLoading}
              className="w-full bg-court-gold hover:bg-court-accent text-court-bg font-bold py-3 rounded-lg transition disabled:opacity-50"
            >
              {isLoading ? 'Creating...' : 'Create New Game'}
            </button>

            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-court-border" />
              <span className="text-court-muted text-sm">or join</span>
              <div className="flex-1 h-px bg-court-border" />
            </div>

            <div className="flex gap-3">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Room code"
                maxLength={6}
                className="flex-1 bg-court-bg border border-court-border rounded-lg px-4 py-3 text-court-text placeholder:text-court-muted/50 focus:outline-none focus:border-court-gold transition uppercase tracking-widest text-center font-mono"
              />
              <button
                onClick={handleJoin}
                disabled={isLoading}
                className="bg-court-panel hover:bg-court-border text-court-text font-bold px-6 py-3 rounded-lg transition disabled:opacity-50"
              >
                Join
              </button>
            </div>

            {error && (
              <p className="text-red-400 text-sm text-center">{error}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-serif font-bold text-court-gold mb-1">
          Courtroom Chaos
        </h1>
        <div className="flex items-center justify-center gap-3">
          <span className="text-court-muted text-sm">Room Code:</span>
          <span className="font-mono text-2xl text-court-text tracking-[0.3em] bg-court-panel px-4 py-1 rounded-lg border border-court-border">
            {roomState.code}
          </span>
          <button
            onClick={() => {
              const url = `${window.location.origin}?join=${roomState.code}`;
              navigator.clipboard.writeText(url).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              });
            }}
            className="text-xs bg-court-panel hover:bg-court-border text-court-text px-3 py-1.5 rounded-lg border border-court-border transition"
          >
            {copied ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
      </div>

      {/* Players List */}
      <div className="bg-court-surface border border-court-border rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-serif font-bold text-court-text mb-4">
          Players ({roomState.players.length}/6)
        </h2>
        <div className="space-y-3">
          {roomState.players.map((player) => (
            <div
              key={player.socketId}
              className="flex items-center justify-between bg-court-bg rounded-lg px-4 py-3 border border-court-border/50"
            >
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full ${player.connected ? 'bg-green-400' : 'bg-red-400'}`} />
                <span className="text-court-text">
                  {player.name}
                  {player.isHost && (
                    <span className="text-court-gold ml-2 text-xs">(HOST)</span>
                  )}
                  {player.socketId === socketId && (
                    <span className="text-court-muted ml-2 text-xs">(You)</span>
                  )}
                </span>
              </div>
              {isHost && player.socketId !== socketId && (
                <button
                  onClick={() => handleKick(player.socketId)}
                  className="text-xs text-red-400 hover:text-red-300 transition"
                >
                  Kick
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="text-court-muted text-sm text-center mt-4">
          Roles will be assigned randomly when the game starts
        </p>
      </div>

      {/* Start Game */}
      {isHost && (
        <div className="text-center">
          <button
            onClick={handleStart}
            disabled={!canStart || isLoading}
            className="bg-court-gold hover:bg-court-accent text-court-bg font-bold px-12 py-4 rounded-xl text-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Starting...' : 'Start Trial'}
          </button>
          {!canStart && (
            <p className="text-court-muted text-sm mt-2">
              Need at least 3 players to start
            </p>
          )}
        </div>
      )}

      {!isHost && (
        <div className="text-center">
          <p className="text-court-muted text-sm">
            Waiting for the host to start the trial...
          </p>
        </div>
      )}

      {error && (
        <p className="text-red-400 text-sm text-center mt-4">{error}</p>
      )}
    </div>
  );
}
