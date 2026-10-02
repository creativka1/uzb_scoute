const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),path=require('node:path'),os=require('node:os');
const {gunzipSync}=require('node:zlib'),{NextRequest}=require('next/server');
const root=path.resolve(__dirname,'..');
function load(file,cwd=root){const exports={};const code=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText;vm.runInNewContext(code,{exports,require,console,process:{cwd:()=>cwd},URL,Date,Object,Number});return exports;}
const api=load('app/api/analysis/route.ts'),analysis=load('lib/match-analysis.ts');
const core=JSON.parse(gunzipSync(fs.readFileSync(path.join(root,'data/match_core.json.gz'))));
const request=q=>new NextRequest('http://localhost/api/analysis?'+q);
test('explicit league, season, team and player scopes',async()=>{
for(const league of ['UZB','KAZ'])for(const season of core.seasons[league]){const response=await api.GET(request(`league=${league}&seasonId=${season.id}`));assert.equal(response.status,200);const data=await response.json();assert.ok(data.matches.every(m=>m.league===league&&m.seasonId===season.id));const ids=new Set(data.matches.map(m=>m.id));assert.ok(data.appearances.every(a=>ids.has(a.matchId)));if(season===core.seasons[league][0])assert.equal(data.matches.length,0);}
const a=core.appearances[0],m=core.matches.find(m=>m.id===a.matchId);
const team=await(await api.GET(request(`league=${m.league}&seasonId=${m.seasonId}&teamId=${a.teamId}`))).json();assert.ok(team.matches.every(m=>[m.homeTeamId,m.awayTeamId].includes(a.teamId)));assert.ok(team.appearances.some(p=>p.teamId!==a.teamId));
const player=await(await api.GET(request(`league=${m.league}&playerId=${a.playerId}`))).json();assert.ok(player.appearances.every(p=>p.playerId===a.playerId));assert.equal(player.matches.length,new Set(player.appearances.map(p=>p.matchId)).size);
});
test('invalid, unavailable and corrupt store return errors',async()=>{
for(const q of ['league=BAD','seasonId=wat','seasonId=1','playerId=-2','teamId=1.2'])assert.equal((await api.GET(request(q))).status,400);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'match-core-test-'));try{const isolated=load('app/api/analysis/route.ts',dir);assert.equal((await isolated.GET(request(''))).status,503);fs.mkdirSync(path.join(dir,'data'));fs.writeFileSync(path.join(dir,'data/match_core.json.gz'),'broken');assert.equal((await isolated.GET(request(''))).status,500);}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('partial per90 uses covered minutes and preserves zero',()=>{const rows=[{minutes:30,stats:{assists:1,goals:0}},{minutes:90,stats:{assists:null,goals:null}}];const a=analysis.observedMetric(rows,'assists');assert.equal(a.per90,3);assert.equal(a.minutes,30);assert.equal(a.matches,1);assert.equal(analysis.observedMetric(rows,'goals').per90,0);assert.equal(analysis.observedMetric(rows,'xG').value,null);});
test('team form handles away scores and excludes unknown scores',()=>{const a=analysis.teamWindow([{homeTeamId:1,awayTeamId:2,homeScore:2,awayScore:0},{homeTeamId:3,awayTeamId:1,homeScore:1,awayScore:1},{homeTeamId:1,awayTeamId:4,homeScore:null,awayScore:0}],1);assert.equal(a.pointsPerMatch,2);assert.equal(a.goalsFor,3);assert.equal(a.goalsAgainst,1);assert.equal(a.scored,2);assert.equal(a.played,3);assert.equal(analysis.teamWindow([],1).pointsPerMatch,null);});
