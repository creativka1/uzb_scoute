import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SNAPSHOT = path.join(ROOT, 'data', 'footystats_snapshot.json');
const OUT_DIR = path.join(ROOT, 'data', 'cache', 'footystats-public');
const seasonYear = Number(process.env.FOOTYSTATS_SEASON_YEAR || new Date().getUTCFullYear());

const LEAGUES = {
  UZB: {
    seasonName: 'Uzbekistan Super League',
    datasetsUrl: 'https://footystats.org/uzbekistan/uzbekistan-super-league/datasets',
  },
  KAZ: {
    seasonName: 'Kazakhstan Premier League',
    datasetsUrl: 'https://footystats.org/kazakhstan/kazakhstan-premier-league/datasets',
  },
};

function finite(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(String(value).replace('%', '').trim());
  return Number.isFinite(n) ? n : null;
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripTags(value) {
  return decodeHtml(String(value || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += ch;
  }
  if (field.length || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  if (rows.length < 2) throw new Error('Players CSV does not contain data rows');
  const headers = rows[0].map(h => h.trim().replace(/^\uFEFF/, ''));
  return rows.slice(1).filter(r => r.some(v => String(v).trim())).map(values =>
    Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']))
  );
}

function pick(row, names) {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(row, name) && row[name] !== '') return row[name];
  }
  const lower = new Map(Object.keys(row).map(k => [k.toLowerCase(), k]));
  for (const name of names) {
    const key = lower.get(name.toLowerCase());
    if (key && row[key] !== '') return row[key];
  }
  return null;
}

function normalizePlayer(row, league, index) {
  const name = String(pick(row, ['full_name','player_name','name','known_as','Player','player']) || '').trim();
  if (!name) return null;
  const playerId = finite(pick(row, ['id','player_id','playerID','playerId']));
  return {
    source: 'footystats-public-csv',
    sourcePlayerKey: playerId !== null ? String(playerId) : `${league}:${name.toLowerCase()}:${index}`,
    league,
    footystatsPlayerId: playerId,
    competitionId: finite(pick(row, ['competition_id','season_id','league_id'])),
    name,
    knownAs: String(pick(row, ['known_as','short_name']) || '').trim() || null,
    age: finite(pick(row, ['age'])),
    nationality: pick(row, ['nationality','nationality_name','country']) ?? null,
    position: pick(row, ['position','position_short']) ?? null,
    clubTeamId: finite(pick(row, ['club_team_id','team_id'])),
    clubTeam2Id: finite(pick(row, ['club_team_2_id'])),
    appearances: finite(pick(row, ['appearances_overall','appearances','apps'])),
    minutes: finite(pick(row, ['minutes_played_overall','minutes','minutes_played'])),
    goals: finite(pick(row, ['goals_overall','goals'])),
    assists: finite(pick(row, ['assists_overall','assists'])),
    yellowCards: finite(pick(row, ['yellow_cards_overall','yellow_cards'])),
    redCards: finite(pick(row, ['red_cards_overall','red_cards'])),
    averageRating: finite(pick(row, ['average_rating_overall','average_rating','rating'])),
    passesTotal: finite(pick(row, ['passes_total_overall','passes_total'])),
    passesCompletedTotal: finite(pick(row, ['passes_completed_total_overall','passes_completed_total'])),
    passCompletionPct: finite(pick(row, ['pass_completion_rate_overall','pass_completion_rate','pass_completion_pct'])),
    progressivePassesTotal: finite(pick(row, ['progressive_passes_total_overall','progressive_passes_total'])),
    keyPassesTotal: finite(pick(row, ['key_passes_total_overall','key_passes_total'])),
    keyPassesPer90: finite(pick(row, ['key_passes_per_90_overall','key_passes_per_90'])),
    crossesTotal: finite(pick(row, ['crosses_total_overall','crosses_total'])),
    accurateCrossesTotal: finite(pick(row, ['accurate_crosses_total_overall','accurate_crosses_total'])),
    crossCompletionPct: finite(pick(row, ['cross_completion_rate_overall','cross_completion_rate'])),
    tacklesTotal: finite(pick(row, ['tackles_total_overall','tackles_total'])),
    tacklesPer90: finite(pick(row, ['tackles_per_90_overall','tackles_per_90'])),
    successfulTacklesTotal: finite(pick(row, ['tackles_successful_total_overall','successful_tackles_total'])),
    interceptionsTotal: finite(pick(row, ['interceptions_total_overall','interceptions_total'])),
    interceptionsPer90: finite(pick(row, ['interceptions_per_90_overall','interceptions_per_90'])),
    blocksTotal: finite(pick(row, ['blocks_total_overall','blocks_total'])),
    clearancesTotal: finite(pick(row, ['clearances_total_overall','clearances_total'])),
    dribblesTotal: finite(pick(row, ['dribbles_total_overall','dribbles_total'])),
    successfulDribblesTotal: finite(pick(row, ['dribbles_successful_total_overall','dribbles_successful_total'])),
    dribbleSuccessPct: finite(pick(row, ['dribbles_successful_percentage_overall','dribble_success_pct'])),
    aerialDuelsWonTotal: finite(pick(row, ['aerial_duels_won_total_overall','aerial_duels_won_total'])),
    aerialDuelsWonPer90: finite(pick(row, ['aerial_duels_won_per_90_overall','aerial_duels_won_per_90'])),
    aerialDuelsWonPct: finite(pick(row, ['aerial_duels_won_percentage_overall','aerial_duels_won_pct'])),
    duelsTotal: finite(pick(row, ['duels_total_overall','duels_total'])),
    duelsWonTotal: finite(pick(row, ['duels_won_total_overall','duels_won_total'])),
    duelsWonPer90: finite(pick(row, ['duels_won_per_90_overall','duels_won_per_90'])),
    duelsWonPct: finite(pick(row, ['duels_won_percentage_overall','duels_won_pct'])),
    shotsTotal: finite(pick(row, ['shots_total_overall','shots_total'])),
    shotsPer90: finite(pick(row, ['shots_per_90_overall','shots_per_90'])),
    shotsOnTargetTotal: finite(pick(row, ['shots_on_target_total_overall','shots_on_target_total'])),
    xG: finite(pick(row, ['xg_total_overall','xg','xG'])),
    xGPer90: finite(pick(row, ['xg_per_90_overall','xg_per_90'])),
    npxG: finite(pick(row, ['npxg_total_overall','npxg'])),
    npxGPer90: finite(pick(row, ['npxg_per_90_overall','npxg_per_90'])),
    xA: finite(pick(row, ['xa_total_overall','xa','xA'])),
    xAPer90: finite(pick(row, ['xa_per_90_overall','xa_per_90'])),
    savesTotal: finite(pick(row, ['saves_total_overall','saves_total'])),
    savesPer90: finite(pick(row, ['saves_per_90_overall','saves_per_90'])),
    savePct: finite(pick(row, ['save_percentage_overall','save_percentage','save_pct'])),
    insideBoxSavesTotal: finite(pick(row, ['inside_box_saves_total_overall','inside_box_saves_total'])),
    detailedMatchesRecorded: finite(pick(row, ['detailed_matches_played_recorded_overall','detailed_matches_recorded'])),
    detailedMinutesRecorded: finite(pick(row, ['detailed_minutes_played_recorded_overall','detailed_minutes_recorded'])),
  };
}

async function fetchText(url) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: {
      'User-Agent': 'UzStat/1.0 public-dataset-validator',
      'Accept': 'text/html,text/csv,text/plain;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return { text, url: res.url, contentType: res.headers.get('content-type') || '' };
}

function findPlayersCsvHref(html, year) {
  const rows = html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) || [];
  const target = rows.find(row => new RegExp(`\\b${year}\\s*\\/\\s*${year}\\b`).test(stripTags(row)));
  if (!target) throw new Error(`Could not find ${year}/${year} dataset row`);
  const links = [...target.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const playerLink = links.find(match => /players\s*csv/i.test(stripTags(match[2])));
  if (!playerLink) throw new Error(`Could not find Players CSV link for ${year}`);
  const href = decodeHtml(playerLink[1]).trim();
  if (!href || href.startsWith('#') || /^javascript:/i.test(href)) throw new Error('Players CSV link is not a downloadable URL');
  return href;
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const snapshot = {
  schemaVersion: 1,
  source: 'FootyStats public Players CSV',
  generatedAt: new Date().toISOString(),
  seasonYear,
  leagues: {},
};

for (const [league, cfg] of Object.entries(LEAGUES)) {
  console.log(`Resolving public Players CSV for ${league} ${seasonYear}...`);
  const dataset = await fetchText(cfg.datasetsUrl);
  const href = findPlayersCsvHref(dataset.text, seasonYear);
  const csvUrl = new URL(href, dataset.url).toString();
  const response = await fetchText(csvUrl);
  if (/text\/html/i.test(response.contentType) || /^\s*<!doctype html|^\s*<html/i.test(response.text)) {
    throw new Error(`FootyStats public Players CSV for ${league} requires an authenticated/download session`);
  }
  const rows = parseCsv(response.text);
  const players = rows.map((row, index) => normalizePlayer(row, league, index)).filter(Boolean);
  if (players.length < 20) throw new Error(`Unexpectedly small FootyStats Players CSV for ${league}: ${players.length}`);

  const leagueDir = path.join(OUT_DIR, league, String(seasonYear));
  fs.mkdirSync(leagueDir, { recursive: true });
  fs.writeFileSync(path.join(leagueDir, 'players.csv'), response.text);
  fs.writeFileSync(path.join(leagueDir, 'players.normalized.json'), JSON.stringify(players, null, 2));

  snapshot.leagues[league] = {
    seasonId: null,
    seasonName: `${cfg.seasonName} ${seasonYear}`,
    players,
    publicCsvUrl: response.url,
  };
  console.log(`${league}: ${players.length} public CSV players saved.`);
}

fs.writeFileSync(SNAPSHOT, JSON.stringify(snapshot, null, 2));
console.log(`FootyStats public snapshot written to ${path.relative(ROOT, SNAPSHOT)}`);
