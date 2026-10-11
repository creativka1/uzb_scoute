import Link from 'next/link';
import type { Player } from '@/types/players';
import { getSimilarPlayers } from '@/lib/recruitment';
import { formatMoney, formatNumber, metricLabel } from '@/lib/mvp';
import { DataNote, PlayerIdentity } from './common';
import { SaveButton } from './shell';
import { MvpRadar } from './radar';
import { ArrowLeftRight } from 'lucide-react';
import { ATTACKING_METRICS, displayMetricValue, positionRank, PROFILE_METRICS, scoutSignals } from './profile-data';
import { IndexExplanation } from './index-explanation';
import { SimilarityDetails } from './similarity-details';

export function PlayerProfile({ player, players, embedded = false, onCompare }: { player: Player; players: Player[]; embedded?: boolean; onCompare?: () => void }) {
  const similar = getSimilarPlayers(player, players).slice(0, 3);
  const rank = positionRank(player, players);
  const signals = scoutSignals(player);
  const attacking = ATTACKING_METRICS.filter(metric => displayMetricValue(player, metric.key) !== null);
  return <article className={`player-profile ${embedded ? 'embedded-profile' : ''}`}>
    {!embedded && <Link className="back-link" href="/players">← Все игроки</Link>}
    <section className="profile-summary"><div className="profile-header"><PlayerIdentity player={player} large headingLevel={embedded ? 2 : 1} /><dl className="facts"><div><dt>Возраст</dt><dd>{formatNumber(player.age)}</dd></div>
      <div><dt>Минуты</dt><dd>{formatNumber(player.minutesPlayed)}</dd></div>
      <div><dt>Стоимость по профилю</dt><dd>{formatMoney(player.rawMarketValueEUR)}</dd></div>
    </dl><div className="profile-index"><div className="profile-index-value"><span>Scout Index</span><strong>{formatNumber(player.scoutIndex)}<small> / 100</small></strong></div>
      <span>{rank ? `Место ${rank.rank} из ${rank.total} по позиции в выборке` : 'Место по позиции: —'}</span>
    </div></div><div className="profile-toolbar"><div className="actions"><SaveButton id={player.id} compact />
      {onCompare ? <button className="button" onClick={onCompare}><ArrowLeftRight size={14} />Сравнить</button> : <Link className="button" href={`/compare?a=${player.id}`}><ArrowLeftRight size={14} />Сравнить</Link>}
    </div><IndexExplanation player={player} /></div></section><DataNote />
    <section className="panel key-metrics"><div className="section-heading"><h2>Ключевые показатели</h2><span>Сезон 2025</span></div><div className="metric-grid">
      {PROFILE_METRICS.map(metric => { const detail = 'source' in metric ? player.statsMetricDetails?.[metric.source] : undefined; return <div key={metric.key} className="metric" data-metric={metric.key}>
        <span>{metric.label}</span><strong>{formatNumber(displayMetricValue(player, metric.key), metric.decimals)}</strong>
        {'rate' in metric && <span className="metric-rate">{formatNumber(displayMetricValue(player, metric.rate), 2)} / 90</span>}
        {detail && <small>{detail.matches} из {detail.totalMatches} матчей{detail.status === 'partial' ? ' · частично' : ''}</small>}
      </div>; })}
    </div><p className="fine-print">Значение 0 — реальный ноль. «—» — нет данных. Показатели / 90 используют минуты матчей, в которых метрика известна.</p></section>
    <div className="profile-columns"><MvpRadar player={player} players={players} roleProfile /><section className="panel scout-panel"><h2>Скаутский профиль</h2>
      {([['strong', 'Сильные стороны'], ['average', 'Средние'], ['weak', 'Слабые']] as const).map(([key, title]) => <div className={`scout-group ${key}`} key={key}><h3>{title}</h3>
        {signals[key].length ? <ul>{signals[key].map(signal => <li key={signal.key}><span>{metricLabel(signal.key)}</span><b title={`Ролевая оценка: ${signal.score} из 100`}>{formatNumber(signal.score)}</b></li>)}</ul> : <p className="muted">—</p>}
      </div>)}
      <p className="fine-print">Рассчитанные ролевые оценки лиги, 0–100. Сильные ≥75, средние 40–74, слабые &lt;40. Покрытие сезона частичное.</p>
    </section></div>
    {attacking.length > 0 && <section className="panel attacking-profile"><div className="section-heading"><h2>Атакующий профиль</h2><span>Сохранённые матчи 2025</span></div>
      <dl className="attacking-metrics">{attacking.map(metric => <div key={metric.key} data-attacking-metric={metric.key}><dt>{metric.label}</dt><dd>{formatNumber(displayMetricValue(player, metric.key), metric.decimals)}</dd></div>)}</dl>
    </section>}
    <section className="panel similar-panel"><h2>Похожие игроки</h2><p className="muted">Similarity Index: взвешенная схожесть профилей, покрытие ≥60%.</p>
      {similar.length ? <div className="similar-list">{similar.map(candidate => <div key={candidate.player.id} data-similarity-player={candidate.player.id}>
        <Link href={`/compare?a=${player.id}&b=${candidate.player.id}`}><span>{candidate.player.name.ru}<small>{candidate.player.club.ru}</small></span><strong>{formatNumber(candidate.similarity)}{candidate.similarity !== null && ' / 100'}</strong></Link>
        <SimilarityDetails result={candidate} />
      </div>)}</div> : <p className="muted">— Недостаточно данных для поиска похожих игроков той же позиции/роли и сезона.</p>}
    </section>
    {embedded && <Link className="profile-deep-link" href={`/players/${player.id}`}>Открыть отдельную страницу игрока →</Link>}
  </article>;
}
