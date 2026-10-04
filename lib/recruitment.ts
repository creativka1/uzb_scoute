import type { Player, RoleRadarMetrics } from '../types/players';
import type { TeamNeed } from '../types/decisions';

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

export interface NeedFitCandidate {
  player: Player;
  fitScore: number;
  reasons: string[];
}

/**
 * Need-driven shortlist ranking.
 *
 * This is a transparent heuristic, not a probability of transfer success.
 * Eligibility is strict (league, season and requested position). The score
 * rewards role quality, sample reliability and exact detailed-position fit.
 */
export function rankPlayersForNeed(need: TeamNeed | null | undefined, players: Player[]): NeedFitCandidate[] {
  if (!need || need.status !== 'open' || need.position === 'UNKNOWN') return [];

  const normalizedTeam = need.teamName.trim().toLocaleLowerCase();
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
      const role = player.scoutingEngine?.roleScore ?? 0;
      const minutesScore = Math.min(100, Math.max(0, (player.minutesPlayed / 900) * 100));
      const confidenceScore =
        player.scoutingEngine?.confidence === 'high' ? 100 :
        player.scoutingEngine?.confidence === 'medium' ? 72 : 42;
      const exactPositionScore = need.detailedPosition
        ? player.detailedPosition === need.detailedPosition ? 100 : 0
        : 70;

      const fitScore = Math.round(
        role * 0.55 +
        minutesScore * 0.20 +
        confidenceScore * 0.15 +
        exactPositionScore * 0.10
      );

      const reasons: string[] = [];
      if (need.detailedPosition && player.detailedPosition === need.detailedPosition) reasons.push(`exact:${need.detailedPosition}`);
      if (player.scoutingEngine?.roleScore !== null) reasons.push(`role:${player.scoutingEngine.roleScore}`);
      reasons.push(`minutes:${player.minutesPlayed}`);
      reasons.push(`confidence:${player.scoutingEngine?.confidence || 'low'}`);

      const strongest = (player.scoutingEngine?.strengths || [])
        .filter(signal => signal.percentile !== null)
        .sort((a,b) => (b.percentile ?? -1) - (a.percentile ?? -1))
        .slice(0,2);
      for (const signal of strongest) reasons.push(`strength:${signal.key}:${signal.percentile}`);

      return {player, fitScore: Math.max(0, Math.min(100, fitScore)), reasons};
    })
    .sort((a,b) => b.fitScore - a.fitScore ||
      (b.player.scoutingEngine?.roleScore ?? -1) - (a.player.scoutingEngine?.roleScore ?? -1) ||
      a.player.id.localeCompare(b.player.id));
}
