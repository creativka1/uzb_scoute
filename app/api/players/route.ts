import { NextResponse, NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export type Position = 'FW' | 'MF' | 'DF' | 'GK';

const MIN_PERCENTILE_MINUTES = 450;


function safeNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return value;
}

function per90(value: unknown, minutes: unknown): number | null {
  const v = safeNumber(value);
  const m = safeNumber(minutes);
  if (v === null || m === null || m <= 0) return null;
  return (v / m) * 90;
}

function percentileRank(values: (number | null)[], value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const valid = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (!valid.length) return null;
  if (valid.length === 1) return 100;
  const lessOrEqual = valid.filter((v) => v <= value).length;
  return Math.round(((lessOrEqual - 1) / (valid.length - 1)) * 100);
}

function roleMetrics(pos: Position, stats: any): Record<string, number | null> {
  const minutes = stats?.minutesPlayed;
  return {
    savesPer90: per90(stats?.saves, minutes),
    aerialWinPct: safeNumber(stats?.aerialWinPct),
    passAccPct: safeNumber(stats?.passAccPct),
    duelWinPct: safeNumber(stats?.duelWinPct),
    tacklesPer90: per90(stats?.tackles, minutes),
    interceptionsPer90: per90(stats?.interceptions, minutes),
    keyPassesPer90: per90(stats?.keyPasses, minutes),
    assistsPer90: per90(stats?.assists, minutes),
    dribbleSuccessPct: safeNumber(stats?.dribbleSuccessRate),
    goalsPer90: per90(stats?.goals, minutes),
    shotsPer90: per90(stats?.shots, minutes),
  };
}

function scaleMetric(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 50);
  return values.map((v) => Math.round(28 + ((v - min) / (max - min)) * 66));
}

