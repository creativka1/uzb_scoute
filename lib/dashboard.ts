import type { CoreMatch } from "@/types/matches";
export function knownMatches(matches: CoreMatch[]) {
  return matches.filter(
    (m): m is CoreMatch & { homeScore: number; awayScore: number } =>
      m.homeScore !== null &&
      m.awayScore !== null &&
      Number.isFinite(m.homeScore) &&
      Number.isFinite(m.awayScore),
  );
}
export function seasonTable(matches: CoreMatch[]) {
  const table = new Map<
    number,
    {
      id: number;
      played: number;
      points: number;
      won: number;
      drawn: number;
      lost: number;
      gf: number;
      ga: number;
    }
  >();
  for (const m of knownMatches(matches))
    for (const id of [m.homeTeamId, m.awayTeamId]) {
      const home = id === m.homeTeamId,
        gf = home ? m.homeScore : m.awayScore,
        ga = home ? m.awayScore : m.homeScore;
      const r = table.get(id) || {
        id,
        played: 0,
        points: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        gf: 0,
        ga: 0,
      };
      r.played++;
      r.gf += gf;
      r.ga += ga;
      r.won += Number(gf > ga);
      r.drawn += Number(gf === ga);
      r.lost += Number(gf < ga);
      r.points += gf > ga ? 3 : gf === ga ? 1 : 0;
      table.set(id, r);
    }
  return [...table.values()].sort(
    (a, b) =>
      b.points - a.points ||
      b.gf - b.ga - (a.gf - a.ga) ||
      b.gf - a.gf ||
      a.id - b.id,
  );
}
export function teamProgress(matches: CoreMatch[], teamId: number) {
  let points = 0,
    gf = 0,
    ga = 0;
  return knownMatches(matches)
    .filter((m) => m.homeTeamId === teamId || m.awayTeamId === teamId)
    .sort((a, b) => a.date - b.date || a.id - b.id)
    .map((m) => {
      const scored = m.homeTeamId === teamId ? m.homeScore : m.awayScore,
        conceded = m.homeTeamId === teamId ? m.awayScore : m.homeScore;
      points += scored > conceded ? 3 : scored === conceded ? 1 : 0;
      gf += scored;
      ga += conceded;
      return { id: m.id, date: m.date, points, gf, ga };
    });
}
export function monthlyGoals(matches: CoreMatch[]) {
  const months = new Map<
    string,
    { date: string; goals: number; matches: number }
  >();
  for (const m of knownMatches(matches)) {
    const date = new Date(m.date * 1000).toISOString().slice(0, 7);
    const r = months.get(date) || { date, goals: 0, matches: 0 };
    r.goals += m.homeScore + m.awayScore;
    r.matches++;
    months.set(date, r);
  }
  return [...months.values()].sort((a, b) => a.date.localeCompare(b.date));
}
