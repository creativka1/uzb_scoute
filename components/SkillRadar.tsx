'use client';

import React from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';
import { RadarMetrics } from '@/types/scouting';

export function SkillRadar({
  primaryName,
  primaryMetrics,
  comparisonName,
  comparisonMetrics,
}: {
  primaryName: string;
  primaryMetrics: RadarMetrics;
  comparisonName?: string;
  comparisonMetrics?: RadarMetrics;
}) {
  const chartData = [
    { skill: 'Завершение', primary: primaryMetrics.finishing, comparison: comparisonMetrics?.finishing || 50, avg: 50 },
    { skill: 'Креатив', primary: primaryMetrics.creativity, comparison: comparisonMetrics?.creativity || 50, avg: 50 },
    { skill: 'Дриблинг', primary: primaryMetrics.dribbling, comparison: comparisonMetrics?.dribbling || 50, avg: 50 },
    { skill: 'Защита', primary: primaryMetrics.defending, comparison: comparisonMetrics?.defending || 50, avg: 50 },
    { skill: 'Физика', primary: primaryMetrics.physicality, comparison: comparisonMetrics?.physicality || 50, avg: 50 },
    { skill: 'Пас', primary: primaryMetrics.passing, comparison: comparisonMetrics?.passing || 50, avg: 50 },
  ];

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/90 p-5 shadow-2xl">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-2">
        <h3 className="text-sm font-semibold text-zinc-100">Радар навыков (Процентили)</h3>
        <span className="text-xs text-zinc-400">0 - 100% относительно лиги</span>
      </div>
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="75%" data={chartData}>
            <PolarGrid stroke="#27272a" />
            <PolarAngleAxis dataKey="skill" tick={{ fill: '#d4d4d8', fontSize: 11 }} />
            <PolarRadiusAxis domain={[0, 100]} stroke="#3f3f46" tick={{ fill: '#71717a', fontSize: 9 }} />
            <Radar name={primaryName} dataKey="primary" stroke="#10b981" fill="#10b981" fillOpacity={0.4} strokeWidth={2} />
            {comparisonMetrics && comparisonName ? (
              <Radar name={comparisonName} dataKey="comparison" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.35} strokeWidth={2} />
            ) : (
              <Radar name="Среднее по Лиге" dataKey="avg" stroke="#52525b" fill="transparent" strokeDasharray="3 3" />
            )}
            <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '8px', fontSize: '12px' }} />
            <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