function formatMarketValue(valEUR: number | null): { formatted: string; raw: number | null } {
  if (valEUR === null) return { formatted: '—', raw: null };
  const rounded = Math.max(25000, Math.round(valEUR / 25000) * 25000);
  const formatted = rounded >= 1000000
    ? `€${(rounded / 1000000).toFixed(2)}m`
    : `€${Math.round(rounded / 1000)}k`;
  return { formatted, raw: rounded };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const seasonMode = searchParams.get('season') === 'two' ? 'twoSeasons' : 'currentSeason';
    const leagueFilter = searchParams.get('league') || 'all';

    const filePath = path.join(process.cwd(), 'data', 'superliga_stats.json');
    if (!fs.existsSync(filePath)) {
      return NextResponse.json([], { status: 200 });
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const rawPlayers = JSON.parse(fileContent);

    const playersByPos: Record<Position, any[]> = { FW: [], MF: [], DF: [], GK: [] };

    rawPlayers.forEach((p: any) => {
      const playerLeague = (p.league || '').toUpperCase();
      const filterLeague = (leagueFilter || '').toUpperCase();
      if (filterLeague !== 'ALL' && playerLeague !== filterLeague) return;

      const selectedStats = p[seasonMode];
      const stats = selectedStats && selectedStats.minutesPlayed > 0
        ? selectedStats
        : (p.currentSeason?.minutesPlayed > 0 ? p.currentSeason : p.twoSeasons);

      if (!stats || !stats.minutesPlayed) return;

      const pos: Position = p.position || 'MF';
      playersByPos[pos].push({ ...p, stats, roleMetrics: roleMetrics(pos, stats) });
    });

    const enrichedPlayers: any[] = [];

    const roleKeys: Record<Position, string[]> = {
      GK: ['savesPer90', 'aerialWinPct', 'passAccPct', 'duelWinPct', 'tacklesPer90', 'interceptionsPer90'],
      DF: ['tacklesPer90', 'interceptionsPer90', 'duelWinPct', 'aerialWinPct', 'passAccPct', 'dribbleSuccessPct'],
      MF: ['keyPassesPer90', 'assistsPer90', 'dribbleSuccessPct', 'tacklesPer90', 'passAccPct', 'duelWinPct'],
      FW: ['goalsPer90', 'assistsPer90', 'shotsPer90', 'keyPassesPer90', 'dribbleSuccessPct', 'duelWinPct'],
    };

    (Object.keys(playersByPos) as Position[]).forEach((pos) => {
      const group = playersByPos[pos];
      if (!group.length) return;
      const keys = roleKeys[pos];
      const distributions: Record<string, (number | null)[]> = {};
      keys.forEach((key) => {
        distributions[key] = group.map((item) =>
          safeNumber(item.stats?.minutesPlayed) !== null && item.stats.minutesPlayed >= MIN_PERCENTILE_MINUTES
            ? item.roleMetrics[key]
            : null
        );
      });

      group.forEach((p) => {
        const hasReliableSample = safeNumber(p.stats?.minutesPlayed) !== null && p.stats.minutesPlayed >= MIN_PERCENTILE_MINUTES;
        const values = keys.map((key) => hasReliableSample ? percentileRank(distributions[key], p.roleMetrics[key]) : null);
        const available = values.filter((v): v is number => v !== null);
        const scoutIndex = available.length ? Math.round(available.reduce((a, b) => a + b, 0) / available.length) : null;

        const radar = { m1: values[0] ?? null, m2: values[1] ?? null, m3: values[2] ?? null, m4: values[3] ?? null, m5: values[4] ?? null, m6: values[5] ?? null };
        const marketVal = formatMarketValue(safeNumber(p.marketValueCurrency));

        enrichedPlayers.push({
          id: `${p.league || 'UZB'}-${p.sofaId}`,
          league: p.league || 'UZB',
          countryCode: p.countryCode || '',
          name: { uz: p.name, ru: p.name },
          age: p.age,
          isU21: p.age <= 21,
          isLegionnaire: p.isLegionnaire || false,
          isEstimatedMarketValue: false,
          club: { uz: p.club, ru: p.club },
          position: pos,
          number: p.jerseyNumber ?? null,
          height: p.height ?? null,
          preferredFoot: p.preferredFoot || 'Unknown',
          contractUntil: p.contractUntil || '—',
          marketValue: marketVal.formatted,
          rawMarketValueEUR: marketVal.raw,
          photoUrl: `https://api.sofascore.com/api/v1/player/${p.sofaId}/image`,
          initials: (p.shortName || p.name || 'UZ').split(' ').map((n: string) => n[0]).join('').slice(0, 2),
          scoutIndex,
          scoutIndexIsCalculated: scoutIndex !== null,
          scoutIndexBasis: hasReliableSample
            ? 'Среднее доступных ролевых метрик, рассчитанных как процентили среди игроков с минимум 450 минутами'
            : 'Недостаточно игрового времени для надёжного процентиля (минимум 450 минут)',
          tags: [p.club, pos, p.isLegionnaire ? 'Legioner' : 'Local'],
          minutesPlayed: p.stats.minutesPlayed,
          matchesPlayed: p.stats.matchesPlayed,
          goals: p.stats.goals ?? 0,
          assists: p.stats.assists ?? 0,
          xG: null,
          xA: null,
          shots: p.stats.shots ?? 0,
          keyPasses: p.stats.keyPasses ?? 0,
          goalsPer90: per90(p.stats.goals, p.stats.minutesPlayed),
          assistsPer90: per90(p.stats.assists, p.stats.minutesPlayed),
          shotsPer90: per90(p.stats.shots, p.stats.minutesPlayed),
          keyPassesPer90: per90(p.stats.keyPasses, p.stats.minutesPlayed),
          passAccPct: safeNumber(p.stats.passAccPct),
          dribbleSuccessRate: pos === 'GK' ? null : safeNumber(p.stats.dribbleSuccessRate),
          dribbleWon: p.stats.dribbleWon ?? 0,
          dribbleTotal: p.stats.dribbleTotal ?? 0,
          duelWinRate: safeNumber(p.stats.duelWinPct),
          progressiveRuns: null,
          aerialWinRate: safeNumber(p.stats.aerialWinPct),
          tackles: p.stats.tackles ?? 0,
          interceptions: p.stats.interceptions ?? 0,
          saves: p.stats.saves ?? 0,
          roleMetrics: p.roleMetrics,
          radar,
        });
      });
    });

    return NextResponse.json(enrichedPlayers, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error: any) {
    console.error('Ошибка в route.ts:', error.message);
    return NextResponse.json([], { status: 200 });
  }
}