import type { Player, Position, DetailedPosition, RoleRadarMetrics, MetricDetail } from '../types/players';
import type { TeamNeed } from '../types/decisions';

export const SIMILARITY_VERSION = 'weighted-v1' as const;
export const SIMILARITY_CATEGORIES = {
  attack: 'Атака', creation: 'Создание', progression: 'Продвижение',
  possession: 'Владение', duels: 'Единоборства', defence: 'Оборона',
} as const;
export type SimilarityCategory = keyof typeof SIMILARITY_CATEGORIES;

// Rate denominators always come from observed metric minutes, never total
// season minutes. Additional metrics are source-backed counts/rates, not radar axes.
export const SIMILARITY_METRICS = [
  { key: 'goalsPer90', source: 'goals', category: 'attack', rate: true },
  { key: 'assistsPer90', source: 'assists', category: 'creation', rate: true },
  { key: 'xGPer90', source: 'xG', category: 'attack', rate: true },
  { key: 'xAPer90', source: 'xA', category: 'creation', rate: true },
  { key: 'shotsPer90', source: 'shots', category: 'attack', rate: true },
  { key: 'keyPassesPer90', source: 'keyPasses', category: 'creation', rate: true },
  { key: 'passAccPct', source: 'passAccPct', category: 'possession', rate: false },
  { key: 'dribbleSuccessPct', source: 'dribbleSuccessRate', category: 'possession', rate: false },
  { key: 'duelWinPct', source: 'duelWinPct', category: 'duels', rate: false },
  { key: 'aerialWinPct', source: 'aerialWinPct', category: 'duels', rate: false },
  { key: 'tacklesPer90', source: 'tackles', category: 'defence', rate: true },
  { key: 'interceptionsPer90', source: 'interceptions', category: 'defence', rate: true },
  { key: 'progressiveRunsPer90', source: 'progressiveRuns', category: 'progression', rate: true },
  { key: 'progressivePassesPer90', source: 'progressivePasses', category: 'progression', rate: true },
  { key: 'progressiveCarriesPer90', source: 'progressiveCarries', category: 'progression', rate: true },
  { key: 'successfulDribblesPer90', source: 'dribbleWon', category: 'possession', rate: true },
  { key: 'passesPer90', source: 'totalPass', category: 'possession', rate: true },
  { key: 'accuratePassesPer90', source: 'accuratePass', category: 'possession', rate: true },
  { key: 'duelsWonPer90', source: 'duelWon', category: 'duels', rate: true },
  { key: 'aerialDuelsWonPer90', source: 'aerialWon', category: 'duels', rate: true },
  { key: 'savesPer90', source: 'saves', category: 'defence', rate: true },
] as const;
type SimilarityMetric = typeof SIMILARITY_METRICS[number];
type SimilarityWeights = Partial<Record<SimilarityMetric['key'], number>>;
const midfieldWeights: SimilarityWeights = {
  goalsPer90: 4, assistsPer90: 5, xGPer90: 5, xAPer90: 6, shotsPer90: 2, keyPassesPer90: 7,
  passAccPct: 5, dribbleSuccessPct: 4, duelWinPct: 3, aerialWinPct: 1, tacklesPer90: 4, interceptionsPer90: 3,
  progressiveRunsPer90: 2, progressivePassesPer90: 3, progressiveCarriesPer90: 2,
  successfulDribblesPer90: 1, passesPer90: 1, accuratePassesPer90: 1, duelsWonPer90: 1, aerialDuelsWonPer90: .5,
};
const defenderWeights: SimilarityWeights = { ...midfieldWeights, goalsPer90: 4, assistsPer90: 5, xGPer90: 5,
  xAPer90: 2, shotsPer90: 1, keyPassesPer90: 2, passAccPct: 7, dribbleSuccessPct: 1,
  duelWinPct: 8, aerialWinPct: 8, tacklesPer90: 10, interceptionsPer90: 10,
  progressiveRunsPer90: 1, progressivePassesPer90: 2, progressiveCarriesPer90: 1,
  successfulDribblesPer90: .5, duelsWonPer90: 2, aerialDuelsWonPer90: 2 };
