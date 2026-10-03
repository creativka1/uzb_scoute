'use client';
import React, { useEffect, useState, useRef } from 'react';
import type { Language, League, Player, Position, SeasonMode } from '@/types/players';
import type { Appearance, CoreMatch, MatchCore, AnalysisLocation } from '@/types/matches';
import { observedMetric, teamWindow, metricCoverage, minuteDistribution } from '@/lib/match-analysis';

import {DecisionWorkspace,NeedForm} from './decision-workspace';
import type {NeedSeed} from './decision-workspace';
import type {TeamNeed} from '@/types/decisions';
import {SquadDepth} from './squad-depth';

const tr = (lang: Language, ru: string, uz: string) => lang === 'ru' ? ru : uz;
const fmt = (n: number | null | undefined, decimals = 0) => typeof n === 'number' && Number.isFinite(n) ? n.toFixed(decimals) : '—';
const date = (n: number, lang: Language) => new Date(n*1000).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'uz-UZ', {timeZone:'Asia/Tashkent'});
const labels: Record<string, [string,string]> = {goals:['Голы','Gollar'],assists:['Ассисты','Assistlar'],shots:['Удары','Zarbalar'],keyPasses:['Передачи под удар','Zarbaga olib kelgan paslar'],tackles:['Отборы','To‘p qaytarish'],interceptions:['Перехваты','To‘pni to‘xtatish'],saves:['Сейвы','Seyvlar'],xG:['Ожидаемые голы · xG','Kutilayotgan gollar · xG'],xA:['Ожидаемые ассисты · xA','Kutilayotgan assistlar · xA']};
const metricName = (key: string, lang: Language) => labels[key]?.[lang === 'ru' ? 0 : 1] || key;
function useCore(league: League, playerId?: number) {
  const [data,setData] = useState<MatchCore | null>(null);
  const [error,setError] = useState(false),[revision,setRevision]=useState(0);
  useEffect(() => { const controller = new AbortController(); let active=true; setData(null); setError(false);
    const timer=setTimeout(()=>{if(active){controller.abort();setError(true);}},15000);
    fetch(`/api/analysis?league=${league}${playerId ? `&playerId=${playerId}` : ''}`, {signal:controller.signal,cache:'no-store'})
      .then(async r => {if(!r.ok) throw Error('load'); return r.json();}).then(value=>{if(active)setData(value);})
      .catch(()=>{if(active)setError(true);}).finally(()=>clearTimeout(timer));
    return () => {active=false;clearTimeout(timer);controller.abort();};
  },[league,playerId,revision]);
  return {data,error,refresh:()=>setRevision(v=>v+1)};
}

