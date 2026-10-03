const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
const root = path.resolve(__dirname, '..');
const cache = new Map();
function load(file) {
  if (cache.has(file)) return cache.get(file);
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX},
  }).outputText;
  const imports = name => {
    if (!name.startsWith('@/') && !name.startsWith('.')) return require(name);
    const base = name.startsWith('@/') ? name.slice(2) : path.join(path.dirname(file), name);
    return load(base + (fs.existsSync(path.join(root, base + '.tsx')) ? '.tsx' : '.ts'));
  };
  vm.runInNewContext(code, {exports, require: imports, console, process: {cwd: () => root}, URL, Date, Object, Number});
  cache.set(file, exports);
  return exports;
}
const ui = load('components/football/player-analysis.tsx');
const api = load('app/api/players/route.ts');
const {NextRequest} = require('next/server');
let players;
async function sourcePlayers() {
  return players ||= await (await api.GET(new NextRequest('http://localhost/api/players?league=UZB&season=previous'))).json();
}
function render(component, props) {return renderToStaticMarkup(React.createElement(component, props));}

test('display formatter distinguishes an actual zero from a missing source value', () => {
  assert.equal(ui.formatValue(null, 1, '%'), '—');
  assert.equal(ui.formatValue(0, 1, '%'), '0.0%');
  assert.equal(ui.formatValue(undefined), '—');
  assert.equal(ui.formatValue(NaN), '—');
});

test('profile does not turn missing raw statistics into zero or a percentile', async () => {
  const player = (await sourcePlayers()).find(p => p.position === 'MF');
  // Isolated rendering variant tests the missing-value presentation, not production data.
  const missing = {...player, roleMetrics: {}, radar: {m1:null,m2:null,m3:null,m4:null,m5:null,m6:null}};
  for (const lang of ['ru', 'uz']) {
    const html = render(ui.MetricProfile, {player: missing, lang});
    assert.ok(html.includes('—'));
    for (const row of html.split('class="metric-line primary"').slice(1)) assert.ok(!row.split('class="profile-row"')[0].includes('style="width:'));
    assert.ok(!html.includes('N='));
    assert.ok(!/P\d{1,3}/.test(html));
    assert.ok(!/<details[^>]* open/.test(html));
  }
});

test('comparison still shows the second player when the first has missing metrics', async () => {
  const list = await sourcePlayers();
  const other = list.find(p => p.position === 'MF' && p.radar.m2 !== null);
  assert.ok(other);
  const missing = {...other, id: 'render-fixture', roleMetrics: {}, radar: {m1:null,m2:null,m3:null,m4:null,m5:null,m6:null}};
  const html = render(ui.MetricProfile, {player: missing, comparison: other, lang: 'ru'});
  assert.ok(html.includes('profile-track comparison'));
  assert.ok(html.includes(ui.formatValue(other.roleMetrics.assistsPer90, 2)));
});

test('all real source-backed player positions render with missing fields safely', async () => {
  const list = await sourcePlayers();
  for (const pos of new Set(list.map(p => p.position))) {
    const player = list.find(p => p.position === pos);
    const html = render(ui.PlayerDossier, {player, players: [], lang: 'ru', saved: false, canSave: true,
      onSave(){},onCompare(){},onCompareReplacement(){},onPrint(){},onClose(){}, detailedLabel:'—', footLabel:'—'});
    assert.ok(html.includes('Профиль игрока'));
    assert.ok(html.includes('Источник и надёжность данных'));
    assert.ok(!html.includes('NaN'));
    assert.ok(!html.includes('undefined'));
  }
});

test('zero assists give an empty actual bar despite tied nonzero percentile',async()=>{
const p=(await sourcePlayers()).find(p=>p.position==='MF'&&p.assists===0&&p.radar.m2>0);assert.ok(p);
const html=render(ui.MetricProfile,{player:p,lang:'ru'}),row=html.split('data-metric="assistsPer90"')[1].split('data-metric=')[0];assert.ok(row.includes('0.00'));assert.ok(row.includes('width:0%'));assert.ok(!row.includes(`width:${p.radar.m2}%`));assert.ok(html.includes('Сравнение со средним'));assert.equal(ui.formatValue(0.0001,2),'<0.01');
});


test('equal player values use the group scale and show the actual mean', async () => {
  const source = (await sourcePlayers()).find(p => p.position === 'MF');
  const player = {...source, roleMetrics: {...source.roleMetrics, keyPassesPer90: 1},
    roleBenchmarks: {...source.roleBenchmarks, keyPassesPer90: {count: 10, mean: 1.5, max: 4}}};
  const other = {...player, id: 'render-other'};
  const html = render(ui.MetricProfile, {player, comparison: other, lang: 'ru'});
  const row = html.split('data-metric="keyPassesPer90"')[1].split('data-metric=')[0];
  assert.equal((row.match(/width:25%/g) || []).length, 2);
  assert.equal((row.match(/left:37.5%/g) || []).length, 2);
  assert.ok(!html.includes('class="metric-line mean"'));
  assert.ok(!html.includes('mean-track'));
  assert.ok(row.includes('1.50'));
  assert.ok(row.includes('0–4.00'));
  assert.ok(!row.includes('width:100%'));
  assert.ok(!html.includes('Место в группе'));
});
