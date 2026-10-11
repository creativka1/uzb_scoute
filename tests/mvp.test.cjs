const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { NextRequest } = require('next/server');
const root = path.resolve(__dirname, '..');
const loaded = new Map();
function load(file) {
  if (loaded.has(file)) return loaded.get(file);
  const exports = {};
  const imports = name => {
    if (!name.startsWith('@/') && !name.startsWith('.')) return require(name);
    const base = name.startsWith('@/') ? name.slice(2) : path.join(path.dirname(file), name);
    return load(base + (fs.existsSync(path.join(root, base + '.tsx')) ? '.tsx' : '.ts'));
  };
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, require: imports, console, process, URL, Date, Object, Number });
  loaded.set(file, exports);
  return exports;
}
const mvp = load('lib/mvp.ts');
const api = load('app/api/players/route.ts');
async function cohort() {
  const response = await api.GET(new NextRequest('http://localhost/api/players?league=UZB&season=previous'));
  assert.equal(response.status, 200);
  return mvp.selectMvpPlayers(await response.json());
}

test('MVP contains exactly ten source-backed midfielders in one explicit season', async () => {
  const players = await cohort();
  assert.equal(players.length, 10);
  assert.equal(new Set(players.map(p => p.id)).size, 10);
  for (const player of players) {
    assert.equal(player.league, 'UZB');
    assert.equal(player.position, 'MF');
    assert.ok(player.statsSeasonIds.includes(72383));
    assert.ok(player.minutesPlayed >= 450);
    assert.equal(player.scoutingEngine.metricCoverage, 5);
    assert.equal(player.detailedPosition, null); // do not invent winger positions
    assert.ok(player.scoutIndex !== null);
  }
  assert.throws(() => mvp.selectMvpPlayers(players.slice(1)), /unavailable/);
});

test('search and filters combine; reset returns the complete original cohort', async () => {
  const players = await cohort();
  const first = players[0];
  assert.equal(mvp.filterPlayers(players, { ...mvp.EMPTY_FILTERS, search: first.name.ru.toUpperCase() }).length, 1);
  const filtered = mvp.filterPlayers(players, { ...mvp.EMPTY_FILTERS, team: first.club.ru, maxAge: '30', maxCost: '500000' });
  assert.ok(filtered.every(p => p.club.ru === first.club.ru && p.age <= 30 && p.rawMarketValueEUR <= 500000));
  assert.equal(mvp.filterPlayers(players, { ...mvp.EMPTY_FILTERS, maxCost: '0' }).length, 0);
  assert.equal(mvp.filterPlayers(players, mvp.EMPTY_FILTERS).length, 10);
});

test('recruitment uses the cohort, constraints and Scout Index; team context excludes incumbents', async () => {
  const players = await cohort();
  const filters = { ...mvp.EMPTY_FILTERS, position: 'MF', maxAge: '30', maxCost: '900000', minMinutes: '1000' };
  const ranked = mvp.recruitPlayers(players, filters);
  assert.ok(ranked.length > 0);
  assert.ok(ranked.every(p => p.age <= 30 && p.rawMarketValueEUR <= 900000 && p.minutesPlayed >= 1000));
  for (let i = 1; i < ranked.length; i++) assert.ok(ranked[i - 1].scoutIndex >= ranked[i].scoutIndex);
  const forTeam = mvp.recruitPlayers(players, mvp.EMPTY_FILTERS, players[0].club.ru);
  assert.ok(forTeam.length > 0);
  assert.ok(forTeam.every(p => p.club.ru !== players[0].club.ru));
  const missing = { ...players[0], age: null, rawMarketValueEUR: null };
  assert.equal(mvp.filterPlayers([missing], { ...mvp.EMPTY_FILTERS, maxAge: '99' }).length, 0);
  assert.equal(mvp.filterPlayers([missing], { ...mvp.EMPTY_FILTERS, maxCost: '9999999' }).length, 0);
});

test('missing numeric values never appear as zero; real zero is retained', () => {
  for (const value of [null, undefined, NaN, Infinity]) assert.equal(mvp.formatNumber(value, 2), '—');
  assert.equal(mvp.formatNumber(0, 2), '0,00');
  assert.equal(mvp.formatMoney(null), '—');
});

test('xG and xA per 90 use their observed match minutes instead of entire sample minutes', async () => {
  for (const player of await cohort()) {
    for (const [key, source] of [['xGPer90', 'xG'], ['xAPer90', 'xA']]) {
      const detail = player.statsMetricDetails[source];
      assert.equal(mvp.metricValue(player, key), detail.per90);
      assert.ok(detail.minutes <= player.minutesPlayed);
      if (detail.per90 !== null) assert.ok(Math.abs(detail.per90 - detail.value / detail.minutes * 90) < 0.000001);
    }
  }
});

test('shortlist parsing preserves unknown IDs and rejects corrupt data', () => {
  assert.equal(mvp.parseShortlist(null).length, 0);
  assert.equal(mvp.parseShortlist('["UZB-573710","UZB-573710","old-player"]').length, 2);
  for (const raw of ['broken', '{}', '[null]', '[{"id":"UZB-573710"}]']) assert.throws(() => mvp.parseShortlist(raw));
});