interface Note { id: string; createdAt: string; updatedAt: string; context: string; matchIds: number[]; calculationVersion: string; evidence: string; observation: string; decision: string; review: string; status: 'open'|'confirmed'|'rejected'|'inconclusive' }
function validNote(n: unknown): n is Note {
  if (!n || typeof n !== 'object') return false;
  const x=n as Note;
  return ['id','createdAt','updatedAt','context','calculationVersion','evidence','observation','decision','review'].every(k=>typeof (x as unknown as Record<string,unknown>)[k] === 'string') && Array.isArray(x.matchIds) && x.matchIds.every(Number.isInteger) && ['open','confirmed','rejected','inconclusive'].includes(x.status);
}
export function AnalysisNotebook({scope, context, matchIds, evidence, lang, expanded=false}: {scope:string; context:string; matchIds:number[]; evidence:string; lang:Language;expanded?:boolean}) {
  const key = `uzstat.analysis-notes.v1:${scope}`;
  const [notes,setNotes] = useState<Note[]>([]), [ready,setReady] = useState(false), [error,setError] = useState('');
  const [editingId,setEditingId]=useState<string|null>(null);
  const [observation,setObservation] = useState(''), [decision,setDecision] = useState(''), [review,setReview] = useState('');
  useEffect(()=>{setReady(false);setNotes([]);setError('');setObservation('');setDecision('');setReview('');setEditingId(null);
    try {const raw=localStorage.getItem(key);const value=raw ? JSON.parse(raw) : [];
      if(!Array.isArray(value)||!value.every(validNote)) throw Error('corrupt');
      setNotes(value);setReady(true);
    } catch {setError(tr(lang,'Сохранение недоступно или повреждено. Существующие записи не перезаписаны.','Saqlanma mavjud emas yoki buzilgan. Yozuvlar o‘zgartirilmagan.'));}
  },[key]);
  const persist=(next:Note[])=>{if(!ready)return false;try{localStorage.setItem(key,JSON.stringify(next));setNotes(next);setError('');return true;}catch{setError(tr(lang,'Не удалось сохранить. Текст оставлен в форме.','Saqlab bo‘lmadi. Matn shaklda qoldi.'));return false;}};
  return <details className="analysis-card explanation notebook" open={expanded||undefined}><summary>{tr(lang,'Выводы и проверка решений','Xulosalar va qarorlarni tekshirish')} · {notes.length}</summary>
    <p>{tr(lang,'Записи сохраняются в этом браузере. Они содержат период, матчи и снимок наблюдений. Для резервной копии выгрузите JSON.','Yozuvlar shu brauzerda saqlanadi: davr, o‘yinlar va kuzatuvlar nusxasi. Zaxira uchun JSON yuklab oling.')}</p>
    {error && <p role="alert" className="error-notice">{error}</p>}
    <div className="note-form"><label>{tr(lang,'Наблюдение','Kuzatuv')}<textarea maxLength={4000} value={observation} onChange={e=>setObservation(e.target.value)} /></label>
    <label>{tr(lang,'Решение или цель развития','Qaror yoki rivojlanish maqsadi')}<textarea maxLength={4000} value={decision} onChange={e=>setDecision(e.target.value)} /></label>
    <label>{tr(lang,'Когда и по каким признакам проверить','Qachon va qanday tekshirish')}<input maxLength={500} value={review} onChange={e=>setReview(e.target.value)} placeholder={tr(lang,'После следующих 5 матчей…','Keyingi 5 o‘yindan keyin…')} /></label></div>
    <div className="note-actions"><button className="action-primary" disabled={!ready || !observation.trim()} onClick={()=>{const now=new Date().toISOString();const updated=editingId ? notes.map(n=>n.id===editingId?{...n,updatedAt:now,observation:observation.trim(),decision:decision.trim(),review:review.trim()}:n) : [...notes,{id:crypto.randomUUID(),createdAt:now,updatedAt:now,context,matchIds,calculationVersion:'observed-v1',evidence,observation:observation.trim(),decision:decision.trim(),review:review.trim(),status:'open' as const}];if(persist(updated)){setObservation('');setDecision('');setReview('');setEditingId(null);}}}>{editingId?tr(lang,'Сохранить изменения','O‘zgarishlarni saqlash'):tr(lang,'Сохранить вывод','Xulosani saqlash')}</button>{editingId&&<button className="action-secondary" onClick={()=>{setEditingId(null);setObservation('');setDecision('');setReview('');}}>{tr(lang,'Отмена','Bekor qilish')}</button>}
    <details className="note-backup"><summary>{tr(lang,'Резервная копия','Zaxira nusxasi')}</summary><button className="action-secondary" disabled={!notes.length} onClick={()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(notes,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='uzstat-analysis-notes.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}>{tr(lang,'Экспорт JSON','JSON eksport')}</button>
    <label className="action-secondary">{tr(lang,'Восстановить JSON','JSON tiklash')}<input type="file" accept="application/json" disabled={!ready} onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>1000000)throw Error('large');const values=JSON.parse(await file.text());if(!Array.isArray(values)||!values.every(validNote))throw Error('format');const ids=new Set(notes.map(n=>n.id));persist([...notes,...values.filter(n=>{if(ids.has(n.id))return false;ids.add(n.id);return true;})]);}catch{setError(tr(lang,'Файл не распознан; записи не изменены.','Fayl tanilmadi; yozuvlar o‘zgarmadi.'));}e.target.value='';}} /></label></details></div>
    {notes.slice().reverse().map(n=><article className="note-entry" key={n.id}><small>{n.context} · {new Date(n.createdAt).toLocaleDateString()}</small><h4>{n.observation}</h4><button className="text-link" onClick={()=>{setEditingId(n.id);setObservation(n.observation);setDecision(n.decision);setReview(n.review);}}>{tr(lang,'Редактировать','Tahrirlash')}</button><p>{n.decision}</p><p>{n.review}</p><details><summary>{tr(lang,'Основание вывода','Xulosa asosi')}</summary><p>{n.evidence}</p><p>{tr(lang,'Матчи','O‘yinlar')}: {n.matchIds.join(', ') || '—'}</p></details><label>{tr(lang,'Результат проверки','Tekshiruv natijasi')}<select value={n.status} onChange={e=>persist(notes.map(x=>x.id===n.id?{...x,status:e.target.value as Note['status'],updatedAt:new Date().toISOString()}:x))}><option value="open">{tr(lang,'Ожидает проверки','Tekshirilmagan')}</option><option value="confirmed">{tr(lang,'Подтвердилось','Tasdiqlandi')}</option><option value="rejected">{tr(lang,'Не подтвердилось','Tasdiqlanmadi')}</option><option value="inconclusive">{tr(lang,'Недостаточно данных','Ma’lumot yetarli emas')}</option></select></label></article>)}
  </details>;
}

