import type { Appearance, CoreMatch } from '../types/matches';

export function observedMetric(rows: Appearance[], key: string) {
  const known = rows.filter(a => typeof a.stats[key] === 'number' && Number.isFinite(a.stats[key]));
  const sum = known.length ? known.reduce((n, a) => n + a.stats[key]!, 0) : null;
  const minutes = known.reduce((n, a) => n + a.minutes, 0);
  return {value: sum, per90: sum !== null && minutes > 0 ? sum / minutes * 90 : null,
    matches: known.length, totalMatches: rows.length, minutes};
}
export function teamWindow(matches: CoreMatch[], teamId: number) {
  const known = matches.filter(m => m.homeScore !== null && m.awayScore !== null);
  if (!known.length) return {played: matches.length, scored: 0, pointsPerMatch: null, goalsFor: null, goalsAgainst: null};
  let points = 0, goalsFor = 0, goalsAgainst = 0;
  for (const m of known) {
    const gf = m.homeTeamId === teamId ? m.homeScore! : m.awayScore!;
    const ga = m.homeTeamId === teamId ? m.awayScore! : m.homeScore!;
    goalsFor += gf; goalsAgainst += ga; points += gf > ga ? 3 : gf === ga ? 1 : 0;
  }
  return {played: matches.length, scored: known.length, pointsPerMatch: points / known.length, goalsFor, goalsAgainst};
}
export function teamRoster(rows: Appearance[]) {
  const grouped = new Map<number, Appearance[]>();
  for (const a of rows) grouped.set(a.playerId, [...(grouped.get(a.playerId) || []), a]);
  return [...grouped].map(([id, list]) => ({id, appearances: list.length,
    minutes: list.reduce((n,a) => n + a.minutes, 0),
    starts: list.some(a => a.substitute !== null) ? list.filter(a => a.substitute === false).length : null,
    startsCovered: list.filter(a => a.substitute !== null).length,
    positions: [...new Set(list.map(a => a.position).filter(Boolean))],
  })).sort((a,b) => b.minutes-a.minutes);
}
