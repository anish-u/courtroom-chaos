import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useSocket } from '../hooks/useSocket';
import { useGameStore, Role, Phase } from '../store/gameStore';
import type { PlayerScore } from '../store/gameStore';

const MIN_PLAYERS = 3;

const ROLE_LABELS: Record<Role, string> = {
  [Role.PROSECUTOR]: 'Prosecutor',
  [Role.DEFENSE]: 'Defense Lawyer',
  [Role.DEFENDANT]: 'Defendant',
  [Role.WITNESS_1]: 'Witness 1',
  [Role.WITNESS_2]: 'Witness 2',
  [Role.JURY_FOREMAN]: 'Jury Foreman',
};

export default function VerdictView() {
  const navigate = useNavigate();
  const { rematch, readyForRematch, foremanOverride } = useSocket();
  const { roomState, socketId } = useGameStore();
  const [overrideTarget, setOverrideTarget] = useState<string | null>(null);
  const [overrideModifier, setOverrideModifier] = useState(0);
  const [hasOverridden, setHasOverridden] = useState(false);
  const [isReadying, setIsReadying] = useState(false);

  useEffect(() => {
    if (!roomState) navigate('/lobby');
  }, [roomState, navigate]);

  // Navigate all players (not just host) when next round starts
  useEffect(() => {
    if (roomState?.phase === Phase.LOBBY) {
      navigate('/lobby');
    }
  }, [roomState?.phase, navigate]);

  if (!roomState) return null;

  const myPlayer = roomState.players.find(p => p.socketId === socketId);
  const isForeman = myPlayer?.role === Role.JURY_FOREMAN;
  const isHost = myPlayer?.isHost;

  const iAmReady = socketId ? roomState.rematchReady.includes(socketId) : false;
  const readyCount = roomState.rematchReady.length;
  const canStartRound = readyCount >= MIN_PLAYERS;

  const sortedScores = [...roomState.scores].sort((a, b) => b.scores.total - a.scores.total);

  const handleOverride = async () => {
    if (!overrideTarget || !roomState) return;
    await foremanOverride(roomState.code, overrideTarget, overrideModifier);
    setHasOverridden(true);
  };

  const handlePlayAgain = async () => {
    if (isReadying || iAmReady) return;
    setIsReadying(true);
    await readyForRematch();
    setIsReadying(false);
  };

  const handleStartRound = async () => {
    if (!roomState) return;
    await rematch(roomState.code);
  };

  const handleLeave = () => {
    useGameStore.getState().reset();
    navigate('/lobby');
  };

  const medalColors = ['text-yellow-400', 'text-gray-300', 'text-amber-600'];
  const verdict = roomState.caseVerdict;

  return (
    <div className="min-h-screen p-4 max-w-3xl mx-auto pb-12">
      <div className="text-center mb-8 pt-8">
        <div className="text-6xl mb-4 drop-shadow-[3px_3px_0_#111827]">⚖️</div>
        <h1 className="text-4xl font-black text-court-gold mb-4 drop-shadow-[3px_3px_0_#111827]">The Verdict Is In</h1>

        {/* Case verdict banner */}
        {verdict && (
          <div className={`inline-block px-8 py-3 mb-4 rounded-xl border-4 border-court-border shadow-[4px_4px_0_0_#111827] font-black text-2xl tracking-widest uppercase ${
            verdict === 'GUILTY'
              ? 'bg-red-500 text-white'
              : 'bg-emerald-500 text-white'
          }`}>
            {verdict === 'GUILTY' ? 'GUILTY' : 'NOT GUILTY'}
          </div>
        )}

        {roomState.winner && (
          <p className="text-white text-lg font-black mt-2">
            Best Performer: <span className="text-court-gold">{roomState.winner}</span>
          </p>
        )}
      </div>

      {roomState.verdictRationale && (
        <div className="fg-card p-6 mb-8">
          <h2 className="text-court-text font-black text-lg uppercase tracking-wide border-b-4 border-court-border pb-2 mb-4">
            Peter&apos;s verdict
          </h2>
          <p className="text-court-text text-lg md:text-xl font-bold leading-relaxed whitespace-pre-wrap">
            {roomState.verdictRationale}
          </p>
        </div>
      )}

      {/* Scoreboard */}
      <div className="fg-card p-6 mb-6">
        <h2 className="text-lg font-black text-court-text mb-4 text-center border-b-4 border-court-border pb-2">Final Scores</h2>
        <div className="space-y-4">
          {sortedScores.map((score, i) => {
            const playerSocket = roomState.players.find(p => p.name === score.playerName)?.socketId;
            const isReady = playerSocket ? roomState.rematchReady.includes(playerSocket) : false;
            return (
            <ScoreCard
              key={score.playerId}
              score={score}
              rank={i}
              medalColor={medalColors[i] || 'text-court-muted'}
              isReady={isReady}
            />
            );
          })}
        </div>
      </div>

      {/* Foreman Override */}
      {isForeman && !hasOverridden && roomState.scores.length > 0 && (
        <div className="fg-card-dark p-6 mb-6">
          <h2 className="text-lg font-black text-court-text mb-3">Jury Foreman Override</h2>
          <p className="text-court-muted text-sm mb-4">
            As Jury Foreman, you may adjust one player's score by up to +/-15 points.
          </p>

          <div className="space-y-3">
            <div>
              <label className="text-court-muted text-sm">Select player:</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {roomState.scores.map((s) => (
                  <button
                    key={s.playerId}
                    onClick={() => setOverrideTarget(s.playerId)}
                    className={`px-3 py-2 rounded-lg text-sm border transition ${
                      overrideTarget === s.playerId
                        ? 'bg-court-gold/20 border-court-gold text-court-gold'
                        : 'bg-court-bg border-court-border text-court-text hover:border-court-gold/50'
                    }`}
                  >
                    {s.playerName}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-court-muted text-sm">Modifier: {overrideModifier > 0 ? '+' : ''}{overrideModifier}</label>
              <input
                type="range"
                min="-15"
                max="15"
                value={overrideModifier}
                onChange={(e) => setOverrideModifier(parseInt(e.target.value))}
                className="w-full accent-court-gold mt-1"
              />
            </div>

            <button
              type="button"
              onClick={handleOverride}
              disabled={!overrideTarget}
              className="w-full bg-court-gold hover:bg-yellow-300 text-court-text font-black py-3 rounded-xl border-4 border-court-border shadow-[4px_4px_0_0_#111827] transition disabled:opacity-30"
            >
              Apply Override
            </button>
          </div>
        </div>
      )}

      {/* Play Again section */}
      <div className="fg-card-dark p-6 mb-6">
        <h2 className="text-lg font-black text-court-text mb-2">Play Again?</h2>
        <p className="text-court-muted text-sm mb-4">
          Click "Play Again" to stay in for the next round. The host starts once enough players are ready.
        </p>

        {/* Ready status row */}
        <div className="flex flex-wrap gap-2 mb-4">
          {roomState.players.map(p => (
            <span
              key={p.socketId}
              className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-bold border-2 ${
                roomState.rematchReady.includes(p.socketId)
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                  : 'bg-court-bg border-court-border text-court-muted'
              }`}
            >
              <span>{roomState.rematchReady.includes(p.socketId) ? '✓' : '○'}</span>
              <span>{p.name}</span>
            </span>
          ))}
        </div>

        <div className="flex gap-3 flex-wrap">
          <button
            type="button"
            onClick={handlePlayAgain}
            disabled={iAmReady || isReadying}
            className={`font-black px-6 py-3 rounded-xl border-4 border-court-border shadow-[4px_4px_0_0_#111827] transition ${
              iAmReady
                ? 'bg-emerald-500 text-white cursor-default'
                : 'bg-court-gold hover:bg-yellow-300 text-court-text'
            } disabled:opacity-60`}
          >
            {iAmReady ? '✓ Ready!' : isReadying ? 'Joining...' : 'Play Again'}
          </button>

          {isHost && (
            <button
              type="button"
              onClick={handleStartRound}
              disabled={!canStartRound}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-6 py-3 rounded-xl border-4 border-court-border shadow-[4px_4px_0_0_#111827] transition disabled:opacity-30"
            >
              Start Round 2 ({readyCount}/{roomState.players.length} ready)
            </button>
          )}

          <button
            type="button"
            onClick={handleLeave}
            className="bg-court-panel hover:bg-yellow-200 text-court-text font-black px-6 py-3 rounded-xl border-4 border-court-border shadow-[4px_4px_0_0_#111827] transition"
          >
            Leave
          </button>
        </div>

        {!isHost && iAmReady && (
          <p className="text-court-muted text-sm mt-3">Waiting for the host to start the next round...</p>
        )}
      </div>
    </div>
  );
}

function ScoreCard({ score, rank, medalColor, isReady }: { score: PlayerScore; rank: number; medalColor: string; isReady: boolean }) {
  const medals = ['1st', '2nd', '3rd'];

  return (
    <div className={`bg-white border-4 rounded-xl p-4 ${rank === 0 ? 'border-court-accent shadow-[3px_3px_0_0_#111827]' : 'border-court-border'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className={`text-2xl font-bold ${medalColor}`}>
            {medals[rank] || `${rank + 1}th`}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-court-text font-bold">{score.playerName}</span>
              {isReady && (
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" title="Ready for next round" />
              )}
            </div>
            <div className="text-court-muted text-xs">{ROLE_LABELS[score.role] || score.role}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-court-gold">{score.scores.total}</div>
          {score.foremanModifier !== undefined && (
            <div className="text-xs text-court-accent">
              Foreman: {score.foremanModifier > 0 ? '+' : ''}{score.foremanModifier}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <ScoreBar label="Wit" value={score.scores.creativity} color="bg-blue-500" />
        <ScoreBar label="Charisma" value={score.scores.persuasiveness} color="bg-emerald-500" />
        <ScoreBar label="Chaos" value={score.scores.absurdity} color="bg-purple-500" />
      </div>
    </div>
  );
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-court-muted">{label}</span>
        <span className="text-court-text">{value}</span>
      </div>
      <div className="w-full bg-court-panel rounded-full h-2">
        <div
          className={`${color} h-2 rounded-full transition-all duration-1000`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}
