import type { Player, RoleRadarMetrics } from '../types/players';

/** Relative statistical similarity, not a probability of a successful transfer. */
export function getSimilarPlayers(target: Player | null, players: Player[], cheaperOnly = false) {
  if (!target || target.position === 'UNKNOWN' || (cheaperOnly && target.rawMarketValueEUR === null)) return [];
  const keys: (keyof RoleRadarMetrics)[] = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'];
  const period = (p: Player) => JSON.stringify(p.statsSeasonIds ?? [p.statsSeasonLabel]);
  // Fix the axes for this search: all candidates use exactly the same metrics.
  const axes = keys.filter(k => target.radar[k] !== null);
  if (axes.length < (target.position === 'GK' ? 2 : 3)) return [];
  return players.filter(p => p.id !== target.id && p.position === target.position && p.league === target.league && period(p) === period(target))
    .filter(p => !cheaperOnly || (p.rawMarketValueEUR !== null && p.rawMarketValueEUR < target.rawMarketValueEUR!))
    .flatMap(player => {
      if (axes.some(k => player.radar[k] === null)) return [];
      const distance = axes.reduce((sum, k) => sum + Math.abs(target.radar[k]! - player.radar[k]!), 0) / axes.length;
      const costDiff = target.rawMarketValueEUR !== null && player.rawMarketValueEUR !== null ? target.rawMarketValueEUR - player.rawMarketValueEUR : null;
      return [{player, similarity: Math.round(Math.max(0, 100 - distance)), comparedMetrics: axes.length,
        costDiff, isCheaper: costDiff !== null && costDiff > 0}];
    }).sort((a,b) => b.similarity - a.similarity || a.player.id.localeCompare(b.player.id)).slice(0, 6);
}
export function getBudgetReplacements(target: Player | null, players: Player[]) {
  return getSimilarPlayers(target, players, true).slice(0, 3);
}
