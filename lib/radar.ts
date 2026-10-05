import type { Player, Position } from "@/types/players";
export const radarMetrics: Record<Position, string[]> = {
  UNKNOWN: [],
  GK: ["savesPer90", "passAccPct"],
  DF: [
    "tacklesPer90",
    "interceptionsPer90",
    "passAccPct",
    "dribbleSuccessPct",
    "keyPassesPer90",
  ],
  MF: [
    "keyPassesPer90",
    "assistsPer90",
    "dribbleSuccessPct",
    "tacklesPer90",
    "passAccPct",
  ],
  FW: [
    "goalsPer90",
    "assistsPer90",
    "shotsPer90",
    "keyPassesPer90",
    "dribbleSuccessPct",
  ],
};
const finite = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 100;
export function radarSeries(player: Player, comparison?: Player) {
  const all = radarMetrics[player.position].map((key, i) => ({
    key,
    value: player.radar[`m${i + 1}` as keyof Player["radar"]],
    other: comparison?.radar[`m${i + 1}` as keyof Player["radar"]] ?? null,
  }));
  const available = all.filter((a): a is typeof a & { value: number } =>
    finite(a.value),
  );
  const compatible =
    !!comparison &&
    player.position === comparison.position &&
    player.league === comparison.league &&
    JSON.stringify(player.statsSeasonIds) ===
      JSON.stringify(comparison.statsSeasonIds);
  const shared = compatible ? available.filter((a) => finite(a.other)) : [];
  const compare = shared.length >= 3;
  return {
    axes: compare ? shared : available,
    missing: all.filter((a) => !finite(a.value)).map((a) => a.key),
    compare,
    total: all.length,
  };
}
