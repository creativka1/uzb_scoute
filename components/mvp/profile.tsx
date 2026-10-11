import Link from 'next/link';
import type { Player } from '@/types/players';
import { getSimilarPlayers } from '@/lib/recruitment';
import { formatMoney, formatNumber, metricLabel, metricValue, MVP_METRICS, teamSlug } from '@/lib/mvp';
import { DataNote, PlayerIdentity } from './common';
import { SaveButton } from './shell';
import { MvpRadar } from './radar';
import { ArrowLeftRight } from 'lucide-react';

export function PlayerProfile({ player, players, embedded = false, onCompare }: { player: Player; players: Player[]; embedded?: boolean; onCompare?: () => void }) {
  const foot = { Right: 'Правая', Left: 'Левая', Both: 'Обе' }[player.preferredFoot];
  const similar = getSimilarPlayers(player, players).slice(0, 3);
  const metrics = MVP_METRICS;
  return <article className={`player-profile ${embedded ? 'embedded-profile' : ''}`}>
    {!embedded && <Link className="back-link" href="/players">← Все игроки</Link>}
    <section className="profile-header"><PlayerIdentity player={player} large headingLevel={embedded ? 2 : 1} /><div className="profile-header-side"><div className="actions">
      <SaveButton id={player.id} />
      {onCompare ? <button className="button" onClick={onCompare}><ArrowLeftRight size={14} />Сравнить</button> : <Link className="button" href={`/compare?a=${player.id}`}><ArrowLeftRight size={14} />Сравнить</Link>}
    </div><div className="profile-index"><strong>{formatNumber(player.scoutIndex)}</strong><span>Scout Index / 100</span></div></div></section>
    <dl className="facts"><div><dt>Возраст</dt><dd>{formatNumber(player.age)}</dd></div>
      <div><dt>Команда</dt><dd><Link href={`/teams/${teamSlug(player.club.ru)}`}>{player.club.ru}</Link></dd></div>
      <div><dt>Ведущая нога</dt><dd>{foot || '—'}</dd></div>
      <div><dt>Стоимость по профилю</dt><dd>{formatMoney(player.rawMarketValueEUR)}</dd></div>
      <div><dt>Контракт до</dt><dd>{player.contractUntil || '—'}</dd></div>
      <div><dt>Матчи в выборке</dt><dd>{formatNumber(player.matchesPlayed)}</dd></div>
      <div><dt>Минуты</dt><dd>{formatNumber(player.minutesPlayed)}</dd></div>
    </dl><DataNote />
    <section className="panel key-metrics"><div className="section-heading"><h2>Ключевые показатели</h2><span>Сезон 2025</span></div><div className="metric-grid">
      {metrics.map(metric => { const detail = player.statsMetricDetails?.[metric.source]; return <div key={metric.key} className="metric">
        <span>{metric.label}</span><strong>{formatNumber(metricValue(player, metric.key), metric.decimals)}</strong>
        {detail && <small>{detail.matches} из {detail.totalMatches} матчей{detail.status === 'partial' ? ' · частично' : ''}</small>}
      </div>; })}
    </div><p className="fine-print">Значение 0 — реальный ноль. «—» — нет данных. Показатели / 90 используют минуты матчей, в которых метрика известна.</p></section>
    <div className="profile-columns"><MvpRadar player={player} /><section className="panel scout-panel"><h2>Скаутский профиль</h2>
      <p className="scout-inline">Scout Index <strong>{formatNumber(player.scoutIndex)} / 100</strong></p>
      <p className="muted">Ролевой рейтинг по доступным показателям с учётом подтверждённых минут.</p>
      <h3>Сильные стороны</h3>{player.scoutingEngine.strengths.length ? <ul>{player.scoutingEngine.strengths.map(signal => <li key={signal.key}>{metricLabel(signal.key)}</li>)}</ul> : <p className="muted">Нет показателей в верхней четверти сравнимой выборки.</p>}
      <p className="fine-print">Это рассчитанный ориентир для скаутинга. Неполное покрытие сезона ограничивает выводы.</p>
      <details><summary>Что пока неизвестно</summary><p className="muted">Точная позиция: —. Продвижение мяча: —. {player.xG === null ? 'xG: —. ' : ''}{player.xA === null ? 'xA: —. ' : ''} Полный сезон не подтверждён.</p></details>
    </section></div>
    <section className="panel similar-panel"><h2>Похожие игроки</h2><p className="muted">Similarity Index: схожесть доступных ролевых показателей.</p>
      {similar.length ? <div className="similar-list">{similar.map(candidate => <Link href={`/compare?a=${player.id}&b=${candidate.player.id}`} key={candidate.player.id}>
        <span>{candidate.player.name.ru}<small>{candidate.player.club.ru}</small></span><strong>{formatNumber(candidate.similarity)} / 100</strong>
      </Link>)}</div> : <p className="muted">Недостаточно общих метрик для поиска похожих игроков.</p>}
    </section>
    {embedded && <Link className="profile-deep-link" href={`/players/${player.id}`}>Открыть отдельную страницу игрока →</Link>}
  </article>;
}
