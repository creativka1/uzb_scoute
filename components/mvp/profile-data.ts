import type { Player, Position, RoleRadarMetrics } from '@/types/players';
import { metricValue, MVP_METRICS } from '@/lib/mvp';

export const PROFILE_METRICS = [
  { key: 'matchesPlayed', label: 'Матчи', decimals: 0 },
  { key: 'minutesPlayed', label: 'Минуты', decimals: 0 },
  { key: 'goals', label: 'Голы', decimals: 0, source: 'goals', rate: 'goalsPer90' },
  { key: 'assists', label: 'Ассисты', decimals: 0, source: 'assists', rate: 'assistsPer90' },
  { key: 'xG', label: 'xG', decimals: 2, source: 'xG' },
  { key: 'xA', label: 'xA', decimals: 2, source: 'xA' },
  { key: 'keyPassesPer90', label: 'Передачи под удар / 90', decimals: 2, source: 'keyPasses' },
  { key: 'dribbleSuccessPct', label: 'Успешный дриблинг, %', decimals: 1, source: 'dribbleSuccessRate' },
] as const;

export const COMPARISON_METRICS = [
  { key: 'goals', label: 'Голы', decimals: 0, source: 'goals' },
  { key: 'assists', label: 'Ассисты', decimals: 0, source: 'assists' },
  ...MVP_METRICS.map(metric => ({ ...metric, label: metric.key === 'assistsPer90' ? 'Ассисты / 90' : metric.label })),
] as const;

export function displayMetricValue(player: Player, key: string): number | null {
  // Totals come directly from the source. Never reconstruct them from /90.
  const direct = ['matchesPlayed', 'minutesPlayed', 'goals', 'assists', 'xG', 'xA'];
  const value = direct.includes(key) ? player[key as keyof Player] : metricValue(player, key);
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function samePeriod(a: Player, b: Player) {
  return Boolean(a.statsSeasonIds?.length && b.statsSeasonIds?.length) &&
    [...a.statsSeasonIds!].sort().join(',') === [...b.statsSeasonIds!].sort().join(',') &&
    a.statsSeasonType === b.statsSeasonType;
}

export function positionPeers(player: Player, players: Player[]): Player[] {
  if (player.position === 'UNKNOWN') return [];
  return [...new Map(players.filter(peer => peer.league === player.league &&
    peer.position === player.position && samePeriod(player, peer)).map(peer => [peer.id, peer])).values()];
}

export function positionRank(player: Player, players: Player[]) {
  if (player.scoutIndex === null || !Number.isFinite(player.scoutIndex)) return null;
  const peers = positionPeers(player, players).filter(peer => peer.scoutIndex !== null && Number.isFinite(peer.scoutIndex));
  if (peers.length < 2 || !peers.some(peer => peer.id === player.id)) return null;
  return { rank: 1 + peers.filter(peer => peer.scoutIndex! > player.scoutIndex!).length, total: peers.length };
}

const RADAR_LABELS = ['Голы / 90', 'Ассисты / 90', 'xG / 90', 'xA / 90', 'Пасы под удар', 'Дриблинг, %', 'Точность паса', 'Единоборства'];

function eligible(player: Player, source: string, benchmark: boolean) {
  const detail = player.statsMetricDetails?.[source];
  // Keep the existing coverage policy: 450 covered minutes / 80% for peers,
  // 90 / 60% for the displayed player. Missing coverage is not assumed complete.
  return Boolean(detail && detail.status !== 'missing' && detail.totalMinutes > 0 &&
    detail.minutes >= (benchmark ? player.scoutingEngine.benchmarkMinMinutes : 90) &&
    detail.minutes / detail.totalMinutes >= (benchmark ? .8 : .6));
}

export function radarData(player: Player, players: Player[], comparison?: Player) {
  const peers = positionPeers(player, players);
  if (comparison && (!peers.some(peer => peer.id === comparison.id) || !positionPeers(player, [comparison]).length)) return { peers: peers.length, axes: [] };
  const axes = MVP_METRICS.flatMap((metric, index) => {
    const value = metricValue(player, metric.key), other = comparison ? metricValue(comparison, metric.key) : null;
    if (value === null || !Number.isFinite(value) || !eligible(player, metric.source, false) ||
      (comparison && (other === null || !Number.isFinite(other) || !eligible(comparison, metric.source, false)))) return [];
    const values = peers.filter(peer => eligible(peer, metric.source, true)).map(peer => metricValue(peer, metric.key))
      .filter((item): item is number => item !== null && Number.isFinite(item));
    if (values.length < 3) return [];
    const percentile = (subject: number) => Math.round(100 * (values.filter(item => item < subject).length + values.filter(item => item === subject).length / 2) / values.length);
    return [{ key: metric.key, label: RADAR_LABELS[index], metricLabel: metric.label, value, otherValue: other, decimals: metric.decimals,
      score: percentile(value), other: other === null ? null : percentile(other), count: values.length }];
  });
  return { peers: peers.length, axes };
}

const ROLE_KEYS: Record<Position, string[]> = {
  UNKNOWN: [], GK: ['savesPer90', 'passAccPct'],
  DF: ['tacklesPer90', 'interceptionsPer90', 'passAccPct', 'dribbleSuccessPct', 'keyPassesPer90'],
  MF: ['keyPassesPer90', 'assistsPer90', 'dribbleSuccessPct', 'tacklesPer90', 'passAccPct'],
  FW: ['goalsPer90', 'assistsPer90', 'shotsPer90', 'keyPassesPer90', 'dribbleSuccessPct'],
};

export function scoutSignals(player: Player) {
  // Use the already calculated league role scores, not the UI radar cohort.
  const signals = ROLE_KEYS[player.position].flatMap((key, index) => {
    const score = player.scoutingEngine.adjustedRadar[`m${index + 1}` as keyof RoleRadarMetrics];
    const value = player.roleMetrics?.[key];
    return typeof score === 'number' && Number.isFinite(score) && typeof value === 'number' && Number.isFinite(value)
      ? [{ key, value, score }] : [];
  });
  return {
    strong: signals.filter(signal => signal.score >= 75).sort((a, b) => b.score - a.score).slice(0, 3),
    average: signals.filter(signal => signal.score >= 40 && signal.score < 75).sort((a, b) => b.score - a.score).slice(0, 3),
    weak: signals.filter(signal => signal.score < 40).sort((a, b) => a.score - b.score).slice(0, 2),
  };
}
