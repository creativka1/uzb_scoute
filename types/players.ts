export type Position = 'FW' | 'MF' | 'DF' | 'GK' | 'UNKNOWN';
export type AnalyticalRole = 'UNKNOWN' | 'GOALKEEPER' | 'DEFENDER' | 'MIDFIELDER' | 'ATTACKING_MIDFIELDER' | 'FORWARD';
export type DetailedPosition = 'GK' | 'RB' | 'CB' | 'LB' | 'RWB' | 'LWB' | 'DM' | 'CM' | 'AM' | 'RM' | 'LM' | 'RW' | 'LW' | 'ST';
export type Language = 'uz' | 'ru';
export type League = 'UZB' | 'KAZ';
export type SeasonMode = 'latest' | 'current' | 'previous' | 'two';
export type SortField = 'value' | 'age' | 'scout';
export type SortOrder = 'asc' | 'desc';
export type MainView = 'players' | 'recruitment' | 'saved' | 'team';
export type FootFilter = 'all' | 'Right' | 'Left' | 'Both';
export type NationalityFilter = 'all' | 'local' | 'legionnaire';

export interface RoleRadarMetrics {
  m1: number | null;
  m2: number | null;
  m3: number | null;
  m4: number | null;
  m5: number | null;
  m6: number | null;
}

export interface ScoutingMetricSignal {
  key: string;
  value: number;
  percentile: number;
}

export interface ScoutingEngine {
  rawRoleScore: number | null;
  roleScore: number | null;
  rawAttackingScore?: number | null;
  attackingScore: number | null;
  sampleWeight: number;
  adjustedRadar: RoleRadarMetrics;
  confidence: 'low' | 'medium' | 'high';
  metricCoverage: number;
  totalRoleMetrics: number;
  benchmarkPlayers: number;
  benchmarkByMetric: Record<string, number>;
  benchmarkMinMinutes: number;
  isLowSample: boolean;
  strengths: ScoutingMetricSignal[];
  watchouts: ScoutingMetricSignal[];
  missingMetrics: string[];
}

export interface MetricDetail {
  value: number | null; per90: number | null; matches: number; totalMatches: number;
  minutes: number; totalMinutes: number; eventIds: number[];
  status: 'missing' | 'partial' | 'complete'; reason?: string | null;
}
export interface ValidatedSupplement {
  source: 'FootyStats';
  footystatsPlayerId: number;
  validation: { comparable: number; aligned: number };
  metrics: Record<string, number | null>;
}

export interface Player {
  id: string;
  league: League;
  name: { uz: string; ru: string };
  age: number | null;
  isU21: boolean | null;
  isLegionnaire: boolean | null;
  club: { uz: string; ru: string };
  position: Position;
  sourcePosition: Position;
  analyticalRole: AnalyticalRole;
  analyticalRoleIsCalculated: boolean;
  analyticalRoleBasis: string;
  detailedPosition: DetailedPosition | null;
  detailedPositionConfidence: 'low' | 'medium' | 'high' | null;
  detailedPositionStartsUsed: number;
  detailedPositionPrimaryShare: number | null;
  detailedPositionDistribution: Record<string, number>;
  detailedPositionSecondary: { position: DetailedPosition; starts: number; share: number }[];
  detailedPositionHeatmapMatchesAvailable: number;
  detailedPositionHeatmapMatchesValidated: number;
  detailedPositionMethod: string | null;
  number: number | null;
  height: number | null;
  preferredFoot: 'Right' | 'Left' | 'Both' | string;
  marketValue: string;
  rawMarketValueEUR: number | null;
  isEstimatedMarketValue?: boolean;
  countryCode?: string | null;
  contractUntil: string;
  statsMetricDetails?: Record<string, MetricDetail>;
  roleMetricCoverage?: Record<string, MetricDetail>;
  statsSeasonIds?: number[];
  statsSeasonType: 'current' | 'previous' | 'two';
  statsSeasonLabel: string;
  statsCoverageComplete: boolean;
  clubSource: 'profile' | 'last_match' | null;
  clubObservedAt: number | null;
  statsDateFrom: number | null;
  statsDateTo: number | null;
  photoUrl: string;
  initials: string;
  scoutIndex: number | null;
  scoutIndexBasis?: string;
  scoutingEngine: ScoutingEngine;
  tags: string[];
  minutesPlayed: number;
  matchesPlayed: number;
  goals: number | null;
  assists: number | null;
  xG: number | null;
  xA: number | null;
  shots: number | null;
  keyPasses: number | null;
  goalsPer90: number | null;
  assistsPer90: number | null;
  shotsPer90: number | null;
  keyPassesPer90: number | null;
  passAccPct: number | null;
  dribbleSuccessRate: number | null;
  dribbleWon: number | null;
  dribbleTotal: number | null;
  duelWinRate: number | null;
  progressiveRuns: number | null;
  aerialWinRate: number | null;
  tackles: number | null;
  interceptions: number | null;
  saves: number | null;
  roleMetrics?: Record<string, number | null>;
  roleBenchmarks?: Record<string, {mean:number|null;max:number|null;count:number}>;
  validatedSupplement?: ValidatedSupplement | null;
  radar: RoleRadarMetrics;
}

