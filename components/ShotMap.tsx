'use client';

import React, { useState } from 'react';
import { ShotEvent } from '@/types/scouting';
import { Target } from 'lucide-react';

export function ShotMap({ shots, playerName }: { shots: ShotEvent[]; playerName: string }) {
  const [activeShot, setActiveShot] = useState<ShotEvent | null>(null);

  const getOutcomeColor = (result: ShotEvent['result']) => {
    switch (result) {
      case 'goal': return '#10b981';
      case 'saved': return '#38bdf8';
      case 'blocked': return '#ef4444';
      default: return '#71717a';
    }
  };

  const totalShots = shots.length;
  const totalGoals = shots.filter((s) => s.result === 'goal').length;
  const cumulativeXG = shots.reduce((acc, s) => acc + s.xG, 0).toFixed(2);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/90 p-5 shadow-2xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-zinc-800 pb-3 mb-4 gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-emerald-400" />
            <h3 className="text-sm font-semibold text-zinc-100">Карта ударов — {playerName}</h3>
          </div>
          <span className="text-[11px] text-zinc-400">Координаты и ожидаемый вес ударов (xG)</span>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="rounded bg-zinc-950 px-2.5 py-1 border border-zinc-800 text-zinc-300">
            Удары: <strong className="text-white">{totalShots}</strong>
          </span>
          <span className="rounded bg-zinc-950 px-2.5 py-1 border border-zinc-800 text-emerald-400">
            Голы: <strong>{totalGoals}</strong>
          </span>
          <span className="rounded bg-zinc-950 px-2.5 py-1 border border-zinc-800 text-sky-400">
            Σ xG: <strong>{cumulativeXG}</strong>
          </span>
        </div>
      </div>

      <div className="relative flex justify-center py-2">
        <div className="relative w-full max-w-[500px] aspect-[68/52] bg-zinc-950 rounded-lg border border-zinc-800 overflow-hidden">
          <svg viewBox="0 0 100 75" className="w-full h-full select-none">
            <rect x="5" y="5" width="90" height="68" fill="none" stroke="#27272a" strokeWidth="0.8" />
            <line x1="5" y1="73" x2="95" y2="73" stroke="#3f3f46" strokeWidth="0.8" />
            <path d="M 38 73 A 12 12 0 0 1 62 73" fill="none" stroke="#27272a" strokeWidth="0.8" />
            <circle cx="50" cy="73" r="0.8" fill="#52525b" />
            <rect x="22" y="5" width="56" height="26" fill="none" stroke="#3f3f46" strokeWidth="0.8" />
            <rect x="36" y="5" width="28" height="9" fill="none" stroke="#3f3f46" strokeWidth="0.8" />
            <rect x="44" y="2" width="12" height="3" fill="#18181b" stroke="#71717a" strokeWidth="0.8" />
            <circle cx="50" cy="20" r="0.8" fill="#71717a" />
            <path d="M 40 31 A 10 10 0 0 0 60 31" fill="none" stroke="#3f3f46" strokeWidth="0.8" />

            {shots.map((shot) => {
              const radius = Math.max(1.8, Math.min(4.8, 1.6 + shot.xG * 3.8));
              const isHovered = activeShot?.id === shot.id;
              const color = getOutcomeColor(shot.result);

              return (
                <g key={shot.id} className="cursor-pointer">
                  {(shot.result === 'goal' || isHovered) && (
                    <circle
                      cx={shot.x}
                      cy={shot.y * 0.65 + 5}
                      r={radius + 2}
                      fill={color}
                      opacity={0.3}
                    />
                  )}
                  <circle
                    cx={shot.x}
                    cy={shot.y * 0.65 + 5}
                    r={radius}
                    fill={color}
                    stroke="#09090b"
                    strokeWidth="0.8"
                    onMouseEnter={() => setActiveShot(shot)}
                    onMouseLeave={() => setActiveShot(null)}
                  />
                </g>
              );
            })}
          </svg>

          {activeShot && (
            <div
              className="absolute z-20 pointer-events-none rounded-lg border border-zinc-700 bg-zinc-950/95 p-2 text-xs shadow-xl text-zinc-200"
              style={{
                left: `${Math.min(75, Math.max(25, activeShot.x))}%`,
                top: `${Math.min(70, activeShot.y * 0.65 + 10)}%`,
                transform: 'translate(-50%, -100%)',
              }}
            >
              <div className="font-semibold text-emerald-400">
                {activeShot.result.toUpperCase()} · xG: {activeShot.xG.toFixed(2)}
              </div>
              <div className="text-[11px] text-zinc-400">
                {activeShot.minute}' мин vs {activeShot.opponent}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
