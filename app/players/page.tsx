import { loadMvpPlayers } from '@/lib/mvp-data';
import { PlayersWorkspace } from '@/components/mvp/players-workspace';

export default async function PlayersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  return <PlayersWorkspace key={q || ''} players={await loadMvpPlayers()} query={typeof q === 'string' ? q : ''} />;
}
