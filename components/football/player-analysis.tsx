'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { ArrowRightLeft, Bookmark, Check, ChevronRight, Printer, Search, X } from 'lucide-react';
import type { Language, Player, Position } from '@/types/players';
import type { AnalysisLocation } from '@/types/matches';
import { getSimilarPlayers } from '@/lib/recruitment';
import { PlayerMatchHistory } from '@/components/football/match-workspace';

const text = (lang: Language, ru: string, uz: string) => lang === 'ru' ? ru : uz;
export const formatValue = (value: number | null | undefined, decimals = 0, suffix = '') =>
  value === null || value === undefined || !Number.isFinite(value) ? '—' : value > 0 && value < 0.5 * Math.pow(10, -decimals) ? `<${Math.pow(10, -decimals).toFixed(decimals)}${suffix}` : `${value.toFixed(decimals)}${suffix}`;

const metricLabels: Record<string, [string, string]> = {
  savesPer90: ['Сейвы', 'Seyvlar'], passAccPct: ['Точные передачи', 'Aniq paslar'],
  tacklesPer90: ['Отборы', 'To‘p qaytarish'], interceptionsPer90: ['Перехваты', 'To‘pni to‘xtatish'],
  dribbleSuccessPct: ['Успешный дриблинг', 'Muvaffaqiyatli dribling'],
  keyPassesPer90: ['Передачи под удар', 'Zarbaga olib kelgan paslar'],
  assistsPer90: ['Голевые передачи', 'Golli uzatmalar'], goalsPer90: ['Голы', 'Gollar'], shotsPer90: ['Удары', 'Zarbalar'],
};
const roleKeys: Record<Position, string[]> = {
  UNKNOWN: [], GK: ['savesPer90', 'passAccPct'],
  DF: ['tacklesPer90', 'interceptionsPer90', 'passAccPct', 'dribbleSuccessPct', 'keyPassesPer90'],
  MF: ['keyPassesPer90', 'assistsPer90', 'dribbleSuccessPct', 'tacklesPer90', 'passAccPct'],
  FW: ['goalsPer90', 'assistsPer90', 'shotsPer90', 'keyPassesPer90', 'dribbleSuccessPct'],
};
export function positionLabel(position: Position, lang: Language) {
  const labels = { GK: ['Вратарь', 'Darvozabon'], DF: ['Защитник', 'Himoyachi'], MF: ['Полузащитник', 'Yarim himoyachi'], FW: ['Нападающий', 'Hujumchi'], UNKNOWN: ['Позиция не указана', 'Pozitsiya ko‘rsatilmagan'] };
  return labels[position][lang === 'ru' ? 0 : 1];
}
function band(value: number | null, lang: Language) {
  if (value === null) return text(lang, 'Недостаточно данных для сравнения', 'Taqqoslash uchun ma’lumot yetarli emas');
  if (value >= 75) return text(lang, 'Верхняя четверть группы', 'Guruhning yuqori choragida');
  if (value >= 60) return text(lang, 'Выше середины группы', 'Guruh o‘rtasidan yuqori');
  if (value >= 40) return text(lang, 'Около середины группы', 'Guruh o‘rtasiga yaqin');
  return text(lang, 'Ниже середины группы', 'Guruh o‘rtasidan past');
}
export function PlayerAvatar({ player, lang, large = false }: {player: Player; lang: Language; large?: boolean}) {
  const [attempt, setAttempt] = useState(0);
  useEffect(() => setAttempt(0), [player.photoUrl]);
  const urls = [player.photoUrl, player.photoUrl?.replace('img.sofascore.com', 'api.sofascore.com')];
  return <div className={`player-avatar ${large ? 'large' : ''}`}>{attempt >= urls.length || !player.photoUrl ? player.initials : <img src={urls[attempt]} alt={player.name[lang]} onError={() => setAttempt(n => n + 1)} />}</div>;
}

export function AnalysisDialog({ title, children, onClose, lang, narrow = false }: {title: string; children: React.ReactNode; onClose: () => void; lang: Language; narrow?: boolean}) {
  const ref = useRef<HTMLDialogElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  const id = useId();
  useEffect(() => {
    const el = ref.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    el?.showModal();
    document.body.style.overflow = 'hidden';
    return () => { el?.close(); document.body.style.overflow = overflow; previousFocus?.focus(); };
  }, []);
  return <dialog ref={ref} aria-labelledby={id} className={`analysis-dialog ${narrow ? 'narrow' : ''}`} onCancel={e => { e.preventDefault(); close.current(); }} onClick={e => { if (e.target === e.currentTarget) close.current(); }}>
    <div className="dialog-sheet">
      <div className="dialog-top"><span id={id}>{title}</span><button className="icon-button" onClick={onClose} aria-label={text(lang, 'Закрыть', 'Yopish')}><X size={20} /></button></div>
      {children}
    </div>
  </dialog>;
}

