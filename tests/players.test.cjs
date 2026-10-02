const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
const os = require('node:os');
const {NextRequest} = require('next/server');
const root = path.resolve(__dirname, '..');
function moduleFrom(file, extra = '', cwd = root) {
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8') + extra, {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX},
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, {exports, require, console, process: {cwd: () => cwd}, URL, Date, Object, Number});
  return exports;
}
const api = moduleFrom('app/api/players/route.ts', '\nexports.testHelpers = { formatMarketValue, percentileRank };');
const recruitment = moduleFrom('lib/recruitment.ts');
async function get(league, season) {
  const res = await api.GET(new NextRequest(`http://localhost/api/players?league=${league}&season=${season}`));
  assert.equal(res.status, 200);
  return {players: await res.json(), meta: JSON.parse(res.headers.get('X-Data-Metadata'))};
}

test('exact season boundaries and per-league benchmarks', async () => {
  const source = JSON.parse(fs.readFileSync(path.join(root, 'data/superliga_stats.json')));
  for (const league of ['UZB', 'KAZ']) {
    for (const season of ['current', 'previous', 'two', 'latest']) {
      const {players, meta} = await get(league, season);
      const mode = meta.periods[league].mode;
      const field = mode === 'two' ? 'twoSeasons' : mode === 'previous' ? 'previousSeason' : 'currentSeason';
      assert.equal(players.length, source.filter(p => p.league === league && p[field]?.minutesPlayed > 0).length);
      for (const p of players) {
        assert.equal(p.statsSeasonType, mode);
        assert.equal(p.league, league);
        const raw = source.find(r => r.sofaId === Number(p.id.split('-')[1]) && r.league === league);
        assert.equal(p.minutesPlayed, raw[field].minutesPlayed);
        assert.equal(p.interceptions, raw[field].observedTotals.interceptions);
        assert.equal(p.xG, raw[field].observedTotals.xG);
        if (!meta.periods[league].complete) assert.equal(p.scoutingEngine.confidence, 'low');
      }
    }
  }
  const all = (await get('all', 'previous')).players;
  const uzb = (await get('UZB', 'previous')).players;
  for (const p of uzb) assert.deepEqual(all.find(a => a.id === p.id).radar, p.radar);
});

test('bad filters and unavailable/corrupt datasets return errors, never a successful empty list', async () => {
  assert.equal((await api.GET(new NextRequest('http://localhost/api/players?season=bogus'))).status, 400);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'uzstat-test-'));
  try {
    const isolated = moduleFrom('app/api/players/route.ts', '', dir);
    assert.equal((await isolated.GET(new NextRequest('http://localhost/api/players'))).status, 503);
    fs.mkdirSync(path.join(dir, 'data/audits'), {recursive: true});
    fs.writeFileSync(path.join(dir, 'data/superliga_stats.json'), '{broken');
    fs.writeFileSync(path.join(dir, 'data/audits/data_integrity.json'), '{}');
    assert.equal((await isolated.GET(new NextRequest('http://localhost/api/players'))).status, 500);
  } finally { fs.rmSync(dir, {recursive: true, force: true}); }
});

test('money formatting preserves integer millions', () => {
  assert.equal(api.testHelpers.formatMarketValue(10000000).formatted, '€10m');
  assert.equal(api.testHelpers.formatMarketValue(100000000).formatted, '€100m');
  assert.equal(api.testHelpers.formatMarketValue(null).formatted, '—');
  assert.equal(api.testHelpers.formatMarketValue(0).raw, 0);
  assert.equal(api.testHelpers.percentileRank([0, 1, 2], null), null);
});

test('budget candidates exclude unknown and more expensive values; two GK metrics suffice', async () => {
  const players = (await get('UZB', 'previous')).players;
  for (const target of players) {
    for (const {player, comparedMetrics} of recruitment.getBudgetReplacements(target, players)) {
      assert.notEqual(player.rawMarketValueEUR, null);
      assert.ok(player.rawMarketValueEUR < target.rawMarketValueEUR);
      assert.equal(player.position, target.position);
      assert.ok(comparedMetrics >= (target.position === 'GK' ? 2 : 3));
    }
  }
  // Explicit synthetic variations of a source-backed GK verify the two-axis path.
  const keeper = players.find(p => p.position === 'GK' && p.radar.m1 !== null && p.radar.m2 !== null);
  assert.ok(keeper);
  const target = {...keeper, id: 'fixture-target', rawMarketValueEUR: 100};
  const cheap = {...keeper, id: 'fixture-cheap', rawMarketValueEUR: 50};
  const unknown = {...keeper, id: 'fixture-unknown', rawMarketValueEUR: null};
  assert.equal(recruitment.getBudgetReplacements(target, [cheap, unknown]).length, 1);
  assert.equal(recruitment.getBudgetReplacements(unknown, [cheap]).length, 0);
});

test('partial observations expose matching minute denominators',async()=>{
const list=(await get('UZB','previous')).players;let recovered=0;
for(const p of list){for(const d of Object.values(p.statsMetricDetails)){if(d.status==='partial'&&d.value!==null)recovered++;if(d.per90!==null)assert.ok(Math.abs(d.per90-d.value/d.minutes*90)<0.00001);}for(const [key,d] of Object.entries(p.roleMetricCoverage)){if(key.endsWith('Per90')&&d.value!==undefined&&d.per90!==null)assert.equal(p.roleMetrics[key],d.per90);}}assert.ok(recovered>0);
});
test('similarity ignores price by default and fixes season and axes',async()=>{
const s=(await get('UZB','previous')).players.find(p=>p.position==='GK'&&p.radar.m1!==null&&p.radar.m2!==null);
const target={...s,id:'target',rawMarketValueEUR:null},same={...s,id:'same',rawMarketValueEUR:null};
const result=recruitment.getSimilarPlayers(target,[same,{...same,id:'other',statsSeasonIds:[-1]},{...same,id:'missing',radar:{...same.radar,m2:null}}]);assert.equal(result.length,1);assert.equal(result[0].similarity,100);assert.equal(result[0].player.id,'same');
});


test('group mean uses eligible raw metrics within one league, position and period', async () => {
  const all = (await get('all', 'previous')).players;
  for (const league of ['UZB', 'KAZ']) {
    const list = (await get(league, 'previous')).players;
    for (const p of list) {
      assert.deepEqual(all.find(a => a.id === p.id).roleBenchmarks, p.roleBenchmarks);
      for (const [key, benchmark] of Object.entries(p.roleBenchmarks)) {
        const values = list.filter(q => q.position === p.position).filter(q => {
          const coverage = q.roleMetricCoverage[key];
          return coverage.minutes >= 450 && coverage.totalMinutes > 0 && coverage.minutes / coverage.totalMinutes >= 0.8;
        }).map(q => q.roleMetrics[key]).filter(Number.isFinite);
        assert.equal(benchmark.count, values.length);
        if (values.length < 3) {
          assert.equal(benchmark.mean, null);
          assert.equal(benchmark.max, null);
        } else {
          assert.ok(Math.abs(benchmark.mean - values.reduce((a,b) => a+b,0) / values.length) < 1e-9);
          assert.equal(benchmark.max, Math.max(...values));
        }
      }
    }
  }
});