const forwardWeights: SimilarityWeights = { ...midfieldWeights, goalsPer90: 10, assistsPer90: 5, xGPer90: 10,
  xAPer90: 3, shotsPer90: 8, keyPassesPer90: 4, passAccPct: 2, dribbleSuccessPct: 3,
  duelWinPct: 3, aerialWinPct: 5, tacklesPer90: 1, interceptionsPer90: 1,
  progressiveRunsPer90: 1, progressivePassesPer90: 1, progressiveCarriesPer90: 1,
  passesPer90: .5, accuratePassesPer90: .5, duelsWonPer90: .5 };

// These weights belong only to Similarity. Scout Index and need-fit profiles
// below remain independent. Expected weights include unavailable metrics, so
// coverage cannot inflate by silently dropping missing fields from the role.
export const SIMILARITY_PROFILES: Record<NeedProfileKey, SimilarityWeights> = {
  MF: midfieldWeights,
  CM: { ...midfieldWeights, passAccPct: 7, tacklesPer90: 6, interceptionsPer90: 4 },
  AM: { ...midfieldWeights, goalsPer90: 5, assistsPer90: 8, xGPer90: 6, xAPer90: 9, shotsPer90: 3,
    keyPassesPer90: 10, passAccPct: 3, dribbleSuccessPct: 7, duelWinPct: 1, aerialWinPct: .5,
    tacklesPer90: 1, interceptionsPer90: 1, progressiveRunsPer90: 3, progressiveCarriesPer90: 3,
    successfulDribblesPer90: 2, passesPer90: .5, accuratePassesPer90: .5, duelsWonPer90: .5, aerialDuelsWonPer90: .25 },
  DM: { ...midfieldWeights, goalsPer90: 4, assistsPer90: 6, xGPer90: 5, xAPer90: 3, shotsPer90: 1,
    keyPassesPer90: 4, passAccPct: 9, dribbleSuccessPct: 3, duelWinPct: 7, aerialWinPct: 4,
    tacklesPer90: 10, interceptionsPer90: 10, progressiveRunsPer90: 1, progressivePassesPer90: 4,
    progressiveCarriesPer90: 1, successfulDribblesPer90: .5, duelsWonPer90: 2, aerialDuelsWonPer90: 1 },
  DF: defenderWeights, CB: defenderWeights,
  FB_WB: { ...defenderWeights, goalsPer90: 5, xGPer90: 6, xAPer90: 6, keyPassesPer90: 7, dribbleSuccessPct: 5,
    aerialWinPct: 3, interceptionsPer90: 6, progressiveRunsPer90: 3, progressiveCarriesPer90: 3 },
  FW: forwardWeights, ST: forwardWeights,
  WINGER: { ...midfieldWeights, goalsPer90: 6, assistsPer90: 8, xGPer90: 7, xAPer90: 7, shotsPer90: 5,
    keyPassesPer90: 9, passAccPct: 3, dribbleSuccessPct: 8, duelWinPct: 2, tacklesPer90: 2,
    interceptionsPer90: 1, progressiveRunsPer90: 3, progressiveCarriesPer90: 3, successfulDribblesPer90: 2 },
  GK: { savesPer90: 10, passAccPct: 4, passesPer90: 1, accuratePassesPer90: 1,
    aerialWinPct: 2, aerialDuelsWonPer90: 1, progressivePassesPer90: 1 },
};