export function CoverageLabel({player,metric,lang,role=false}: {player:Player;metric:string;lang:Language;role?:boolean}) {
  const d=(role?player.roleMetricCoverage:player.statsMetricDetails)?.[metric];
  if(!d)return null;
  const full=d.reason==='no_attempts'
    ? text(lang,'Нет попыток: процент не определён','Urinishlar yo‘q: foiz aniqlanmagan')
    : `${text(lang,'Данные','Ma’lumot')}: ${d.matches} / ${d.totalMatches} ${text(lang,'матчей','o‘yin')} · ${d.minutes} ${text(lang,'мин','daq')}${d.status==='partial'?text(lang,' · частично',' · qisman'):''}`;
  const compact=d.reason==='no_attempts'
    ? text(lang,'Нет попыток','Urinishlar yo‘q')
    : `${d.matches}/${d.totalMatches} · ${d.minutes} ${text(lang,'мин','daq')}${d.status==='partial'?text(lang,' · частично',' · qisman'):''}`;
  return <small className={`metric-coverage ${d.status}`} title={full} aria-label={full}>{compact}</small>;
}
export function ScoutBadge({player,lang}: {player:Player;lang:Language}) {
  return <div className="scout-pill"><span>{text(lang,'Скаутский индекс','Skaut indeksi')}</span><strong>{formatValue(player.scoutingEngine.roleScore)}<small> / 100</small></strong></div>;
}
export function MetricProfile({ player, comparison, lang }: {player: Player; comparison?: Player; lang: Language}) {
  const keys = roleKeys[player.position];
  const lowCoverage=keys.some(k=>[player,comparison].some(p=>{const d=p?.roleMetricCoverage?.[k];return d && (d.status==='partial'||d.minutes<450);}));
  return <section className="analysis-card metric-profile compact-profile">
    <h3>{text(lang,'Сравнение со средним','O‘rtacha bilan taqqoslash')}</h3>
    <p className="muted">{positionLabel(player.position,lang)} · {player.statsSeasonLabel}</p>
    <div className="comparison-key"><span><i/>{player.name[lang]}</span>{comparison&&<span><i/>{comparison.name[lang]}</span>}<span className="mean-key"><i/>{text(lang,'Среднее по позиции','Pozitsiya o‘rtachasi')}</span></div>
    {lowCoverage&&<p className="compact-warning">{text(lang,'Часть показателей основана на небольшой или неполной выборке.','Ayrim ko‘rsatkichlar kichik yoki to‘liq bo‘lmagan tanlovga asoslangan.')}</p>}
    {!keys.length&&<p className="empty-inline">{text(lang,'Позиция для сравнения неизвестна.','Taqqoslash pozitsiyasi noma’lum.')}</p>}
    <div className="profile-rows">{keys.map(key=>{
      const percent=key.endsWith('Pct'), value=player.roleMetrics?.[key]??null, other=comparison?.roleMetrics?.[key]??null;
      const benchmark=player.roleBenchmarks?.[key], mean=benchmark?.mean??null;
      const max=percent?100:Math.max(1,benchmark?.max??0,value??0,other??0);
      const values=[{value,name:player.name[lang],kind:'primary'},...(comparison?[{value:other,name:comparison.name[lang],kind:'comparison'}]:[])];
      return <div className="profile-row" key={key} data-metric={key}>
        <div className="metric-top"><div><strong>{metricLabels[key][lang==='ru'?0:1]}</strong><span>{percent?text(lang,'Успешность, %','Muvaffaqiyat, %'):text(lang,'За 90 минут','90 daqiqada')}</span></div><small className="metric-scale">0–{formatValue(max,percent?0:2,percent?'%':'')}</small></div>
        <div className={`metric-lines ${comparison?'':'single-player'}`}>{values.map(item=><div className={`metric-line ${item.kind}`} key={item.kind}>{comparison&&<span className="metric-line-name">{item.name}</span>}<div className={`profile-track ${item.kind==='comparison'?'comparison':''} `} role="img" aria-label={`${item.name}: ${formatValue(item.value,percent?1:2,percent?'%':'')}; ${text(lang,'среднее','o‘rtacha')}: ${formatValue(mean,percent?1:2,percent?'%':'')}`}>{item.value!==null&&<span style={{width:`${item.value/max*100}%`}}/>}{mean!==null&&<i className="mean-marker" style={{left:`${mean/max*100}%`}} aria-hidden="true"/>}</div><b>{formatValue(item.value,percent?1:2,percent?'%':'')}</b></div>)}</div>
        <p className="metric-mean-caption">{text(lang,'Среднее','O‘rtacha')}: {formatValue(mean,percent?1:2,percent?'%':'')}</p>
      </div>;
    })}</div>
    <details className="explanation"><summary>{text(lang,'Подробнее о данных и сравнении','Ma’lumot va taqqoslash tafsilotlari')}</summary>
      <p>{text(lang,'Вертикальная отметка на полосе — среднее арифметическое показателей игроков той же позиции, лиги и периода. В группу входят игроки с минимум 450 покрытыми минутами и 80% покрытия этой метрики. При группе меньше трёх игроков среднее не выводится.','Chiziqdagi tik belgi — bir xil pozitsiya, liga va davrdagi futbolchilar ko‘rsatkichlarining arifmetik o‘rtachasi. Kamida 450 qamrab olingan daqiqa va 80% qamrov talab qilinadi. Guruhda uch futbolchidan kam bo‘lsa, o‘rtacha ko‘rsatilmaydi.')}</p>
      <p>{text(lang,'Все ряды одной метрики имеют общую шкалу: от нуля до максимума группы или выбранных игроков. Полная полоса не означает 100% успешности. Проценты используются только для долей успешных действий. Пропуски не заменяются нулями.','Bir ko‘rsatkich qatorlari bir shkalada: noldan guruh yoki tanlangan futbolchilar maksimumigacha. To‘liq chiziq 100% muvaffaqiyat degani emas. Foiz faqat muvaffaqiyat ulushida ishlatiladi. Bo‘sh qiymatlar nolga almashtirilmaydi.')}</p>
      <div className="table-scroll"><table className="method-table"><thead><tr><th>{text(lang,'Показатель','Ko‘rsatkich')}</th><th>{player.name[lang]}</th>{comparison&&<th>{comparison.name[lang]}</th>}<th>{text(lang,'Игроков в среднем','O‘rtachadagi futbolchilar')}</th></tr></thead><tbody>{keys.map(key=><tr key={key}><td>{metricLabels[key][lang==='ru'?0:1]}</td><td><CoverageLabel player={player} metric={key} lang={lang} role/></td>{comparison&&<td><CoverageLabel player={comparison} metric={key} lang={lang} role/></td>}<td>{player.roleBenchmarks?.[key]?.count??0}</td></tr>)}</tbody></table></div>
      <p>{text(lang,'Индекс использует доступные ролевые процентили с поправкой на минуты; это не общая оценка качества. Набор метрик может отличаться. Неполное покрытие способно смещать сравнение.','Indeks mavjud rol percentillarini daqiqalar hisobiga moslaydi; bu umumiy sifat bahosi emas. Ko‘rsatkichlar tarkibi farq qilishi mumkin. To‘liq bo‘lmagan qamrov taqqoslashni og‘dirishi mumkin.')}</p>
    </details>
  </section>;
}

