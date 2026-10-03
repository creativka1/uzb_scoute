import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { gunzipSync } from 'zlib';
import type { MatchCore, CoreMatch, CoreSeason, CoreTeam } from '@/types/matches';
export const dynamic = 'force-dynamic';

type OfficialMatchCore = {
  schemaVersion: number;
  generatedAt: string;
  source: string;
  seasons: Partial<Record<'UZB'|'KAZ', CoreSeason[]>>;
  teams: CoreTeam[];
  matches: CoreMatch[];
};

function normalizeTeamName(value: string | null | undefined) {
  return (value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9а-яёқғҳў]+/giu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function mergeOfficialMatchCore(base: MatchCore): MatchCore {
  const file = path.join(process.cwd(), 'data', 'official_match_core_2026.json');
  if (!fs.existsSync(file)) return base;

  const official: OfficialMatchCore = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (official.schemaVersion !== 1 || !Array.isArray(official.matches) || !Array.isArray(official.teams)) {
    throw new Error('Invalid official match core');
  }

  const baseTeams = new Map(base.teams.map(team => [team.id, team.name]));
  const officialTeams = new Map(official.teams.map(team => [team.id, team.name]));

  const isDuplicate = (candidate: CoreMatch) => {
    const home = normalizeTeamName(officialTeams.get(candidate.homeTeamId));
    const away = normalizeTeamName(officialTeams.get(candidate.awayTeamId));
    return base.matches.some(existing => {
      if (existing.league !== candidate.league || existing.seasonId !== candidate.seasonId) return false;
      if (Math.abs(existing.date - candidate.date) > 18 * 3600) return false;
      return normalizeTeamName(baseTeams.get(existing.homeTeamId)) === home &&
        normalizeTeamName(baseTeams.get(existing.awayTeamId)) === away;
    });
  };

  const officialMatches = official.matches.filter(match => !isDuplicate(match));
  const teamIdsUsed = new Set(officialMatches.flatMap(match => [match.homeTeamId, match.awayTeamId]));
  const mergedTeams = [...base.teams];
  const knownTeamIds = new Set(mergedTeams.map(team => team.id));
  for (const team of official.teams) {
    if (teamIdsUsed.has(team.id) && !knownTeamIds.has(team.id)) {
      mergedTeams.push(team);
      knownTeamIds.add(team.id);
    }
  }

  const mergedSeasons = {...base.seasons};
  for (const league of ['UZB','KAZ'] as const) {
    const extras = official.seasons?.[league] || [];
    const byId = new Map<number, CoreSeason>(base.seasons[league].map(season => [season.id, season]));
    for (const season of extras) {
      const existing = byId.get(season.id);
      byId.set(season.id, existing ? {
        ...existing,
        cachedMatches: Math.max(existing.cachedMatches || 0, season.cachedMatches || 0),
        lastSyncedAt: season.lastSyncedAt || existing.lastSyncedAt,
      } : season);
    }
    mergedSeasons[league] = Array.from(byId.values()).sort((a,b) => Number(b.year) - Number(a.year));
  }

  return {
    ...base,
    source: officialMatches.length ? 'mixed-match-core' : base.source,
    seasons: mergedSeasons,
    teams: mergedTeams,
    matches: [...base.matches, ...officialMatches],
  };
}


/** Explicit season IDs. No per-player or per-team season fallback. */
export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams;
  const league = params.get('league') || 'UZB';
  const season = params.get('seasonId');
  const player = params.get('playerId');
  const team = params.get('teamId');
  if (!['UZB','KAZ'].includes(league) || [season, player, team].some(v => v !== null && !/^\d+$/.test(v)))
    return NextResponse.json({error:'INVALID_FILTER'}, {status:400});
  const file = path.join(process.cwd(), 'data/match_core.json.gz');
  if (!fs.existsSync(file)) return NextResponse.json({error:'DATA_UNAVAILABLE'}, {status:503});
  try {
    const baseCore: MatchCore = JSON.parse(gunzipSync(fs.readFileSync(file)).toString('utf8'));
    if (baseCore.schemaVersion !== 1 || !Array.isArray(baseCore.matches) || !Array.isArray(baseCore.appearances)) throw Error('Invalid core');
    const core = mergeOfficialMatchCore(baseCore);
    const seasons = core.seasons[league as 'UZB'|'KAZ'];
    if (season && !seasons.some(s => s.id === Number(season))) return NextResponse.json({error:'UNKNOWN_SEASON'}, {status:400});
    let matches = core.matches.filter(m => m.league === league && (!season || m.seasonId === Number(season)) && (!team || m.homeTeamId === Number(team) || m.awayTeamId === Number(team)));
    const ids = new Set(matches.map(m => m.id));
    let appearances = core.appearances.filter(a => ids.has(a.matchId) && (!player || a.playerId === Number(player)));
    if (player) { const played = new Set(appearances.map(a => a.matchId)); matches = matches.filter(m => played.has(m.id)); }
    // Keep both teams for a selected team's matches; match detail needs both lineups.
    const teamIds = new Set(matches.flatMap(m => [m.homeTeamId,m.awayTeamId]));
    const playerIds = new Set(appearances.map(a => a.playerId));
    return NextResponse.json({...core, teams:core.teams.filter(t => teamIds.has(t.id)), players:core.players.filter(p => playerIds.has(p.id)),
      matches:matches.sort((a,b) => b.date-a.date || b.id-a.id), appearances}, {headers:{'Cache-Control':'no-store'}});
  } catch { return NextResponse.json({error:'DATA_READ_FAILED'}, {status:500}); }
}
