import fs from 'node:fs';
import path from 'node:path';
export const API_ORIGIN='https://api.football-data-api.com';
export const number=v=>(typeof v==='number'||typeof v==='string'&&v.trim()!=='')&&Number.isFinite(Number(v))&&Number(v)>=0?Number(v):null;
const name=v=>String(v||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const birthday=v=>number(v)===null?null:new Date(Number(v)*1000).toISOString().slice(0,10);
export function normalizePlayer(raw,league,year,seasonId){
 const d=raw.detailed||{};
 return {id:number(raw.id),league,year,seasonId,name:raw.full_name||raw.known_as||'',birthday:raw.birthday??null,clubId:number(raw.club_team_id??d.club_team_id),url:typeof raw.url==='string'&&raw.url.startsWith('/')?`https://footystats.org${raw.url}`:null,
 metrics:{appearances:number(raw.appearances_overall),minutes:number(raw.minutes_played_overall),goals:number(raw.goals_overall),assists:number(raw.assists_overall),xG:number(d.xg_total_overall),xGPer90:number(d.xg_per_90_overall),shotsPer90:number(d.shots_per_90_overall),keyPassesPer90:number(d.key_passes_per_90_overall),progressivePasses:number(d.progressive_passes_total_overall),passAccPct:number(d.pass_completion_rate_overall),dribbleSuccessPct:number(d.dribbles_successful_percentage_overall),duelWinPct:number(d.duels_won_percentage_overall),aerialWinPct:number(d.aerial_duels_won_percentage_overall),savesPer90:number(d.saves_per_90_overall)}};
}
// Cross-provider IDs are never equated. Exact full name + birth date is needed,
// or an explicit reviewed mapping. Ambiguous identities remain unlinked.
export function reconcile(players,primary,config){
 return players.map(p=>{
  const manual=config.playerLinks?.[`${p.league}:${p.id}`];
  const candidates=primary.filter(q=>q.league===p.league&&(manual?Number(q.sofaId)===Number(manual):name(q.name)===name(p.name)&&birthday(q.dateOfBirthTimestamp)!==null&&birthday(q.dateOfBirthTimestamp)===birthday(p.birthday)));
  const match=candidates.length===1?candidates[0]:null;
  const base=match?.currentSeason;
  const comparisons=Object.fromEntries(['goals','assists'].map(k=>[k,{primary:number(base?.observedTotals?.[k]),footystats:p.metrics[k]}]));
  return {...p,sofaId:match?.sofaId??null,identity:match?(manual?'reviewed_mapping':'exact_name_and_birthdate'):'unlinked',comparisons};
 });
}
export async function apiRequest(endpoint,params,key,fetcher=fetch){
 const url=new URL(endpoint,API_ORIGIN);url.searchParams.set('key',key);for(const [k,v] of Object.entries(params))url.searchParams.set(k,String(v));
 const response=await fetcher(url,{signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw new Error(`FootyStats HTTP ${response.status}`);
 const payload=await response.json();if(payload.success===false||!Array.isArray(payload.data))throw new Error('FootyStats invalid or denied response');return payload;
}
export async function fetchPlayers(seasonId,key,fetcher=fetch){
 const rows=[];let lastSignature='';
 for(let page=1;page<=30;page++){
  const payload=await apiRequest('/league-players',{season_id:seasonId,include:'stats',page},key,fetcher);
  const signature=payload.data.map(p=>p.id).join(',');if(page>1&&signature&&signature===lastSignature)throw new Error('FootyStats repeated pagination');lastSignature=signature;
  rows.push(...payload.data);
  const pages=number(payload.pager?.max_page??payload.pager?.total_pages);
  if(pages!==null?page>=pages:payload.data.length<200)return rows;
 }
 throw new Error('FootyStats pagination limit reached');
}
export function resolveSeason(leagues,entry,year){
 const found=leagues.filter(l=>l.country===entry.country&&[l.league_name,l.name].some(n=>entry.names.includes(n)));
 const ids=found.flatMap(l=>(l.season||[]).filter(s=>String(s.year)===String(year)).map(s=>number(s.id))).filter(Boolean);
 return [...new Set(ids)].length===1?ids[0]:null;
}
export function atomicJSON(file,data){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(`${file}.tmp`,JSON.stringify(data,null,2)+'\n');fs.renameSync(`${file}.tmp`,file);}