function similarityRole(player: Player): NeedProfileKey | null {
  if (player.position === 'UNKNOWN') return null;
  if (player.position === 'GK') return 'GK';
  const detailed = player.detailedPosition;
  if (detailed === 'CB') return 'CB';
  if (detailed && ['RB', 'LB', 'RWB', 'LWB'].includes(detailed)) return 'FB_WB';
  if (detailed && ['RM', 'LM', 'RW', 'LW'].includes(detailed)) return 'WINGER';
  if (detailed === 'DM' || detailed === 'CM' || detailed === 'AM' || detailed === 'ST') return detailed;
  if (player.position === 'MF' && player.analyticalRole === 'ATTACKING_MIDFIELDER') return 'AM';
  return player.position;
}
function similarityPeriod(player: Player): string | null {
  const ids = player.statsSeasonIds;
  if (ids?.length) return JSON.stringify([...new Set(ids)].sort((a, b) => a - b));
  return player.statsSeasonLabel?.trim() ? JSON.stringify(player.statsSeasonLabel.trim()) : null;
}
function comparableSimilarity(a: Player, b: Player): boolean {
  const period = similarityPeriod(a), role = similarityRole(a);
  return role !== null && role === similarityRole(b) && a.position === b.position && a.league === b.league &&
    period !== null && period === similarityPeriod(b) && a.statsSeasonType === b.statsSeasonType;
}
function similarityObservation(player: Player, metric: SimilarityMetric): { value: number; minutes: number } | null {
  const detail: MetricDetail | undefined = player.statsMetricDetails?.[metric.source] ?? player.roleMetricCoverage?.[metric.key];
  if (!detail || detail.status === 'missing' || !Number.isFinite(detail.minutes) || detail.minutes <= 0) return null;
  const field = metric.rate ? 'per90' : 'value';
  // Explicit null observations take precedence over any stale top-level value.
  const value = field in detail ? detail[field] : player.roleMetrics?.[metric.key];
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return { value, minutes: detail.minutes };
}
export interface SimilarityContribution {
  key: string; category: SimilarityCategory; weight: number; coveredMinutes: number;
  reliability: number; percentile1: number; percentile2: number; diff: number; benchmarkPlayers: number;
}
export interface SimilarityScore {
  similarity: number | null; distance: number | null; coverage: number;
  availableWeight: number; expectedWeight: number; comparedMetrics: number;
}
export interface SimilarityResult extends SimilarityScore {
  version: typeof SIMILARITY_VERSION; profileKey: NeedProfileKey | null;
  status: 'ok' | 'insufficient_data' | 'incomparable'; reason: string | null;
  subscores: Record<SimilarityCategory, SimilarityScore>; metrics: SimilarityContribution[];
}
function weightedSimilarity(metrics: SimilarityContribution[], expectedWeight: number): SimilarityScore {
  const availableWeight = metrics.reduce((sum, metric) => sum + metric.weight, 0);
  const coverage = expectedWeight > 0 ? availableWeight / expectedWeight : 0;
  const reliableWeight = metrics.reduce((sum, metric) => sum + metric.weight * metric.reliability, 0);
  const distanceSquared = reliableWeight > 0 ? metrics.reduce((sum, metric) =>
    sum + metric.weight * metric.reliability * metric.diff ** 2, 0) / reliableWeight : null;
  const sufficient = coverage >= .60 && distanceSquared !== null;
  return { similarity: sufficient ? Math.round(100 * Math.exp(-2.5 * distanceSquared!)) : null,
    distance: sufficient ? Math.sqrt(distanceSquared!) : null, coverage, availableWeight, expectedWeight, comparedMetrics: metrics.length };
}
function similarityContext(target: Player, players: Player[]) {
  const profileKey = similarityRole(target), weights = profileKey ? SIMILARITY_PROFILES[profileKey] : {};
  const expected = SIMILARITY_METRICS.filter(metric => (weights[metric.key] ?? 0) > 0);
  const peers = [...new Map([...players, target].map(player => [player.id, player])).values()]
    .filter(player => comparableSimilarity(target, player));
  const benchmarks = new Map(expected.map(metric => [metric.key, peers.map(player => similarityObservation(player, metric))
    .filter((value): value is { value: number; minutes: number } => value !== null).map(observation => observation.value)]));
  return { profileKey, weights, expected, benchmarks };
}
function compareSimilarity(target: Player, other: Player, context: ReturnType<typeof similarityContext>): SimilarityResult {
  const comparable = comparableSimilarity(target, other);
  const percentile = (values: number[], value: number) => 100 *
    (values.filter(item => item < value).length + values.filter(item => item === value).length * .5) / values.length;
  const metrics: SimilarityContribution[] = comparable ? context.expected.flatMap(metric => {
    const a = similarityObservation(target, metric), b = similarityObservation(other, metric);
    const benchmark = context.benchmarks.get(metric.key)!;
    if (!a || !b || benchmark.length < 2) return [];
    // A symmetric, conservative pair reliability: the lesser observed sample.
    const coveredMinutes = Math.min(a.minutes, b.minutes), percentile1 = percentile(benchmark, a.value), percentile2 = percentile(benchmark, b.value);
    return [{ key: metric.key, category: metric.category, weight: context.weights[metric.key]!, coveredMinutes,
      reliability: Math.min(1, Math.sqrt(coveredMinutes / 900)), percentile1, percentile2,
      diff: (percentile1 - percentile2) / 100, benchmarkPlayers: benchmark.length }];
  }) : [];
  const expectedWeight = context.expected.reduce((sum, metric) => sum + context.weights[metric.key]!, 0);
  const score = weightedSimilarity(metrics, expectedWeight);
  const subscores = Object.fromEntries((Object.keys(SIMILARITY_CATEGORIES) as SimilarityCategory[]).map(category => [category,
    weightedSimilarity(metrics.filter(metric => metric.category === category),
      context.expected.filter(metric => metric.category === category).reduce((sum, metric) => sum + context.weights[metric.key]!, 0))])) as Record<SimilarityCategory, SimilarityScore>;
  return { ...score, version: SIMILARITY_VERSION, profileKey: context.profileKey,
    status: !comparable ? 'incomparable' : score.similarity === null ? 'insufficient_data' : 'ok',
    reason: score.similarity === null ? 'Недостаточно данных' : null, subscores, metrics };
}

