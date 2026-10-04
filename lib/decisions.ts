import type { MatchCore, CoreMatch } from '../types/matches';
import type { DecisionStore, MetricSnapshot, ReviewMetric, ReviewTarget, TrackedDecision } from '../types/decisions';
export const reviewMetrics:ReviewMetric[]=['teamPoints','teamGoals','teamConceded','goals','assists','shots','keyPasses','tackles','interceptions','saves','xG','xA'];
export const decisionStorageKey='uzstat.decisions.v1';
export const emptyDecisionStore=():DecisionStore=>({version:1,needs:[],decisions:[]});
export function targetMatches(core:MatchCore,target:ReviewTarget):CoreMatch[]{
  const ids=new Set(core.appearances.filter(a=>a.playerId===target.playerId).map(a=>a.matchId));
  return [...new Map(core.matches.filter(m=>m.league===target.league&&m.seasonId===target.seasonId&&(target.playerId!==undefined?ids.has(m.id):m.homeTeamId===target.teamId||m.awayTeamId===target.teamId)).map(m=>[m.id,m])).values()].sort((a,b)=>a.date-b.date||a.id-b.id);
}
export function metricSnapshot(core:MatchCore,target:ReviewTarget,metric:ReviewMetric,matchIds:number[]):MetricSnapshot {
  const wanted=new Set(matchIds),matches=targetMatches(core,target).filter(m=>wanted.has(m.id));
  const ids=new Set(matches.map(m=>m.id));let value:number|null=null,covered=0,minutes=0;
  if(metric.startsWith('team')&&target.playerId===undefined&&target.teamId!==undefined){
    let sum=0;
    for(const m of matches){if(m.homeScore===null||m.awayScore===null)continue;
      const home=m.homeTeamId===target.teamId,gf=home?m.homeScore:m.awayScore,ga=home?m.awayScore:m.homeScore;
      sum+=metric==='teamPoints'?(gf>ga?3:gf===ga?1:0):metric==='teamGoals'?gf:ga;covered++;
    }value=covered?sum/covered:null;
  }else if(!metric.startsWith('team')&&target.playerId!==undefined){
    const rows=core.appearances.filter(a=>ids.has(a.matchId)&&a.playerId===target.playerId);
    let sum=0;for(const a of rows){const v=a.stats[metric];if(typeof v!=='number'||!Number.isFinite(v))continue;sum+=v;minutes+=a.minutes;covered++;}
    value=covered&&minutes>0?sum/minutes*90:null;
  }
  return {value,covered,total:matches.length,minutes,matchIds:matches.map(m=>m.id),sourceHashes:Object.fromEntries(matches.map(m=>[String(m.id),`${m.eventHash}:${m.lineupHash||''}`])),from:matches[0]?.date??null,to:matches.at(-1)?.date??null};
}
export function evaluateDecision(core:MatchCore,d:TrackedDecision){
  const following=targetMatches(core,d.target).filter(m=>m.date>d.cutoff).slice(0,d.window);
  const snapshot=metricSnapshot(core,d.target,d.metric,following.map(m=>m.id));
  const sufficient=snapshot.total>=d.window&&snapshot.covered/snapshot.total>=d.minCoverage&&snapshot.value!==null;
  const result: 'met'|'missed'|'insufficient'=!sufficient?'insufficient':(d.direction==='atLeast'?snapshot.value!>=d.threshold:snapshot.value!<=d.threshold)?'met':'missed';
  return {snapshot,result,remaining:Math.max(0,d.window-snapshot.total),delta:snapshot.value!==null&&d.baseline.value!==null?snapshot.value-d.baseline.value:null};
}
export function parseDecisionStore(raw:string|null):DecisionStore {
  if(raw===null)return emptyDecisionStore();const v=JSON.parse(raw);
  const obj=(x:any)=>x&&typeof x==='object'&&!Array.isArray(x),str=(x:any)=>typeof x==='string',num=(x:any)=>typeof x==='number'&&Number.isFinite(x),id=(x:any)=>Number.isInteger(x)&&x>0,ids=(x:any)=>Array.isArray(x)&&x.every(id),league=(x:any)=>['UZB','KAZ'].includes(x),pos=(x:any)=>['GK','DF','MF','FW','UNKNOWN'].includes(x);
  const snapshot=(x:any)=>obj(x)&&(x.value===null||num(x.value))&&Number.isInteger(x.covered)&&x.covered>=0&&Number.isInteger(x.total)&&x.total>=x.covered&&num(x.minutes)&&x.minutes>=0&&ids(x.matchIds)&&x.total===x.matchIds.length&&obj(x.sourceHashes)&&Object.values(x.sourceHashes).every(str)&&(x.from===null||num(x.from))&&(x.to===null||num(x.to));
  const candidate=(c:any)=>obj(c)&&id(c.playerId)&&str(c.name)&&pos(c.position)&&str(c.addedAt)&&str(c.reason)&&obj(c.metrics)&&Object.values(c.metrics).every(x=>x===null||num(x))&&ids(c.seasonIds)&&ids(c.matchIds)&&(c.fitScore===undefined||(num(c.fitScore)&&c.fitScore>=0&&c.fitScore<=100))&&(c.fitReasons===undefined||(Array.isArray(c.fitReasons)&&c.fitReasons.every(str)));
  const need=(n:any)=>obj(n)&&str(n.id)&&league(n.league)&&id(n.teamId)&&id(n.seasonId)&&str(n.teamName)&&str(n.seasonName)&&pos(n.position)&&(n.detailedPosition===null||['GK','RB','CB','LB','RWB','LWB','DM','CM','AM','RM','LM','RW','LW','ST'].includes(n.detailedPosition))&&str(n.observation)&&str(n.requirement)&&str(n.evidence)&&ids(n.matchIds)&&str(n.createdAt)&&['open','closed'].includes(n.status)&&Array.isArray(n.candidates)&&n.candidates.every(candidate)&&new Set(n.candidates.map((c:any)=>c.playerId)).size===n.candidates.length;
  const decision=(d:any)=>obj(d)&&str(d.id)&&(d.needId===null||str(d.needId))&&id(d.clubTeamId)&&obj(d.target)&&league(d.target.league)&&id(d.target.seasonId)&&(id(d.target.playerId)?d.target.teamId===undefined:id(d.target.teamId)&&d.target.playerId===undefined)&&str(d.subjectName)&&str(d.observation)&&str(d.action)&&reviewMetrics.includes(d.metric)&&d.metric.startsWith('team')===(d.target.playerId===undefined)&&['atLeast','atMost'].includes(d.direction)&&num(d.threshold)&&d.threshold>=0&&Number.isInteger(d.window)&&d.window>=1&&d.window<=10&&num(d.minCoverage)&&d.minCoverage>=0.8&&d.minCoverage<=1&&num(d.cutoff)&&typeof d.retrospective==='boolean'&&snapshot(d.baseline)&&(d.baseline.to===null||d.baseline.to<=d.cutoff)&&str(d.createdAt)&&d.version==='decision-v1'&&(d.review===undefined||(obj(d.review)&&str(d.review.at)&&['met','missed','insufficient'].includes(d.review.result)&&snapshot(d.review.snapshot)&&str(d.review.comment)));
  if(!obj(v)||v.version!==1||!Array.isArray(v.needs)||!v.needs.every(need)||!Array.isArray(v.decisions)||!v.decisions.every(decision)||new Set(v.needs.map((n:any)=>n.id)).size!==v.needs.length||new Set(v.decisions.map((d:any)=>d.id)).size!==v.decisions.length||v.decisions.some((d:any)=>d.needId!==null&&!v.needs.some((n:any)=>n.id===d.needId&&n.teamId===d.clubTeamId&&n.league===d.target.league&&n.seasonId===d.target.seasonId)))throw Error('Invalid decision store');
  return v;
}
