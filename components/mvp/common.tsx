import Link from 'next/link';
import type { Player } from '@/types/players';
import { formatMoney, formatNumber, positionName, teamSlug } from '@/lib/mvp';
import { PlayerPhoto } from './photo';

export function PageHeading({ title, description }: { title: string; description?: string }) {
  return <div className="page-heading"><h1>{title}</h1>{description && <p>{description}</p>}</div>;
}
export function DataNote() {
  return <p className="data-note">Узбекистан · 2025 · Неполный сезон. Показатели рассчитаны по сохранённым матчам; клуб и стоимость — последние доступные сведения источника.</p>;
}
export function PlayerIdentity({ player, large = false, headingLevel = 1 }: { player: Player; large?: boolean; headingLevel?: 1 | 2 }) {
  return <div className={`identity ${large ? 'large' : ''}`}>
    <PlayerPhoto key={player.id} player={player} />
    <div>{large ? headingLevel === 1 ? <h1>{player.name.ru}</h1> : <h2>{player.name.ru}</h2> : <strong>{player.name.ru}</strong>}<span>{player.club.ru} · {positionName(player.position)}</span></div>
  </div>;
}
export function PlayerCards({ players }: { players: Player[] }) {
  return <div className="player-cards">{players.map(player => <Link href={`/players/${player.id}`} className="player-card" key={player.id}>
    <PlayerIdentity player={player} /><div className="card-line"><span>{formatNumber(player.minutesPlayed)} мин</span><span>Scout Index <b>{formatNumber(player.scoutIndex)}</b></span></div>
  </Link>)}</div>;
}
export function PlayerTable({ players, children }: { players: Player[]; children?: React.ReactNode }) {
  if (!players.length) return <div className="empty"><h2>Игроки не найдены</h2><p>Попробуйте изменить условия поиска.</p>{children}</div>;
  return <><div className="table-scroll directory-table"><table className="player-table"><caption className="sr-only">Игроки MVP</caption>
    <thead><tr><th>Игрок</th><th>Команда</th><th>Возраст</th><th>Позиция</th><th>Матчи</th><th>Минуты</th><th>Scout Index</th><th>Стоимость</th></tr></thead>
    <tbody>{players.map(player => <tr key={player.id}>
      <td><Link className="player-link" href={`/players/${player.id}`}>{player.name.ru}</Link></td>
      <td><Link href={`/teams/${teamSlug(player.club.ru)}`}>{player.club.ru}</Link></td>
      <td>{formatNumber(player.age)}</td><td>{positionName(player.position)}</td><td>{formatNumber(player.matchesPlayed)}</td>
      <td>{formatNumber(player.minutesPlayed)}</td><td><strong>{formatNumber(player.scoutIndex)}</strong></td><td>{formatMoney(player.rawMarketValueEUR)}</td>
    </tr>)}</tbody>
  </table></div><div className="mobile-player-list">{players.map(player => <Link className="player-card" href={`/players/${player.id}`} key={player.id}>
    <PlayerIdentity player={player} /><dl className="mobile-player-facts">
      <div><dt>Возраст</dt><dd>{formatNumber(player.age)}</dd></div><div><dt>Матчи</dt><dd>{formatNumber(player.matchesPlayed)}</dd></div>
      <div><dt>Минуты</dt><dd>{formatNumber(player.minutesPlayed)}</dd></div><div><dt>Scout Index</dt><dd>{formatNumber(player.scoutIndex)}</dd></div>
      <div><dt>Стоимость</dt><dd>{formatMoney(player.rawMarketValueEUR)}</dd></div>
    </dl>
  </Link>)}</div></>;
}
