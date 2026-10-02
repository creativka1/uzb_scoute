'use client';
import React, { useEffect, useMemo, useState, useRef } from 'react';
import type { Language, League, Player, Position, SeasonMode } from '@/types/players';
import type { Appearance, CoreMatch, MatchCore } from '@/types/matches';
import { observedMetric, teamRoster, teamWindow } from '@/lib/match-analysis';

const tr = (lang: Language, ru: string, uz: string) => lang === 'ru' ? ru : uz;
const fmt = (n: number | null | undefined, decimals = 0) => typeof n === 'number' && Number.isFinite(n) ? n.toFixed(decimals) : '—';
const date = (n: number, lang: Language) => new Date(n*1000).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'uz-UZ', {timeZone:'Asia/Tashkent'});
const labels: Record<string, [string,string]> = {goals:['Голы','Gollar'],assists:['Ассисты','Assistlar'],shots:['Удары','Zarbalar'],keyPasses:['Передачи под удар','Zarbaga olib kelgan paslar'],tackles:['Отборы','To‘p qaytarish'],interceptions:['Перехваты','To‘pni to‘xtatish'],saves:['Сейвы','Seyvlar'],xG:['Ожидаемые голы · xG','Kutilayotgan gollar · xG'],xA:['Ожидаемые ассисты · xA','Kutilayotgan assistlar · xA']};
const metricName = (key: string, lang: Language) => labels[key]?.[lang === 'ru' ? 0 : 1] || key;
function useCore(league: League, playerId?: number) {
  const [data,setData] = useState<MatchCore | null>(null);
  const [error,setError] = useState(false);
  useEffect(() => { const controller = new AbortController(); setData(null); setError(false);
    fetch(`/api/analysis?league=${league}${playerId ? `&playerId=${playerId}` : ''}`, {signal:controller.signal})
      .then(async r => {if(!r.ok) throw Error('load'); return r.json();}).then(setData)
      .catch(e => {if(e.name !== 'AbortError') setError(true);});
    return () => controller.abort();
  },[league,playerId]);
  return {data,error};
}

