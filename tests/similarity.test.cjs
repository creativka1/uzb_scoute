const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const exportsForTest = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/recruitment.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports: exportsForTest, require });
const { calculateSimilarity, getSimilarPlayers, SIMILARITY_METRICS, SIMILARITY_PROFILES } = exportsForTest;

// Synthetic observations exercise the mathematics, never enter production data.
function player(id, overrides = {}, values = {}) {
  const statsMetricDetails = {};
  for (const metric of SIMILARITY_METRICS) {
    const value = Object.hasOwn(values, metric.key) ? values[metric.key] : 1;
    statsMetricDetails[metric.source] = { value, per90: metric.rate ? value : null, minutes: 900,
      totalMinutes: 900, matches: 10, totalMatches: 10, status: value === null ? 'missing' : 'complete', eventIds: [] };
  }
  return { id, league: 'UZB', position: 'MF', analyticalRole: 'MIDFIELDER', detailedPosition: null,
    statsSeasonIds: [72383], statsSeasonType: 'previous', statsSeasonLabel: '2025', minutesPlayed: 900,
    rawMarketValueEUR: 100, scoutIndex: 80, radar: { m1: 90, m2: 90, m3: 90, m4: 90, m5: 90, m6: null },
    roleMetrics: {}, statsMetricDetails, ...overrides };
}
function offensive(value) { return { goalsPer90: value, xGPer90: value, assistsPer90: value }; }

test('weighted exponential similarity matches an independently calculated four-player example', () => {
  const a = player('a', {}, offensive(0)), b = player('b', {}, offensive(3));
  const group = [a, b, player('c', {}, offensive(1)), player('d', {}, offensive(2))];
  const result = calculateSimilarity(a, b, group);
  // MF: total expected weight 60.5; goals+xG+assists weight 14.
  // Midrank percentiles are 12.5 and 87.5; every other metric ties at 50.
  const d2 = 14 * .75 ** 2 / 60.5;
  assert.equal(result.coverage, 1);
  assert.equal(result.expectedWeight, 60.5);
  assert.ok(Math.abs(result.distance - Math.sqrt(d2)) < 1e-12);
  assert.equal(result.similarity, Math.round(100 * Math.exp(-2.5 * d2)));
  assert.equal(result.metrics.find(metric => metric.key === 'xGPer90').percentile1, 12.5);
  assert.equal(result.metrics.find(metric => metric.key === 'xGPer90').percentile2, 87.5);
  assert.equal(result.comparedMetrics, 20);
});

test('large goals/xG/assists differences cannot yield 90+ merely because other metrics match', () => {
  for (const [position, detailedPosition] of [['MF', null], ['MF', 'AM'], ['MF', 'CM'], ['MF', 'DM'],
    ['FW', 'ST'], ['FW', 'RW'], ['DF', 'CB'], ['DF', 'RB']]) {
    const a = player('a', { position, detailedPosition }, offensive(0));
    const b = player('b', { position, detailedPosition }, offensive(4));
    const result = calculateSimilarity(a, b, [a, b]);
    assert.equal(result.status, 'ok');
    assert.ok(result.similarity < 90, `${detailedPosition ?? position}: ${result.similarity}`);
    assert.equal(result.subscores.possession.similarity, 100);
    assert.ok(result.subscores.attack.similarity < 90);
  }
});

test('matching only the old five role axes fails weighted coverage rather than yielding high similarity', () => {
  const keep = new Set(['keyPassesPer90', 'assistsPer90', 'dribbleSuccessPct', 'tacklesPer90', 'passAccPct']);
  const missing = Object.fromEntries(SIMILARITY_METRICS.filter(metric => !keep.has(metric.key)).map(metric => [metric.key, null]));
  const a = player('a', {}, missing), b = player('b', {}, missing);
  const result = calculateSimilarity(a, b, [a, b]);
  assert.equal(result.comparedMetrics, 5);
  assert.ok(Math.abs(result.coverage - 25 / 60.5) < 1e-12);
  assert.equal(result.similarity, null);
  assert.equal(result.distance, null);
  assert.equal(result.reason, 'Недостаточно данных');
  assert.equal(getSimilarPlayers(a, [b])[0].similarity, null);
});

test('60% coverage is inclusive and uses the full expected role weights', () => {
  const missing = Object.fromEntries(SIMILARITY_METRICS.map(metric => [metric.key, null]));
  const a = player('a', { position: 'GK' }, { ...missing, savesPer90: 1, aerialWinPct: 60 });
  const b = player('b', { position: 'GK' }, { ...missing, savesPer90: 1, aerialWinPct: 60 });
  const result = calculateSimilarity(a, b, [a, b]);
  assert.equal(result.expectedWeight, 20);
  assert.equal(result.coverage, .6);
  assert.equal(result.similarity, 100);
  b.statsMetricDetails.aerialWinPct.value = null;
  assert.equal(calculateSimilarity(a, b, [a, b]).coverage, .5);
  assert.equal(calculateSimilarity(a, b, [a, b]).similarity, null);
});

