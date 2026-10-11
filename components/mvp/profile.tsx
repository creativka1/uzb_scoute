import Link from 'next/link';
import type { Player } from '@/types/players';
import { getSimilarPlayers } from '@/lib/recruitment';
import { formatMoney, formatNumber, metricLabel } from '@/lib/mvp';
import { DataNote, PlayerIdentity } from './common';
import { SaveButton } from './shell';
import { MvpRadar } from './radar';
import { ArrowLeftRight } from 'lucide-react';
import { displayMetricValue, positionRank, PROFILE_METRICS, scoutSignals } from './profile-data';

export function PlayerProfile({ player, players, embedded = false, onCompare }: { player: Player; players: Player[]; embedded?: boolean; onCompare?: () => void }) {
  const similar = getSimilarPlayers(player, players).slice(0, 3);
  const rank = positionRank(player, players);
  const signals = scoutSignals(player);
  return <article className={`player-profile ${embedded ? 'embedded-profile' : ''}`}>
    {!embedded && <Link className="back-link" href="/players">← Все игроки</Link>}
    <section className="profile-summary"><div className="profile-header"><PlayerIdentity player={player} large headingLevel={embedded ? 2 : 1} /><div className="actions">
      <SaveButton id={player.id} compact />
      {onCompare ? <button className="button" onClick={onCompare}><ArrowLeftRight size={14} />Сравнить</button> : <Link className="button" href={`/compare?a=${player.id}`}><ArrowLeftRight size={14} />Сравнить</Link>}
    </div></div><div className="profile-context"><dl className="facts"><div><dt>Возраст</dt><dd>{formatNumber(player.age)}</dd></div>
      <div><dt>Минуты</dt><dd>{formatNumber(player.minutesPlayed)}</dd></div>
      <div><dt>Стоимость по профилю</dt><dd>{formatMoney(player.rawMarketValueEUR)}</dd></div>
    </dl><div className="profile-index" title={player.scoutIndexBasis}><div className="profile-index-value"><span>Scout Index</span><strong>{formatNumber(player.scoutIndex)}<small> / 100</small></strong></div>
      <span>Покрытие: {formatNumber(player.scoutingEngine.metricCoverage)}/{formatNumber(player.scoutingEngine.totalRoleMetrics)} ролевых метрик · {player.statsCoverageComplete ? 'полный сезон' : 'частичный сезон'}</span>
      <span>{rank ? `Место ${rank.rank} из ${rank.total} среди игроков той же позиции в выборке` : 'Место по позиции: —'}</span>
    </div></div></section><DataNote />
    <section className="panel key-metrics"><div className="section-heading"><h2>Ключевые показатели</h2><span>Сезон 2025</span></div><div className="metric-grid">
      {PROFILE_METRICS.map(metric => { const detail = 'source' in metric ? player.statsMetricDetails?.[metric.source] : undefined; return <div key={metric.key} className="metric" data-metric={metric.key}>
        <span>{metric.label}</span><strong>{formatNumber(displayMetricValue(player, metric.key), metric.decimals)}</strong>
        {'rate' in metric && <span className="metric-rate">{formatNumber(displayMetricValue(player, metric.rate), 2)} / 90</span>}
        {detail && <small>{detail.matches} из {detail.totalMatches} матчей{detail.status === 'partial' ? ' · частично' : ''}</small>}
      </div>; })}
    </div><p className="fine-print">Значение 0 — реальный ноль. «—» — нет данных. Показатели / 90 используют минуты матчей, в которых метрика известна.</p></section>
    <div className="profile-columns"><MvpRadar player={player} players={players} /><section className="panel scout-panel"><h2>Скаутский профиль</h2>
      {([['strong', 'Сильные стороны'], ['average', 'Средние'], ['weak', 'Слабые']] as const).map(([key, title]) => <div className={`scout-group ${key}`} key={key}><h3>{title}</h3>
        {signals[key].length ? <ul>{signals[key].map(signal => <li key={signal.key}><span>{metricLabel(signal.key)}</span><b title={`Ролевая оценка: ${signal.score} из 100`}>{formatNumber(signal.score)}</b></li>)}</ul> : <p className="muted">—</p>}
      </div>)}
      <p className="fine-print">Рассчитанные ролевые оценки лиги, 0–100. Сильные ≥75, средние 40–74, слабые &lt;40. Покрытие сезона частичное.</p>
    </section></div>
    <section className="panel similar-panel"><h2>Похожие игроки</h2><p className="muted">Similarity Index: схожесть доступных ролевых показателей.</p>
      {similar.length ? <div className="similar-list">{similar.map(candidate => <Link href={`/compare?a=${player.id}&b=${candidate.player.id}`} key={candidate.player.id}>
        <span>{candidate.player.name.ru}<small>{candidate.player.club.ru}</small></span><strong>{formatNumber(candidate.similarity)} / 100</strong>
      </Link>)}</div> : <p className="muted">Недостаточно общих метрик для поиска похожих игроков.</p>}
    </section>
    {embedded && <Link className="profile-deep-link" href={`/players/${player.id}`}>Открыть отдельную страницу игрока →</Link>}
  </article>;
}
