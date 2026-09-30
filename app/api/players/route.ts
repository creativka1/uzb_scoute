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

  const less = valid.filter((v) => v < value).length;
  const equal = valid.filter((v) => v === value).length;
  const percentile = ((less + equal * 0.5) / valid.length) * 100;

  return Math.max(0, Math.min(100, Math.round(percentile)));
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

type AnalyticalRole = 'GOALKEEPER' | 'DEFENDER' | 'MIDFIELDER' | 'ATTACKING_MIDFIELDER' | 'FORWARD';

function deriveAnalyticalRole(pos: Position, attackingScore: number | null): {
  role: AnalyticalRole;
  basis: string;
} {
  if (pos === 'GK') return { role: 'GOALKEEPER', basis: 'Позиция источника: GK' };
  if (pos === 'DF') return { role: 'DEFENDER', basis: 'Позиция источника: DF' };
  if (pos === 'FW') return { role: 'FORWARD', basis: 'Позиция источника: FW' };

  if (attackingScore !== null && attackingScore >= 75) {
    return {
      role: 'ATTACKING_MIDFIELDER',
      basis: 'Рассчитано платформой: позиция источника MF + атакующий вклад не ниже 75-го процентильного профиля',
    };
  }

  return { role: 'MIDFIELDER', basis: 'Позиция источника: MF; недостаточно оснований для более узкой аналитической роли' };
}

