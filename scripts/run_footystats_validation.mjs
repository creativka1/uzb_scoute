import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const STATUS_PATH = path.join(ROOT, 'data', 'audits', 'footystats_status.json');
const RECON_PATH = path.join(ROOT, 'data', 'audits', 'source_reconciliation.json');
const SNAPSHOT_PATH = path.join(ROOT, 'data', 'footystats_snapshot.json');

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
let sourceMode = null;

if (key) {
  if (!runScript('scripts/sync_footystats.mjs')) {
    writeStatus({
      status: 'sync_failed',
      seasonYear: 2026,
      mode: 'api',
      note: 'FootyStats API snapshot could not be refreshed; production football data was left unchanged.',
    });
    process.exit(0);
  }
  sourceMode = 'api';
} else {
  // Respect access controls: only use the public Players CSV link exposed by
  // FootyStats itself. If it redirects to HTML/login, do not attempt to bypass.
  if (!runScript('scripts/sync_footystats_public_csv.mjs')) {
    if (fs.existsSync(SNAPSHOT_PATH)) fs.rmSync(SNAPSHOT_PATH);
    writeStatus({
      status: 'public_unavailable',
      seasonYear: 2026,
      mode: 'public_csv',
      note: 'No API key is configured and the public Players CSV was not directly downloadable. No FootyStats values were merged.',
    });
    process.exit(0);
  }
  sourceMode = 'public_csv';
}

if (!runScript('scripts/audit_data_sources.mjs')) {
  writeStatus({
    status: 'audit_failed',
    seasonYear: 2026,
    mode: sourceMode,
    note: 'FootyStats snapshot exists but reconciliation failed; production football data was left unchanged.',
  });
  process.exit(0);
}

let summary = {};
let snapshotSource = null;
try {
  const report = JSON.parse(fs.readFileSync(RECON_PATH, 'utf8'));
  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
  snapshotSource = snapshot.source || null;
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
  mode: sourceMode,
  source: snapshotSource,
  note: 'FootyStats values are validation-only supplements and never overwrite conflicting primary data.',
  leagues: summary,
});
