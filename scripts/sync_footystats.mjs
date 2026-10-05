import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {apiRequest,fetchPlayers,resolveSeason,normalizePlayer,reconcile,atomicJSON} from './footystats.mjs';
export async function sync({root=process.cwd(),key=process.env.FOOTYSTATS_API_KEY,year=Number(process.env.FOOTYSTATS_YEAR||2026),fetcher=fetch}={}){
 const status={schemaVersion:1,provider:'FootyStats',checkedAt:new Date().toISOString(),year,state:'not_configured',leagues:{}};
 const statusFile=path.join(root,'data/audits/footystats_status.json');
 if(!key){atomicJSON(statusFile,status);console.log('FootyStats: not_configured (FOOTYSTATS_API_KEY missing)');return status;}
 const config=JSON.parse(fs.readFileSync(path.join(root,'data/footystats/config.json'),'utf8'));
 const primary=JSON.parse(fs.readFileSync(path.join(root,'data/superliga_stats.json'),'utf8'));
 try{
  const catalog=await apiRequest('/league-list',{},key,fetcher);
  for(const [league,entry] of Object.entries(config.leagues)){
   try{
    const explicit=entry.seasonIds?.[String(year)];
    const seasonId=explicit||resolveSeason(catalog.data,entry,year);
    if(!seasonId){status.leagues[league]={state:'season_unavailable',players:0,linked:0};continue;}
    const raw=await fetchPlayers(seasonId,key,fetcher);
    if(raw.some(p=>Number(p.competition_id)!==Number(seasonId)))throw Error('FootyStats returned another season');
    const players=reconcile(raw.map(p=>normalizePlayer(p,league,year,seasonId)),primary,config);
    const snapshot={schemaVersion:1,provider:'FootyStats',league,year,seasonId,fetchedAt:status.checkedAt,players};
    atomicJSON(path.join(root,`data/footystats/${league}-${year}.json`),snapshot);
    status.leagues[league]={state:players.length?'connected':'empty',seasonId,players:players.length,linked:players.filter(p=>p.sofaId!==null).length};
   }catch(e){status.leagues[league]={state:'error',message:String(e.message).replaceAll(key,'[redacted]')};}
  }
  const states=Object.values(status.leagues).map(l=>l.state);
  status.state=states.every(s=>s==='connected')?'connected':states.some(s=>s==='connected')?'partial':states.includes('error')?'error':'season_unavailable';
 }catch(e){status.state='error';status.message=String(e.message).replaceAll(key,'[redacted]');}
 atomicJSON(statusFile,status);console.log(`FootyStats: ${status.state}`);return status;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const s=await sync();if(s.state==='error')process.exitCode=1;}
