import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SOFA_PATH = path.join(ROOT, 'data', 'superliga_stats.json');
const FOOTY_PATH = path.join(ROOT, 'data', 'footystats_snapshot.json');
const OUT_PATH = path.join(ROOT, 'data', 'audits', 'source_reconciliation.json');
const VALIDATED_OUT = path.join(ROOT, 'data', 'footystats_validated.json');

function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeName(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function diff(a, b) {
  if (a === null || b === null) return null;
  return b - a;
}

function metricCheck(sofa, footy) {
  const checks = {
    appearances: {
      sofa: finite(sofa?.matchesPlayed),
      footystats: finite(footy?.appearances),
      tolerance: 1,
    },
    minutes: {
      sofa: finite(sofa?.minutesPlayed),
      footystats: finite(footy?.minutes),
      tolerance: 120,
    },
    goals: {
      sofa: finite(sofa?.goals),
      footystats: finite(footy?.goals),
      tolerance: 0,
    },
    assists: {
      sofa: finite(sofa?.assists),
      footystats: finite(footy?.assists),
      tolerance: 1,
    },
  };

  for (const item of Object.values(checks)) {
    item.diff = diff(item.sofa, item.footystats);
    item.comparable = item.sofa !== null && item.footystats !== null;
    item.aligned = item.comparable ? Math.abs(item.diff) <= item.tolerance : null;
  }
  const comparable = Object.values(checks).filter(x => x.comparable);
  const aligned = comparable.filter(x => x.aligned).length;
  return {
    checks,
    comparable: comparable.length,
    aligned,
    safeForReview: comparable.length >= 3 && aligned === comparable.length,
  };
}

if (!fs.existsSync(SOFA_PATH)) {
  console.error('Missing data/superliga_stats.json. Build SofaScore-derived data first.');
  process.exit(1);
}
if (!fs.existsSync(FOOTY_PATH)) {
  console.error('Missing data/footystats_snapshot.json. Run npm run sync:footystats first.');
  process.exit(1);
}

const sofaPlayers = JSON.parse(fs.readFileSync(SOFA_PATH, 'utf8'));
const footySnapshot = JSON.parse(fs.readFileSync(FOOTY_PATH, 'utf8'));
if (!Array.isArray(sofaPlayers) || footySnapshot?.schemaVersion !== 1) {
  throw new Error('Unexpected source schema.');
}

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  policy: {
    note: 'Audit only. FootyStats values are never merged automatically.',
    appearancesTolerance: 1,
    minutesTolerance: 120,
    goalsTolerance: 0,
    assistsTolerance: 1,
  },
  leagues: {},
};

for (const [league, payload] of Object.entries(footySnapshot.leagues || {})) {
  const footyPlayers = Array.isArray(payload?.players) ? payload.players : [];
  const sofaLeague = sofaPlayers.filter(p => p?.league === league);
  const sofaByName = new Map();
  for (const p of sofaLeague) {
    const key = normalizeName(p?.name);
    if (!key) continue;
    const arr = sofaByName.get(key) || [];
    arr.push(p);
    sofaByName.set(key, arr);
  }

  const rows = [];
  for (const footy of footyPlayers) {
    const key = normalizeName(footy?.name);
    const candidates = sofaByName.get(key) || [];
    if (candidates.length !== 1) {
      rows.push({
        footystatsPlayerId: footy?.footystatsPlayerId ?? null,
        footystatsName: footy?.name ?? null,
        status: candidates.length === 0 ? 'unmatched' : 'ambiguous',
        candidateSofaIds: candidates.map(p => p?.sofaId).filter(Boolean),
      });
      continue;
    }

    const sofa = candidates[0];
    const stats = sofa?.currentSeason || null;
    const audit = metricCheck(stats, footy);
    rows.push({
      footystatsPlayerId: footy?.footystatsPlayerId ?? null,
      sofaId: sofa?.sofaId ?? null,
      name: footy?.name ?? sofa?.name ?? null,
      status: audit.safeForReview ? 'aligned' : 'conflict',
      ...audit,
    });
  }

  const matched = rows.filter(r => ['aligned', 'conflict'].includes(r.status));
  report.leagues[league] = {
    footystatsSeasonId: payload?.seasonId ?? null,
    footystatsSeasonName: payload?.seasonName ?? null,
    totalFootyStatsPlayers: footyPlayers.length,
    matched: matched.length,
    aligned: rows.filter(r => r.status === 'aligned').length,
    conflicts: rows.filter(r => r.status === 'conflict').length,
    unmatched: rows.filter(r => r.status === 'unmatched').length,
    ambiguous: rows.filter(r => r.status === 'ambiguous').length,
    rows,
  };
}