function statRows(player: Player, lang: Language): { label: string; value: string; hint?: string; key?: string }[] {
  const ru = lang === 'ru';
  const rows = [
    {key: 'matchesPlayed', label: ru ? 'Матчи' : 'O‘yinlar', value: formatValue(player.matchesPlayed)},
    {key: 'minutesPlayed', label: ru ? 'Минуты' : 'Daqiqalar', value: formatValue(player.minutesPlayed)},
    {key: 'goals', label: ru ? 'Голы' : 'Gollar', value: formatValue(player.goals)},
    {key: 'assists', label: ru ? 'Голевые передачи' : 'Golli uzatmalar', value: formatValue(player.assists)},
    {key: 'shots', label: ru ? 'Удары' : 'Zarbalar', value: formatValue(player.shots)},
    {key: 'keyPasses', label: ru ? 'Передачи под удар' : 'Zarbaga olib kelgan paslar', value: formatValue(player.keyPasses)},
    {key: 'xG', label: ru ? 'Ожидаемые голы · xG' : 'Kutilayotgan gollar · xG', value: formatValue(player.xG, 2), hint: ru ? 'Сумма вероятностей гола для ударов игрока по модели источника.' : 'Manba modeli bo‘yicha futbolchi zarba bergan vaziyatlar sifati.'},
    {key: 'xA', label: ru ? 'Ожидаемые ассисты · xA' : 'Kutilayotgan assistlar · xA', value: formatValue(player.xA, 2), hint: ru ? 'Оценка голевого потенциала передач по модели источника.' : 'Manba modeli bo‘yicha paslarning golga olib kelish salohiyati.'},
    {key: 'passAccPct', label: ru ? 'Точные передачи' : 'Aniq paslar', value: formatValue(player.passAccPct, 1, '%')},
    {key: 'dribbleSuccessRate', label: ru ? 'Успешный дриблинг' : 'Muvaffaqiyatli dribling', value: formatValue(player.dribbleSuccessRate, 1, '%')},
    {key: 'dribbleWon', label: ru ? 'Успешные обводки' : 'Muvaffaqiyatli aldab o‘tishlar', value: formatValue(player.dribbleWon)},
    {key: 'dribbleTotal', label: ru ? 'Попытки обводок' : 'Aldab o‘tishga urinishlar', value: formatValue(player.dribbleTotal)},
    {key: 'duelWinPct', label: ru ? 'Выигранные единоборства' : 'Yutilgan kurashlar', value: formatValue(player.duelWinRate, 1, '%')},
    {key: 'aerialWinPct', label: ru ? 'Выигранные верховые дуэли' : 'Havoda yutilgan kurashlar', value: formatValue(player.aerialWinRate, 1, '%')},
    {key: 'tackles', label: ru ? 'Отборы' : 'To‘p qaytarish', value: formatValue(player.tackles)},
    {key: 'interceptions', label: ru ? 'Перехваты' : 'To‘pni to‘xtatish', value: formatValue(player.interceptions)},
  ];
  if (player.position === 'GK') rows.splice(2, 0, {key: 'saves', label: ru ? 'Сейвы' : 'Seyvlar', value: formatValue(player.saves)});
  return rows;
}

