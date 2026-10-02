'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { ArrowRightLeft, Bookmark, Check, ChevronRight, Printer, Search, X } from 'lucide-react';
import type { Language, Player, Position, RoleRadarMetrics } from '@/types/players';
import { getBudgetReplacements } from '@/lib/recruitment';

const text = (lang: Language, ru: string, uz: string) => lang === 'ru' ? ru : uz;
export const formatValue = (value: number | null | undefined, decimals = 0, suffix = '') =>
  value === null || value === undefined || !Number.isFinite(value) ? '—' : `${value.toFixed(decimals)}${suffix}`;

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

export function MetricProfile({ player, comparison, lang }: {player: Player; comparison?: Player; lang: Language}) {
  const keys = roleKeys[player.position];
  const slots: (keyof RoleRadarMetrics)[] = ['m1', 'm2', 'm3', 'm4', 'm5'];
  const rows = keys.map((key, index) => ({key, label: metricLabels[key][lang === 'ru' ? 0 : 1], percentile: player.radar[slots[index]], other: comparison?.radar[slots[index]] ?? null }));
  return <section className="analysis-card metric-profile">
    <div className="section-heading"><div><span className="eyebrow">{text(lang, 'ИГРОВОЙ ПРОФИЛЬ', 'O‘YIN PROFILI')}</span><h3>{text(lang, 'Как выглядит на фоне лиги', 'Liga fonida qanday ko‘rinadi')}</h3></div></div>
    <p className="muted">{positionLabel(player.position, lang)} · {player.statsSeasonLabel}</p>
    {(player.scoutingEngine.isLowSample || comparison?.scoutingEngine.isLowSample) && <p className="sample-note">{text(lang, 'Мало игрового времени: сравнение предварительное.', 'O‘yin vaqti kam: taqqoslash dastlabki.')}</p>}
    {comparison && <div className="comparison-key"><span><i />{player.name[lang]}</span><span><i />{comparison.name[lang]}</span></div>}
    {!rows.length && <p className="empty-inline">{text(lang, 'Для сравнения нужна подтверждённая позиция.', 'Taqqoslash uchun tasdiqlangan pozitsiya kerak.')}</p>}
    <div className="profile-rows">{rows.map(row => {
      const percent = row.key.endsWith('Pct');
      const raw = player.roleMetrics?.[row.key] ?? null;
      const otherRaw = comparison?.roleMetrics?.[row.key] ?? null;
      return <div className="profile-row" key={row.key}>
        <div className="metric-top"><div><strong>{row.label}</strong><span>{percent ? text(lang, 'доля успешных действий', 'muvaffaqiyatli harakatlar ulushi') : text(lang, 'за 90 минут', '90 daqiqa hisobida')}</span></div>
          <div className="metric-values"><b>{formatValue(raw, percent ? 1 : 2, percent ? '%' : '')}</b>{comparison && <b className="comparison-value">{formatValue(otherRaw, percent ? 1 : 2, percent ? '%' : '')}</b>}</div>
        </div>
        {row.percentile !== null ? <div className="profile-track" role="img" aria-label={`${player.name[lang]}: ${band(row.percentile, lang)}`}><span style={{width: `${row.percentile}%`}} /><i /></div> : <div className="profile-no-data">{raw === null ? text(lang, 'Нет значения у источника', 'Manbada qiymat yo‘q') : band(null, lang)}</div>}
        {comparison && (row.other !== null ? <div className="profile-track comparison" role="img" aria-label={`${comparison.name[lang]}: ${band(row.other, lang)}`}><span style={{width: `${row.other}%`}} /><i /></div> : <p className="profile-no-data">{comparison.name[lang]}: {band(null, lang)}</p>)}
        {!comparison && row.percentile !== null && <p className="metric-caption">{band(row.percentile, lang)}</p>}
      </div>;
    })}</div>
    {rows.length > 0 && <details className="explanation"><summary>{text(lang, 'Что означает полоска?', 'Chiziq nimani anglatadi?')}</summary>
      <p>{text(lang, 'Число — реальное значение показателя. Полоска — его место среди игроков той же линии в этой лиге и сезоне. Отметка посередине — 50-й процентиль. Более длинная полоска означает более высокое значение, но сама по себе не делает игрока лучше.', 'Raqam — ko‘rsatkichning haqiqiy qiymati. Chiziq — shu liga, mavsum va ampluadagi futbolchilar orasidagi o‘rni. O‘rtadagi belgi — 50-percentil. Uzunroq chiziq yuqoriroq ko‘rsatkichni anglatadi, ammo futbolchi yaxshiroq degani emas.')}</p>
      <p>{text(lang, 'В группу сравнения входят игроки с 450+ минутами. За 90 минут — пересчёт с учётом сыгранного времени. Размер группы зависит от наличия конкретной метрики.', 'Taqqoslash guruhiga 450+ daqiqa o‘ynagan futbolchilar kiradi. 90 daqiqa hisobida — o‘ynalgan vaqtga mos hisob. Guruh hajmi ko‘rsatkich mavjudligiga bog‘liq.')}</p>
      <div className="table-scroll"><table className="method-table"><thead><tr><th>{text(lang, 'Показатель', 'Ko‘rsatkich')}</th><th>{text(lang, 'Процентиль', 'Percentil')}</th>{comparison && <th>{comparison.name[lang]}</th>}<th>{text(lang, 'Игроков в группе', 'Guruhdagi futbolchilar')}</th></tr></thead><tbody>{rows.map(r => <tr key={r.key}><td>{r.label}</td><td>{formatValue(r.percentile)}</td>{comparison && <td>{formatValue(r.other)}</td>}<td>{player.scoutingEngine.benchmarkByMetric[r.key] ?? 0}</td></tr>)}</tbody></table></div>
      <p>{text(lang, 'Например, 93-й процентиль — примерно выше 93% группы; одинаковые значения делят место. Это не 93% успешных действий.', 'Masalan, 93-percentil — guruhning taxminan 93%idan yuqori; teng qiymatlar o‘rinni bo‘lishadi. Bu harakatlarning 93%i muvaffaqiyatli degani emas.')}</p>
    </details>}
  </section>;
}