/** Relative weighted statistical similarity, never a transfer-success probability. */
export function calculateSimilarity(target: Player, other: Player, players: Player[]): SimilarityResult {
  return compareSimilarity(target, other, similarityContext(target, [...players, other]));
}
export function getSimilarPlayers(target: Player | null, players: Player[], cheaperOnly = false) {
  if (!target || target.position === 'UNKNOWN' || (cheaperOnly && target.rawMarketValueEUR === null)) return [];
  // Benchmark before price filtering, so a budget switch cannot change percentiles.
  const context = similarityContext(target, players);
  return [...new Map(players.map(player => [player.id, player])).values()]
    .filter(player => player.id !== target.id && comparableSimilarity(target, player))
    .filter(player => !cheaperOnly || (player.rawMarketValueEUR !== null && player.rawMarketValueEUR < target.rawMarketValueEUR!))
    .map(player => {
      const costDiff = target.rawMarketValueEUR !== null && player.rawMarketValueEUR !== null ? target.rawMarketValueEUR - player.rawMarketValueEUR : null;
      return { player, ...compareSimilarity(target, player, context), costDiff, isCheaper: costDiff !== null && costDiff > 0 };
    }).sort((a, b) => (b.similarity ?? -1) - (a.similarity ?? -1) || a.player.id.localeCompare(b.player.id)).slice(0, 6);
}
export function getBudgetReplacements(target: Player | null, players: Player[]) {
  return getSimilarPlayers(target, players, true).filter(candidate => candidate.similarity !== null).slice(0, 3);
}

export type NeedProfileKey = 'GK'|'CB'|'FB_WB'|'DM'|'CM'|'AM'|'WINGER'|'ST'|'DF'|'MF'|'FW';

type MetricWeight = Record<string, number>;
interface NeedProfile {
  key: NeedProfileKey;
  metrics: MetricWeight;
  components: {role:number;minutes:number;confidence:number;position:number};
}

const broadRoleKeys: Record<Position, string[]> = {
  UNKNOWN: [],
  GK: ['savesPer90', 'passAccPct'],
  DF: ['tacklesPer90', 'interceptionsPer90', 'passAccPct', 'dribbleSuccessPct', 'keyPassesPer90'],
  MF: ['keyPassesPer90', 'assistsPer90', 'dribbleSuccessPct', 'tacklesPer90', 'passAccPct'],
  FW: ['goalsPer90', 'assistsPer90', 'shotsPer90', 'keyPassesPer90', 'dribbleSuccessPct'],
};

