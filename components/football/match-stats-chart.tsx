import React from 'react';
import type {Appearance,CoreMatch} from '@/types/matches';
import type {Language} from '@/types/players';
export function MatchStatsChart({match,appearances,lang}:{match:CoreMatch;appearances:Appearance[];lang:Language}){
 const ru=lang==='ru',rows=appearances.filter(a=>a.matchId===match.id);
 const groups=[rows.filter(a=>a.teamId===match.homeTeamId),rows.filter(a=>a.teamId===match.awayTeamId)];
 const metrics=[['shots',ru?'Удары':'Zarbalar'],['keyPasses',ru?'Ключевые пасы':'Asosiy paslar'],['tackles',ru?'Отборы':'To‘p qaytarish'],['interceptions',ru?'Перехваты':'To‘xtatish'],['xG','xG']];
 const sum=(group:Appearance[],key:string)=>{const known=group.map(a=>a.stats[key]).filter((v):v is number=>typeof v==='number'&&Number.isFinite(v));return {value:known.length?known.reduce((a,b)=>a+b,0):null,covered:known.length,total:group.length};};
 return <section className="analysis-card match-stats-chart"><h3>{ru?'Показатели загруженного состава':'Yuklangan tarkib ko‘rsatkichlari'}</h3><p className="muted">{ru?'Суммы наблюдаемых действий игроков. Подписи показывают покрытие участников.':'Futbolchilarning kuzatilgan harakatlari yig‘indisi. Ishtirokchilar qamrovi ko‘rsatilgan.'}</p>
 <div className="match-stats-rows">{metrics.map(([key,label])=>{const [a,b]=groups.map(g=>sum(g,key));const total=(a.value??0)+(b.value??0),fraction=total>0?(a.value??0)/total*100:50;const fmt=(v:number|null)=>v===null?'—':key==='xG'?v.toFixed(2):String(v);return <div key={key}><span>{label}</span><div className="match-stat-line"><b>{fmt(a.value)}</b><div className="match-stat-track" role="img" aria-label={`${label}: ${fmt(a.value)} / ${fmt(b.value)}`}>{a.value!==null&&b.value!==null&&total>0&&<><i style={{width:`${fraction}%`}}/><i style={{width:`${100-fraction}%`}}/></>}</div><b>{fmt(b.value)}</b></div><div className="match-stat-coverage"><small>{a.covered}/{a.total}</small><small>{b.covered}/{b.total}</small></div></div>;})}</div>
 </section>;
}