test('radar uses available same-position metrics without missing-value polygons', async () => {
  const { MvpRadar } = load('components/mvp/radar.tsx');
  const players = await cohort();
  const html = renderToStaticMarkup(React.createElement(MvpRadar, { player: players[0], players, comparison: players[1] }));
  assert.ok(html.includes(players[0].name.ru));
  assert.ok(html.includes(players[1].name.ru));
  assert.ok(!html.includes('NaN'));
  assert.ok(!html.includes('Среднее по'));
  const missing = { ...players[0], roleMetrics: {}, statsMetricDetails: {} };
  const absent = renderToStaticMarkup(React.createElement(MvpRadar, { player: missing, players, comparison: players[1] }));
  assert.ok(absent.includes('Недостаточно общих данных'));
  assert.ok(!absent.includes('<polygon'));
});

test('profile and comparison totals are source values, never reconstructed from rates', async () => {
  const { displayMetricValue, COMPARISON_METRICS } = load('components/mvp/profile-data.ts');
  const players = await cohort();
  assert.equal(players[0].goals, 7);
  assert.equal(players[0].assists, 4);
  for (const player of players) for (const key of ['matchesPlayed', 'minutesPlayed', 'goals', 'assists', 'xG', 'xA']) {
    assert.equal(displayMetricValue(player, key), player[key]);
  }
  assert.equal(displayMetricValue({ ...players[0], goals: null, assists: null }, 'goals'), null);
  assert.equal(displayMetricValue({ ...players[0], goals: null, assists: null }, 'assists'), null);
  assert.equal(displayMetricValue({ ...players[0], goals: 0 }, 'goals'), 0);
  assert.equal(COMPARISON_METRICS.length, 10);
  assert.ok(['goals', 'assists', 'goalsPer90', 'assistsPer90'].every(key => COMPARISON_METRICS.some(metric => metric.key === key)));
});

test('radar ranks real metrics within one position and season, excludes null and keeps zero', async () => {
  const { radarData } = load('components/mvp/profile-data.ts');
  const players = await cohort();
  const data = radarData(players[0], players);
  assert.equal(data.axes.length, 8);
  assert.equal(data.peers, 10);
  const unrelated = [
    { ...players[0], id: 'other-position', position: 'FW' },
    { ...players[0], id: 'other-season', statsSeasonIds: [999] },
    { ...players[0], id: 'other-league', league: 'KAZ' },
    players[0],
  ];
  assert.equal(JSON.stringify(radarData(players[0], [...players, ...unrelated])), JSON.stringify(data));
  const partial = { ...players[0], roleMetrics: { ...players[0].roleMetrics, goalsPer90: 0, assistsPer90: null } };
  const axes = radarData(partial, players).axes;
  assert.ok(axes.some(axis => axis.key === 'goalsPer90' && Number.isFinite(axis.score)));
  assert.ok(!axes.some(axis => axis.key === 'assistsPer90'));
  for (const axis of data.axes) {
    assert.ok(axis.count >= 3 && axis.count <= 10);
    assert.ok(axis.score >= 0 && axis.score <= 100);
  }
  const sparse = { ...players[0], roleMetrics: { goalsPer90: players[0].roleMetrics.goalsPer90 }, statsMetricDetails: { goals: players[0].statsMetricDetails.goals } };
  const { MvpRadar } = load('components/mvp/radar.tsx');
  const sparseHtml = renderToStaticMarkup(React.createElement(MvpRadar, { player: sparse, players }));
  assert.ok(sparseHtml.includes('Голы / 90'));
  assert.ok(!sparseHtml.includes('<polygon'));
  assert.equal(radarData(players[0], players, { ...players[1], position: 'FW' }).axes.length, 0);
});

test('scout categories use existing league scores; position rank respects tied scores and missing data', async () => {
  const { scoutSignals, positionRank } = load('components/mvp/profile-data.ts');
  const players = await cohort();
  for (const player of players) {
    const groups = scoutSignals(player);
    assert.ok(groups.strong.length <= 3 && groups.average.length <= 3 && groups.weak.length <= 2);
    assert.ok(groups.strong.every(signal => signal.score >= 75));
    assert.ok(groups.average.every(signal => signal.score >= 40 && signal.score < 75));
    assert.ok(groups.weak.every(signal => signal.score < 40));
    const rank = positionRank(player, players);
    assert.equal(rank.total, 10);
    assert.equal(rank.rank, 1 + players.filter(peer => peer.scoutIndex > player.scoutIndex).length);
  }
  assert.equal(positionRank({ ...players[0], scoutIndex: null }, players), null);
  const absent = scoutSignals({ ...players[0], scoutingEngine: { ...players[0].scoutingEngine, adjustedRadar: {} } });
  assert.equal(absent.strong.length + absent.average.length + absent.weak.length, 0);
});
