import { loadMvpPlayers } from '@/lib/mvp-data';
import { PlayerComparison } from '@/components/mvp/comparison';

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ a?: string; b?: string }> }) {
  const { a, b } = await searchParams;
  return <PlayerComparison players={await loadMvpPlayers()} first={a} second={b} />;
}
