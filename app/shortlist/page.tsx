import { loadMvpPlayers } from '@/lib/mvp-data';
import { Shortlist } from '@/components/mvp/shortlist';

export default async function ShortlistPage() {
  return <Shortlist players={await loadMvpPlayers()} />;
}
