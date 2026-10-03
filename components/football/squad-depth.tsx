'use client';
import React,{useEffect,useState} from 'react';
import type {Appearance} from '@/types/matches';
import type {DetailedPosition,Language,League,Player,Position,SeasonMode} from '@/types/players';
import {confirmedDepth} from '@/lib/match-analysis';
import type {NeedSeed} from './decision-workspace';
const tr=(l:Language,r:string,u:string)=>l==='ru'?r:u;
export function SquadDepth({rows,league,seasonId,mode,lang,onNeed}:{rows:Appearance[];league:League;seasonId:number;mode:SeasonMode;lang:Language;onNeed:(seed:NeedSeed)=>void}){
  const [profiles,setProfiles]=useState<Player[]>([]),[error,setError]=useState(false),[loading,setLoading]=useState(true),[view,setView]=useState<'broad'|'detailed'>('broad');
  useEffect(()=>{const controller=new AbortController();setProfiles([]);setError(false);setLoading(true);fetch(`/api/players?league=${league}&season=${mode}`,{signal:controller.signal}).then(async r=>{if(!r.ok)throw Error('load');return r.json();}).then(setProfiles).catch(e=>{if(e.name!=='AbortError')setError(true);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});return()=>controller.abort();},[league,mode,seasonId]);
  const depth=confirmedDepth(rows,profiles,seasonId,league);
  const groups=view==='broad'?['GK','DF','MF','FW','UNKNOWN']:[...new Set(depth.map(p=>p.detailed||'UNKNOWN'))].sort();
  const names=new Map(profiles.map(p=>[Number(p.id.split('-')[1]),p.name[lang]]));
  const broad=(detail:string):Position=>detail==='GK'?'GK':['RB','CB','LB','RWB','LWB'].includes(detail)?'DF':['ST','RW','LW'].includes(detail)?'FW':'MF';
  return <details className="analysis-card squad-depth"><summary>{tr(lang,'Глубина состава по подтверждённым позициям','Tasdiqlangan pozitsiyalar bo‘yicha tarkib chuqurligi')}</summary><div className="side-switch"><button aria-pressed={view==='broad'} onClick={()=>setView('broad')}>{tr(lang,'Позиции в матчах','O‘yinlardagi pozitsiyalar')}</button><button aria-pressed={view==='detailed'} onClick={()=>setView('detailed')}>{tr(lang,'Точные позиции профиля','Profildagi aniq pozitsiyalar')}</button></div>
    <p className="muted">{view==='broad'?tr(lang,'Только позиции источника в загруженных матчах. Игрок может входить в несколько групп. Минуты — всего за команду.','Faqat yuklangan o‘yinlardagi manba pozitsiyalari. Futbolchi bir necha guruhda bo‘lishi mumkin. Daqiqalar — jamoa uchun jami.'):tr(lang,'Точная позиция берётся из подтверждённого профиля. Она не доказывает роль в историческом матче или наличие игрока в текущем составе.','Aniq pozitsiya tasdiqlangan profildan. Bu tarixiy o‘yindagi rol yoki hozirgi tarkibda borligini isbotlamaydi.')}</p>
    {loading&&<p role="status">{tr(lang,'Загрузка профилей…','Profillar yuklanmoqda…')}</p>}{error&&<p role="alert">{tr(lang,'Профили не загрузились. Точные позиции не определены.','Profillar yuklanmadi. Aniq pozitsiyalar aniqlanmadi.')}</p>}
    <div className="depth-grid">{groups.map(group=>{const list=depth.filter(p=>view==='detailed'?(p.detailed||'UNKNOWN')===group:group==='UNKNOWN'?p.positions.length===0||p.positions.includes('UNKNOWN'):p.positions.includes(group as Position));
      return <article key={group}><h4>{group==='UNKNOWN'?tr(lang,'Не подтверждено','Tasdiqlanmagan'):group} · {list.length}</h4>{list.map(p=><div key={p.id}><span>{names.get(p.id)||`#${p.id}`}</span><small>{p.appearances} {tr(lang,'игр','o‘yin')}<br/>{p.minutes} {tr(lang,'мин','daq')}</small></div>)}{!list.length&&<p className="muted">{tr(lang,'Нет подтверждённых игроков в выборке','Tanlovda tasdiqlangan futbolchilar yo‘q')}</p>}{group!=='UNKNOWN'&&<button className="text-link" onClick={()=>onNeed({position:view==='broad'?group as Position:(profiles.find(p=>p.detailedPosition===group)?.position||broad(group)),detailedPosition:view==='detailed'?group as DetailedPosition:null,evidence:`${group}: ${list.length} ${tr(lang,'игроков в загруженном составе','yuklangan tarkibdagi futbolchi')}; ${list.map(p=>`${names.get(p.id)||p.id}: ${p.minutes} ${tr(lang,'мин','daq')}`).join('; ')}`})}>{tr(lang,'Сформулировать потребность','Ehtiyojni belgilash')} →</button>}</article>;
    })}</div>
  </details>;
}