function Trend({rows, metric, lang, data}: {rows:Appearance[];metric:string;lang:Language;data:MatchCore}) {
  const list=rows.slice().reverse(), values=list.map(a=>a.stats[metric]);
  const max=Math.max(1,...values.filter((n):n is number=>n!==null));
  const x=(i:number)=>30+i*(540/Math.max(1,list.length-1));
  const y=(v:number)=>130-v/max*100;
  const events=new Map(data.matches.map(m=>[m.id,m]));
  return <figure className="trend"><figcaption>{metricName(metric,lang)} · {tr(lang,'за матч, от старых к новым','har o‘yinda, eskidan yangiga')}</figcaption><svg viewBox="0 0 600 165" role="img" aria-label={tr(lang,'Динамика по матчам; пропуски не соединяются','O‘yinlar dinamikasi; bo‘sh qiymatlar ulanmaydi')}><line x1="30" x2="570" y1="130" y2="130" stroke="#526569"/><text x="4" y="134">0</text><text x="4" y="30">{fmt(max,1)}</text>{list.map((a,i)=>{const v=values[i],prev=values[i-1];return <g key={a.id}>{v!==null && <>{i>0&&prev!==null&&<line x1={x(i-1)} y1={y(prev)} x2={x(i)} y2={y(v)} stroke="#7ee0bb" strokeWidth="2"/>}<circle cx={x(i)} cy={y(v)} r="4" fill="#7ee0bb"><title>{date(events.get(a.matchId)!.date,lang)}: {v}</title></circle></>}{v===null&&<text x={x(i)} y="115" textAnchor="middle">—</text>}{(i===0||i===list.length-1)&&<text x={x(i)} y="156" textAnchor={i===0?'start':'end'}>{date(events.get(a.matchId)!.date,lang)}</text>}</g>;})}</svg></figure>;
}

