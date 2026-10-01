import type { Player, RoleRadarMetrics } from '../types/players';

export function getBudgetReplacements(selectedPlayer: Player | null, players: Player[]) {
    if (!selectedPlayer) return [];

    const target = selectedPlayer;
    if (target.rawMarketValueEUR === null) return [];
    const radarKeys: (keyof RoleRadarMetrics)[] = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'];

    const scored = players
      .filter((p) => p.id !== target.id && p.position === target.position && p.rawMarketValueEUR !== null && p.rawMarketValueEUR < target.rawMarketValueEUR!)
      .map((cand) => {
        const shared = radarKeys
          .map((key) => {
            const a = target.radar[key];
            const b = cand.radar[key];
            return a !== null && b !== null ? Math.abs(a - b) : null;
          })
          .filter((v): v is number => v !== null);

        if (shared.length < (target.position === 'GK' ? 2 : 3)) return null;

        const meanAbsoluteDifference = shared.reduce((sum, v) => sum + v, 0) / shared.length;
        const similarity = Math.round(Math.max(0, 100 - meanAbsoluteDifference));

        const hasBothValues = target.rawMarketValueEUR !== null && cand.rawMarketValueEUR !== null;
        const costDiff = hasBothValues
          ? target.rawMarketValueEUR! - cand.rawMarketValueEUR!
          : null;

        return {
          player: cand,
          similarity,
          comparedMetrics: shared.length,
          costDiff,
          isCheaper: costDiff !== null && costDiff > 0,
        };
      })
      .filter((item): item is {
        player: Player;
        similarity: number;
        comparedMetrics: number;
        costDiff: number | null;
        isCheaper: boolean;
      } => item !== null);

    return scored
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3);
  }
