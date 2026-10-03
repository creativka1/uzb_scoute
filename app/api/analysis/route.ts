import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { gunzipSync } from 'zlib';
import type { MatchCore } from '@/types/matches';
export const dynamic = 'force-dynamic';

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
    const core: MatchCore = JSON.parse(gunzipSync(fs.readFileSync(file)).toString('utf8'));
    if (core.schemaVersion !== 1 || !Array.isArray(core.matches) || !Array.isArray(core.appearances)) throw Error('Invalid core');
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