const validated = {
  schemaVersion: 1,
  generatedAt: report.generatedAt,
  source: footySnapshot.source || 'FootyStats',
  policy: 'Only players aligned on at least three core checks are included. These values are supplemental and never overwrite conflicting primary data.',
  leagues: {},
};

for (const [league, value] of Object.entries(report.leagues)) {
  const footyPlayers = footySnapshot.leagues?.[league]?.players || [];
  const byId = new Map(footyPlayers.filter(player => player.footystatsPlayerId !== null).map(player => [player.footystatsPlayerId, player]));
  const byName = new Map();
  for (const player of footyPlayers) {
    const key = normalizeName(player.name);
    if (!key) continue;
    const rows = byName.get(key) || [];
    rows.push(player);
    byName.set(key, rows);
  }
  const accepted = [];
  for (const row of value.rows) {
    if (row.status !== 'aligned') continue;
    const named = byName.get(normalizeName(row.name)) || [];
    const player = row.footystatsPlayerId !== null && row.footystatsPlayerId !== undefined
      ? byId.get(row.footystatsPlayerId)
      : named.length === 1 ? named[0] : null;
    if (!player) continue;
    accepted.push({
      sofaId: row.sofaId,
      footystatsPlayerId: row.footystatsPlayerId ?? null,
      sourcePlayerKey: player.sourcePlayerKey ?? null,
      name: row.name,
      validation: {
        comparable: row.comparable,
        aligned: row.aligned,
        checks: row.checks,
      },
      metrics: {
        appearances: player.appearances,
        minutes: player.minutes,
        goals: player.goals,
        assists: player.assists,
        averageRating: player.averageRating,
        passesTotal: player.passesTotal,
        passesCompletedTotal: player.passesCompletedTotal,
        passCompletionPct: player.passCompletionPct,
        progressivePassesTotal: player.progressivePassesTotal,
        keyPassesTotal: player.keyPassesTotal,
        keyPassesPer90: player.keyPassesPer90,
        crossesTotal: player.crossesTotal,
        accurateCrossesTotal: player.accurateCrossesTotal,
        crossCompletionPct: player.crossCompletionPct,
        tacklesTotal: player.tacklesTotal,
        tacklesPer90: player.tacklesPer90,
        successfulTacklesTotal: player.successfulTacklesTotal,
        interceptionsTotal: player.interceptionsTotal,
        interceptionsPer90: player.interceptionsPer90,
        blocksTotal: player.blocksTotal,
        clearancesTotal: player.clearancesTotal,
        dribblesTotal: player.dribblesTotal,
        successfulDribblesTotal: player.successfulDribblesTotal,
        dribbleSuccessPct: player.dribbleSuccessPct,
        aerialDuelsWonTotal: player.aerialDuelsWonTotal,
        aerialDuelsWonPer90: player.aerialDuelsWonPer90,
        aerialDuelsWonPct: player.aerialDuelsWonPct,
        duelsTotal: player.duelsTotal,
        duelsWonTotal: player.duelsWonTotal,
        duelsWonPer90: player.duelsWonPer90,
        duelsWonPct: player.duelsWonPct,
        shotsTotal: player.shotsTotal,
        shotsPer90: player.shotsPer90,
        shotsOnTargetTotal: player.shotsOnTargetTotal,
        xG: player.xG,
        xGPer90: player.xGPer90,
        npxG: player.npxG,
        npxGPer90: player.npxGPer90,
        xA: player.xA,
        xAPer90: player.xAPer90,
        savesTotal: player.savesTotal,
        savesPer90: player.savesPer90,
        savePct: player.savePct,
        insideBoxSavesTotal: player.insideBoxSavesTotal,
        detailedMatchesRecorded: player.detailedMatchesRecorded,
        detailedMinutesRecorded: player.detailedMinutesRecorded,
      },
    });
  }
  validated.leagues[league] = accepted;
}

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(report, null, 2));
fs.writeFileSync(VALIDATED_OUT, JSON.stringify(validated, null, 2));
console.log(`Source reconciliation report written to ${path.relative(ROOT, OUT_PATH)}`);
console.log(`Validated FootyStats snapshot written to ${path.relative(ROOT, VALIDATED_OUT)}`);
for (const [league, value] of Object.entries(report.leagues)) {
  console.log(`${league}: matched=${value.matched}, aligned=${value.aligned}, conflicts=${value.conflicts}, unmatched=${value.unmatched}`);
}
