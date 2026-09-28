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
    console.log("Запрос от фронтенда - leagueFilter:", leagueFilter, "seasonMode:", seasonMode);
   // Приводим обе лиги к верхнему регистру для надежного сравнения
   const playerLeague = (p.league || '').toUpperCase();
   const filterLeague = (leagueFilter || '').toUpperCase();

   if (filterLeague !== 'ALL' && playerLeague && playerLeague !== filterLeague) {
       return;
   }
      const stats = p[seasonMode] || p.currentSeason || p.twoSeasons;
      if (!stats || stats.minutesPlayed === 0) return;

      const pos: Position = p.position || 'MF';
      const mins90 = Math.max(0.5, stats.minutesPlayed / 90);

      let m1 = 0, m2 = 0, m3 = 0, m4 = 0, m5 = 0, m6 = 0;

      if (pos === 'GK') {
        m1 = (stats.saves || 0) / mins90;
        m2 = stats.aerialWinPct || 50;
        m3 = stats.passAccPct || 60;
        m4 = 67;
        m5 = stats.matchesPlayed || 1;
        m6 = 68;
      } else if (pos === 'DF') {
        m1 = (stats.tackles || 0) / mins90;
        m2 = stats.aerialWinPct || 50;
        m3 = stats.duelWinPct || 50;
        m4 = (stats.interceptions || 0) / mins90;
        m5 = stats.passAccPct || 65;
        m6 = 68;
      } else if (pos === 'MF') {
        m1 = (stats.keyPasses || 0) / mins90;
        m2 = (stats.assists || 0) / mins90;
        m3 = stats.dribbleSuccessRate || 0;
        m4 = (stats.tackles || 0) / mins90;
        m5 = stats.passAccPct || 70;
        m6 = 68;
      } else {
        m1 = (stats.goals || 0) / mins90;
        m2 = (stats.xG || ((stats.goals || 0) * 0.85)) / mins90;
        m3 = stats.dribbleSuccessRate || 0;
        m4 = (stats.assists || 0) / mins90;
        m5 = stats.minutesPlayed;
        m6 = 68;
      }

      playersByPos[pos].push({
        ...p,
        stats,
        mins90,
        rawM: { m1, m2, m3, m4, m5, m6 },
      });
    });

    const enrichedPlayers: any[] = [];

    (Object.keys(playersByPos) as Position[]).forEach((pos) => {
      const group = playersByPos[pos];
      if (group.length === 0) return;

      const m1Scaled = scaleMetric(group.map((item) => item.rawM.m1));
      const m2Scaled = scaleMetric(group.map((item) => item.rawM.m2));
      const m3Scaled = scaleMetric(group.map((item) => item.rawM.m3));
      const m4Scaled = scaleMetric(group.map((item) => item.rawM.m4));
      const m5Scaled = scaleMetric(group.map((item) => item.rawM.m5));
      const m6Scaled = scaleMetric(group.map((item) => item.rawM.m6));

      group.forEach((p, idx) => {
        const radar = {
          m1: m1Scaled[idx],
          m2: m2Scaled[idx],
          m3: m3Scaled[idx],
          m4: m4Scaled[idx],
          m5: m5Scaled[idx],
          m6: m6Scaled[idx],
        };

        const avgScore = (radar.m1 + radar.m2 + radar.m3 + radar.m4 + radar.m5 + radar.m6) / 6;
        const scoutIndex = Math.min(88, Math.max(50, Math.round(48 + (avgScore * 0.4) + (p.age <= 21 ? 3 : 0))));

        let actualEUR = p.marketValueCurrency;
        if (!actualEUR || actualEUR <= 0) {
          const kAge = p.age <= 19 ? 1.45 : p.age <= 21 ? 1.25 : p.age <= 27 ? 1.0 : p.age <= 31 ? 0.8 : 0.6;
          const kPos = pos === 'FW' ? 1.15 : pos === 'MF' ? 1.05 : pos === 'DF' ? 0.95 : 0.85;
          const base = (p.stats.minutesPlayed / 90) * 6500 + scoutIndex * 1200;
          actualEUR = Math.round(base * kAge * kPos);
        }

        const marketVal = formatMarketValue(actualEUR);

        enrichedPlayers.push({
          id: `${p.league || 'UZB'}-${p.sofaId}`,
          league: p.league || 'UZB',
          name: { uz: p.name, ru: p.name },
          age: p.age,
          isU21: p.age <= 21,
          isLegionnaire: p.isLegionnaire || false,
          club: { uz: p.club, ru: p.club },
          position: pos,
          number: p.jerseyNumber || 10,
          height: p.height || 182,
          preferredFoot: p.preferredFoot || 'Right',
          contractUntil: p.contractUntil || '—',
          marketValue: marketVal.formatted,
          rawMarketValueEUR: marketVal.raw,
          photoUrl: `https://api.sofascore.com/api/v1/player/${p.sofaId}/image`,
          initials: (p.shortName || p.name || 'UZ').split(' ').map((n: string) => n[0]).join('').slice(0, 2),
          scoutIndex,
          tags: [p.club, pos, p.isLegionnaire ? 'Legioner' : 'Local'],
          minutesPlayed: p.stats.minutesPlayed,
          matchesPlayed: p.stats.matchesPlayed,
          goals: p.stats.goals || 0,
          assists: p.stats.assists || 0,
          xG: p.stats.xG || 0,
          xA: p.stats.xA || 0,
          shots: p.stats.shots || 0,
          keyPasses: p.stats.keyPasses || 0,
          dribbleSuccessRate: pos === 'GK' ? 0 : (p.stats.dribbleSuccessRate || 0),
          dribbleWon: p.stats.dribbleWon || 0,
          dribbleTotal: p.stats.dribbleTotal || 0,
          duelWinRate: p.stats.duelWinPct || 50,
          progressiveRuns: pos === 'FW' ? 12 : 5,
          aerialWinRate: p.stats.aerialWinPct || 50,
          tackles: p.stats.tackles || 0,
          interceptions: p.stats.interceptions || 0,
          saves: p.stats.saves || 0,
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