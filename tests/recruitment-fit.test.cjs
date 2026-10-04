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


function rolePlayer({id,position,detailed,radar,role=70,minutes=900,confidence='high',club='Other',seasonIds=[10]}){
 return {
  id:`UZB-${id}`,league:'UZB',position,detailedPosition:detailed,
  club:{ru:club,uz:club},statsSeasonIds:seasonIds,minutesPlayed:minutes,radar,
  scoutingEngine:{roleScore:role,confidence,strengths:[]}
 };
}
function roleNeed(position,detailed){return {...need,position,detailedPosition:detailed};}

test('GK profile prioritises shot stopping over distribution when broad role score is equal',()=>{
 const rows=lib.rankPlayersForNeed(roleNeed('GK','GK'),[
  rolePlayer({id:10,position:'GK',detailed:'GK',radar:{m1:90,m2:40,m3:null,m4:null,m5:null,m6:null}}),
  rolePlayer({id:11,position:'GK',detailed:'GK',radar:{m1:55,m2:90,m3:null,m4:null,m5:null,m6:null}})
 ]);
 assert.equal(rows[0].player.id,'UZB-10');
 assert.equal(rows[0].profileKey,'GK');
 assert.ok(rows[0].reasons.some(x=>x.startsWith('metric:savesPer90:90:')));
});

test('CB profile rewards defending and secure passing over creative outliers',()=>{
 const rows=lib.rankPlayersForNeed(roleNeed('DF','CB'),[
  rolePlayer({id:20,position:'DF',detailed:'CB',radar:{m1:80,m2:90,m3:80,m4:20,m5:20,m6:null}}),
  rolePlayer({id:21,position:'DF',detailed:'CB',radar:{m1:40,m2:30,m3:55,m4:95,m5:95,m6:null}})
 ]);
 assert.equal(rows[0].player.id,'UZB-20');
 assert.equal(rows[0].profileKey,'CB');
 assert.ok(rows[0].profileScore>rows[1].profileScore);
});

test('DM profile ranks ball winning and circulation above a pure attacking midfield profile',()=>{
 const rows=lib.rankPlayersForNeed(roleNeed('MF','DM'),[
  rolePlayer({id:30,position:'MF',detailed:'DM',radar:{m1:50,m2:20,m3:30,m4:90,m5:90,m6:null}}),
  rolePlayer({id:31,position:'MF',detailed:'DM',radar:{m1:95,m2:90,m3:95,m4:30,m5:60,m6:null}})
 ]);
 assert.equal(rows[0].player.id,'UZB-30');
 assert.equal(rows[0].profileKey,'DM');
});

test('winger profile values dribbling creation and assists instead of only goals and shots',()=>{
 const rows=lib.rankPlayersForNeed(roleNeed('FW','RW'),[
  rolePlayer({id:40,position:'FW',detailed:'RW',radar:{m1:30,m2:80,m3:50,m4:90,m5:95,m6:null}}),
  rolePlayer({id:41,position:'FW',detailed:'RW',radar:{m1:90,m2:40,m3:90,m4:40,m5:40,m6:null}})
 ]);
 assert.equal(rows[0].player.id,'UZB-40');
 assert.equal(rows[0].profileKey,'WINGER');
});

test('ST profile puts finishing and shot volume ahead of secondary creation',()=>{
 const rows=lib.rankPlayersForNeed(roleNeed('FW','ST'),[
  rolePlayer({id:50,position:'FW',detailed:'ST',radar:{m1:90,m2:20,m3:90,m4:20,m5:70,m6:null}}),
  rolePlayer({id:51,position:'FW',detailed:'ST',radar:{m1:50,m2:90,m3:50,m4:90,m5:90,m6:null}})
 ]);
 assert.equal(rows[0].player.id,'UZB-50');
 assert.equal(rows[0].profileKey,'ST');
});

test('missing role metric is renormalized rather than treated as zero',()=>{
 const rows=lib.rankPlayersForNeed(roleNeed('MF','DM'),[
  rolePlayer({id:60,position:'MF',detailed:'DM',radar:{m1:null,m2:null,m3:null,m4:90,m5:90,m6:null},role:55}),
  rolePlayer({id:61,position:'MF',detailed:'DM',radar:{m1:60,m2:60,m3:60,m4:55,m5:55,m6:null},role:55})
 ]);
 assert.equal(rows[0].player.id,'UZB-60');
 assert.ok(rows[0].profileCoverage<100);
 assert.ok(rows[0].profileScore>=85);
});
