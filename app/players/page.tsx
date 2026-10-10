import { loadMvpPlayers } from '@/lib/mvp-data';
import { PlayerDirectory } from '@/components/mvp/directory';

export default async function PlayersPage() {
  return <PlayerDirectory players={await loadMvpPlayers()} />;
}
