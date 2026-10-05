// Runs the actual players API and ranking code against the committed dataset.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const {NextRequest}=require('next/server');
const root=path.resolve(__dirname,'..'),cache=new Map();
function load(file){
 if(cache.has(file))return cache.get(file);
 const exports={};cache.set(file,exports);
 const imports=name=>name.startsWith('@/')?load(name.slice(2)+'.ts'):name.startsWith('.')?load(path.join(path.dirname(file),name)+'.ts'):require(name);
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{exports,require:imports,console,process,URL,Date,Object,Number,Map,Set,Math,String});return exports;
}
(async()=>{
 const api=load('app/api/players/route.ts'),rank=load('lib/recruitment.ts');
 const report={version:rank.NEED_FIT_VERSION,generatedAt:new Date().toISOString(),policy:'Committed current-season data; no fabricated candidates; deterministic ranking.',leagues:{}};
 for(const league of ['UZB','KAZ']){
  const response=await api.GET(new NextRequest(`http://localhost/api/players?league=${league}&season=current`));if(response.status!==200)throw Error(`players API: ${response.status}`);
  const players=await response.json(),meta=JSON.parse(response.headers.get('X-Data-Metadata')),period=meta.periods[league];
  const roles={GK:['GK','GK'],CB:['DF','CB'],DM:['MF','DM'],WINGER:['FW','RW'],ST:['FW','ST']};
  const result={period:period.label,seasonId:period.seasons[0].id,complete:period.complete,playerCount:players.length,roles:{}};
  for(const [role,[position,detailedPosition]] of Object.entries(roles)){
   const need={id:'audit',status:'open',league,seasonId:result.seasonId,teamName:'',position,detailedPosition};
   const roleNeeds=role==='WINGER'?[{...need,detailedPosition:'RW'},{...need,detailedPosition:'LW'}]:[need];
   const unique=(rows)=>[...new Map(rows.map(r=>[r.player.id,r])).values()].sort((a,b)=>b.fitScore-a.fitScore||b.profileScore-a.profileScore||a.player.id.localeCompare(b.player.id));
   const rows=unique(roleNeeds.flatMap(n=>rank.rankPlayersForNeed(n,players)));
   const provisional=unique(roleNeeds.flatMap(n=>rank.rankPlayersForNeed(n,players,{allowUnconfirmedPosition:true})));
   result.roles[role]={preliminaryTop10:provisional.slice(0,10).map(r=>({id:r.player.id,name:r.player.name.ru,club:r.player.club.ru,minutes:r.player.minutesPlayed,fit:r.fitScore,coverage:r.profileCoverage,positionConfirmed:r.positionConfirmed??!!r.player.detailedPosition,reasons:r.reasons})),candidateCount:rows.length,confirmedRolePlayers:players.filter(p=>role==='WINGER'?['RW','LW','RM','LM'].includes(p.detailedPosition):p.detailedPosition===detailedPosition).length,top10:rows.slice(0,10).map(r=>({id:r.player.id,name:r.player.name.ru,club:r.player.club.ru,position:r.player.position,detailedPosition:r.player.detailedPosition,minutes:r.player.minutesPlayed,fit:r.fitScore,profile:r.profileScore,coverage:r.profileCoverage,reasons:r.reasons})),flags:rows.slice(0,10).flatMap(r=>[...(r.player.minutesPlayed<450?[`${r.player.id}: below 450 minutes`]:[]),...(r.profileCoverage<60?[`${r.player.id}: role metric coverage below 60%`]:[]),...(r.reasons.includes('profileFallback:broadRoleScore')?[`${r.player.id}: broad fallback`]:[]),...(r.player.scoutingEngine.roleScore===null?[`${r.player.id}: no reliable role score`]:[])])};
  }
  report.leagues[league]=result;
 }
 const out=process.argv[2]||`docs/audits/${report.version}-2026.json`;fs.writeFileSync(path.join(root,out),JSON.stringify(report,null,2)+'\n');
 for(const [league,d] of Object.entries(report.leagues)){console.log(league,d.period,d.playerCount,'players');for(const [role,r] of Object.entries(d.roles)) console.log(role,'candidates:',r.candidateCount,'confirmed:',r.confirmedRolePlayers,'top:',r.top10.slice(0,3).map(x=>`${x.name} ${x.fit}`).join('; '),'flags:',r.flags.length);}
})().catch(e=>{console.error(e);process.exitCode=1});