function statRows(player: Player, lang: Language): { label: string; value: string; hint?: string }[] {
  const ru = lang === 'ru';
  const rows = [
    {label: ru ? 'Матчи' : 'O‘yinlar', value: formatValue(player.matchesPlayed)},
    {label: ru ? 'Минуты' : 'Daqiqalar', value: formatValue(player.minutesPlayed)},
    {label: ru ? 'Голы' : 'Gollar', value: formatValue(player.goals)},
    {label: ru ? 'Голевые передачи' : 'Golli uzatmalar', value: formatValue(player.assists)},
    {label: ru ? 'Удары' : 'Zarbalar', value: formatValue(player.shots)},
    {label: ru ? 'Передачи под удар' : 'Zarbaga olib kelgan paslar', value: formatValue(player.keyPasses)},
    {label: ru ? 'Ожидаемые голы · xG' : 'Kutilayotgan gollar · xG', value: formatValue(player.xG, 2), hint: ru ? 'Сумма вероятностей гола для ударов игрока по модели источника.' : 'Manba modeli bo‘yicha futbolchi zarba bergan vaziyatlar sifati.'},
    {label: ru ? 'Ожидаемые ассисты · xA' : 'Kutilayotgan assistlar · xA', value: formatValue(player.xA, 2), hint: ru ? 'Оценка голевого потенциала передач по модели источника.' : 'Manba modeli bo‘yicha paslarning golga olib kelish salohiyati.'},
    {label: ru ? 'Точные передачи' : 'Aniq paslar', value: formatValue(player.passAccPct, 1, '%')},
    {label: ru ? 'Успешный дриблинг' : 'Muvaffaqiyatli dribling', value: formatValue(player.dribbleSuccessRate, 1, '%')},
    {label: ru ? 'Успешные обводки' : 'Muvaffaqiyatli aldab o‘tishlar', value: formatValue(player.dribbleWon)},
    {label: ru ? 'Попытки обводок' : 'Aldab o‘tishga urinishlar', value: formatValue(player.dribbleTotal)},
    {label: ru ? 'Выигранные единоборства' : 'Yutilgan kurashlar', value: formatValue(player.duelWinRate, 1, '%')},
    {label: ru ? 'Выигранные верховые дуэли' : 'Havoda yutilgan kurashlar', value: formatValue(player.aerialWinRate, 1, '%')},
    {label: ru ? 'Отборы' : 'To‘p qaytarish', value: formatValue(player.tackles)},
    {label: ru ? 'Перехваты' : 'To‘pni to‘xtatish', value: formatValue(player.interceptions)},
  ];
  if (player.position === 'GK') rows.splice(2, 0, {label: ru ? 'Сейвы' : 'Seyvlar', value: formatValue(player.saves)});
  return rows;
}

