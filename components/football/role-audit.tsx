'use client';
import React,{useMemo,useState} from 'react';
import {rankPlayersForNeed} from '@/lib/recruitment';
import type {Player,Language,DetailedPosition,Position} from '@/types/players';
import type {TeamNeed} from '@/types/decisions';
export function RoleAudit({players,lang,onPlayer}:{players:Player[];lang:Language;onPlayer:(p:Player)=>void}){
 const [role,setRole]=useState('GK'),[preliminary,setPreliminary]=useState(false),ru=lang==='ru';
 const roles:Record<string,[Position,DetailedPosition]>={GK:['GK','GK'],CB:['DF','CB'],DM:['MF','DM'],WINGER:['FW','RW'],ST:['FW','ST']};
 const rows=useMemo(()=>{
  const p=players[0];if(!p||p.statsSeasonIds?.length!==1)return [];
  const [position,detailedPosition]=roles[role];
  const need={status:'open',league:p.league,seasonId:p.statsSeasonIds[0],teamName:'',position,detailedPosition} as TeamNeed;
  const variants=role==='WINGER'?[need,{...need,detailedPosition:'LW' as const}]:[need];
  return [...new Map(variants.flatMap(n=>rankPlayersForNeed(n,players,{allowUnconfirmedPosition:preliminary})).map(r=>[r.player.id,r])).values()].sort((a,b)=>b.fitScore-a.fitScore||b.profileScore-a.profileScore||a.player.id.localeCompare(b.player.id)).slice(0,10);
 },[players,role,preliminary]);
 return <details className="analysis-card role-audit"><summary>{ru?'Проверка ролей · TOP-10':'Rollar tekshiruvi · TOP-10'} <small>role-v3</small></summary><p className="muted">{ru?'Профили GK, CB, DM, WINGER, ST на данных выбранного сезона. Для предварительного списка используется широкая позиция; точную роль нужно подтвердить.':'Tanlangan mavsumdagi GK, CB, DM, WINGER, ST profillari. Dastlabki ro‘yxat umumiy pozitsiyaga asoslanadi; aniq rolni tasdiqlash kerak.'}</p>
 <div className="position-pills">{Object.keys(roles).map(key=><button key={key} aria-pressed={role===key} onClick={()=>setRole(key)}>{key}</button>)}</div><label className="audit-checkbox"><input type="checkbox" checked={preliminary} onChange={e=>setPreliminary(e.target.checked)}/>{ru?'Включить игроков с неподтверждённой точной позицией':'Aniq pozitsiyasi tasdiqlanmagan futbolchilarni qo‘shish'}</label>
 {players[0]?.statsSeasonIds?.length!==1?<p className="empty-inline">{ru?'Выберите один сезон.':'Bitta mavsumni tanlang.'}</p>:!rows.length?<p className="empty-inline">{ru?'Подтверждённых кандидатов нет. Можно открыть предварительный список для дальнейшей проверки.':'Tasdiqlangan nomzodlar yo‘q. Keyingi tekshiruv uchun dastlabki ro‘yxatni ochish mumkin.'}</p>:<div className="table-scroll"><table className="analysis-table"><thead><tr>{['#',ru?'Игрок':'Futbolchi','Fit',ru?'Покрытие профиля':'Profil qamrovi',ru?'Позиция':'Pozitsiya'].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={r.player.id}><td>{i+1}</td><td><button className="text-link" onClick={()=>onPlayer(r.player)}>{r.player.name[lang]}</button><small>{r.player.club[lang]} · {r.player.minutesPlayed} {ru?'мин':'daq'}</small><details><summary>{ru?'Почему':'Nega'}</summary><p>{ru?'Профиль':'Profil'}: {r.profileKey} · {r.profileScore}/100 · {r.player.scoutingEngine.confidence}</p>{r.usesBroadFallback&&<p>{ru?'Недостаточно ролевых осей: используется общий рейтинг линии.':'Rol ko‘rsatkichlari yetarli emas: umumiy amplua reytingi ishlatiladi.'}</p>}</details></td><td>{r.fitScore}</td><td>{r.profileCoverage}%</td><td>{r.positionConfirmed?r.player.detailedPosition:<span className="context-chip">{ru?'Не подтверждена':'Tasdiqlanmagan'}</span>}</td></tr>)}</tbody></table></div>}
 </details>;
}
