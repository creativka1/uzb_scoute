import Link from 'next/link';
import { ArrowLeftRight } from 'lucide-react';
import type { Player } from '@/types/players';
import { formatNumber } from '@/lib/mvp';
import { PlayerIdentity } from './common';

export function ComparisonPair({ left, right }: { left: Player; right: Player }) {
  return <div className="compare-identities"><Link className="compare-player-card" href={`/players/${left.id}`}><PlayerIdentity player={left} /><span className="index-chip neutral" title="Scout Index">{formatNumber(left.scoutIndex)}</span></Link>
    <span className="compare-between" aria-hidden="true"><ArrowLeftRight size={16} /></span>
    <Link className="compare-player-card" href={`/players/${right.id}`}><PlayerIdentity player={right} /><span className="index-chip neutral" title="Scout Index">{formatNumber(right.scoutIndex)}</span></Link>
  </div>;
}
