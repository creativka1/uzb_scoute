import Link from 'next/link';
import { loadMvpPlayers } from '@/lib/mvp-data';
import { groupTeams } from '@/lib/mvp';
import { DataNote, PageHeading } from '@/components/mvp/common';

export default async function TeamsPage() {
  const teams = groupTeams(await loadMvpPlayers());
  return <><PageHeading title="Команды" description="Клубы, представленные в выборке MVP. Здесь показана только часть состава." />
    <div className="team-cards">{teams.map(team => <Link href={`/teams/${team.id}`} className="team-card" key={team.id}>
      <h2>{team.name}</h2><p>Игроков в MVP: {team.players.length}</p><span>Открыть команду →</span>
    </Link>)}</div><DataNote />
  </>;
}
