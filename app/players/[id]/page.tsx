import { notFound } from 'next/navigation';
import { loadMvpPlayers } from '@/lib/mvp-data';
import { PlayerPageProfile } from '@/components/mvp/player-page';

export default async function PlayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const players = await loadMvpPlayers();
  const player = players.find(item => item.id === id);
  if (!player) notFound();
  return <PlayerPageProfile player={player} players={players} />;
}