interface Note { id: string; createdAt: string; updatedAt: string; context: string; matchIds: number[]; calculationVersion: string; evidence: string; observation: string; decision: string; review: string; status: 'open'|'confirmed'|'rejected'|'inconclusive' }
function validNote(n: unknown): n is Note {
  if (!n || typeof n !== 'object') return false;
  const x=n as Note;
  return ['id','createdAt','updatedAt','context','calculationVersion','evidence','observation','decision','review'].every(k=>typeof (x as unknown as Record<string,unknown>)[k] === 'string') && Array.isArray(x.matchIds) && x.matchIds.every(Number.isInteger) && ['open','confirmed','rejected','inconclusive'].includes(x.status);
}
export function AnalysisNotebook({scope, context, matchIds, evidence, lang}: {scope:string; context:string; matchIds:number[]; evidence:string; lang:Language}) {
  const key = `uzstat.analysis-notes.v1:${scope}`;
  const [notes,setNotes] = useState<Note[]>([]), [ready,setReady] = useState(false), [error,setError] = useState('');
  const [observation,setObservation] = useState(''), [decision,setDecision] = useState(''), [review,setReview] = useState('');
  useEffect(()=>{setReady(false);setNotes([]);setError('');setObservation('');setDecision('');setReview('');
    try {const raw=localStorage.getItem(key);const value=raw ? JSON.parse(raw) : [];
      if(!Array.isArray(value)||!value.every(validNote)) throw Error('corrupt');
      setNotes(value);setReady(true);
    } catch {setError(tr(lang,'Сохранение недоступно или повреждено. Существующие записи не перезаписаны.','Saqlanma mavjud emas yoki buzilgan. Yozuvlar o‘zgartirilmagan.'));}
  },[key]);
  const persist=(next:Note[])=>{if(!ready)return false;try{localStorage.setItem(key,JSON.stringify(next));setNotes(next);setError('');return true;}catch{setError(tr(lang,'Не удалось сохранить. Текст оставлен в форме.','Saqlab bo‘lmadi. Matn shaklda qoldi.'));return false;}};
  return <details className="analysis-card explanation notebook"><summary>{tr(lang,'Выводы и проверка решений','Xulosalar va qarorlarni tekshirish')} · {notes.length}</summary>
    <p>{tr(lang,'Записи сохраняются в этом браузере. Они содержат период, матчи и снимок наблюдений. Для резервной копии выгрузите JSON.','Yozuvlar shu brauzerda saqlanadi: davr, o‘yinlar va kuzatuvlar nusxasi. Zaxira uchun JSON yuklab oling.')}</p>
    {error && <p role="alert" className="error-notice">{error}</p>}
    <div className="note-form"><label>{tr(lang,'Наблюдение','Kuzatuv')}<textarea maxLength={4000} value={observation} onChange={e=>setObservation(e.target.value)} /></label>
    <label>{tr(lang,'Решение или цель развития','Qaror yoki rivojlanish maqsadi')}<textarea maxLength={4000} value={decision} onChange={e=>setDecision(e.target.value)} /></label>
    <label>{tr(lang,'Когда и по каким признакам проверить','Qachon va qanday tekshirish')}<input maxLength={500} value={review} onChange={e=>setReview(e.target.value)} placeholder={tr(lang,'После следующих 5 матчей…','Keyingi 5 o‘yindan keyin…')} /></label></div>
    <div className="note-actions"><button className="action-primary" disabled={!ready || !observation.trim()} onClick={()=>{const now=new Date().toISOString();if(persist([...notes,{id:crypto.randomUUID(),createdAt:now,updatedAt:now,context,matchIds,calculationVersion:'observed-v1',evidence,observation:observation.trim(),decision:decision.trim(),review:review.trim(),status:'open'}])){setObservation('');setDecision('');setReview('');}}}>{tr(lang,'Сохранить вывод','Xulosani saqlash')}</button>
    <button className="action-secondary" disabled={!notes.length} onClick={()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(notes,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='uzstat-analysis-notes.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}}>{tr(lang,'Экспорт JSON','JSON eksport')}</button>
    <label className="action-secondary">{tr(lang,'Восстановить JSON','JSON tiklash')}<input type="file" accept="application/json" disabled={!ready} onChange={async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>1000000)throw Error('large');const values=JSON.parse(await file.text());if(!Array.isArray(values)||!values.every(validNote))throw Error('format');const ids=new Set(notes.map(n=>n.id));persist([...notes,...values.filter(n=>!ids.has(n.id))]);}catch{setError(tr(lang,'Файл не распознан; записи не изменены.','Fayl tanilmadi; yozuvlar o‘zgarmadi.'));}e.target.value='';}} /></label></div>
    {notes.slice().reverse().map(n=><article className="note-entry" key={n.id}><small>{n.context} · {new Date(n.createdAt).toLocaleDateString()}</small><h4>{n.observation}</h4><p>{n.decision}</p><p>{n.review}</p><details><summary>{tr(lang,'Основание вывода','Xulosa asosi')}</summary><p>{n.evidence}</p><p>{tr(lang,'Матчи','O‘yinlar')}: {n.matchIds.join(', ') || '—'}</p></details><label>{tr(lang,'Результат проверки','Tekshiruv natijasi')}<select value={n.status} onChange={e=>persist(notes.map(x=>x.id===n.id?{...x,status:e.target.value as Note['status'],updatedAt:new Date().toISOString()}:x))}><option value="open">{tr(lang,'Ожидает проверки','Tekshirilmagan')}</option><option value="confirmed">{tr(lang,'Подтвердилось','Tasdiqlandi')}</option><option value="rejected">{tr(lang,'Не подтвердилось','Tasdiqlanmadi')}</option><option value="inconclusive">{tr(lang,'Недостаточно данных','Ma’lumot yetarli emas')}</option></select></label></article>)}
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