function DataContext({ player, lang }: {player: Player; lang: Language}) {
  return <details className="analysis-card explanation data-context"><summary>{text(lang, 'Качество данных', 'Ma’lumot sifati')}</summary>
    <p>{text(lang, 'Прочерк означает отсутствие данных, а не нулевой результат.', 'Tire — nol natija emas, ma’lumot yo‘qligi.')}</p>
    <dl className="facts"><div><dt>{text(lang, 'Период наблюдений', 'Kuzatuv davri')}</dt><dd>{new Date(player.statsDateFrom * 1000).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'uz-UZ')} — {new Date(player.statsDateTo * 1000).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'uz-UZ')}</dd></div>
      <div><dt>{text(lang, 'Покрытие сезона', 'Mavsum qamrovi')}</dt><dd>{player.statsCoverageComplete ? text(lang, 'Матчи загружены', 'O‘yinlar yuklangan') : text(lang, 'Неполное', 'To‘liq emas')}</dd></div>
    </dl>
    <p>{text(lang, 'Рейтинг — среднее доступных ролевых процентилей с поправкой на минуты. Это вспомогательный расчёт, а не общая оценка качества игрока.', 'Reyting — mavjud rol percentillarining daqiqalarga moslashtirilgan o‘rtachasi. Bu yordamchi hisob, futbolchining umumiy sifat bahosi emas.')}</p>
    <p>{text(lang, 'Точная позиция показывается только при однозначном подтверждении в профиле источника. Клуб может относиться к последнему известному матчу.', 'Aniq pozitsiya faqat manba profilida bir ma’noli tasdiqlangan bo‘lsa ko‘rsatiladi. Klub oxirgi ma’lum o‘yinga tegishli bo‘lishi mumkin.')}</p>
  </details>;
}