export function PlayerMatchHistory({player,lang,onOpenMatch}: {player:Player;lang:Language;onOpenMatch?:(location:AnalysisLocation)=>void}) {
  const {data,error,refresh}=useCore(player.league);
  const [season,setSeason]=useState(''), [metric,setMetric]=useState('goals');
  if(error)return <p role="alert">{tr(lang,'История матчей не загрузилась.','O‘yinlar tarixi yuklanmadi.')} <button onClick={refresh}>{tr(lang,'Повторить','Qayta urinish')}</button></p>;
  if(!data)return <p className="muted">{tr(lang,'Загрузка матчей…','O‘yinlar yuklanmoqda…')}</p>;
  const playerNumericId=Number(player.id.split('-')[1]);
  const seasonIdsWithPlayer=new Set(
    data.appearances.filter(a=>a.playerId===playerNumericId)
      .map(a=>data.matches.find(m=>m.id===a.matchId)?.seasonId)
      .filter((id): id is number=>typeof id==='number')
  );
  const seasons=data.seasons[player.league].filter(s=>seasonIdsWithPlayer.has(s.id));
  if(!seasons.length)return <p className="empty-inline">{tr(lang,'Нет загруженной истории матчей этого игрока.','Bu futbolchining yuklangan o‘yin tarixi yo‘q.')}</p>;
  const preferredId=player.statsSeasonIds?.find(id=>seasonIdsWithPlayer.has(id));
  const chosen=season||String(preferredId||seasons[0].id);
  const events=data.matches.filter(m=>m.seasonId===Number(chosen));
  const map=new Map(events.map(m=>[m.id,m]));
  const rows=data.appearances.filter(a=>map.has(a.matchId)&&a.playerId===playerNumericId).sort((a,b)=>map.get(b.matchId)!.date-map.get(a.matchId)!.date);
  const teams=new Map(data.teams.map(t=>[t.id,t.name]));
  const last=observedMetric(rows.slice(0,5),metric), previous=observedMetric(rows.slice(5,10),metric);
  return <div className="player-history"><button className="text-link" onClick={refresh}>{tr(lang,'Перечитать данные','Ma’lumotni qayta o‘qish')}</button><div className="analysis-controls"><label>{tr(lang,'Сезон истории','Tarix mavsumi')}<select value={chosen} onChange={e=>setSeason(e.target.value)}>{seasons.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>{tr(lang,'Показатель','Ko‘rsatkich')}<select value={metric} onChange={e=>setMetric(e.target.value)}>{Object.keys(labels).map(k=><option value={k} key={k}>{metricName(k,lang)}</option>)}</select></label></div>
    <p className="muted">{tr(lang,'Доступные матчи сезона. Нажмите дату, чтобы открыть матч.','Mavsumning mavjud o‘yinlari. O‘yinni ochish uchun sanani bosing.')}</p>
    {!rows.length ? <p className="empty-inline">{tr(lang,'Нет подтверждённых матчей этого сезона.','Bu mavsumda tasdiqlangan o‘yinlar yo‘q.')}</p> : <>
    <Trend rows={rows} metric={metric} lang={lang} data={data}/>
    <div className="window-cards">{[[tr(lang,'Последние 5 доступных','Oxirgi 5 mavjud'),last],[tr(lang,'Предыдущие 5 доступных','Oldingi 5 mavjud'),previous]].map(([label,stat])=>{const s=stat as typeof last;return <article key={String(label)} className="analysis-card"><h4>{String(label)}</h4><strong>{fmt(s.per90,2)} <small>/ 90 {tr(lang,'мин','daq')}</small></strong><p className="muted">{s.matches} / {s.totalMatches} {tr(lang,'участий с показателем','ko‘rsatkichli ishtirok')} · {s.minutes} {tr(lang,'покрытых минут','qamrab olingan daqiqa')}</p></article>;})}</div>
    <div className="table-scroll"><table className="analysis-table"><thead><tr>{[tr(lang,'Дата / матч','Sana / o‘yin'),tr(lang,'Команда','Jamoa'),tr(lang,'Позиция','Pozitsiya'),tr(lang,'Минуты','Daqiqalar'),metricName(metric,lang)].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{rows.map(a=>{const m=map.get(a.matchId)!;return <tr key={a.id}><td>{onOpenMatch?<button className="text-link" onClick={()=>onOpenMatch({league:player.league,teamId:a.teamId,seasonId:m.seasonId,matchId:m.id})}>{date(m.date,lang)} ↗</button>:date(m.date,lang)}<small>{teams.get(m.homeTeamId)} {fmt(m.homeScore)} : {fmt(m.awayScore)} {teams.get(m.awayTeamId)}</small></td><td>{teams.get(a.teamId)||'—'}</td><td>{a.position||'—'}</td><td>{a.minutes}</td><td>{fmt(a.stats[metric],metric==='xG'||metric==='xA'?2:0)}</td></tr>;})}</tbody></table></div></>}
    <details className="analysis-card explanation"><summary>{tr(lang,'Сравнение сезонов и позиций','Mavsumlar va pozitsiyalar taqqoslovi')}</summary><p>{tr(lang,'Роли здесь — широкие позиции источника. Смена позиции не доказывает причину изменения показателя.','Bu yerda rollar — manbaning umumiy pozitsiyalari. Pozitsiya o‘zgarishi ko‘rsatkich o‘zgarishining sababini isbotlamaydi.')}</p><div className="table-scroll"><table className="analysis-table"><thead><tr><th>{tr(lang,'Период / позиция','Davr / pozitsiya')}</th><th>{tr(lang,'Значение / 90','Qiymat / 90')}</th><th>{tr(lang,'Покрытие','Qamrov')}</th></tr></thead><tbody>{seasons.flatMap(s=>{const ids=new Set(data.matches.filter(m=>m.seasonId===s.id).map(m=>m.id));const seasonRows=data.appearances.filter(a=>ids.has(a.matchId)&&a.playerId===Number(player.id.split('-')[1]));return [null,...new Set(seasonRows.map(a=>a.position||'UNKNOWN'))].map(pos=>{const subset=pos?seasonRows.filter(a=>(a.position||'UNKNOWN')===pos):seasonRows;const stat=observedMetric(subset,metric);return <tr key={`${s.id}:${pos}`}><td>{s.name} · {pos||tr(lang,'Все позиции','Barcha pozitsiyalar')}</td><td>{fmt(stat.per90,2)}</td><td>{stat.matches} / {stat.totalMatches} · {stat.minutes} {tr(lang,'мин','daq')}</td></tr>;});})}</tbody></table></div></details>
    {rows.length>0&&<details className="analysis-card explanation"><summary>{tr(lang,'Решения и проверка по новым матчам','Qarorlar va yangi o‘yinlar bo‘yicha tekshiruv')}</summary><DecisionWorkspace key={`player-decisions:${player.id}:${chosen}`} core={data} teamId={rows[0].teamId} seasonId={Number(chosen)} lang={lang} playerId={Number(player.id.split('-')[1])}/></details>}
    <AnalysisNotebook key={`${player.id}:${chosen}`} scope={`player:${player.id}:${chosen}`} context={`${player.name[lang]} · ${seasons.find(s=>String(s.id)===chosen)?.name}`} matchIds={rows.map(a=>a.matchId)} evidence={`${metricName(metric,lang)} /90: ${fmt(last.per90,2)} (${last.matches}/${last.totalMatches}); previous: ${fmt(previous.per90,2)} (${previous.matches}/${previous.totalMatches})`} lang={lang}/>
  </div>;
}

export function TeamWorkspace({league,seasonMode,lang,onRecruit,onPlayer,initialSelection}: {
  league:League;seasonMode:SeasonMode;lang:Language;
  onRecruit:(position:Position,season:SeasonMode,team:string,need?:TeamNeed)=>void;
  onPlayer:(player:Player,pool:Player[])=>void;initialSelection?:AnalysisLocation|null;
}) {
  const {data,error,refresh}=useCore(league);
  const [team,setTeam]=useState(''),[season,setSeason]=useState('');
  const [match,setMatch]=useState<number|null>(null),[tab,setTab]=useState<'overview'|'matches'|'roster'|'notes'>('overview');
  const [needSeed,setNeedSeed]=useState<NeedSeed|null>(null);
  const [query,setQuery]=useState(''),[position,setPosition]=useState<Position|'all'>('all');
  const [windowSize,setWindowSize]=useState(5),[side,setSide]=useState<'home'|'away'>('home');
  const [metric,setMetric]=useState('shots'),[profileError,setProfileError]=useState(false),[opening,setOpening]=useState(false);
  const request=useRef<AbortController|null>(null);
  useEffect(()=>()=>request.current?.abort(),[]);
  useEffect(()=>{request.current?.abort();setOpening(false);setProfileError(false);setNeedSeed(null);},[team,season]);
  useEffect(()=>{
    if(initialSelection?.league===league){setTeam(String(initialSelection.teamId));setSeason(String(initialSelection.seasonId));setMatch(initialSelection.matchId);setTab('matches');return;}
    try{const saved=JSON.parse(localStorage.getItem(`uzstat.analysis.team.${league}`)||'null');
      if(saved&&Number.isInteger(saved.teamId)&&Number.isInteger(saved.seasonId)){setTeam(String(saved.teamId));if(seasonMode==='latest'||seasonMode==='two')setSeason(String(saved.seasonId));}
    }catch{/* Preference is optional; source data remains available. */}
  },[league,initialSelection,seasonMode]);
  if(error)return <p role="alert" className="error-notice">{tr(lang,'Матчи не загрузились.','O‘yinlar yuklanmadi.')} <button onClick={refresh}>{tr(lang,'Повторить','Qayta urinish')}</button></p>;
  if(!data)return <p className="muted">{tr(lang,'Загрузка команд…','Jamoalar yuklanmoqda…')}</p>;
  const allSeasons=data.seasons[league];
  const seasons=allSeasons.filter(s=>data.matches.some(m=>m.seasonId===s.id));
  if(!seasons.length)return <div className="workspace-empty"><h3>{tr(lang,'Матчи этой лиги ещё не загружены','Bu liga o‘yinlari hali yuklanmagan')}</h3></div>;
  const currentWithData=allSeasons.find(s=>s.id===seasons[0].id);
  const previousWithData=seasons[1]||seasons[0];
  const defaultSeason=seasonMode==='previous' ? previousWithData : currentWithData||seasons[0];
  const selectedSeason=seasons.find(s=>s.id===Number(season))||defaultSeason;
  const seasonMatches=data.matches.filter(m=>m.seasonId===selectedSeason.id);
  const teamIds=new Set(seasonMatches.flatMap(m=>[m.homeTeamId,m.awayTeamId]));
  const options=data.teams.filter(t=>teamIds.has(t.id)).sort((a,b)=>(a.name||'').localeCompare(b.name||''));
  const teamId=options.find(t=>t.id===Number(team))?.id||options[0]?.id;
  const teams=new Map(data.teams.map(t=>[t.id,t.name])), names=new Map(data.players.map(p=>[p.id,p.name]));
  const teamName=teams.get(teamId)||'—';
  const matches=seasonMatches.filter(m=>m.homeTeamId===teamId||m.awayTeamId===teamId);
  const ids=new Set(matches.map(m=>m.id)), rows=data.appearances.filter(a=>ids.has(a.matchId)&&a.teamId===teamId);
  const roster=minuteDistribution(rows), selected=matches.find(m=>m.id===match);
  const latestMatches=matches.slice(0,windowSize),previousMatches=matches.slice(windowSize,windowSize*2);
  const latest=teamWindow(latestMatches,teamId),previous=teamWindow(previousMatches,teamId);
  const mode:SeasonMode=selectedSeason.id===seasons[0].id?'current':'previous';
  const remember=(tid:number,sid:number)=>{try{localStorage.setItem(`uzstat.analysis.team.${league}`,JSON.stringify({teamId:tid,seasonId:sid}));}catch{}};
  const recruitNeed=(need:TeamNeed)=>{remember(teamId,selectedSeason.id);onRecruit(need.position,mode,teamName,need);};
  const chooseTeam=(id:number)=>{setTeam(String(id));setMatch(null);remember(id,selectedSeason.id);};
  const openMatch=(m:CoreMatch)=>{setMatch(m.id);setSide('home');setTab('matches');};
  const openPlayer=async(id:number)=>{
    request.current?.abort();const controller=new AbortController();request.current=controller;setOpening(true);setProfileError(false);
    try{const response=await fetch(`/api/players?league=${league}&season=${mode}`,{signal:controller.signal});if(!response.ok)throw Error('load');
      const pool:Player[]=await response.json(),player=pool.find(p=>p.id===`${league}-${id}`);if(!player)throw Error('missing');onPlayer(player,pool);
    }catch{if(!controller.signal.aborted)setProfileError(true);}finally{if(!controller.signal.aborted)setOpening(false);}
  };
  const result=(m:CoreMatch)=>{if(m.homeScore===null||m.awayScore===null)return '—';const gf=m.homeTeamId===teamId?m.homeScore:m.awayScore,ga=m.homeTeamId===teamId?m.awayScore:m.homeScore;return gf>ga?tr(lang,'В','G‘'):gf===ga?tr(lang,'Н','D'):tr(lang,'П','M');};
  const matchButton=(m:CoreMatch)=><button key={m.id} className="match-summary-row" onClick={()=>openMatch(m)}><time>{date(m.date,lang)}</time><span>{teams.get(m.homeTeamId)||'—'} — {teams.get(m.awayTeamId)||'—'}</span><strong>{fmt(m.homeScore)} : {fmt(m.awayScore)}</strong><span className="result-chip">{result(m)}</span><span aria-hidden>→</span></button>;
  const rosterFiltered=roster.filter(p=>(position==='all'||p.positions.includes(position))&&(names.get(p.id)||'').toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const displayedMatches=matches.filter(m=>`${teams.get(m.homeTeamId)} ${teams.get(m.awayTeamId)}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const noteProps={scope:`team:${league}:${teamId}:${selectedSeason.id}`,context:`${teamName} · ${selectedSeason.name}`,matchIds:matches.map(m=>m.id),evidence:`Points per available match: ${fmt(latest.pointsPerMatch,2)} (${latest.scored}/${latest.played}); previous ${fmt(previous.pointsPerMatch,2)} (${previous.scored}/${previous.played})`,lang};
  return <section className="team-workspace focused-team">
    <div className="analysis-controls"><label>{tr(lang,'Команда','Jamoa')}<select value={teamId||''} onChange={e=>chooseTeam(Number(e.target.value))}>{!options.length&&<option value="">—</option>}{options.map(t=><option key={t.id} value={t.id}>{t.name||t.id}</option>)}</select></label><label>{tr(lang,'Сезон','Mavsum')}<select value={selectedSeason.id} onChange={e=>{const id=Number(e.target.value);setSeason(String(id));setTeam('');setMatch(null);setQuery('');if(teamId)remember(teamId,id);}}>{seasons.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label></div>
    <div className="section-heading"><h2>{teamName}</h2><button className="text-link" onClick={refresh}>{tr(lang,'Перечитать данные','Ma’lumotni qayta o‘qish')}</button><span className="context-chip">{selectedSeason.complete?tr(lang,'Загруженный сезон','Yuklangan mavsum'):tr(lang,'Неполные данные','To‘liq bo‘lmagan ma’lumot')}</span></div>
    <nav className="dossier-tabs" aria-label={tr(lang,'Анализ команды','Jamoa tahlili')}>{(['overview','matches','roster','notes'] as const).map((key,i)=><button key={key} aria-pressed={tab===key} onClick={()=>{setTab(key);setMatch(null);setQuery('');}}>{[tr(lang,'Обзор','Umumiy'),tr(lang,'Матчи','O‘yinlar'),tr(lang,'Состав','Tarkib'),tr(lang,'Выводы','Xulosalar')][i]}</button>)}</nav>
    {profileError&&<p role="alert" className="error-notice">{tr(lang,'Не удалось открыть профиль. Попробуйте ещё раз.','Profil ochilmadi. Qayta urinib ko‘ring.')}</p>}{opening&&<p role="status" className="muted">{tr(lang,'Открываю профиль…','Profil ochilmoqda…')}</p>}
    {!teamId?<div className="workspace-empty"><h3>{tr(lang,'Выберите команду','Jamoani tanlang')}</h3></div>:!matches.length?<div className="workspace-empty"><h3>{tr(lang,'Для выбранной команды нет загруженных матчей','Tanlangan jamoa uchun yuklangan o‘yinlar yo‘q')}</h3></div>:<>
      {tab==='overview'&&<>
        <div className="section-heading"><h3>{tr(lang,'Как меняются результаты','Natijalar qanday o‘zgarmoqda')}</h3><label className="inline-select">{tr(lang,'Отрезок','Davr')}<select value={windowSize} onChange={e=>setWindowSize(Number(e.target.value))}><option value={5}>5 {tr(lang,'матчей','o‘yin')}</option><option value={10}>10 {tr(lang,'матчей','o‘yin')}</option></select></label></div>
        <p className="muted">{tr(lang,'Сравнение последних доступных игр с предыдущим отрезком.','Oxirgi mavjud o‘yinlar oldingi davr bilan taqqoslanadi.')}</p>
        <div className="form-comparison"><div/><span>{tr(lang,'Последние','Oxirgi')} {latest.played}</span><span>{tr(lang,'Предыдущие','Oldingi')} {previous.played}</span>{[[tr(lang,'Очки за матч','O‘yindagi ochko'),fmt(latest.pointsPerMatch,2),fmt(previous.pointsPerMatch,2)],[tr(lang,'Забито за матч','O‘yinda urilgan gol'),fmt(latest.scored?latest.goalsFor!/latest.scored:null,2),fmt(previous.scored?previous.goalsFor!/previous.scored:null,2)],[tr(lang,'Пропущено за матч','O‘yinda o‘tkazilgan gol'),fmt(latest.scored?latest.goalsAgainst!/latest.scored:null,2),fmt(previous.scored?previous.goalsAgainst!/previous.scored:null,2)]].map(([label,a,b])=><React.Fragment key={label}><span>{label}</span><strong>{a}</strong><strong className="muted-value">{b}</strong></React.Fragment>)}</div>
        <div className="section-heading"><h3>{tr(lang,'Последние доступные матчи','Oxirgi mavjud o‘yinlar')}</h3><button className="text-link" onClick={()=>setTab('matches')}>{tr(lang,'Все матчи','Barcha o‘yinlar')} →</button></div>
        <div className="match-summary-list">{latestMatches.map(matchButton)}</div>
        <details className="explanation workspace-method"><summary>{tr(lang,'Покрытие и методика','Qamrov va usul')}</summary><p>{tr(lang,'Известен счёт','Hisob ma’lum')}: {latest.scored}/{latest.played} · {previous.scored}/{previous.played}. {tr(lang,'Последние — по загруженной истории, она может быть неполной. Значения получены из счёта матчей, а не суммы статистики игроков.','Oxirgi — yuklangan tarix bo‘yicha, u to‘liq bo‘lmasligi mumkin. Qiymatlar futbolchilar yig‘indisidan emas, o‘yin hisobidan olingan.')}</p><p>{tr(lang,'Составов','Tarkiblar')}: {matches.filter(m=>m.lineupAvailable).length}/{matches.length}. SofaScore · {selectedSeason.lastSyncedAt||tr(lang,'дата синхронизации неизвестна','sinxronlash sanasi noma’lum')}.</p></details>
      </>}
      {tab==='matches'&&!selected&&<><label className="search-field"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={tr(lang,'Поиск соперника','Raqibni qidirish')} aria-label={tr(lang,'Поиск соперника','Raqibni qidirish')}/></label><div className="match-summary-list">{displayedMatches.map(matchButton)}{!displayedMatches.length&&<p className="empty-inline">{tr(lang,'Матчи не найдены','O‘yinlar topilmadi')}</p>}</div></>}
      {tab==='matches'&&selected&&<section className="match-page">
        <button className="text-link back-link" onClick={()=>setMatch(null)}>← {tr(lang,'Все матчи','Barcha o‘yinlar')}</button>
        <div className="match-score"><span>{teams.get(selected.homeTeamId)}</span><strong>{fmt(selected.homeScore)} : {fmt(selected.awayScore)}</strong><span>{teams.get(selected.awayTeamId)}</span></div><p className="muted match-date">{date(selected.date,lang)} · {selected.seasonName}</p>
        <div className="section-heading"><div className="side-switch" role="group" aria-label={tr(lang,'Сторона матча','O‘yin tomoni')}>{(['home','away'] as const).map(s=><button key={s} aria-pressed={side===s} onClick={()=>setSide(s)}>{teams.get(s==='home'?selected.homeTeamId:selected.awayTeamId)}</button>)}</div><label className="inline-select">{tr(lang,'Показатель','Ko‘rsatkich')}<select value={metric} onChange={e=>setMetric(e.target.value)}>{Object.keys(labels).filter(k=>!['goals','assists'].includes(k)).map(k=><option value={k} key={k}>{metricName(k,lang)}</option>)}</select></label></div>
        <p className="muted">{tr(lang,'Схема','Sxema')}: {(side==='home'?selected.homeFormation:selected.awayFormation)||'—'}{(side==='home'?selected.homeTeamId:selected.awayTeamId)!==teamId&&<> · <button className="text-link" onClick={()=>{chooseTeam(side==='home'?selected.homeTeamId:selected.awayTeamId);setTab('overview');}}>{tr(lang,'Разобрать соперника','Raqibni tahlil qilish')} →</button></>}</p>
        {!selected.lineupAvailable?<p className="empty-inline">{tr(lang,'Подтверждённый состав не загружен.','Tasdiqlangan tarkib yuklanmagan.')}</p>:<div className="table-scroll"><table className="analysis-table"><thead><tr><th>{tr(lang,'Игрок','Futbolchi')}</th><th>{tr(lang,'Минуты','Daqiqalar')}</th><th>{metricName('goals',lang)}</th><th>{metricName('assists',lang)}</th><th>{metricName(metric,lang)}</th></tr></thead><tbody>{data.appearances.filter(a=>a.matchId===selected.id&&a.teamId===(side==='home'?selected.homeTeamId:selected.awayTeamId)).sort((a,b)=>(Number(a.substitute)-Number(b.substitute))||b.minutes-a.minutes).map(a=><tr key={a.id}><td><button className="text-link" disabled={opening} onClick={()=>openPlayer(a.playerId)}>{names.get(a.playerId)||a.playerId}</button><small>{a.position||'—'}{a.substitute===true?' · '+tr(lang,'Вышел на замену','Zaxiradan tushgan'):''}</small></td><td>{a.minutes}</td><td>{fmt(a.stats.goals)}</td><td>{fmt(a.stats.assists)}</td><td>{fmt(a.stats[metric],metric==='xG'||metric==='xA'?2:0)}</td></tr>)}</tbody></table></div>}
        <details className="explanation match-coverage"><summary>{tr(lang,'Покрытие показателей состава','Tarkib ko‘rsatkichlari qamrovi')}</summary><p className="muted">{tr(lang,'Известные значения / загруженные участия. Сейвы — только вратари. Это не полнота сезона и не официальная командная сумма.','Ma’lum qiymatlar / yuklangan ishtiroklar. Seyvlar — faqat darvozabonlar. Bu mavsum to‘liqligi yoki rasmiy jamoa yig‘indisi emas.')}</p><div className="table-scroll"><table className="analysis-table"><thead><tr><th>{tr(lang,'Показатель','Ko‘rsatkich')}</th><th>{tr(lang,'Игроки с данными','Ma’lumotli futbolchilar')}</th><th>{tr(lang,'Минуты с данными','Ma’lumotli daqiqalar')}</th></tr></thead><tbody>{Object.keys(labels).map(k=>{const c=metricCoverage(data.appearances.filter(a=>a.matchId===selected.id&&a.teamId===(side==='home'?selected.homeTeamId:selected.awayTeamId)),k);return <tr key={k}><td>{metricName(k,lang)}</td><td>{c.known}/{c.total}</td><td>{c.minutes}/{c.totalMinutes}</td></tr>;})}</tbody></table></div></details>
        <AnalysisNotebook key={`match:${selected.id}`} scope={`match:${selected.id}`} context={`${teams.get(selected.homeTeamId)} — ${teams.get(selected.awayTeamId)} · ${selected.seasonName}`} matchIds={[selected.id]} evidence={`SofaScore #${selected.id}; ${fmt(selected.homeScore)}:${fmt(selected.awayScore)}; event ${selected.eventHash}; lineup ${selected.lineupHash||'missing'}`} lang={lang}/>
        <details className="explanation workspace-method"><summary>{tr(lang,'Источник матча','O‘yin manbasi')}</summary><p>SofaScore #{selected.id} · {tr(lang,'Прочерк — нет данных.','Tire — ma’lumot yo‘q.')}</p><p>{selected.sourcePath||'—'}</p><p className="source-hash">{selected.eventHash}<br/>{selected.lineupHash}</p></details>
      </section>}
      {tab==='roster'&&<>
        <SquadDepth rows={rows} league={league} seasonId={selectedSeason.id} mode={mode} lang={lang} onNeed={setNeedSeed}/>
        {needSeed&&<><NeedForm key={`${needSeed.position}:${needSeed.detailedPosition}`} core={data} teamId={teamId} seasonId={selectedSeason.id} seed={needSeed} lang={lang} onDone={recruitNeed}/><button className="text-link" onClick={()=>setNeedSeed(null)}>{tr(lang,'Отмена','Bekor qilish')}</button></>}
        <div className="roster-controls"><label className="search-field"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={tr(lang,'Имя игрока','Futbolchi ismi')} aria-label={tr(lang,'Поиск по составу','Tarkibdan qidirish')}/></label><label className="inline-select">{tr(lang,'Позиция','Pozitsiya')}<select value={position} onChange={e=>setPosition(e.target.value as Position|'all')}><option value="all">{tr(lang,'Все','Barchasi')}</option>{(['GK','DF','MF','FW'] as Position[]).map(p=><option value={p} key={p}>{p}</option>)}</select></label>{position!=='all'&&<button className="action-secondary" onClick={()=>setNeedSeed({position,detailedPosition:null,evidence:`${teamName} · ${selectedSeason.name}; ${rows.filter(a=>a.position===position).reduce((sum,a)=>sum+a.minutes,0)} ${tr(lang,'минут на позиции в загруженных матчах','yuklangan o‘yinlarda pozitsiyadagi daqiqa')}`})}>{tr(lang,'Найти усиление','Kuchaytirish qidirish')} →</button>}</div>
        <p className="muted">{tr(lang,'Игроки, участвовавшие в загруженных матчах команды. Доля минут — от суммы минут всех игроков этой выборки.','Jamoaning yuklangan o‘yinlarida qatnashgan futbolchilar. Daqiqalar ulushi — tanlovdagi barcha futbolchilar daqiqalari yig‘indisidan.')}</p>
        <div className="table-scroll"><table className="analysis-table"><thead><tr><th>{tr(lang,'Игрок','Futbolchi')}</th><th>{tr(lang,'Игры / минуты','O‘yinlar / daqiqalar')}</th><th>{tr(lang,'Доля минут','Daqiqalar ulushi')}</th><th>{tr(lang,'В старте','Startda')}</th></tr></thead><tbody>{rosterFiltered.map(p=><tr key={p.id}><td><button className="text-link" disabled={opening} onClick={()=>openPlayer(p.id)}>{names.get(p.id)||p.id}</button><small>{p.positions.join(' / ')||'—'}</small></td><td><strong>{p.appearances}</strong><small>{p.minutes} {tr(lang,'мин','daq')}</small></td><td><span>{fmt(p.share,1)}%</span><div className="minute-share"><i style={{width:`${p.share||0}%`}}/></div></td><td>{p.startsCovered===p.appearances?fmt(p.starts):'—'}</td></tr>)}</tbody></table>{!rosterFiltered.length&&<p className="empty-inline">{tr(lang,'Игроки не найдены','Futbolchilar topilmadi')}</p>}</div>
      </>}
      <div hidden={tab!=='notes'}><DecisionWorkspace key={`decisions:${teamId}:${selectedSeason.id}`} core={data} teamId={teamId} seasonId={selectedSeason.id} lang={lang} onRecruit={recruitNeed}/><AnalysisNotebook key={noteProps.scope} {...noteProps} expanded/></div>
    </>}
  </section>;
}
