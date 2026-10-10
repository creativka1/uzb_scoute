import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadMvpPlayers } from '@/lib/mvp-data';
import { formatNumber, groupTeams, positionName } from '@/lib/mvp';
import { DataNote, PageHeading } from '@/components/mvp/common';

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const team = groupTeams(await loadMvpPlayers()).find(item => item.id === id);
  if (!team) notFound();
  return <><Link href="/teams" className="back-link">← Все команды</Link>
    <PageHeading title={team.name} description="Игроки клуба в выборке MVP. Это не полный состав команды." />
    <Link className="button" href={`/recruitment?team=${team.id}`}>Найти усиление</Link>
    <div className="table-scroll team-table"><table><thead><tr><th>Игрок</th><th>Позиция</th><th>Минуты</th></tr></thead>
      <tbody>{team.players.map(player => <tr key={player.id}><td><Link className="player-link" href={`/players/${player.id}`}>{player.name.ru}</Link></td><td>{positionName(player.position)}</td><td>{formatNumber(player.minutesPlayed)}</td></tr>)}</tbody>
    </table></div><DataNote />
  </>;
}