export function PlayerDossier({ player, players, lang, saved, canSave, onSave, onCompare, onCompareReplacement, onPrint, onClose, detailedLabel, footLabel, onOpenMatch }: {
  player: Player; players: Player[]; lang: Language; saved: boolean; canSave: boolean; onSave: () => void; onCompare: () => void; onCompareReplacement: (p: Player) => void; onPrint: () => void; onClose: () => void; detailedLabel: string; footLabel: string; onOpenMatch?:(location:AnalysisLocation)=>void;
}) {
  const [view, setView] = useState<'overview' | 'stats' | 'matches'>('overview');
  const [cheaperOnly,setCheaperOnly]=useState(false);
  const replacements = getSimilarPlayers(player, players, cheaperOnly);
  const ru = lang === 'ru';
  return <AnalysisDialog title={ru ? 'Профиль игрока' : 'Futbolchi profili'} onClose={onClose} lang={lang}>
    <div className="dossier-heading"><PlayerAvatar player={player} lang={lang} large /><div><span className="eyebrow">{player.statsSeasonLabel}</span><h2>{player.name[lang]}</h2><p>{player.club[lang]} <span>·</span> {player.detailedPosition ? detailedLabel : positionLabel(player.position, lang)} <span>·</span> {player.age ?? '—'} {ru ? 'лет' : 'yosh'}</p></div></div>
    <ScoutBadge player={player} lang={lang} /><div className="dossier-actions"><button className="action-primary" onClick={onCompare}><ArrowRightLeft size={16} />{ru ? 'Сравнить игрока' : 'Futbolchini taqqoslash'}</button><button className="action-secondary" disabled={!canSave} onClick={onSave}>{saved ? <Check size={16} /> : <Bookmark size={16} />}{saved ? (ru ? 'В сохранённых' : 'Saqlangan') : (ru ? 'Сохранить' : 'Saqlash')}</button><button className="action-secondary print-action" onClick={onPrint}><Printer size={16} />{ru ? 'Отчёт PDF' : 'PDF hisobot'}</button></div>
    {!player.statsCoverageComplete && <div className="dossier-notice partial">{ru ? 'Неполные данные' : 'Ma’lumot to‘liq emas'}</div>}
    <div className="dossier-tabs" role="group" aria-label={ru ? 'Раздел профиля' : 'Profil bo‘limi'}><button aria-pressed={view === 'overview'} onClick={() => setView('overview')}>{ru ? 'Обзор' : 'Umumiy'}</button><button aria-pressed={view === 'stats'} onClick={() => setView('stats')}>{ru ? 'Вся статистика' : 'Barcha statistika'}</button><button aria-pressed={view === 'matches'} onClick={()=>setView('matches')}>{ru ? 'Матчи и динамика' : 'O‘yinlar va dinamika'}</button></div>
    {view === 'matches' ? <PlayerMatchHistory key={player.id} player={player} lang={lang} onOpenMatch={onOpenMatch}/> : view === 'overview' ? <>
      <div className="dossier-summary"><div><span>{ru ? 'Игры в выборке' : 'Tanlovdagi o‘yinlar'}</span><strong>{formatValue(player.matchesPlayed)}</strong><p>{formatValue(player.minutesPlayed)} {ru ? 'минут' : 'daqiqa'}</p></div><div><span>{player.position === 'GK' ? (ru ? 'Сейвы' : 'Seyvlar') : (ru ? 'Голы' : 'Gollar')}</span><strong>{formatValue(player.position === 'GK' ? player.saves : player.goals)}</strong><CoverageLabel player={player} metric={player.position === 'GK'?'saves':'goals'} lang={lang}/></div><div><span>{player.position === 'GK' ? (ru ? 'Точность передач' : 'Pas aniqligi') : (ru ? 'Голевые передачи' : 'Golli uzatmalar')}</span><strong>{formatValue(player.position === 'GK' ? player.passAccPct : player.assists, player.position === 'GK' ? 1 : 0, player.position === 'GK' ? '%' : '')}</strong><CoverageLabel player={player} metric={player.position === 'GK'?'passAccPct':'assists'} lang={lang}/></div></div>
      <div className="dossier-columns"><MetricProfile player={player} lang={lang} /><details className="analysis-card profile-facts explanation"><summary>{ru ? 'Профиль и контракт' : 'Profil va shartnoma'}</summary><dl className="facts">
        <div><dt>{ru ? 'Стоимость источника' : 'Manbadagi qiymat'}</dt><dd>{player.marketValue}</dd></div><div><dt>{ru ? 'Контракт до' : 'Shartnoma muddati'}</dt><dd>{player.contractUntil}</dd></div><div><dt>{ru ? 'Рабочая нога' : 'Yetakchi oyoq'}</dt><dd>{footLabel}</dd></div><div><dt>{ru ? 'Рост' : 'Bo‘yi'}</dt><dd>{formatValue(player.height, 0, ru ? ' см' : ' sm')}</dd></div><div><dt>{ru ? 'Номер' : 'Raqami'}</dt><dd>{player.number ?? '—'}</dd></div><div><dt>{ru ? 'Точная позиция' : 'Aniq pozitsiya'}</dt><dd>{player.detailedPosition ? detailedLabel : '—'}</dd></div>
      </dl><p className="muted source-note">{player.clubSource === 'last_match' ? (ru ? 'Клуб указан по последнему подтверждённому матчу.' : 'Klub oxirgi tasdiqlangan o‘yin bo‘yicha.') : player.clubSource === 'profile' ? (ru ? 'Клуб указан по сохранённому профилю.' : 'Klub saqlangan profil bo‘yicha.') : (ru ? 'Клуб не подтверждён.' : 'Klub tasdiqlanmagan.')} {player.clubObservedAt ? new Date(player.clubObservedAt * 1000).toLocaleDateString(ru ? 'ru-RU' : 'uz-UZ') : (ru ? 'Дата обновления неизвестна.' : 'Yangilanish sanasi noma’lum.')}</p></details></div>
    </> : <section className="analysis-card all-statistics"><h3>{ru ? 'Показатели по загруженным матчам' : 'Yuklangan o‘yinlar ko‘rsatkichlari'}</h3><p className="muted">{ru ? '— означает отсутствие данных. Реальный ноль показывается как 0.' : '— ma’lumot yo‘qligini bildiradi. Haqiqiy nol 0 sifatida ko‘rsatiladi.'}</p><dl>{statRows(player, lang).map(r => <div key={r.label}><dt>{r.label}{r.hint && <small>{r.hint}</small>}</dt><dd>{r.value}{r.key&&<CoverageLabel player={player} metric={r.key} lang={lang}/>}</dd></div>)}</dl></section>}
    <DataContext player={player} lang={lang} />
    <details className="analysis-card explanation"><summary>{ru ? 'Похожие футболисты' : 'O‘xshash futbolchilar'}</summary><label className="similarity-filter"><input type="checkbox" checked={cheaperOnly} onChange={e=>setCheaperOnly(e.target.checked)}/>{ru?'Только дешевле с известной стоимостью':'Faqat qiymati ma’lum arzonroq futbolchilar'}</label><p>{ru ? 'Сравниваются доступные ролевые показатели. Стоимость берётся из источника и может отличаться от цены трансфера.' : 'Mavjud rol ko‘rsatkichlari taqqoslanadi. Manbadagi qiymat transfer narxidan farq qilishi mumkin.'}</p><p>{ru?'Схожесть — 100 минус среднее расстояние между процентилями по одному набору метрик. Это не вероятность успешного трансфера.':'O‘xshashlik — 100 dan bir xil ko‘rsatkichlar percentillari orasidagi o‘rtacha farq ayriladi. Bu muvaffaqiyatli transfer ehtimoli emas.'}</p>{replacements.length ? <div className="replacement-list">{replacements.map(r => <button key={r.player.id} onClick={() => onCompareReplacement(r.player)}><PlayerAvatar player={r.player} lang={lang} /><span><strong>{r.player.name[lang]}</strong><small>{r.player.club[lang]}</small></span><div className="similarity-score"><b>{r.similarity} / 100</b><small>{ru?'Схожесть профилей':'Profil o‘xshashligi'} · {r.comparedMetrics} {ru?'метрик':'ko‘rsatkich'}</small><small>{r.player.marketValue}</small></div><ChevronRight size={16} /></button>)}</div> : <p className="empty-inline">{ru ? 'Нет кандидатов с тем же набором метрик, лигой и периодом для выбранных условий.' : 'Bir xil ko‘rsatkichlar, liga va davrdagi mos nomzod yo‘q.'}</p>}</details>
  </AnalysisDialog>;
}

