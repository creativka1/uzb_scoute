import fs from 'node:fs';
import path from 'node:path';

const API_BASE = 'https://api.football-data-api.com';
const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'data', 'cache', 'footystats');
const SNAPSHOT = path.join(ROOT, 'data', 'footystats_snapshot.json');

const key = process.env.FOOTYSTATS_API_KEY;
if (!key) {
  console.error('FOOTYSTATS_API_KEY is required. Get it from the FootyStats API dashboard.');
  process.exit(1);
}

const requestedLeagues = (process.env.FOOTYSTATS_LEAGUES || 'UZB,KAZ')
  .split(',')
  .map(x => x.trim().toUpperCase())
  .filter(Boolean);
const seasonYear = Number(process.env.FOOTYSTATS_SEASON_YEAR || new Date().getUTCFullYear());

const LEAGUES = {
  UZB: { countryIsoNumeric: 860, patterns: [/super\s*league/i, /superliga/i] },
  KAZ: { countryIsoNumeric: 398, patterns: [/premier\s*league/i, /premyer/i, /premier/i] },
};

function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function readDetailed(player) {
  return player?.detailed && typeof player.detailed === 'object' ? player.detailed : {};
}

function normalizePlayer(player, league) {
  const d = readDetailed(player);
  return {
    source: 'footystats',
    league,
    footystatsPlayerId: finite(player.id),
    competitionId: finite(player.competition_id),
    name: String(player.full_name || player.known_as || player.first_name || '').trim(),
    knownAs: String(player.known_as || '').trim() || null,
    age: finite(player.age),
    nationality: player.nationality ?? null,
    position: player.position ?? null,
    clubTeamId: finite(player.club_team_id),
    clubTeam2Id: finite(player.club_team_2_id),
    appearances: finite(player.appearances_overall),
    minutes: finite(player.minutes_played_overall),
    goals: finite(player.goals_overall),
    assists: finite(player.assists_overall),
    yellowCards: finite(player.yellow_cards_overall),
    redCards: finite(player.red_cards_overall),
    averageRating: finite(d.average_rating_overall),
    passesTotal: finite(d.passes_total_overall),
    passesCompletedTotal: finite(d.passes_completed_total_overall),
    passCompletionPct: finite(d.pass_completion_rate_overall),
    progressivePassesTotal: finite(d.progressive_passes_total_overall),
    keyPassesTotal: finite(d.key_passes_total_overall),
    keyPassesPer90: finite(d.key_passes_per_90_overall),
    crossesTotal: finite(d.crosses_total_overall),
    accurateCrossesTotal: finite(d.accurate_crosses_total_overall),
    crossCompletionPct: finite(d.cross_completion_rate_overall),
    tacklesTotal: finite(d.tackles_total_overall),
    tacklesPer90: finite(d.tackles_per_90_overall),
    successfulTacklesTotal: finite(d.tackles_successful_total_overall),
    interceptionsTotal: finite(d.interceptions_total_overall),
    interceptionsPer90: finite(d.interceptions_per_90_overall),
    blocksTotal: finite(d.blocks_total_overall),
    clearancesTotal: finite(d.clearances_total_overall),
    dribblesTotal: finite(d.dribbles_total_overall),
    successfulDribblesTotal: finite(d.dribbles_successful_total_overall),
    dribbleSuccessPct: finite(d.dribbles_successful_percentage_overall),
    aerialDuelsWonTotal: finite(d.aerial_duels_won_total_overall),
    aerialDuelsWonPer90: finite(d.aerial_duels_won_per_90_overall),
    aerialDuelsWonPct: finite(d.aerial_duels_won_percentage_overall),
    duelsTotal: finite(d.duels_total_overall),
    duelsWonTotal: finite(d.duels_won_total_overall),
    duelsWonPer90: finite(d.duels_won_per_90_overall),
    duelsWonPct: finite(d.duels_won_percentage_overall),
    shotsTotal: finite(d.shots_total_overall),
    shotsPer90: finite(d.shots_per_90_overall),
    shotsOnTargetTotal: finite(d.shots_on_target_total_overall),
    xG: finite(d.xg_total_overall),
    xGPer90: finite(d.xg_per_90_overall),
    npxG: finite(d.npxg_total_overall),
    npxGPer90: finite(d.npxg_per_90_overall),
    xA: finite(d.xa_total_overall),
    xAPer90: finite(d.xa_per_90_overall),
    savesTotal: finite(d.saves_total_overall),
    savesPer90: finite(d.saves_per_90_overall),
    savePct: finite(d.save_percentage_overall),
    insideBoxSavesTotal: finite(d.inside_box_saves_total_overall),
    detailedMatchesRecorded: finite(d.detailed_matches_played_recorded_overall),
    detailedMinutesRecorded: finite(d.detailed_minutes_played_recorded_overall),
  };
}

