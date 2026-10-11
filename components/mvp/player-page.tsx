import Link from 'next/link';
import { ArrowLeft, ArrowLeftRight, ArrowUpRight, CalendarDays, Clock3, Crosshair, Footprints, Info, KeyRound, Route, Target, Trophy } from 'lucide-react';
import type { Player } from '@/types/players';
import { formatMoney, formatNumber, positionName } from '@/lib/mvp';
import { getSimilarPlayers } from '@/lib/recruitment';
import { PlayerIdentity } from './common';
import { PlayerPhoto } from './photo';
import { SaveButton } from './shell';
import { MvpRadar } from './radar';
import { IndexBars } from './index-bars';
import { SimilarityDetails } from './similarity-details';
import { ATTACKING_METRICS, displayMetricValue, positionRank, PROFILE_METRICS } from './profile-data';

const metricIcons = { matchesPlayed: Trophy, minutesPlayed: Clock3, goals: Target, assists: Footprints,
  xG: Crosshair, xA: Route, keyPassesPer90: KeyRound, dribbleSuccessPct: Footprints };

export function PlayerPageProfile({ player, players }: { player: Player; players: Player[] }) {
  const rank = positionRank(player, players);
  const similar = getSimilarPlayers(player, players).slice(0, 3);
  const attacking = ATTACKING_METRICS.filter(metric => displayMetricValue(player, metric.key) !== null);
  return <article className="player-detail">
    <section className="detail-header" aria-label="Профиль игрока">
      <div className="detail-identity identity large"><PlayerPhoto player={player} /><div><h1>{player.name.ru}</h1>
        <span>{player.club.ru}</span><span className="detail-position">{positionName(player.position)}</span>
      </div></div>
      <div className="detail-header-center"><dl className="detail-facts">
        <div><dt>Возраст</dt><dd>{formatNumber(player.age)}</dd></div>
        <div><dt>Минуты</dt><dd>{formatNumber(player.minutesPlayed)}</dd></div>
        <div><dt>Стоимость по профилю</dt><dd>{formatMoney(player.rawMarketValueEUR)}</dd></div>
      </dl><div className="actions"><SaveButton id={player.id} compact />
        <Link className="button" href={`/compare?a=${player.id}`}><ArrowLeftRight size={15} aria-hidden="true" />Сравнить</Link>
      </div></div>
      <aside className="detail-index"><div className="detail-index-label">Scout Index<Info size={14} aria-hidden="true" /></div>
        <strong className="detail-index-score">{formatNumber(player.scoutIndex)}<small> / 100</small></strong>
        <p>{rank ? `Место ${rank.rank} из ${rank.total} по позиции в выборке` : 'Место по позиции: —'}</p>
        <a href="#scout-index">Как рассчитан индекс?<ArrowUpRight size={13} aria-hidden="true" /></a>
      </aside>
    </section>
    <div className="detail-overview"><nav aria-label="Разделы профиля"><Link className="detail-back" href="/players" aria-label="Все игроки" title="Все игроки"><ArrowLeft size={15} aria-hidden="true" /></Link><a className="active" href="#overview">Обзор</a><a href="#player-shape">Профиль игрока</a><a href="#scout-index">Scout Index</a><a href="#similar-players">Похожие игроки</a></nav>
      <span><CalendarDays size={15} aria-hidden="true" />Сезон 2025</span>
    </div>
    <section className="panel detail-key-metrics" id="overview"><div className="section-heading"><h2>Ключевые показатели</h2>
      <span>Узбекистан · 2025 · {player.statsCoverageComplete ? 'Полный сезон' : 'Неполный сезон'}</span>
    </div><div className="metric-grid">{PROFILE_METRICS.map(metric => {
      const Icon = metricIcons[metric.key];
      const detail = 'source' in metric ? player.statsMetricDetails?.[metric.source] : undefined;
      return <div key={metric.key} className="metric" data-metric={metric.key}><Icon size={17} aria-hidden="true" /><div>
        <span>{metric.label}</span><strong>{formatNumber(displayMetricValue(player, metric.key), metric.decimals)}</strong>
        {'rate' in metric && <span className="metric-rate">{formatNumber(displayMetricValue(player, metric.rate), 2)} / 90</span>}
        {detail && <small>{detail.matches} из {detail.totalMatches} матчей{detail.status === 'partial' ? ' · частично' : ''}</small>}
      </div></div>;
    })}</div><p className="fine-print">Показатели /90 используют минуты матчей, в которых метрика известна. «—» — нет данных. Клуб и стоимость — последние сведения источника.</p></section>
    <div className={`detail-analysis ${attacking.length ? '' : 'without-attacking'}`}>
      <div id="player-shape"><MvpRadar player={player} players={players} title="Профиль игрока" /></div>
      <IndexBars player={player} />
      {attacking.length > 0 && <section className="panel detail-attacking"><div className="section-heading"><h2>Атакующий профиль</h2><Target size={16} aria-hidden="true" /></div>
        <p className="muted">Сохранённые матчи 2025</p>
        <dl>{attacking.map(metric => <div key={metric.key} data-attacking-metric={metric.key}><dt>{metric.label}</dt><dd>{formatNumber(displayMetricValue(player, metric.key), metric.decimals)}</dd></div>)}</dl>
        <p className="fine-print">Только доступные показатели. Totals и /90 взяты из существующих данных.</p>
      </section>}
    </div>
    <section className="panel detail-similar" id="similar-players"><div className="section-heading"><h2>Похожие игроки</h2><span>Взвешенная схожесть профилей · покрытие ≥60%</span></div>
      {similar.length ? <div className="detail-similar-list">{similar.map(candidate => <div className="detail-similar-card" key={candidate.player.id} data-similarity-player={candidate.player.id}>
        <Link href={`/compare?a=${player.id}&b=${candidate.player.id}`}><PlayerIdentity player={candidate.player} /><div><span>Similarity Index</span><strong>{formatNumber(candidate.similarity)}{candidate.similarity !== null && ' / 100'}<ArrowUpRight size={14} aria-hidden="true" /></strong></div></Link>
        <SimilarityDetails result={candidate} />
      </div>)}</div> : <p className="muted">— Недостаточно данных для поиска похожих игроков той же позиции/роли и сезона.</p>}
    </section>
  </article>;
}
