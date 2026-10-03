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

export function metricCoverage(rows:Appearance[],key:string){
  const eligible=rows.filter(a=>key!=='saves'||a.position==='GK');
  const known=eligible.filter(a=>typeof a.stats[key]==='number'&&Number.isFinite(a.stats[key]));
  return {known:known.length,total:eligible.length,minutes:known.reduce((s,a)=>s+a.minutes,0),totalMinutes:eligible.reduce((s,a)=>s+a.minutes,0)};
}

export function minuteDistribution(rows:Appearance[]){
  const roster=teamRoster(rows),total=roster.reduce((n,p)=>n+p.minutes,0);
  return roster.map(p=>({...p,share:total>0?p.minutes/total*100:null}));
}
export function confirmedDepth(rows:Appearance[],profiles:import('../types/players').Player[],seasonId:number,league:string){
  const roster=minuteDistribution(rows);
  return roster.map(p=>{const source=profiles.find(x=>x.id===`${league}-${p.id}`&&x.statsSeasonIds?.length===1&&x.statsSeasonIds[0]===seasonId);
    const detailed=source?.detailedPosition&&source.detailedPositionMethod?.includes('player.positionsDetailed')?source.detailedPosition:null;
    return {...p,detailed,sourceMethod:detailed?source!.detailedPositionMethod:null};
  });
}
