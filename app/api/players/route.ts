import { NextResponse, NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export type Position = 'FW' | 'MF' | 'DF' | 'GK';

function scaleMetric(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 50);
  return values.map((v) => Math.round(28 + ((v - min) / (max - min)) * 66));
}

function formatMarketValue(valEUR: number): { formatted: string; raw: number } {
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
      keys.forEach((key) => { distributions[key] = group.map((item) => item.roleMetrics[key]); });

      group.forEach((p) => {
        const values = keys.map((key) => percentileRank(distributions[key], p.roleMetrics[key]));
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
          scoutIndexBasis: 'Среднее доступных ролевых метрик, рассчитанных как процентили',
          tags: [p.club, pos, p.isLegionnaire ? 'Legioner' : 'Local'],
          minutesPlayed: p.stats.minutesPlayed,
          matchesPlayed: p.stats.matchesPlayed,
          goals: p.stats.goals ?? 0,
          assists: p.stats.assists ?? 0,
          xG: null,
          xA: null,
          shots: p.stats.shots ?? 0,
          keyPasses: p.stats.keyPasses ?? 0,
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