const profiles: Record<NeedProfileKey, NeedProfile> = {
  GK: {
    key:'GK',
    metrics:{savesPer90:.70,passAccPct:.30},
    components:{role:.70,minutes:.12,confidence:.10,position:.08},
  },
  CB: {
    key:'CB',
    metrics:{interceptionsPer90:.30,tacklesPer90:.25,passAccPct:.30,keyPassesPer90:.10,dribbleSuccessPct:.05},
    components:{role:.65,minutes:.15,confidence:.12,position:.08},
  },
  FB_WB: {
    key:'FB_WB',
    metrics:{tacklesPer90:.23,interceptionsPer90:.15,passAccPct:.15,dribbleSuccessPct:.22,keyPassesPer90:.25},
    components:{role:.65,minutes:.12,confidence:.10,position:.13},
  },
  DM: {
    key:'DM',
    metrics:{tacklesPer90:.35,passAccPct:.30,keyPassesPer90:.15,assistsPer90:.10,dribbleSuccessPct:.10},
    components:{role:.65,minutes:.15,confidence:.10,position:.10},
  },
  CM: {
    key:'CM',
    metrics:{keyPassesPer90:.25,passAccPct:.25,tacklesPer90:.20,assistsPer90:.15,dribbleSuccessPct:.15},
    components:{role:.60,minutes:.15,confidence:.10,position:.15},
  },
  AM: {
    key:'AM',
    metrics:{keyPassesPer90:.35,assistsPer90:.25,dribbleSuccessPct:.20,passAccPct:.10,tacklesPer90:.10},
    components:{role:.65,minutes:.12,confidence:.10,position:.13},
  },
  WINGER: {
    key:'WINGER',
    // The profile spans MF and FW source positions. Missing metrics are not
    // treated as zero; available weights are renormalized transparently.
    metrics:{dribbleSuccessPct:.28,keyPassesPer90:.25,assistsPer90:.18,shotsPer90:.12,goalsPer90:.07,passAccPct:.06,tacklesPer90:.04},
    components:{role:.65,minutes:.12,confidence:.10,position:.13},
  },
  ST: {
    key:'ST',
    metrics:{goalsPer90:.35,shotsPer90:.25,dribbleSuccessPct:.20,assistsPer90:.10,keyPassesPer90:.10},
    components:{role:.68,minutes:.12,confidence:.10,position:.10},
  },
  DF: {
    key:'DF',
    metrics:{tacklesPer90:.25,interceptionsPer90:.25,passAccPct:.20,dribbleSuccessPct:.15,keyPassesPer90:.15},
    components:{role:.60,minutes:.17,confidence:.13,position:.10},
  },
  MF: {
    key:'MF',
    metrics:{keyPassesPer90:.25,assistsPer90:.20,dribbleSuccessPct:.20,tacklesPer90:.15,passAccPct:.20},
    components:{role:.60,minutes:.17,confidence:.13,position:.10},
  },
  FW: {
    key:'FW',
    metrics:{goalsPer90:.28,shotsPer90:.22,assistsPer90:.15,keyPassesPer90:.15,dribbleSuccessPct:.20},
    components:{role:.63,minutes:.15,confidence:.12,position:.10},
  },
};

function needProfile(position: Position, detailed: DetailedPosition | null): NeedProfile {
  if (position === 'GK') return profiles.GK;
  if (detailed === 'CB') return profiles.CB;
  if (detailed && ['RB','LB','RWB','LWB'].includes(detailed)) return profiles.FB_WB;
  if (detailed === 'DM') return profiles.DM;
  if (detailed === 'CM') return profiles.CM;
  if (detailed === 'AM') return profiles.AM;
  if (detailed && ['RM','LM','RW','LW'].includes(detailed)) return profiles.WINGER;
  if (detailed === 'ST') return profiles.ST;
  return position === 'DF' ? profiles.DF : position === 'MF' ? profiles.MF : position === 'FW' ? profiles.FW : profiles.GK;
}

function percentileByMetric(player: Player): Record<string, number> {
  const keys = broadRoleKeys[player.position] || [];
  const axes: (keyof RoleRadarMetrics)[] = ['m1','m2','m3','m4','m5','m6'];
  const result: Record<string, number> = {};
  keys.forEach((key,index)=>{
    const value = player.radar?.[axes[index]];
    if (typeof value === 'number' && Number.isFinite(value)) result[key] = value;
  });
  return result;
}

function calibratedRoleScore(player: Player, profile: NeedProfile) {
  const percentiles = percentileByMetric(player);
  const totalWeight = Object.values(profile.metrics).reduce((sum,value)=>sum+value,0);
  const available = Object.entries(profile.metrics)
    .filter(([key]) => typeof percentiles[key] === 'number')
    .map(([key,weight]) => ({key,weight,percentile:percentiles[key]}));
  const availableWeight = available.reduce((sum,item)=>sum+item.weight,0);
  const coverage = totalWeight > 0 ? availableWeight / totalWeight : 0;

  // Require at least two role-relevant axes before replacing the broad role
  // score. Otherwise the broad score is a safer fallback and coverage is made
  // explicit in the reasons.
  if (available.length < 2 || availableWeight <= 0) {
    return {
      score: player.scoutingEngine?.roleScore ?? 0,
      coverage,
      usedFallback: true,
      contributions: [] as {key:string;percentile:number;weight:number}[],
    };
  }

  const score = available.reduce((sum,item)=>sum+item.percentile*(item.weight/availableWeight),0);
  return {
    score: Math.round(score),
    coverage,
    usedFallback: false,
    contributions: available
      .map(item=>({key:item.key,percentile:item.percentile,weight:item.weight/availableWeight}))
      .sort((a,b)=>b.weight-a.weight),
  };
}

