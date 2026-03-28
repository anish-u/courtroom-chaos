/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useSocket } from "../hooks/useSocket";
import { useGameStore, Phase } from "../store/gameStore";

export default function LobbyView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { createRoom, joinRoom, kickPlayer, startGame } = useSocket();
  const { roomState, playerName, setPlayerName, socketId } = useGameStore();

  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const code = searchParams.get("join");
    if (code && !roomState) {
      setJoinCode(code.toUpperCase());
    }
  }, [searchParams, roomState]);

  const isHost =
    roomState?.players.find((p) => p.socketId === socketId)?.isHost ?? false;
  const canStart = (roomState?.players.length ?? 0) >= 3;

  useEffect(() => {
    if (roomState && roomState.phase !== Phase.LOBBY) {
      navigate("/game");
    }
  }, [roomState, navigate]);

  const handleCreate = async () => {
    if (!playerName.trim()) {
      setError("Enter your name");
      return;
    }
    setIsLoading(true);
    setError("");
    const result = await createRoom(playerName.trim());
    setIsLoading(false);
    if (result.error) {
      setError(result.error);
    }
  };

  const handleJoin = async () => {
    if (!playerName.trim()) {
      setError("Enter your name");
      return;
    }
    if (!joinCode.trim()) {
      setError("Enter a room code");
      return;
    }
    setIsLoading(true);
    setError("");
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

  const copyInviteLink = async () => {
    if (!roomState) return;
    const url = `${window.location.origin}?join=${roomState.code}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement("textarea");
        ta.value = url;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy — copy the URL from the bar manually");
    }
  };

  if (!roomState) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-10">
            <h1 className="text-5xl font-black text-court-gold mb-2 tracking-tight drop-shadow-[3px_3px_0_#111827]">
              Courtroom Chaos
            </h1>
            <p className="text-white/90 text-lg font-bold">
              Judge Peter Griffin Presiding
            </p>
          </div>

          <div className="fg-card p-8 space-y-6">
            <div>
              <label className="block text-sm text-court-muted font-bold mb-2">
                Your Name
              </label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name..."
                maxLength={30}
                className="w-full bg-white border-4 border-court-border rounded-xl px-4 py-3 text-court-text placeholder:text-court-muted/50 focus:outline-none focus:ring-2 focus:ring-court-accent transition font-semibold"
              />
            </div>

            <button
              onClick={handleCreate}
              disabled={isLoading}
              className="w-full bg-court-gold hover:bg-yellow-300 text-court-text font-black py-3 rounded-xl border-4 border-court-border shadow-[4px_4px_0_0_#111827] transition disabled:opacity-50 active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
            >
              {isLoading ? "Creating..." : "Create New Game"}
            </button>

            <div className="flex items-center gap-4">
              <div className="flex-1 h-1 bg-court-border rounded" />
              <span className="text-court-muted text-sm font-bold">or join</span>
              <div className="flex-1 h-1 bg-court-border rounded" />
            </div>

            <div className="flex gap-3">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Room code"
                maxLength={6}
                className="flex-1 bg-white border-4 border-court-border rounded-xl px-4 py-3 text-court-text placeholder:text-court-muted/50 focus:outline-none focus:ring-2 focus:ring-court-accent transition uppercase tracking-widest text-center font-mono font-black"
              />
              <button
                onClick={handleJoin}
                disabled={isLoading}
                className="bg-court-panel hover:bg-yellow-200 text-court-text font-black px-6 py-3 rounded-xl border-4 border-court-border shadow-[3px_3px_0_0_#111827] transition disabled:opacity-50"
              >
                Join
              </button>
            </div>

            {error && (
              <p className="text-red-600 text-sm text-center font-bold">{error}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-black text-court-gold mb-1 drop-shadow-[2px_2px_0_#111827]">
          Courtroom Chaos
        </h1>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <span className="text-white/90 text-sm font-bold">Room Code:</span>
          <span className="font-mono text-2xl text-court-text tracking-[0.3em] bg-court-panel px-4 py-1 rounded-xl border-4 border-court-border shadow-[3px_3px_0_0_#111827]">
            {roomState.code}
          </span>
          <button
            type="button"
            onClick={copyInviteLink}
            className="text-xs bg-court-panel hover:bg-yellow-200 text-court-text px-3 py-2 rounded-xl border-4 border-court-border font-black shadow-[2px_2px_0_0_#111827] transition"
          >
            {copied ? "Copied!" : "Copy Link"}
          </button>
        </div>
      </div>

      {/* Players List */}
      <div className="fg-card p-6 mb-6">
        <h2 className="text-lg font-black text-court-text mb-4 border-b-4 border-court-border pb-2">
          Players ({roomState.players.length}/6)
        </h2>
        <div className="space-y-3">
          {roomState.players.map((player) => (
            <div
              key={player.socketId}
              className="flex items-center justify-between bg-white/90 rounded-xl px-4 py-3 border-4 border-court-border"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`w-2 h-2 rounded-full ${player.connected ? "bg-green-400" : "bg-red-400"}`}
                />
                <span className="text-court-text font-bold">
                  {player.name}
                  {player.isHost && (
                    <span className="text-orange-600 ml-2 text-xs font-black">(HOST)</span>
                  )}
                  {player.socketId === socketId && (
                    <span className="text-court-muted ml-2 text-xs font-semibold">(You)</span>
                  )}
                </span>
              </div>
              {isHost && player.socketId !== socketId && (
                <button
                  type="button"
                  onClick={() => handleKick(player.socketId)}
                  className="text-xs text-red-600 hover:text-red-800 font-black transition"
                >
                  Kick
                </button>
              )}
            </div>
          ))}
        </div>
        <p className="text-court-muted text-sm text-center mt-4 font-semibold">
          Roles will be assigned randomly when the game starts
        </p>
      </div>

      {/* Start Game */}
      {isHost && (
        <div className="text-center">
          <button
            type="button"
            onClick={handleStart}
            disabled={!canStart || isLoading}
            className="bg-court-gold hover:bg-yellow-300 text-court-text font-black px-12 py-4 rounded-xl text-lg border-4 border-court-border shadow-[5px_5px_0_0_#111827] transition disabled:opacity-30 disabled:cursor-not-allowed active:translate-x-0.5 active:translate-y-0.5 active:shadow-none"
          >
            {isLoading ? "Starting..." : "Start Trial"}
          </button>
          {!canStart && (
            <p className="text-white/90 text-sm mt-2 font-semibold">
              Need at least 3 players to start
            </p>
          )}
        </div>
      )}

      {!isHost && (
        <div className="text-center">
          <p className="text-white/90 text-sm font-semibold">
            Waiting for the host to start the trial...
          </p>
        </div>
      )}

      {error && (
        <p className="text-red-200 text-sm text-center mt-4 font-bold drop-shadow">{error}</p>
      )}
    </div>
  );
}
