import { loadMvpPlayers } from '@/lib/mvp-data';
import { groupTeams } from '@/lib/mvp';
import { PlayerDirectory } from '@/components/mvp/directory';

export default async function RecruitmentPage({ searchParams }: { searchParams: Promise<{ team?: string }> }) {
  const players = await loadMvpPlayers();
  const { team } = await searchParams;
  const club = groupTeams(players).find(item => item.id === team);
  return <PlayerDirectory players={players} recruitment team={club?.name} />;
}