test('pair reliability uses the lesser covered metric minutes and the requested square-root scale', () => {
  const a = player('a', {}, { goalsPer90: 0 }), b = player('b', {}, { goalsPer90: 4 });
  b.statsMetricDetails.goals.minutes = 225;
  b.minutesPlayed = 9000; // total season minutes must not override metric minutes
  const result = calculateSimilarity(a, b, [a, b]);
  const contribution = result.metrics.find(metric => metric.key === 'goalsPer90');
  assert.equal(contribution.coveredMinutes, 225);
  assert.equal(contribution.reliability, .5);
  const d2 = (4 * .5 * .5 ** 2) / (60.5 - 4 + 4 * .5);
  assert.ok(Math.abs(result.distance - Math.sqrt(d2)) < 1e-12);
  assert.equal(result.similarity, Math.round(100 * Math.exp(-2.5 * d2)));
  a.statsMetricDetails.goals.minutes = 90;
  assert.equal(calculateSimilarity(a, b, [a, b]).metrics.find(metric => metric.key === 'goalsPer90').reliability, Math.sqrt(.1));
});

test('null, non-finite values and unknown minutes are excluded while actual zero remains available', () => {
  const a = player('a', {}, { goalsPer90: 0 }), b = player('b', {}, { goalsPer90: 0 });
  assert.equal(calculateSimilarity(a, b, [a, b]).metrics.find(metric => metric.key === 'goalsPer90').diff, 0);
  b.roleMetrics.goalsPer90 = 0; // stale fallback cannot fill an explicit null observation
  for (const missing of [null, undefined, NaN, Infinity]) {
    b.statsMetricDetails.goals.per90 = missing;
    assert.ok(!calculateSimilarity(a, b, [a, b]).metrics.some(metric => metric.key === 'goalsPer90'));
  }
  b.statsMetricDetails.goals.per90 = 0;
  for (const minutes of [0, null, NaN, Infinity]) {
    b.statsMetricDetails.goals.minutes = minutes;
    assert.ok(!calculateSimilarity(a, b, [a, b]).metrics.some(metric => metric.key === 'goalsPer90'));
  }
  b.statsMetricDetails = {};
  assert.equal(calculateSimilarity(a, b, [a, b]).similarity, null);
});

test('comparison is symmetric and percentiles ignore other leagues, seasons, roles and duplicate IDs', () => {
  const a = player('a', { detailedPosition: 'AM' }, offensive(0));
  const b = player('b', { detailedPosition: 'AM' }, offensive(3));
  const group = [a, b, player('c', { detailedPosition: 'AM' }, offensive(1))];
  const result = calculateSimilarity(a, b, group);
  assert.equal(result.similarity, calculateSimilarity(b, a, group).similarity);
  const unrelated = [player('other-league', { detailedPosition: 'AM', league: 'KAZ' }),
    player('other-role', { detailedPosition: 'DM' }), player('other-season', { detailedPosition: 'AM', statsSeasonIds: [99] }),
    player('other-mode', { detailedPosition: 'AM', statsSeasonType: 'current' })];
  assert.equal(JSON.stringify(calculateSimilarity(a, b, [...group, ...group, ...unrelated])), JSON.stringify(result));
  assert.equal(getSimilarPlayers(a, [...group, ...unrelated]).length, 2);
  assert.equal(calculateSimilarity(a, unrelated[1], group).status, 'incomparable');
  const two = { ...a, statsSeasonIds: [11, 10], statsSeasonType: 'two' };
  assert.equal(calculateSimilarity(two, { ...b, statsSeasonIds: [10, 11], statsSeasonType: 'two' }, []).status, 'ok');
});

test('six subscores have independent coverage and missing progression stays unknown', () => {
  const a = player('a'), b = player('b');
  for (const source of ['progressiveRuns', 'progressivePasses', 'progressiveCarries']) delete b.statsMetricDetails[source];
  const result = calculateSimilarity(a, b, [a, b]);
  assert.equal(Object.keys(result.subscores).length, 6);
  assert.equal(result.subscores.progression.similarity, null);
  assert.equal(result.subscores.progression.coverage, 0);
  assert.equal(result.subscores.attack.similarity, 100);
  assert.equal(result.subscores.possession.similarity, 100);
  assert.ok(result.coverage < 1 && result.coverage > .6);
});

test('AM and DM weights follow their roles; goals do not replace defensive metrics', () => {
  const am = SIMILARITY_PROFILES.AM, dm = SIMILARITY_PROFILES.DM;
  assert.ok(am.xAPer90 > dm.xAPer90 && am.keyPassesPer90 > dm.keyPassesPer90);
  assert.ok(am.assistsPer90 > dm.assistsPer90 && am.dribbleSuccessPct > dm.dribbleSuccessPct);
  assert.ok(dm.tacklesPer90 > am.tacklesPer90 && dm.interceptionsPer90 > am.interceptionsPer90);
  assert.ok(dm.passAccPct > am.passAccPct && dm.duelWinPct > am.duelWinPct);
  const a = player('a', { position: 'GK' }, offensive(0)), b = player('b', { position: 'GK' }, offensive(4));
  assert.equal(calculateSimilarity(a, b, [a, b]).similarity, 100);
});

test('budget filtering preserves the complete benchmark and never changes Scout Index or player data', () => {
  const a = player('a', {}, offensive(0)), b = player('b', { rawMarketValueEUR: 50 }, offensive(2));
  const costly = player('c', { rawMarketValueEUR: 200 }, offensive(4));
  const group = [a, b, costly], before = JSON.stringify(group);
  assert.equal(getSimilarPlayers(a, group).find(row => row.player.id === 'b').similarity, getSimilarPlayers(a, group, true)[0].similarity);
  assert.equal(JSON.stringify(group), before);
});