export const NEED_FIT_VERSION = 'role-v2' as const;

export interface NeedFitCandidate {
  player: Player;
  fitScore: number;
  fitVersion: typeof NEED_FIT_VERSION;
  profileKey: NeedProfileKey;
  profileScore: number;
  profileCoverage: number;
  reasons: string[];
}

/**
 * Need-driven shortlist ranking.
 *
 * This is a transparent prioritisation heuristic, not a probability of
 * transfer success. Role profiles only use percentiles already available in
 * the current dataset. Missing role metrics are excluded and the remaining
 * weights are renormalized; missing data is never converted to zero.
 */
export function rankPlayersForNeed(need: TeamNeed | null | undefined, players: Player[]): NeedFitCandidate[] {
  if (!need || need.status !== 'open' || need.position === 'UNKNOWN') return [];

  const normalizedTeam = need.teamName.trim().toLocaleLowerCase();
  const profile = needProfile(need.position, need.detailedPosition);

  return players
    .filter(player => player.league === need.league)
    .filter(player => player.position === need.position)
    .filter(player => !need.detailedPosition || player.detailedPosition === need.detailedPosition)
    .filter(player => player.statsSeasonIds?.includes(need.seasonId))
    .filter(player => {
      const clubNames = [player.club?.ru, player.club?.uz].filter(Boolean).map(v => String(v).trim().toLocaleLowerCase());
      return !normalizedTeam || !clubNames.includes(normalizedTeam);
    })
    .map(player => {
      const calibrated = calibratedRoleScore(player, profile);
      const minutesScore = Math.min(100, Math.max(0, (player.minutesPlayed / 900) * 100));
      const confidenceScore =
        player.scoutingEngine?.confidence === 'high' ? 100 :
        player.scoutingEngine?.confidence === 'medium' ? 72 : 42;
      const exactPositionScore = need.detailedPosition
        ? player.detailedPosition === need.detailedPosition ? 100 : 0
        : 70;

      const fitScore = Math.round(
        calibrated.score * profile.components.role +
        minutesScore * profile.components.minutes +
        confidenceScore * profile.components.confidence +
        exactPositionScore * profile.components.position
      );

      const reasons: string[] = [
        `profile:${profile.key}`,
        `profileScore:${calibrated.score}`,
        `profileCoverage:${Math.round(calibrated.coverage*100)}`,
      ];
      if (need.detailedPosition && player.detailedPosition === need.detailedPosition) reasons.push(`exact:${need.detailedPosition}`);
      if (player.scoutingEngine?.roleScore !== null) reasons.push(`role:${player.scoutingEngine.roleScore}`);
      reasons.push(`minutes:${player.minutesPlayed}`);
      reasons.push(`confidence:${player.scoutingEngine?.confidence || 'low'}`);
      if (calibrated.usedFallback) reasons.push('profileFallback:broadRoleScore');

      for (const item of calibrated.contributions.slice(0,4)) {
        reasons.push(`metric:${item.key}:${item.percentile}:${Math.round(item.weight*100)}`);
      }

      return {
        player,
        fitScore: Math.max(0, Math.min(100, fitScore)),
        fitVersion: NEED_FIT_VERSION,
        profileKey: profile.key,
        profileScore: calibrated.score,
        profileCoverage: Math.round(calibrated.coverage*100),
        reasons,
      };
    })
    .sort((a,b) => b.fitScore - a.fitScore ||
      b.profileScore - a.profileScore ||
      (b.player.scoutingEngine?.roleScore ?? -1) - (a.player.scoutingEngine?.roleScore ?? -1) ||
      a.player.id.localeCompare(b.player.id));
}
