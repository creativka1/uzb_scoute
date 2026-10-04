import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const STATUS_PATH = path.join(ROOT, 'data', 'audits', 'footystats_status.json');
const RECON_PATH = path.join(ROOT, 'data', 'audits', 'source_reconciliation.json');

function writeStatus(payload) {
  fs.mkdirSync(path.dirname(STATUS_PATH), { recursive: true });
  fs.writeFileSync(
    STATUS_PATH,
    JSON.stringify({ generatedAt: new Date().toISOString(), ...payload }, null, 2) + '\n'
  );
}

function runScript(script) {
  const result = spawnSync(process.execPath, [script], {
    cwd: ROOT,
    env: {
      ...process.env,
      FOOTYSTATS_LEAGUES: process.env.FOOTYSTATS_LEAGUES || 'UZB,KAZ',
      FOOTYSTATS_SEASON_YEAR: process.env.FOOTYSTATS_SEASON_YEAR || '2026',
    },
    stdio: 'inherit',
  });
  return result.status === 0;
}

const key = String(process.env.FOOTYSTATS_API_KEY || '').trim();
if (!key) {
  writeStatus({
    status: 'not_configured',
    seasonYear: 2026,
    note: 'FootyStats validation is optional and no API key is configured.',
  });
  process.exit(0);
}

if (!runScript('scripts/sync_footystats.mjs')) {
  writeStatus({
    status: 'sync_failed',
    seasonYear: 2026,
    note: 'FootyStats snapshot could not be refreshed; production football data was left unchanged.',
  });
  process.exit(0);
}

if (!runScript('scripts/audit_data_sources.mjs')) {
  writeStatus({
    status: 'audit_failed',
    seasonYear: 2026,
    note: 'FootyStats snapshot exists but reconciliation failed; production football data was left unchanged.',
  });
  process.exit(0);
}

let summary = {};
try {
  const report = JSON.parse(fs.readFileSync(RECON_PATH, 'utf8'));
  summary = Object.fromEntries(
    Object.entries(report.leagues || {}).map(([league, value]) => [
      league,
      {
        totalFootyStatsPlayers: value.totalFootyStatsPlayers ?? 0,
        matched: value.matched ?? 0,
        aligned: value.aligned ?? 0,
        conflicts: value.conflicts ?? 0,
        unmatched: value.unmatched ?? 0,
        ambiguous: value.ambiguous ?? 0,
      },
    ])
  );
} catch {
  summary = {};
}

writeStatus({
  status: 'success',
  seasonYear: 2026,
  mode: 'validation_only',
  note: 'FootyStats values are not merged automatically into production metrics.',
  leagues: summary,
});
