const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),path=require('node:path');
const root=path.resolve(__dirname,'..');
function load(file){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require,Date,Number,Set,Map,Object,JSON});return exports;}
const lib=load('lib/decisions.ts'),analysis=load('lib/match-analysis.ts');
// Explicit synthetic match stream, used only in tests.
const match=(id,date,homeScore=1,awayScore=0)=>({id,date,league:'UZB',seasonId:10,homeTeamId:1,awayTeamId:2,homeScore,awayScore,eventHash:'event'+id,lineupHash:'lineup'+id});
const appearance=(matchId,value,minutes=90,playerId=7)=>({matchId,playerId,teamId:1,position:'MF',minutes,stats:{keyPasses:value,goals:0},substitute:false});
const core={matches:[match(1,100),match(2,200),match(3,300,0,0),match(4,400,0,1),match(5,500,2,0)],appearances:[appearance(1,1),appearance(2,2),appearance(3,0),appearance(4,null),appearance(5,4)]};
const team={league:'UZB',seasonId:10,teamId:1},player={league:'UZB',seasonId:10,playerId:7};
function decision(overrides={}){return {id:'decision',needId:null,clubTeamId:1,target:team,subjectName:'Team',observation:'Observation',action:'Action',metric:'teamPoints',direction:'atLeast',threshold:1,window:3,minCoverage:0.8,cutoff:200,retrospective:true,baseline:lib.metricSnapshot(core,team,'teamPoints',[1,2]),createdAt:'2026-10-02',version:'decision-v1',...overrides};}
test('decision freezes baseline and evaluates the first next window, not the latest or earlier games',()=>{
 const d=decision(),saved=JSON.stringify(d.baseline);const extended={...core,matches:[...core.matches,match(6,600,7,0),match(9,150,9,0)]};
 const result=lib.evaluateDecision(extended,d);assert.equal(JSON.stringify(result.snapshot.matchIds),'[3,4,5]');assert.equal(result.snapshot.value,4/3);assert.equal(result.result,'met');assert.equal(result.delta,4/3-3);assert.equal(JSON.stringify(d.baseline),saved);
 const changed={...extended,matches:extended.matches.map(m=>m.id===1?{...m,homeScore:0,awayScore:4}:m)};assert.equal(lib.evaluateDecision(changed,d).delta,result.delta);
});
test('prospective decisions ignore old fixtures and newly imported older matches',()=>{
 const d=decision({cutoff:1000,retrospective:false});const result=lib.evaluateDecision({...core,matches:[...core.matches,match(9,900)]},d);assert.equal(result.remaining,3);assert.equal(result.result,'insufficient');assert.equal(result.snapshot.value,null);
});
test('scope excludes different league, season, teams, other players and duplicate matches',()=>{
 const data={...core,matches:[...core.matches,core.matches[2],{...match(6,600),league:'KAZ'},{...match(7,700),seasonId:11},{...match(8,800),homeTeamId:8,awayTeamId:9}],appearances:[...core.appearances,appearance(8,99,90,8)]};
 assert.equal(lib.targetMatches(data,team).length,5);assert.equal(lib.targetMatches(data,player).length,5);
});
test('player review uses covered minutes, preserves zeros, and requires enough observations',()=>{
 const d=decision({target:player,metric:'keyPasses',baseline:lib.metricSnapshot(core,player,'keyPasses',[1,2]),threshold:1});
 assert.equal(lib.evaluateDecision(core,d).snapshot.value,2);assert.equal(lib.evaluateDecision(core,d).result,'insufficient');
 const repaired={...core,appearances:core.appearances.map(a=>a.matchId===4?appearance(4,0,30):a)};
 const r=lib.evaluateDecision(repaired,d);assert.equal(r.snapshot.value,4/210*90);assert.equal(r.snapshot.minutes,210);assert.equal(r.result,'met');
 assert.equal(lib.metricSnapshot(core,player,'goals',[1,2]).value,0);assert.equal(lib.metricSnapshot(core,player,'xG',[1,2]).value,null);
});
test('lower is better criteria and saved review snapshots survive validated round trip',()=>{
 const d=decision({metric:'teamConceded',direction:'atMost',threshold:0.4,baseline:lib.metricSnapshot(core,team,'teamConceded',[1,2])});const r=lib.evaluateDecision(core,d);assert.equal(r.result,'met');
 d.review={at:'2026-10-02',result:r.result,snapshot:r.snapshot,comment:'Reviewed'};
 const parsed=lib.parseDecisionStore(JSON.stringify({version:1,needs:[],decisions:[d]}));assert.equal(parsed.decisions[0].review.snapshot.value,1/3);
 assert.equal(lib.evaluateDecision(core,{...d,threshold:0.2}).result,'missed');
});
test('invalid imports and broken references are rejected without replacing existing records',()=>{
 for(const v of ['broken','{}',JSON.stringify({version:1,needs:[],decisions:[decision({needId:'missing'})]}),JSON.stringify({version:1,needs:[],decisions:[decision({window:0})]}),JSON.stringify({version:1,needs:[],decisions:[decision({target:player})]})])assert.throws(()=>lib.parseDecisionStore(v));
 assert.equal(lib.parseDecisionStore(null).needs.length,0);
});
test('need, candidate, decision and review form a persistent chain',()=>{
 const need={id:'need',league:'UZB',teamId:1,teamName:'Club',seasonId:10,seasonName:'Season',position:'MF',detailedPosition:null,observation:'Few key passes',requirement:'Create chances',evidence:'Observed data',matchIds:[1,2],createdAt:'2026-10-02',status:'open',candidates:[{playerId:7,name:'Candidate',position:'MF',addedAt:'2026-10-02',reason:'Create chances',metrics:{keyPassesPer90:1.5},seasonIds:[10],matchIds:[1,2]}]};
 const d=decision({needId:need.id,target:player,metric:'keyPasses',baseline:lib.metricSnapshot(core,player,'keyPasses',[1,2])});const store=lib.parseDecisionStore(JSON.stringify({version:1,needs:[need],decisions:[d]}));
 assert.equal(store.needs[0].candidates[0].playerId,store.decisions[0].target.playerId);assert.equal(lib.evaluateDecision(core,store.decisions[0]).remaining,0);
});
test('coverage excludes missing values and evaluates saves only among keepers',()=>{
 const rows=[{minutes:90,position:'GK',stats:{saves:0,goals:0}},{minutes:30,position:'MF',stats:{saves:null,goals:null}}];
 const saves=analysis.metricCoverage(rows,'saves');assert.equal(saves.known,1);assert.equal(saves.total,1);assert.equal(saves.minutes,90);
 const goals=analysis.metricCoverage(rows,'goals');assert.equal(goals.known,1);assert.equal(goals.total,2);assert.equal(goals.totalMinutes,120);
});
test('minute shares sum to 100 and depth accepts source positions but rejects inference and wrong seasons',()=>{
 const rows=[appearance(1,1,90,7),appearance(1,1,30,8)];const profiles=[{id:'UZB-7',statsSeasonIds:[10],detailedPosition:'CM',detailedPositionConfidence:'low',detailedPositionMethod:'SofaScore cached player.positionsDetailed; snapshot date may be unknown'},{id:'UZB-8',statsSeasonIds:[10],detailedPosition:'AM',detailedPositionConfidence:'high',detailedPositionMethod:'formation inference'}];
 const depth=analysis.confirmedDepth(rows,profiles,10,'UZB');assert.equal(depth[0].share,75);assert.equal(depth[1].share,25);assert.equal(depth[0].detailed,'CM');assert.equal(depth[1].detailed,null);assert.equal(analysis.confirmedDepth(rows,profiles,11,'UZB')[0].detailed,null);
});