async function getJson(endpoint, params) {
  const url = new URL(endpoint, API_BASE);
  url.searchParams.set('key', key);
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url, { headers: { 'User-Agent': 'UzStat/1.0 data-sync' } });
  if (!res.ok) throw new Error(`FootyStats ${res.status} for ${url.pathname}`);
  const json = await res.json();
  if (json?.success === false) throw new Error(json?.message || 'FootyStats API returned success=false');
  return json;
}

function pickSeasonId(list, cfg, year) {
  const leagues = Array.isArray(list?.data) ? list.data : [];
  const ranked = leagues
    .filter(item => cfg.patterns.some(rx => rx.test(String(item.name || item.league_name || ''))))
    .flatMap(item => (Array.isArray(item.season) ? item.season : []).map(season => ({
      leagueName: item.name || item.league_name,
      id: finite(season.id),
      year: finite(season.year ?? season.starting_year),
    })))
    .filter(item => item.id !== null)
    .sort((a, b) => {
      const aExact = a.year === year ? 1 : 0;
      const bExact = b.year === year ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;
      return (b.year || 0) - (a.year || 0);
    });
  return ranked[0] || null;
}

async function fetchAllPlayers(seasonId) {
  const all = [];
  for (let page = 1; page <= 20; page++) {
    const json = await getJson('/league-players', { season_id: seasonId, include: 'stats', page });
    const rows = Array.isArray(json?.data) ? json.data : [];
    all.push(...rows);
    const current = finite(json?.pager?.current_page) ?? page;
    const max = finite(json?.pager?.max_page);
    if (!rows.length || (max !== null && current >= max) || rows.length < 200) break;
  }
  return all;
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const snapshot = {
  schemaVersion: 1,
  source: 'FootyStats API',
  generatedAt: new Date().toISOString(),
  seasonYear,
  leagues: {},
};

for (const league of requestedLeagues) {
  const cfg = LEAGUES[league];
  if (!cfg) {
    console.warn(`Skipping unsupported league code: ${league}`);
    continue;
  }
  console.log(`Resolving FootyStats season for ${league} ${seasonYear}...`);
  const list = await getJson('/league-list', { country: cfg.countryIsoNumeric, chosen_leagues_only: 'true' });
  const selected = pickSeasonId(list, cfg, seasonYear);
  if (!selected) {
    throw new Error(`No chosen FootyStats season found for ${league} ${seasonYear}. Select the league in your FootyStats API account first.`);
  }

  console.log(`Fetching ${league}: ${selected.leagueName} season_id=${selected.id}...`);
  const players = await fetchAllPlayers(selected.id);
  const normalized = players.map(p => normalizePlayer(p, league)).filter(p => p.name);

  const leagueDir = path.join(OUT_DIR, league, String(selected.id));
  fs.mkdirSync(leagueDir, { recursive: true });
  fs.writeFileSync(path.join(leagueDir, 'players.raw.json'), JSON.stringify(players, null, 2));
  fs.writeFileSync(path.join(leagueDir, 'players.normalized.json'), JSON.stringify(normalized, null, 2));

  snapshot.leagues[league] = {
    seasonId: selected.id,
    seasonName: selected.leagueName,
    players: normalized,
  };
  console.log(`${league}: ${normalized.length} players saved.`);
}

fs.writeFileSync(SNAPSHOT, JSON.stringify(snapshot, null, 2));
console.log(`FootyStats snapshot written to ${path.relative(ROOT, SNAPSHOT)}`);
