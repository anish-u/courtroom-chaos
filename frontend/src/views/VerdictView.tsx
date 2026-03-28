import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useSocket } from '../hooks/useSocket';
import { useGameStore, Role } from '../store/gameStore';
import type { PlayerScore } from '../store/gameStore';

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
  const { rematch, foremanOverride } = useSocket();
  const { roomState, socketId } = useGameStore();
  const [overrideTarget, setOverrideTarget] = useState<string | null>(null);
  const [overrideModifier, setOverrideModifier] = useState(0);
  const [hasOverridden, setHasOverridden] = useState(false);

  useEffect(() => {
    if (!roomState) navigate('/lobby');
  }, [roomState, navigate]);

  if (!roomState) return null;

  const myPlayer = roomState.players.find(p => p.socketId === socketId);
  const isForeman = myPlayer?.role === Role.JURY_FOREMAN;
  const isHost = myPlayer?.isHost;

  const sortedScores = [...roomState.scores].sort((a, b) => b.scores.total - a.scores.total);

  const handleOverride = async () => {
    if (!overrideTarget || !roomState) return;
    await foremanOverride(roomState.code, overrideTarget, overrideModifier);
    setHasOverridden(true);
  };

  const handleRematch = async () => {
    if (!roomState) return;
    await rematch(roomState.code);
    navigate('/lobby');
  };

  const handleNewGame = () => {
    useGameStore.getState().reset();
    navigate('/lobby');
  };

  const medalColors = ['text-yellow-400', 'text-gray-300', 'text-amber-600'];

  return (
    <div className="min-h-screen p-4 max-w-3xl mx-auto pb-12">
      <div className="text-center mb-8 pt-8">
        <div className="text-6xl mb-4 drop-shadow-[3px_3px_0_#111827]">⚖️</div>
        <h1 className="text-4xl font-black text-court-gold mb-2 drop-shadow-[3px_3px_0_#111827]">The Verdict Is In</h1>
        {roomState.winner && (
          <p className="text-white text-xl font-black">
            <span className="text-court-gold">{roomState.winner}</span> wins the case!
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
          {sortedScores.map((score, i) => (
            <ScoreCard key={score.playerId} score={score} rank={i} medalColor={medalColors[i] || 'text-court-muted'} />
          ))}
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

      {/* Actions */}
      <div className="flex gap-4 justify-center flex-wrap">
        {isHost && (
          <button
            type="button"
            onClick={handleRematch}
            className="bg-court-gold hover:bg-yellow-300 text-court-text font-black px-8 py-3 rounded-xl border-4 border-court-border shadow-[4px_4px_0_0_#111827] transition"
          >
            Rematch (Same Players)
          </button>
        )}
        <button
          type="button"
          onClick={handleNewGame}
          className="bg-court-panel hover:bg-yellow-200 text-court-text font-black px-8 py-3 rounded-xl border-4 border-court-border shadow-[4px_4px_0_0_#111827] transition"
        >
          New Game
        </button>
      </div>
    </div>
  );
}

function ScoreCard({ score, rank, medalColor }: { score: PlayerScore; rank: number; medalColor: string }) {
  const medals = ['1st', '2nd', '3rd'];

  return (
    <div className={`bg-white border-4 rounded-xl p-4 ${rank === 0 ? 'border-court-accent shadow-[3px_3px_0_0_#111827]' : 'border-court-border'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className={`text-2xl font-bold ${medalColor}`}>
            {medals[rank] || `${rank + 1}th`}
          </span>
          <div>
            <div className="text-court-text font-bold">{score.playerName}</div>
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
        <ScoreBar label="Creativity" value={score.scores.creativity} weight="30%" color="bg-blue-500" />
        <ScoreBar label="Persuasion" value={score.scores.persuasiveness} weight="30%" color="bg-emerald-500" />
        <ScoreBar label="Absurdity" value={score.scores.absurdity} weight="40%" color="bg-purple-500" />
      </div>
    </div>
  );
}

function ScoreBar({ label, value, weight, color }: { label: string; value: number; weight: string; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-court-muted">{label} ({weight})</span>
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
