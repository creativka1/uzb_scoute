const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),path=require('node:path');
const root=path.resolve(__dirname,'..');
function load(file){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require,Math,Number,String,Object,JSON,Map,Set});return exports;}
const lib=load('lib/recruitment.ts');
const need={id:'n',league:'UZB',teamId:1,teamName:'Club A',seasonId:10,seasonName:'2026',position:'MF',detailedPosition:'CM',observation:'Need creator',requirement:'More progression',evidence:'Depth',matchIds:[1],createdAt:'2026-10-04',status:'open',candidates:[]};
function player(id,club,role,minutes,confidence='medium',detailed='CM',seasonIds=[10]){return {id:`UZB-${id}`,league:'UZB',position:'MF',detailedPosition:detailed,club:{ru:club,uz:club},statsSeasonIds:seasonIds,minutesPlayed:minutes,scoutingEngine:{roleScore:role,confidence,strengths:[{key:'keyPassesPer90',percentile:80}]}};}
test('need ranking enforces league season position and excludes current team',()=>{
 const rows=lib.rankPlayersForNeed(need,[player(1,'Club A',99,1000),player(2,'Club B',80,900,'high'),player(3,'Club C',90,900,'high','AM'),{...player(4,'Club D',95,900,'high'),league:'KAZ'},player(5,'Club E',95,900,'high','CM',[11])]);
 assert.equal(rows.length,1);assert.equal(rows[0].player.id,'UZB-2');assert.ok(rows[0].fitScore>=70);assert.ok(rows[0].reasons.some(x=>x.startsWith('exact:')));
});
test('need ranking rewards role score sample and confidence transparently',()=>{
 const rows=lib.rankPlayersForNeed(need,[player(2,'Club B',82,1000,'high'),player(3,'Club C',65,200,'low')]);
 assert.equal(rows[0].player.id,'UZB-2');assert.ok(rows[0].fitScore>rows[1].fitScore);assert.ok(rows[0].reasons.some(x=>x==='role:82'));assert.ok(rows[0].reasons.some(x=>x==='minutes:1000'));
});