function DataContext({ player, lang }: {player: Player; lang: Language}) {
  return <details className="analysis-card explanation data-context"><summary>{text(lang, 'Источник и надёжность данных', 'Manba va ma’lumot ishonchliligi')}</summary>
    <p>{text(lang, 'SofaScore · только загруженные подтверждённые матчи. Прочерк означает отсутствие данных, а не нулевой результат.', 'SofaScore · faqat yuklangan, tasdiqlangan o‘yinlar. Tire — nol natija emas, ma’lumot yo‘qligi.')}</p>
    <dl className="facts"><div><dt>{text(lang, 'Период наблюдений', 'Kuzatuv davri')}</dt><dd>{new Date(player.statsDateFrom * 1000).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'uz-UZ')} — {new Date(player.statsDateTo * 1000).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'uz-UZ')}</dd></div>
      <div><dt>{text(lang, 'Покрытие сезона', 'Mavsum qamrovi')}</dt><dd>{player.statsCoverageComplete ? text(lang, 'Матчи загружены', 'O‘yinlar yuklangan') : text(lang, 'Неполное', 'To‘liq emas')}</dd></div>
      <div><dt>{text(lang, 'Рейтинг профиля', 'Profil reytingi')}</dt><dd>{formatValue(player.scoutingEngine.roleScore)} / 100</dd></div>
      <div><dt>{text(lang, 'Метрик для рейтинга', 'Reyting uchun ko‘rsatkichlar')}</dt><dd>{player.scoutingEngine.metricCoverage} {text(lang, 'из', 'ta /')} {player.scoutingEngine.totalRoleMetrics}</dd></div>
    </dl>
    <p>{text(lang, 'Рейтинг — среднее доступных ролевых процентилей с поправкой на минуты. Это вспомогательный расчёт, а не общая оценка качества игрока. При неполном покрытии выводы предварительные.', 'Reyting — mavjud rol percentillarining daqiqalarga moslashtirilgan o‘rtachasi. Bu yordamchi hisob, futbolchining umumiy sifat bahosi emas. Qamrov to‘liq bo‘lmasa, xulosalar dastlabki hisoblanadi.')}</p>
    <p>{text(lang, 'Точная позиция показывается только при однозначном подтверждении в профиле источника. Клуб может относиться к последнему известному матчу.', 'Aniq pozitsiya faqat manba profilida bir ma’noli tasdiqlangan bo‘lsa ko‘rsatiladi. Klub oxirgi ma’lum o‘yinga tegishli bo‘lishi mumkin.')}</p>
  </details>;
}

