import { NextResponse, NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { gunzipSync } from 'zlib';

export const dynamic = 'force-dynamic';

import type { Position } from '@/types/players';

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

const roleSources: Record<string, string> = {
  savesPer90: 'saves', tacklesPer90: 'tackles', interceptionsPer90: 'interceptions',
  keyPassesPer90: 'keyPasses', assistsPer90: 'assists', goalsPer90: 'goals', shotsPer90: 'shots',
  passAccPct: 'passAccPct', dribbleSuccessPct: 'dribbleSuccessRate', aerialWinPct: 'aerialWinPct', duelWinPct: 'duelWinPct',
};
function observed(stats: any, key: string): number | null {
  return safeNumber(stats.metricDetails?.[key]?.value ?? stats[key]);
}
function metricDetail(stats: any, key: string) {
  return stats.metricDetails?.[roleSources[key] || key] ?? {
    matches: stats.matchesPlayed, totalMatches: stats.matchesPlayed, minutes: stats.minutesPlayed,
    totalMinutes: stats.minutesPlayed, status: 'complete',
  };
}
function eligibleMetric(stats: any, key: string, benchmark = false): boolean {
  const d = metricDetail(stats, key);
  // Explicit analytical policy, not an assertion of source completeness.
  return d.minutes >= (benchmark ? 450 : 90) && d.totalMinutes > 0 &&
    d.minutes / d.totalMinutes >= (benchmark ? 0.8 : 0.6);
}
function observedPer90(stats: any, key: string): number | null {
  if (stats.metricDetails?.[key]) return safeNumber(stats.metricDetails[key].per90);
  return per90(stats[key], stats.minutesPlayed);
}
function roleMetrics(pos: Position, stats: any): Record<string, number | null> {
  return Object.fromEntries(Object.entries(roleSources).map(([key, source]) =>
    [key, key.endsWith('Per90') ? observedPer90(stats, source) : observed(stats, source)]));
}

type AnalyticalRole = 'UNKNOWN' | 'GOALKEEPER' | 'DEFENDER' | 'MIDFIELDER' | 'ATTACKING_MIDFIELDER' | 'FORWARD';

function deriveAnalyticalRole(pos: Position, attackingScore: number | null): {
  role: AnalyticalRole;
  basis: string;
} {
  if (pos === 'UNKNOWN') return { role: 'UNKNOWN', basis: 'Нет подтверждённой позиции' };
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
  if (valEUR === null || valEUR < 0) return { formatted: '—', raw: null };

  const formatted = valEUR >= 1000000
    ? `€${Number((valEUR / 1000000).toFixed(2)).toString()}m`
    : `€${Math.round(valEUR / 1000)}k`;

  return { formatted, raw: valEUR };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const requestedSeason = searchParams.get('season') || 'latest';
    const leagueFilter = (searchParams.get('league') || 'all').toUpperCase();
    if (!['latest', 'current', 'previous', 'two'].includes(requestedSeason) || !['ALL', 'UZB', 'KAZ'].includes(leagueFilter)) {
      return NextResponse.json({ error: 'INVALID_FILTER' }, { status: 400 });
    }
    const filePath = path.join(process.cwd(), 'data', 'superliga_stats.json');
    const auditPath = path.join(process.cwd(), 'data', 'audits', 'data_integrity.json');
    if (!fs.existsSync(filePath) || !fs.existsSync(auditPath)) {
      return NextResponse.json({ error: 'DATA_UNAVAILABLE' }, { status: 503 });
    }
    const rawPlayers = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const observationPath = path.join(process.cwd(), 'data/metric_observations.json.gz');
    if (!fs.existsSync(observationPath)) return NextResponse.json({error:'METRIC_OBSERVATIONS_UNAVAILABLE'}, {status:503});
    const observations = JSON.parse(gunzipSync(fs.readFileSync(observationPath)).toString('utf8'));
    for (const p of rawPlayers) for (const period of ['currentSeason','previousSeason','twoSeasons']) {
      if (p[period]) p[period].metricDetails = observations[`${p.league}-${p.sofaId}`]?.[period] || {};
    }
    const audit = JSON.parse(fs.readFileSync(auditPath, 'utf-8'));
    if (!Array.isArray(rawPlayers) || audit.schemaVersion !== 2 || rawPlayers.some((p: any) => p.schemaVersion !== 2)) {
      throw new Error('Unverified dataset schema');
    }
    const detailedPositionsPath = path.join(process.cwd(), 'data', 'detailed_positions.json');
    const detailedPayload = fs.existsSync(detailedPositionsPath)
      ? JSON.parse(fs.readFileSync(detailedPositionsPath, 'utf-8')) : {};
    // Never serve the old, unscoped formation-order inference as an exact position.
    const detailedPositions = detailedPayload.schemaVersion === 2 ? detailedPayload.players || {} : {};
    const selectedLeagues = leagueFilter === 'ALL' ? ['UZB', 'KAZ'] : [leagueFilter];
    const periods: Record<string, any> = {};
    for (const league of selectedLeagues) {
      const seasons = audit.leagues[league];
      const currentPlayers = audit.playersWithCurrentStatsByLeague?.[league] ?? 0;
      const mode = requestedSeason === 'latest'
        ? (currentPlayers > 0 ? 'current' : 'previous') : requestedSeason;
      const selected = mode === 'two' ? seasons : [seasons[mode === 'current' ? 0 : 1]];
      periods[league] = {
        mode, label: selected.map((s: any) => s.name).join(' + '),
        seasons: selected, complete: selected.every((s: any) => s.complete),
      };
    }
    const playersByPos: Record<string, any[]> = {};
    rawPlayers.forEach((p: any) => {
      const period = periods[p.league];
      if (!period) return;
      const stats = period.mode === 'two' ? p.twoSeasons : period.mode === 'previous' ? p.previousSeason : p.currentSeason;
      if (!stats || safeNumber(stats.minutesPlayed) === null || stats.minutesPlayed <= 0) return;
      const pos: Position = ['GK', 'DF', 'MF', 'FW'].includes(p.position) ? p.position : 'UNKNOWN';
      const key = `${p.league}:${pos}`;
      (playersByPos[key] ||= []).push({ ...p, position: pos, stats,
        statsSeasonType: period.mode, period, roleMetrics: roleMetrics(pos, stats) });
    });

    const enrichedPlayers: any[] = [];

    const roleKeys: Record<Position, string[]> = {
      // Only metrics currently backed by the dataset are used in role profiles.
      // duelWinPct / aerialWinPct stay available as raw fields when a source
      // provides them, but they are not part of the score until coverage exists.
      UNKNOWN: [],
      GK: ['savesPer90', 'passAccPct'],
      DF: ['tacklesPer90', 'interceptionsPer90', 'passAccPct', 'dribbleSuccessPct', 'keyPassesPer90'],
      MF: ['keyPassesPer90', 'assistsPer90', 'dribbleSuccessPct', 'tacklesPer90', 'passAccPct'],
      FW: ['goalsPer90', 'assistsPer90', 'shotsPer90', 'keyPassesPer90', 'dribbleSuccessPct'],
    };

    Object.values(playersByPos).forEach((group) => {
      const pos = group[0].position as Position;
      if (!group.length) return;
      const keys = roleKeys[pos];
      const distributions: Record<string, (number | null)[]> = {};
      keys.forEach((key) => {
        distributions[key] = group.map((item) =>
          eligibleMetric(item.stats, key, true)
            ? item.roleMetrics[key]
            : null
        );
      });

      const roleBenchmarks = Object.fromEntries(keys.map(key => {
        const values = distributions[key].filter((v): v is number => v !== null && Number.isFinite(v));
        return [key, { count: values.length,
          mean: values.length >= 3 ? values.reduce((a,b) => a+b,0) / values.length : null,
          max: values.length >= 3 ? Math.max(...values) : null }];
      }));

      group.forEach((p) => {
        const hasReliableSample = safeNumber(p.stats?.minutesPlayed) !== null && p.stats.minutesPlayed >= MIN_PERCENTILE_MINUTES;

        // A player's percentile can still be shown with a small personal sample,
        // but the comparison benchmark itself only uses players with >= 450 minutes.
        // This keeps the radar visible while clearly separating sample reliability
        // from the percentile calculation.
        const values = keys.map((key) => {
          const benchmark = distributions[key].filter((v): v is number => v !== null && Number.isFinite(v));
          if (benchmark.length < 3 || !eligibleMetric(p.stats, key)) return null;
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
        const adjustedValues = values.map((v, i) =>
          v === null ? null : Math.round(50 + (v - 50) * Math.min(1, metricDetail(p.stats, keys[i]).minutes / MIN_PERCENTILE_MINUTES))
        );
        const adjustedAvailable = adjustedValues.filter((v): v is number => v !== null);
        const adjustedRoleScore = adjustedAvailable.length >= minRoleMetrics
          ? Math.round(adjustedAvailable.reduce((a, b) => a + b, 0) / adjustedAvailable.length)
          : null;

        const metricSignals = keys.map((key, index) => ({
          key,
          value: p.roleMetrics[key] ?? null,
          percentile: values[index] ?? null,
          adjustedScore: adjustedValues[index] ?? null,
          rawPercentile: values[index] ?? null,
        }));

        const attackingKeys = ['goalsPer90', 'assistsPer90', 'shotsPer90', 'keyPassesPer90'];
        const attackingPercentiles = (pos === 'FW' || pos === 'MF') ? attackingKeys.map((key) => {
          const benchmark = group
            .filter((item) =>
              eligibleMetric(item.stats, key, true)
            )
            .map((item) => item.roleMetrics[key])
            .filter((v): v is number => v !== null && Number.isFinite(v));

          if (benchmark.length < 3 || !eligibleMetric(p.stats, key)) return null;
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
          .filter((item): item is { key: string; value: number; percentile: number; rawPercentile: number | null; adjustedScore: number | null } =>
            item.value !== null && item.percentile !== null
          )
          .sort((a, b) => b.percentile - a.percentile);

        const strengths = rankedSignals.filter((item) => item.percentile >= 75);
        const watchouts = rankedSignals
          .filter((item) => item.percentile < 40)
          .sort((a, b) => a.percentile - b.percentile);

        const benchmarkPlayers = group.filter((item) =>
          keys.some(key => eligibleMetric(item.stats, key, true) && item.roleMetrics[key] !== null)
        ).length;

        const metricCoverage = available.length;
        const mediumCoverageThreshold = pos === 'GK' ? 2 : 4;
        const highCoverageThreshold = pos === 'GK' ? 2 : 5;
        const confidence =
          !p.period.complete || !hasReliableSample || metricCoverage < mediumCoverageThreshold || keys.some(key => metricDetail(p.stats, key).status !== 'complete')
            ? 'low'
            : p.stats.minutesPlayed >= 900 && metricCoverage >= highCoverageThreshold
              ? 'high'
              : 'medium';

        const radar = { m1: values[0] ?? null, m2: values[1] ?? null, m3: values[2] ?? null, m4: values[3] ?? null, m5: values[4] ?? null, m6: values[5] ?? null };
        const adjustedRadar = { m1: adjustedValues[0] ?? null, m2: adjustedValues[1] ?? null, m3: adjustedValues[2] ?? null, m4: adjustedValues[3] ?? null, m5: adjustedValues[4] ?? null, m6: adjustedValues[5] ?? null };
        const marketVal = formatMarketValue(safeNumber(p.marketValueCurrency));
        const detailed = detailedPositions[String(p.sofaId)] || null;
        const birth = typeof p.dateOfBirthTimestamp === 'number' ? new Date(p.dateOfBirthTimestamp * 1000) : null;
        const now = new Date();
        const age = birth && Number.isFinite(birth.getTime()) && birth <= now
          ? now.getUTCFullYear() - birth.getUTCFullYear() - (now.getUTCMonth() < birth.getUTCMonth() || (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate()) ? 1 : 0)
          : null;

        enrichedPlayers.push({
          id: `${p.league || 'UZB'}-${p.sofaId}`,
          league: p.league || 'UZB',
          countryCode: p.countryCode ?? null,
          name: { uz: p.name, ru: p.name },
          age,
          isU21: age === null ? null : age <= 21,
          isLegionnaire: p.isLegionnaire ?? null,
          isEstimatedMarketValue: false,
          club: /^no team$/i.test(String(p.club || '').trim())
            ? { uz: 'Jamoasiz', ru: 'Без клуба' }
            : { uz: p.club ?? '—', ru: p.club ?? '—' },
          clubSource: p.clubSource,
          clubObservedAt: p.clubObservedAt,
          profileObservedAt: p.profileObservedAt,
          position: pos,
          sourcePosition: pos,
          analyticalRole: analyticalRole.role,
          analyticalRoleIsCalculated: analyticalRole.role === 'ATTACKING_MIDFIELDER',
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
          statsSeasonType: p.statsSeasonType,
          statsSeasonLabel: p.period.label,
          statsCoverageComplete: p.period.complete,
          statsDateFrom: p.stats.dateFrom,
          statsDateTo: p.stats.dateTo,
          statsEventIds: p.stats.eventIds,
          statsMetricCoverage: p.stats.metricCoverage,
          statsMetricDetails: p.stats.metricDetails || {},
          statsSeasonIds: p.period.seasons.map((s: any) => s.id),
          roleMetricCoverage: Object.fromEntries(Object.keys(roleSources).map(key => [key, metricDetail(p.stats, key)])),
          marketValue: marketVal.formatted,
          rawMarketValueEUR: marketVal.raw,
          photoUrl: `https://img.sofascore.com/api/v1/player/${p.sofaId}/image`,
          initials: (p.shortName || p.name || 'UZ').split(' ').map((n: string) => n[0]).join('').slice(0, 2),
          scoutIndex: adjustedRoleScore,
          scoutIndexIsCalculated: scoutIndex !== null,
          scoutIndexBasis: 'Среднее ролевых процентилей с поправкой на покрытые минуты. База: ≥450 покрытых минут и ≥80% минут выборки; оценка игрока: ≥90 минут и ≥60%. Набор метрик может различаться.',
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
            benchmarkByMetric: Object.fromEntries(keys.map(key => [key, distributions[key].filter(v => v !== null).length])),
            benchmarkMinMinutes: MIN_PERCENTILE_MINUTES,
            isLowSample: !hasReliableSample,
            strengths: strengths.slice(0, 3),
            watchouts: watchouts.slice(0, 3),
            missingMetrics: metricSignals.filter((item) => item.value === null).map((item) => item.key),
          },
          tags: [p.club, pos, p.isLegionnaire === null ? null : p.isLegionnaire ? 'Legioner' : 'Local'].filter(Boolean),
          minutesPlayed: p.stats.minutesPlayed,
          matchesPlayed: p.stats.matchesPlayed,
          goals: observed(p.stats, 'goals'),
          assists: observed(p.stats, 'assists'),
          xG: observed(p.stats, 'xG'),
          xA: observed(p.stats, 'xA'),
          shots: observed(p.stats, 'shots'),
          keyPasses: observed(p.stats, 'keyPasses'),
          goalsPer90: observedPer90(p.stats, 'goals'),
          assistsPer90: observedPer90(p.stats, 'assists'),
          shotsPer90: observedPer90(p.stats, 'shots'),
          keyPassesPer90: observedPer90(p.stats, 'keyPasses'),
          passAccPct: observed(p.stats, 'passAccPct'),
          dribbleSuccessRate: pos === 'GK' ? null : observed(p.stats, 'dribbleSuccessRate'),
          dribbleWon: observed(p.stats, 'dribbleWon'),
          dribbleTotal: observed(p.stats, 'dribbleTotal'),
          duelWinRate: observed(p.stats, 'duelWinPct'),
          progressiveRuns: null,
          aerialWinRate: observed(p.stats, 'aerialWinPct'),
          tackles: observed(p.stats, 'tackles'),
          interceptions: observed(p.stats, 'interceptions'),
          saves: observed(p.stats, 'saves'),
          roleMetrics: p.roleMetrics,
          roleBenchmarks,
          radar,
        });
      });
    });

    return NextResponse.json(enrichedPlayers, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-Data-Metadata': JSON.stringify({ periods, unlinkedLineups: audit.unlinkedLineups }),
      },
    });
  } catch (error: any) {
    console.error('Ошибка в route.ts:', error.message);
    return NextResponse.json({ error: 'DATA_READ_FAILED' }, { status: 500 });
  }
}