function formatMarketValue(valEUR: number | null): { formatted: string; raw: number | null } {
  if (valEUR === null || valEUR <= 0) return { formatted: '—', raw: null };

  const formatted = valEUR >= 1000000
    ? `€${(valEUR / 1000000).toFixed(valEUR % 1000000 === 0 ? 0 : 2).replace(/0+$/, '').replace(/\.$/, '')}m`
    : `€${Math.round(valEUR / 1000)}k`;

  return { formatted, raw: valEUR };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const requestedTwoSeasons = searchParams.get('season') === 'two';
    const leagueFilter = searchParams.get('league') || 'all';

    const filePath = path.join(process.cwd(), 'data', 'superliga_stats.json');
    if (!fs.existsSync(filePath)) {
      return NextResponse.json([], { status: 200 });
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const rawPlayers = JSON.parse(fileContent);

    const detailedPositionsPath = path.join(process.cwd(), 'data', 'detailed_positions.json');
    let detailedPositions: Record<string, any> = {};
    if (fs.existsSync(detailedPositionsPath)) {
      try {
        const detailedPayload = JSON.parse(fs.readFileSync(detailedPositionsPath, 'utf-8'));
        detailedPositions = detailedPayload?.players || {};
      } catch {
        detailedPositions = {};
      }
    }

    const playersByPos: Record<Position, any[]> = { FW: [], MF: [], DF: [], GK: [] };

    rawPlayers.forEach((p: any) => {
      const playerLeague = (p.league || '').toUpperCase();
      const filterLeague = (leagueFilter || '').toUpperCase();
      if (filterLeague !== 'ALL' && playerLeague !== filterLeague) return;

      let stats: any = null;
      let statsSeasonType: 'current' | 'previous' | 'two' = 'current';

      if (requestedTwoSeasons) {
        stats = p.twoSeasons;
        statsSeasonType = 'two';
      } else if (p.currentSeason?.minutesPlayed > 0) {
        stats = p.currentSeason;
        statsSeasonType = 'current';
      } else if (p.previousSeason?.minutesPlayed > 0) {
        stats = p.previousSeason;
        statsSeasonType = 'previous';
      } else if (p.twoSeasons?.minutesPlayed > 0) {
        // Backward-compatible fallback for existing data files that only store
        // currentSeason + twoSeasons. If currentSeason is empty, the two-season
        // aggregate contains only the previous season.
        stats = p.twoSeasons;
        statsSeasonType = 'previous';
      }

      if (!stats || !stats.minutesPlayed) return;

      const pos: Position = p.position || 'MF';
      playersByPos[pos].push({ ...p, stats, roleMetrics: roleMetrics(pos, stats) });
    });

    const enrichedPlayers: any[] = [];

    const roleKeys: Record<Position, string[]> = {
      // Only metrics currently backed by the dataset are used in role profiles.
      // duelWinPct / aerialWinPct stay available as raw fields when a source
      // provides them, but they are not part of the score until coverage exists.
      GK: ['savesPer90', 'passAccPct'],
      DF: ['tacklesPer90', 'interceptionsPer90', 'passAccPct', 'dribbleSuccessPct', 'keyPassesPer90'],
      MF: ['keyPassesPer90', 'assistsPer90', 'dribbleSuccessPct', 'tacklesPer90', 'passAccPct'],
      FW: ['goalsPer90', 'assistsPer90', 'shotsPer90', 'keyPassesPer90', 'dribbleSuccessPct'],
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

        // A player's percentile can still be shown with a small personal sample,
        // but the comparison benchmark itself only uses players with >= 450 minutes.
        // This keeps the radar visible while clearly separating sample reliability
        // from the percentile calculation.
        const values = keys.map((key) => {
          const benchmark = distributions[key].filter((v): v is number => v !== null && Number.isFinite(v));
          if (benchmark.length < 3) return null;
          return percentileRank(benchmark, p.roleMetrics[key]);
        });

        const available = values.filter((v): v is number => v !== null);
        const minRoleMetrics = pos === 'GK' ? 2 : 3;
        const scoutIndex = available.length >= minRoleMetrics
          ? Math.round(available.reduce((a, b) => a + b, 0) / available.length)
          : null;

        // Stage 3 reliability adjustment:
        // for players below the 450-minute reliability threshold, extreme raw
        // percentiles are shrunk toward the neutral 50th percentile.
        // At 450+ minutes, adjusted percentile equals the raw Stage 2 percentile.
        const sampleWeight = Math.min(1, Math.max(0, p.stats.minutesPlayed / MIN_PERCENTILE_MINUTES));
        const adjustedValues = values.map((v) =>
          v === null ? null : Math.round(50 + (v - 50) * sampleWeight)
        );
        const adjustedAvailable = adjustedValues.filter((v): v is number => v !== null);
        const adjustedRoleScore = adjustedAvailable.length >= minRoleMetrics
          ? Math.round(adjustedAvailable.reduce((a, b) => a + b, 0) / adjustedAvailable.length)
          : null;

        const metricSignals = keys.map((key, index) => ({
          key,
          value: p.roleMetrics[key] ?? null,
          percentile: adjustedValues[index] ?? null,
          rawPercentile: values[index] ?? null,
        }));

        const attackingKeys = ['goalsPer90', 'assistsPer90', 'shotsPer90', 'keyPassesPer90'];
        const attackingPercentiles = (pos === 'FW' || pos === 'MF') ? attackingKeys.map((key) => {
          const benchmark = group
            .filter((item) =>
              safeNumber(item.stats?.minutesPlayed) !== null &&
              item.stats.minutesPlayed >= MIN_PERCENTILE_MINUTES
            )
            .map((item) => item.roleMetrics[key])
            .filter((v): v is number => v !== null && Number.isFinite(v));

          if (benchmark.length < 3) return null;
          return percentileRank(benchmark, p.roleMetrics[key]);
        }) : [];
        const attackingAvailable = attackingPercentiles.filter((v): v is number => v !== null);
        const rawAttackingScore = attackingAvailable.length >= 2
          ? Math.round(attackingAvailable.reduce((a, b) => a + b, 0) / attackingAvailable.length)
          : null;
        const attackingScore = rawAttackingScore === null
          ? null
          : Math.round(50 + (rawAttackingScore - 50) * sampleWeight);

        const analyticalRole = deriveAnalyticalRole(pos, attackingScore);

        const rankedSignals = metricSignals
          .filter((item): item is { key: string; value: number; percentile: number } =>
            item.value !== null && item.percentile !== null
          )
          .sort((a, b) => b.percentile - a.percentile);

        const strengths = rankedSignals.filter((item) => item.percentile >= 75);
        const watchouts = rankedSignals
          .filter((item) => item.percentile < 40)
          .sort((a, b) => a.percentile - b.percentile);

        const benchmarkPlayers = group.filter((item) =>
          safeNumber(item.stats?.minutesPlayed) !== null && item.stats.minutesPlayed >= MIN_PERCENTILE_MINUTES
        ).length;

        const metricCoverage = available.length;
        const mediumCoverageThreshold = pos === 'GK' ? 2 : 4;
        const highCoverageThreshold = pos === 'GK' ? 2 : 5;
        const confidence =
          !hasReliableSample || metricCoverage < mediumCoverageThreshold
            ? 'low'
            : p.stats.minutesPlayed >= 900 && metricCoverage >= highCoverageThreshold
              ? 'high'
              : 'medium';

        const radar = { m1: values[0] ?? null, m2: values[1] ?? null, m3: values[2] ?? null, m4: values[3] ?? null, m5: values[4] ?? null, m6: values[5] ?? null };
        const adjustedRadar = { m1: adjustedValues[0] ?? null, m2: adjustedValues[1] ?? null, m3: adjustedValues[2] ?? null, m4: adjustedValues[3] ?? null, m5: adjustedValues[4] ?? null, m6: adjustedValues[5] ?? null };
        const marketVal = formatMarketValue(safeNumber(p.marketValueCurrency));
        const detailed = detailedPositions[String(p.sofaId)] || null;

        enrichedPlayers.push({
          id: `${p.league || 'UZB'}-${p.sofaId}`,
          league: p.league || 'UZB',
          countryCode: p.countryCode || '',
          name: { uz: p.name, ru: p.name },
          age: p.age,
          isU21: p.age <= 21,
          isLegionnaire: p.isLegionnaire || false,
          isEstimatedMarketValue: false,
          club: /^no team$/i.test(String(p.club || '').trim())
            ? { uz: 'Jamoasiz', ru: 'Без клуба' }
            : { uz: p.club, ru: p.club },
          position: pos,
          sourcePosition: pos,
          analyticalRole: analyticalRole.role,
          analyticalRoleIsCalculated: analyticalRole.role !== 'GOALKEEPER' && analyticalRole.role !== 'DEFENDER' && analyticalRole.role !== 'FORWARD' && analyticalRole.role !== 'MIDFIELDER',
          analyticalRoleBasis: analyticalRole.basis,
          detailedPosition: detailed?.detailedPosition ?? null,
          detailedPositionConfidence: detailed?.confidence ?? null,
          detailedPositionStartsUsed: detailed?.startsUsed ?? 0,
          detailedPositionPrimaryShare: detailed?.primaryShare ?? null,
          detailedPositionDistribution: detailed?.positionDistribution ?? {},
          detailedPositionSecondary: detailed?.secondaryPositions ?? [],
          detailedPositionHeatmapMatchesAvailable: detailed?.heatmapMatchesAvailable ?? 0,
          detailedPositionHeatmapMatchesValidated: detailed?.heatmapMatchesValidated ?? 0,
          detailedPositionMethod: detailed?.method ?? null,
          number: p.jerseyNumber ?? null,
          height: p.height ?? null,
          preferredFoot: p.preferredFoot || 'Unknown',
          contractUntil: p.contractUntil || '—',
          statsSeasonType,
          marketValue: marketVal.formatted,
          rawMarketValueEUR: marketVal.raw,
          photoUrl: `https://api.sofascore.com/api/v1/player/${p.sofaId}/image`,
          initials: (p.shortName || p.name || 'UZ').split(' ').map((n: string) => n[0]).join('').slice(0, 2),
          scoutIndex,
          scoutIndexIsCalculated: scoutIndex !== null,
          scoutIndexBasis: 'Среднее доступных ролевых процентилей по метрикам с реальным покрытием данных; база сравнения — игроки с минимум 450 минутами',
          scoutingEngine: {
            rawRoleScore: scoutIndex,
            roleScore: adjustedRoleScore,
            rawAttackingScore,
            attackingScore,
            sampleWeight,
            adjustedRadar,
            confidence,
            metricCoverage,
            totalRoleMetrics: keys.length,
            benchmarkPlayers,
            benchmarkMinMinutes: MIN_PERCENTILE_MINUTES,
            isLowSample: !hasReliableSample,
            strengths: strengths.slice(0, 3),
            watchouts: watchouts.slice(0, 3),
            missingMetrics: metricSignals.filter((item) => item.value === null).map((item) => item.key),
          },
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