export function PlayerDossier({ player, players, lang, saved, canSave, onSave, onCompare, onCompareReplacement, onPrint, onClose, detailedLabel, footLabel }: {
  player: Player; players: Player[]; lang: Language; saved: boolean; canSave: boolean; onSave: () => void; onCompare: () => void; onCompareReplacement: (p: Player) => void; onPrint: () => void; onClose: () => void; detailedLabel: string; footLabel: string;
}) {
  const [view, setView] = useState<'overview' | 'stats'>('overview');
  const replacements = getBudgetReplacements(player, players);
  const ru = lang === 'ru';
  return <AnalysisDialog title={ru ? 'Профиль игрока' : 'Futbolchi profili'} onClose={onClose} lang={lang}>
    <div className="dossier-heading"><PlayerAvatar player={player} lang={lang} large /><div><span className="eyebrow">{player.statsSeasonLabel}</span><h2>{player.name[lang]}</h2><p>{player.club[lang]} <span>·</span> {player.detailedPosition ? detailedLabel : positionLabel(player.position, lang)} <span>·</span> {player.age ?? '—'} {ru ? 'лет' : 'yosh'}</p></div></div>
    <div className="dossier-actions"><button className="action-primary" onClick={onCompare}><ArrowRightLeft size={16} />{ru ? 'Сравнить игрока' : 'Futbolchini taqqoslash'}</button><button className="action-secondary" disabled={!canSave} onClick={onSave}>{saved ? <Check size={16} /> : <Bookmark size={16} />}{saved ? (ru ? 'В сохранённых' : 'Saqlangan') : (ru ? 'Сохранить' : 'Saqlash')}</button><button className="action-secondary print-action" onClick={onPrint}><Printer size={16} />{ru ? 'Отчёт PDF' : 'PDF hisobot'}</button></div>
    <div className="dossier-notice">{player.statsCoverageComplete ? (ru ? 'Показатели по загруженным матчам сезона.' : 'Yuklangan mavsum o‘yinlari ko‘rsatkichlari.') : (ru ? 'Часть матчей отсутствует. Цифры ниже не являются итогом всего сезона.' : 'Ayrim o‘yinlar yo‘q. Quyidagi raqamlar to‘liq mavsum yakuni emas.')}</div>
    <div className="dossier-tabs" role="group" aria-label={ru ? 'Раздел профиля' : 'Profil bo‘limi'}><button aria-pressed={view === 'overview'} onClick={() => setView('overview')}>{ru ? 'Обзор' : 'Umumiy'}</button><button aria-pressed={view === 'stats'} onClick={() => setView('stats')}>{ru ? 'Вся статистика' : 'Barcha statistika'}</button></div>
    {view === 'overview' ? <>
      <div className="dossier-summary"><div><span>{ru ? 'Игровое время' : 'O‘yin vaqti'}</span><strong>{player.minutesPlayed}<small>{ru ? ' мин' : ' daq'}</small></strong><p>{player.matchesPlayed} {ru ? 'матчей в выборке' : 'o‘yin tanlovda'}</p></div><div><span>{player.position === 'GK' ? (ru ? 'Сейвы' : 'Seyvlar') : (ru ? 'Голы' : 'Gollar')}</span><strong>{formatValue(player.position === 'GK' ? player.saves : player.goals)}</strong><p>{ru ? 'По доступным данным' : 'Mavjud ma’lumotlar bo‘yicha'}</p></div><div><span>{player.position === 'GK' ? (ru ? 'Точность передач' : 'Pas aniqligi') : (ru ? 'Голевые передачи' : 'Golli uzatmalar')}</span><strong>{formatValue(player.position === 'GK' ? player.passAccPct : player.assists, player.position === 'GK' ? 1 : 0, player.position === 'GK' ? '%' : '')}</strong><p>{ru ? 'По доступным данным' : 'Mavjud ma’lumotlar bo‘yicha'}</p></div></div>
      <div className="dossier-columns"><MetricProfile player={player} lang={lang} /><aside className="analysis-card profile-facts"><span className="eyebrow">{ru ? 'ОБ ИГРОКЕ' : 'FUTBOLCHI HAQIDA'}</span><h3>{ru ? 'Профиль и контракт' : 'Profil va shartnoma'}</h3><dl className="facts">
        <div><dt>{ru ? 'Стоимость источника' : 'Manbadagi qiymat'}</dt><dd>{player.marketValue}</dd></div><div><dt>{ru ? 'Контракт до' : 'Shartnoma muddati'}</dt><dd>{player.contractUntil}</dd></div><div><dt>{ru ? 'Рабочая нога' : 'Yetakchi oyoq'}</dt><dd>{footLabel}</dd></div><div><dt>{ru ? 'Рост' : 'Bo‘yi'}</dt><dd>{formatValue(player.height, 0, ru ? ' см' : ' sm')}</dd></div><div><dt>{ru ? 'Номер' : 'Raqami'}</dt><dd>{player.number ?? '—'}</dd></div><div><dt>{ru ? 'Точная позиция' : 'Aniq pozitsiya'}</dt><dd>{player.detailedPosition ? detailedLabel : '—'}</dd></div>
      </dl><p className="muted source-note">{player.clubSource === 'last_match' ? (ru ? 'Клуб указан по последнему подтверждённому матчу.' : 'Klub oxirgi tasdiqlangan o‘yin bo‘yicha.') : player.clubSource === 'profile' ? (ru ? 'Клуб указан по сохранённому профилю SofaScore.' : 'Klub saqlangan SofaScore profili bo‘yicha.') : (ru ? 'Клуб не подтверждён источником.' : 'Klub manbada tasdiqlanmagan.')} {player.clubObservedAt ? new Date(player.clubObservedAt * 1000).toLocaleDateString(ru ? 'ru-RU' : 'uz-UZ') : (ru ? 'Дата обновления неизвестна.' : 'Yangilanish sanasi noma’lum.')}</p></aside></div>
    </> : <section className="analysis-card all-statistics"><h3>{ru ? 'Показатели по загруженным матчам' : 'Yuklangan o‘yinlar ko‘rsatkichlari'}</h3><p className="muted">{ru ? '— означает отсутствие данных. Реальный ноль показывается как 0.' : '— ma’lumot yo‘qligini bildiradi. Haqiqiy nol 0 sifatida ko‘rsatiladi.'}</p><dl>{statRows(player, lang).map(r => <div key={r.label}><dt>{r.label}{r.hint && <small>{r.hint}</small>}</dt><dd>{r.value}</dd></div>)}</dl></section>}
    <DataContext player={player} lang={lang} />
    <details className="analysis-card explanation"><summary>{ru ? 'Похожие игроки с меньшей стоимостью' : 'Qiymati arzonroq o‘xshash futbolchilar'}</summary><p>{ru ? 'Сравниваются доступные ролевые показатели. Стоимость берётся из источника и может отличаться от цены трансфера.' : 'Mavjud rol ko‘rsatkichlari taqqoslanadi. Manbadagi qiymat transfer narxidan farq qilishi mumkin.'}</p>{replacements.length ? <div className="replacement-list">{replacements.map(r => <button key={r.player.id} onClick={() => onCompareReplacement(r.player)}><PlayerAvatar player={r.player} lang={lang} /><span><strong>{r.player.name[lang]}</strong><small>{r.player.club[lang]}</small></span><b>{r.player.marketValue}</b><ChevronRight size={16} /></button>)}</div> : <p className="empty-inline">{ru ? 'Нет подходящих игроков с известной меньшей стоимостью и достаточным числом общих метрик.' : 'Qiymati ma’lum, arzonroq va yetarli umumiy ko‘rsatkichlarga ega nomzod yo‘q.'}</p>}</details>
  </AnalysisDialog>;
}