export function PlayerMatchHistory({player,lang}: {player:Player;lang:Language}) {
  const {data,error}=useCore(player.league,Number(player.id.split('-')[1]));
  const [season,setSeason]=useState(''), [metric,setMetric]=useState('goals');
  if(error)return <p role="alert">{tr(lang,'История матчей не загрузилась.','O‘yinlar tarixi yuklanmadi.')}</p>;
  if(!data)return <p className="muted">{tr(lang,'Загрузка матчей…','O‘yinlar yuklanmoqda…')}</p>;
  const seasons=data.seasons[player.league];
  const chosen=season||String(player.statsSeasonIds?.[0]||seasons.find(s=>data.matches.some(m=>m.seasonId===s.id))?.id||seasons[0].id);
  const events=data.matches.filter(m=>m.seasonId===Number(chosen));
  const map=new Map(events.map(m=>[m.id,m]));
  const rows=data.appearances.filter(a=>map.has(a.matchId)).sort((a,b)=>map.get(b.matchId)!.date-map.get(a.matchId)!.date);
  const teams=new Map(data.teams.map(t=>[t.id,t.name]));
  const last=observedMetric(rows.slice(0,5),metric), previous=observedMetric(rows.slice(5,10),metric);
  return <div className="player-history"><div className="analysis-controls"><label>{tr(lang,'Сезон истории','Tarix mavsumi')}<select value={chosen} onChange={e=>setSeason(e.target.value)}>{seasons.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>{tr(lang,'Показатель','Ko‘rsatkich')}<select value={metric} onChange={e=>setMetric(e.target.value)}>{Object.keys(labels).map(k=><option value={k} key={k}>{metricName(k,lang)}</option>)}</select></label></div>
    <p className="muted">{tr(lang,'Только подтверждённые участия. Отсутствующий матч не означает, что игрок не играл. Позиция указана по составу конкретного матча.','Faqat tasdiqlangan ishtiroklar. Yo‘q o‘yin futbolchi o‘ynamagan degani emas. Pozitsiya o‘yin tarkibidan olingan.')}</p>
    {!rows.length ? <p className="empty-inline">{tr(lang,'Нет подтверждённых матчей этого сезона.','Bu mavsumda tasdiqlangan o‘yinlar yo‘q.')}</p> : <>
    <Trend rows={rows} metric={metric} lang={lang} data={data}/>
    <div className="window-cards">{[[tr(lang,'Последние 5 доступных','Oxirgi 5 mavjud'),last],[tr(lang,'Предыдущие 5 доступных','Oldingi 5 mavjud'),previous]].map(([label,stat])=>{const s=stat as typeof last;return <article key={String(label)} className="analysis-card"><h4>{String(label)}</h4><strong>{fmt(s.per90,2)} <small>/ 90 {tr(lang,'мин','daq')}</small></strong><p className="muted">{s.matches} / {s.totalMatches} {tr(lang,'участий с показателем','ko‘rsatkichli ishtirok')} · {s.minutes} {tr(lang,'покрытых минут','qamrab olingan daqiqa')}</p></article>;})}</div>
    <div className="table-scroll"><table className="analysis-table"><thead><tr>{[tr(lang,'Дата / матч','Sana / o‘yin'),tr(lang,'Команда','Jamoa'),tr(lang,'Позиция','Pozitsiya'),tr(lang,'Минуты','Daqiqalar'),metricName(metric,lang)].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{rows.map(a=>{const m=map.get(a.matchId)!;return <tr key={a.id}><td>{date(m.date,lang)}<small>{teams.get(m.homeTeamId)} {fmt(m.homeScore)} : {fmt(m.awayScore)} {teams.get(m.awayTeamId)}</small><small>SofaScore #{m.id}</small></td><td>{teams.get(a.teamId)||'—'}</td><td>{a.position||'—'}</td><td>{a.minutes}</td><td>{fmt(a.stats[metric],metric==='xG'||metric==='xA'?2:0)}</td></tr>;})}</tbody></table></div></>}
    <details className="analysis-card explanation"><summary>{tr(lang,'Сравнение сезонов и позиций','Mavsumlar va pozitsiyalar taqqoslovi')}</summary><p>{tr(lang,'Роли здесь — широкие позиции источника. Смена позиции не доказывает причину изменения показателя.','Bu yerda rollar — manbaning umumiy pozitsiyalari. Pozitsiya o‘zgarishi ko‘rsatkich o‘zgarishining sababini isbotlamaydi.')}</p><div className="table-scroll"><table className="analysis-table"><thead><tr><th>{tr(lang,'Период / позиция','Davr / pozitsiya')}</th><th>{tr(lang,'Значение / 90','Qiymat / 90')}</th><th>{tr(lang,'Покрытие','Qamrov')}</th></tr></thead><tbody>{seasons.flatMap(s=>{const ids=new Set(data.matches.filter(m=>m.seasonId===s.id).map(m=>m.id));const seasonRows=data.appearances.filter(a=>ids.has(a.matchId));return [null,...new Set(seasonRows.map(a=>a.position||'UNKNOWN'))].map(pos=>{const subset=pos?seasonRows.filter(a=>(a.position||'UNKNOWN')===pos):seasonRows;const stat=observedMetric(subset,metric);return <tr key={`${s.id}:${pos}`}><td>{s.name} · {pos||tr(lang,'Все позиции','Barcha pozitsiyalar')}</td><td>{fmt(stat.per90,2)}</td><td>{stat.matches} / {stat.totalMatches} · {stat.minutes} {tr(lang,'мин','daq')}</td></tr>;});})}</tbody></table></div></details>
    <AnalysisNotebook key={`${player.id}:${chosen}`} scope={`player:${player.id}:${chosen}`} context={`${player.name[lang]} · ${seasons.find(s=>String(s.id)===chosen)?.name}`} matchIds={rows.map(a=>a.matchId)} evidence={`${metricName(metric,lang)} /90: ${fmt(last.per90,2)} (${last.matches}/${last.totalMatches}); previous: ${fmt(previous.per90,2)} (${previous.matches}/${previous.totalMatches})`} lang={lang}/>
  </div>;
}

export function TeamWorkspace({league,seasonMode,lang,onRecruit,onPlayer}: {league:League;seasonMode:SeasonMode;lang:Language;onRecruit:(p:Position)=>void;onPlayer:(player:Player, pool:Player[])=>void}) {
  const {data,error}=useCore(league);
  const [team,setTeam]=useState(''),[season,setSeason]=useState(''),[match,setMatch]=useState<number|null>(null);
  const [profileError,setProfileError]=useState(false),[opening,setOpening]=useState(false);
  const detailRef=useRef<HTMLElement>(null);
  const profileRequest=useRef<AbortController|null>(null);
  useEffect(()=>()=>profileRequest.current?.abort(),[]);
  useEffect(()=>{if(match!==null)detailRef.current?.scrollIntoView({behavior:'smooth',block:'start'});},[match]);
  useEffect(()=>{setTeam('');setSeason('');setMatch(null);},[league,seasonMode]);
  const seasonId=useMemo(()=>{if(!data)return 0;const list=data.seasons[league];return Number(season)||(seasonMode==='current'?list[0].id:seasonMode==='previous'?list[1].id:list.find(s=>data.matches.some(m=>m.seasonId===s.id))?.id||list[0].id);},[data,league,season,seasonMode]);
  if(error)return <p role="alert" className="error-notice">{tr(lang,'Не удалось прочитать матчевое ядро.','O‘yinlar bazasini o‘qib bo‘lmadi.')}</p>;
  if(!data)return <p className="muted">{tr(lang,'Загрузка команд и матчей…','Jamoalar va o‘yinlar yuklanmoqda…')}</p>;
  const seasons=data.seasons[league], selectedSeason=seasons.find(s=>s.id===seasonId)!;
  const seasonMatches=data.matches.filter(m=>m.seasonId===seasonId);
  const teamIds=new Set(seasonMatches.flatMap(m=>[m.homeTeamId,m.awayTeamId]));
  const options=data.teams.filter(t=>teamIds.has(t.id)).sort((a,b)=>(a.name||'').localeCompare(b.name||''));
  const teamId=Number(team)||options[0]?.id;
  const teamName=data.teams.find(t=>t.id===teamId)?.name||'—';
  const matches=seasonMatches.filter(m=>m.homeTeamId===teamId||m.awayTeamId===teamId);
  const ids=new Set(matches.map(m=>m.id));
  const rows=data.appearances.filter(a=>ids.has(a.matchId)&&a.teamId===teamId);
  const roster=teamRoster(rows), names=new Map(data.players.map(p=>[p.id,p.name]));
  const teams=new Map(data.teams.map(t=>[t.id,t.name]));
  const selected=matches.find(m=>m.id===match);
  const openPlayer=async (id:string)=>{profileRequest.current?.abort();const controller=new AbortController();profileRequest.current=controller;setOpening(true);setProfileError(false);try{
    const mode=seasonId===seasons[0].id?'current':'previous';
    const response=await fetch(`/api/players?league=${league}&season=${mode}`,{signal:controller.signal});if(!response.ok)throw Error('load');
    const pool:Player[]=await response.json();const player=pool.find(p=>p.id===id);if(!player)throw Error('missing');onPlayer(player,pool);
  }catch(e){if(!controller.signal.aborted)setProfileError(true);}finally{if(!controller.signal.aborted)setOpening(false);}};
  const latest=teamWindow(matches.slice(0,5),teamId), previous=teamWindow(matches.slice(5,10),teamId);
  return <section className="team-workspace">{profileError&&<p role="alert" className="error-notice">{tr(lang,'Не удалось открыть профиль этого сезона.','Bu mavsum profilini ochib bo‘lmadi.')}</p>}{opening&&<p role="status">{tr(lang,'Открываю профиль…','Profil ochilmoqda…')}</p>}<div className="analysis-controls"><label>{tr(lang,'Команда','Jamoa')}<select value={teamId||''} onChange={e=>{setTeam(e.target.value);setMatch(null);}}>{!options.length&&<option value="">—</option>}{options.map(t=><option key={t.id} value={t.id}>{t.name||t.id}</option>)}</select></label><label>{tr(lang,'Сезон матчей','O‘yinlar mavsumi')}<select value={seasonId} onChange={e=>{setSeason(e.target.value);setTeam('');setMatch(null);}}>{seasons.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label></div>
    <div className="section-heading"><div><span className="eyebrow">{tr(lang,'КОМАНДА И МАТЧИ','JAMOA VA O‘YINLAR')}</span><h2>{teamName}</h2></div><span>{matches.length} {tr(lang,'матчей в кэше','keshlangan o‘yin')}</span></div>
    <p className="dossier-notice">{selectedSeason.name} · {selectedSeason.complete?tr(lang,'Загрузка сезона завершена.','Mavsum yuklangan.'):tr(lang,'Неполная история. «Последние» означает последние доступные матчи, а не гарантированно последние игры команды.','Tarix to‘liq emas. «Oxirgi» — oxirgi mavjud o‘yinlar, jamoaning eng so‘nggi barcha o‘yinlari emas.')} {tr(lang,'Последняя синхронизация:','Oxirgi sinxronlash:')} {selectedSeason.lastSyncedAt||tr(lang,'дата неизвестна','sana noma’lum')}.</p>
    {!matches.length ? <div className="workspace-empty"><h3>{tr(lang,'Матчи этого сезона ещё не загружены','Bu mavsum o‘yinlari hali yuklanmagan')}</h3><p>{tr(lang,'Выберите доступный сезон. Прошлые матчи не подставляются автоматически.','Mavjud mavsumni tanlang. Oldingi o‘yinlar avtomatik almashtirilmaydi.')}</p></div> : <>
    <div className="window-cards">{[[tr(lang,'Последние 5 доступных матчей','Oxirgi 5 mavjud o‘yin'),latest],[tr(lang,'Предыдущие 5 доступных матчей','Oldingi 5 mavjud o‘yin'),previous]].map(([label,value])=>{const v=value as typeof latest;return <article className="analysis-card" key={String(label)}><h3>{String(label)}</h3><strong>{fmt(v.pointsPerMatch,2)} <small>{tr(lang,'очка / матч','ochko / o‘yin')}</small></strong><p>{tr(lang,'Голы','Gollar')}: {fmt(v.goalsFor)} — {fmt(v.goalsAgainst)}</p><p className="muted">{tr(lang,'Известен счёт','Hisob ma’lum')}: {v.scored} / {v.played}</p></article>;})}</div>
    <div className="team-columns"><section className="analysis-card"><h3>{tr(lang,'Журнал матчей','O‘yinlar jurnali')}</h3><div className="match-list">{matches.map(m=><button aria-pressed={selected?.id===m.id} key={m.id} onClick={()=>setMatch(m.id)}><span><small>{date(m.date,lang)}</small>{teams.get(m.homeTeamId)||'—'} — {teams.get(m.awayTeamId)||'—'}</span><strong>{fmt(m.homeScore)} : {fmt(m.awayScore)}</strong><small>{m.lineupAvailable?tr(lang,'Есть состав','Tarkib bor'):tr(lang,'Нет состава','Tarkib yo‘q')}</small></button>)}</div></section>
    <section className="analysis-card"><h3>{tr(lang,'Участие игроков','Futbolchilar ishtiroki')}</h3><p className="muted">{tr(lang,'Исторический состав по матчам, не список действующих контрактов. Глубина отражает только широкие подтверждённые позиции.','O‘yinlar bo‘yicha tarixiy tarkib, amaldagi shartnomalar ro‘yxati emas. Faqat umumiy tasdiqlangan pozitsiyalar.')}</p><div className="position-depth">{(['GK','DF','MF','FW'] as Position[]).map(pos=><button key={pos} onClick={()=>onRecruit(pos)} title={tr(lang,'Искать усиление на эту позицию','Bu pozitsiyaga kuchaytirish qidirish')}>{pos} · {roster.filter(p=>p.positions.includes(pos)).length}<span>+ {tr(lang,'Поиск','Qidiruv')}</span></button>)}</div><div className="table-scroll"><table className="analysis-table"><thead><tr><th>{tr(lang,'Игрок','Futbolchi')}</th><th>{tr(lang,'Минуты','Daqiqalar')}</th><th>{tr(lang,'Участия','Ishtiroklar')}</th></tr></thead><tbody>{roster.map(p=><tr key={p.id}><td><button className="text-link" disabled={opening} onClick={()=>openPlayer(`${league}-${p.id}`)}>{names.get(p.id)||p.id}</button><small>{p.positions.join(' / ')||'—'}</small></td><td>{p.minutes}</td><td>{p.appearances}</td></tr>)}</tbody></table></div></section></div>
    {selected&&<section ref={detailRef} className="analysis-card match-detail"><div className="section-heading"><h3>{teams.get(selected.homeTeamId)} {fmt(selected.homeScore)} : {fmt(selected.awayScore)} {teams.get(selected.awayTeamId)}</h3><button className="action-secondary" onClick={()=>setMatch(null)}>{tr(lang,'Закрыть матч','O‘yinni yopish')}</button></div><p className="muted">{date(selected.date,lang)} · {selected.seasonName} · SofaScore #{selected.id}</p><p className="muted">{tr(lang,'Схемы','Sxemalar')}: {selected.homeFormation||'—'} / {selected.awayFormation||'—'}. {tr(lang,'Ниже — показатели игроков, не официальная командная сумма.','Quyida futbolchilar statistikasi, rasmiy jamoa yig‘indisi emas.')}</p>
    {!selected.lineupAvailable&&<p className="dossier-notice">{tr(lang,'Подтверждённый состав не загружен.','Tasdiqlangan tarkib yuklanmagan.')}</p>}
    {[selected.homeTeamId,selected.awayTeamId].map(tid=><div key={tid}><div className="section-heading"><h4>{teams.get(tid)}</h4>{tid!==teamId&&<button className="text-link" onClick={()=>{setTeam(String(tid));setMatch(null);}}>{tr(lang,'Анализ соперника','Raqib tahlili')} →</button>}</div><div className="table-scroll"><table className="analysis-table"><thead><tr>{[tr(lang,'Игрок','Futbolchi'),tr(lang,'Старт','Start'),tr(lang,'Мин','Daq'),...['goals','assists','shots','keyPasses','xG','xA'].map(k=>metricName(k,lang))].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{data.appearances.filter(a=>a.matchId===selected.id&&a.teamId===tid).map(a=><tr key={a.id}><td><button className="text-link" disabled={opening} onClick={()=>openPlayer(`${league}-${a.playerId}`)}>{names.get(a.playerId)||a.playerId}</button><small>{a.position||'—'}</small></td><td>{a.substitute===null?'—':a.substitute?tr(lang,'Замена','Zaxira'):tr(lang,'Да','Ha')}</td><td>{a.minutes}</td>{['goals','assists','shots','keyPasses','xG','xA'].map(k=><td key={k}>{fmt(a.stats[k],k==='xG'||k==='xA'?2:0)}</td>)}</tr>)}</tbody></table></div></div>)}
    <details className="explanation"><summary>{tr(lang,'Происхождение данных','Ma’lumot manbasi')}</summary><p>{selected.sourcePath||tr(lang,'Состав отсутствует','Tarkib mavjud emas')}</p><p className="source-hash">Event SHA-256: {selected.eventHash}<br/>Lineup SHA-256: {selected.lineupHash||'—'}</p></details>
    <AnalysisNotebook key={`match:${selected.id}`} scope={`match:${selected.id}`} context={`${teams.get(selected.homeTeamId)} — ${teams.get(selected.awayTeamId)} · ${selected.seasonName}`} matchIds={[selected.id]} evidence={`SofaScore #${selected.id}; ${fmt(selected.homeScore)}:${fmt(selected.awayScore)}; event ${selected.eventHash}; lineup ${selected.lineupHash||'missing'}`} lang={lang}/>
    </section>}
    <AnalysisNotebook key={`team:${league}:${teamId}:${seasonId}`} scope={`team:${league}:${teamId}:${seasonId}`} context={`${teamName} · ${selectedSeason.name}`} matchIds={matches.map(m=>m.id)} evidence={`Points per available match: ${fmt(latest.pointsPerMatch,2)} (${latest.scored}/${latest.played}); previous ${fmt(previous.pointsPerMatch,2)} (${previous.scored}/${previous.played})`} lang={lang}/>
    </>}
    <details className="analysis-card explanation"><summary>{tr(lang,'Покрытие и ограничения','Qamrov va cheklovlar')}</summary><p>{tr(lang,'Составы загружены','Tarkiblar yuklangan')}: {matches.filter(m=>m.lineupAvailable).length} / {matches.length}. {tr(lang,'Во всём кэше составов без подтверждённой привязки к сезону','Butun keshda mavsumga bog‘lanmagan tarkiblar')}: {data.unlinkedEventIds.length}.</p><p>{tr(lang,'Источник: SofaScore. Нет событийных данных для карт ударов, сетей передач и прессинга. Такие показатели не реконструируются из сезонных сумм.','Manba: SofaScore. Zarba xaritalari, pas tarmoqlari va pressing uchun voqealar yo‘q. Ular mavsum yig‘indisidan tiklanmaydi.')}</p></details>
  </section>;
}
