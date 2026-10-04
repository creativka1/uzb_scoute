const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm"),
  ts = require("typescript"),
  path = require("node:path");
const root = path.resolve(__dirname, "..");
function load(file) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync(path.join(root, file), "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    { exports, require, Math, Number, String, Object, JSON, Map, Set, Date },
  );
  return exports;
}
const radar = load("lib/radar.ts"),
  dash = load("lib/dashboard.ts");
const player = {
  position: "MF",
  league: "UZB",
  statsSeasonIds: [26],
  radar: { m1: null, m2: 80, m3: 0, m4: 92, m5: 72, m6: null },
};
test("a missing key-pass percentile leaves a four-axis radar and preserves real zero", () => {
  const s = radar.radarSeries(player);
  assert.equal(s.axes.length, 4);
  assert.equal(s.axes[1].value, 0);
  assert.equal(s.missing.join(","), "keyPassesPer90");
  assert.equal(s.compare, false);
});
test("comparison uses shared available axes without substituting missing values", () => {
  const other = { ...player, radar: { ...player.radar, m1: 50, m3: null } };
  const s = radar.radarSeries(player, other);
  assert.equal(s.axes.length, 3);
  assert.equal(s.compare, true);
  assert.equal(
    s.axes.map((a) => a.key).join(","),
    "assistsPer90,tacklesPer90,passAccPct",
  );
});
test("a different season never gets a comparison contour", () => {
  const s = radar.radarSeries(player, { ...player, statsSeasonIds: [25] });
  assert.equal(s.compare, false);
  assert.equal(s.axes.length, 4);
});
const match = (id, homeScore, awayScore, date = 1770000000) => ({
  id,
  homeTeamId: 1,
  awayTeamId: 2,
  homeScore,
  awayScore,
  date,
});
test("loaded results count a real 0–0 but exclude an unknown result", () => {
  const rows = dash.seasonTable([
    match(1, 0, 0),
    match(2, 2, 1),
    match(3, null, 0),
  ]);
  const team = rows.find((r) => r.id === 1);
  assert.equal(team.played, 2);
  assert.equal(team.points, 4);
  assert.equal(team.won, 1);
  assert.equal(team.drawn, 1);
  assert.equal(team.gf, 2);
  assert.equal(team.ga, 1);
});
test("season cumulative chart sorts by match date and does not create a zero result for missing scores", () => {
  const s = dash.teamProgress(
    [
      match(2, 0, 1, 1770200000),
      match(3, null, null, 1770300000),
      match(1, 2, 1, 1770000000),
    ],
    1,
  );
  assert.equal(s.length, 2);
  assert.equal(s[0].points, 3);
  assert.equal(s[1].points, 3);
  assert.equal(s[1].gf, 2);
  assert.equal(s[1].ga, 2);
});
test("monthly goals sum match score once and retain a real scoreless month", () => {
  const s = dash.monthlyGoals([
    match(1, 0, 0, Date.UTC(2026, 1, 1) / 1000),
    match(2, 2, 1, Date.UTC(2026, 2, 1) / 1000),
    match(3, null, null, Date.UTC(2026, 3, 1) / 1000),
  ]);
  assert.equal(s.length, 2);
  assert.equal(s[0].goals, 0);
  assert.equal(s[1].goals, 3);
});