export function PlayerPicker({ player, players, lang, onChoose, onClose }: {player: Player; players: Player[]; lang: Language; onChoose: (p: Player) => void; onClose: () => void}) {
  const [query, setQuery] = useState('');
  const options = players.filter(p => p.id !== player.id && p.position === player.position && `${p.name[lang]} ${p.club[lang]}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <AnalysisDialog title={text(lang, 'С кем сравнить?', 'Kim bilan taqqoslash?')} lang={lang} onClose={onClose} narrow><div className="picker-body"><h2>{player.name[lang]}</h2><p className="muted">{text(lang, 'Выберите игрока той же линии.', 'Shu ampluadagi futbolchini tanlang.')}</p><label className="search-field"><Search size={18} /><input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder={text(lang, 'Имя игрока или клуб', 'Futbolchi yoki klub nomi')} aria-label={text(lang, 'Поиск для сравнения', 'Taqqoslash uchun qidiruv')} /></label><div className="replacement-list">{options.map(p => <button key={p.id} onClick={() => onChoose(p)}><PlayerAvatar player={p} lang={lang} /><span><strong>{p.name[lang]}</strong><small>{p.club[lang]}</small></span><ChevronRight size={18} /></button>)}</div>{!options.length && <p className="empty-inline">{text(lang, 'Игроки не найдены.', 'Futbolchi topilmadi.')}</p>}</div></AnalysisDialog>;
}

export function PlayerComparison({ primary, other, players, lang, onChange, onClose }: {primary: Player; other: Player; players: Player[]; lang: Language; onChange: (p: Player) => void; onClose: () => void}) {
  const [view, setView] = useState<'profile' | 'stats'>('profile');
  const a = statRows(primary, lang), b = statRows(other, lang);
  return <AnalysisDialog title={text(lang, 'Сравнение игроков', 'Futbolchilar taqqoslovi')} onClose={onClose} lang={lang}>
    <div className="comparison-identities">{[primary, other].map((p,i) => <div key={p.id}><PlayerAvatar player={p} lang={lang} /><div><span className="eyebrow">{i === 0 ? text(lang, 'ПЕРВЫЙ ИГРОК', 'BIRINCHI FUTBOLCHI') : text(lang, 'ВТОРОЙ ИГРОК', 'IKKINCHI FUTBOLCHI')}</span><h2>{p.name[lang]}</h2><p className="muted">{p.club[lang]} · {p.minutesPlayed} {text(lang, 'мин', 'daq')}</p></div></div>)}</div>
    <label className="comparison-select">{text(lang, 'Заменить второго игрока', 'Ikkinchi futbolchini almashtirish')}<select value={other.id} onChange={e => {const p=players.find(p => p.id === e.target.value); if(p) onChange(p);}}>{players.filter(p => p.id !== primary.id && p.position === primary.position).map(p => <option key={p.id} value={p.id}>{p.name[lang]}</option>)}</select></label>
    <div className="dossier-notice">{text(lang, 'Сравнивайте также минуты и полноту данных. Больший показатель сам по себе не означает, что игрок лучше подходит команде.', 'Daqiqalar va ma’lumot to‘liqligini ham solishtiring. Yuqoriroq ko‘rsatkich futbolchi jamoaga yaxshiroq mos degani emas.')}</div>
    <div className="dossier-tabs" role="group"><button aria-pressed={view === 'profile'} onClick={() => setView('profile')}>{text(lang, 'Игровой профиль', 'O‘yin profili')}</button><button aria-pressed={view === 'stats'} onClick={() => setView('stats')}>{text(lang, 'Все показатели', 'Barcha ko‘rsatkichlar')}</button></div>
    {view === 'profile' ? <MetricProfile player={primary} comparison={other} lang={lang} /> : <div className="analysis-card table-scroll"><table className="comparison-table"><thead><tr><th>{text(lang, 'Показатель', 'Ko‘rsatkich')}</th><th>{primary.name[lang]}</th><th>{other.name[lang]}</th></tr></thead><tbody>{a.map((row,i) => <tr key={row.label}><th>{row.label}</th><td>{row.value}</td><td>{b[i]?.value ?? '—'}</td></tr>)}</tbody></table></div>}
  </AnalysisDialog>;
}