export function PlayerPicker({ player, players, lang, onChoose, onClose }: {player: Player; players: Player[]; lang: Language; onChoose: (p: Player) => void; onClose: () => void}) {
  const [query, setQuery] = useState('');
  const options = players.filter(p => p.id !== player.id && p.position === player.position && p.league===player.league && JSON.stringify(p.statsSeasonIds)===JSON.stringify(player.statsSeasonIds) && `${p.name[lang]} ${p.club[lang]}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <AnalysisDialog title={text(lang, 'С кем сравнить?', 'Kim bilan taqqoslash?')} lang={lang} onClose={onClose} narrow><div className="picker-body"><h2>{player.name[lang]}</h2><p className="muted">{text(lang, 'Выберите игрока той же линии.', 'Shu ampluadagi futbolchini tanlang.')}</p><label className="search-field"><Search size={18} /><input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder={text(lang, 'Имя игрока или клуб', 'Futbolchi yoki klub nomi')} aria-label={text(lang, 'Поиск для сравнения', 'Taqqoslash uchun qidiruv')} /></label><div className="replacement-list">{options.map(p => <button key={p.id} onClick={() => onChoose(p)}><PlayerAvatar player={p} lang={lang} /><span><strong>{p.name[lang]}</strong><small>{p.club[lang]}</small></span><ChevronRight size={18} /></button>)}</div>{!options.length && <p className="empty-inline">{text(lang, 'Игроки не найдены.', 'Futbolchi topilmadi.')}</p>}</div></AnalysisDialog>;
}

export function PlayerComparison({ primary, other, players, lang, onChange, onClose }: {primary: Player; other: Player; players: Player[]; lang: Language; onChange: (p: Player) => void; onClose: () => void}) {
  const [view, setView] = useState<'profile' | 'stats'>('profile');
  const a = statRows(primary, lang), b = statRows(other, lang);
  return <AnalysisDialog title={text(lang, 'Сравнение игроков', 'Futbolchilar taqqoslovi')} onClose={onClose} lang={lang}>
    <div className="comparison-identities">{[primary, other].map((p,i) => <div key={p.id}><PlayerAvatar player={p} lang={lang} /><div><span className="eyebrow">{i === 0 ? text(lang, 'ПЕРВЫЙ ИГРОК', 'BIRINCHI FUTBOLCHI') : text(lang, 'ВТОРОЙ ИГРОК', 'IKKINCHI FUTBOLCHI')}</span><h2>{p.name[lang]}</h2><p className="muted">{p.club[lang]}</p><p className="participation-stack"><span>{formatValue(p.matchesPlayed)} {text(lang,'игр','o‘yin')}</span><small>{formatValue(p.minutesPlayed)} {text(lang,'мин','daq')}</small></p></div></div>)}</div>
    <label className="comparison-select">{text(lang, 'Заменить второго игрока', 'Ikkinchi futbolchini almashtirish')}<select value={other.id} onChange={e => {const p=players.find(p => p.id === e.target.value && p.league===primary.league && JSON.stringify(p.statsSeasonIds)===JSON.stringify(primary.statsSeasonIds)); if(p) onChange(p);}}>{players.filter(p => p.id !== primary.id && p.position === primary.position && p.league===primary.league && JSON.stringify(p.statsSeasonIds)===JSON.stringify(primary.statsSeasonIds)).map(p => <option key={p.id} value={p.id}>{p.name[lang]}</option>)}</select></label>
    <div className="dossier-notice">{text(lang, 'Сравнивайте также минуты и полноту данных. Больший показатель сам по себе не означает, что игрок лучше подходит команде.', 'Daqiqalar va ma’lumot to‘liqligini ham solishtiring. Yuqoriroq ko‘rsatkich futbolchi jamoaga yaxshiroq mos degani emas.')}</div>
    <div className="dossier-tabs" role="group"><button aria-pressed={view === 'profile'} onClick={() => setView('profile')}>{text(lang, 'Игровой профиль', 'O‘yin profili')}</button><button aria-pressed={view === 'stats'} onClick={() => setView('stats')}>{text(lang, 'Все показатели', 'Barcha ko‘rsatkichlar')}</button></div>
    {view === 'profile' ? <MetricProfile player={primary} comparison={other} lang={lang} /> : <div className="analysis-card table-scroll"><table className="comparison-table"><thead><tr><th>{text(lang, 'Показатель', 'Ko‘rsatkich')}</th><th>{primary.name[lang]}</th><th>{other.name[lang]}</th></tr></thead><tbody>{a.map((row,i) => <tr key={row.label}><th>{row.label}</th><td>{row.value}{row.key&&<CoverageLabel player={primary} metric={row.key} lang={lang}/>}</td><td>{b[i]?.value ?? '—'}{row.key&&<CoverageLabel player={other} metric={row.key} lang={lang}/>}</td></tr>)}</tbody></table></div>}
  </AnalysisDialog>;
}
