import Link from 'next/link';
import { ArrowLeftRight } from 'lucide-react';
import type { Player } from '@/types/players';
import { formatNumber, metricValue, MVP_METRICS } from '@/lib/mvp';
import { PlayerIdentity } from './common';

export function ComparisonBars({ left, right }: { left: Player; right: Player }) {
  return <div className="bar-comparison" aria-label="Сравнение ключевых показателей">
    {MVP_METRICS.map(metric => {
      const a = metricValue(left, metric.key), b = metricValue(right, metric.key);
      const known = [a, b].filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0);
      const maximum = metric.key.endsWith('Pct') ? 100 : Math.max(...known, 0);
      const width = (value: number | null) => value !== null && Number.isFinite(value) && maximum > 0 ? `${Math.max(0, Math.min(100, value / maximum * 100))}%` : '0%';
      const coverage = (player: Player) => {
        const detail = player.statsMetricDetails?.[metric.source];
        return detail?.status === 'partial' ? `${detail.matches}/${detail.totalMatches} матчей` : undefined;
      };
      return <div className="bar-comparison-row" key={metric.key} data-metric={metric.key}>
        <span className="bar-value left" title={coverage(left)}>{formatNumber(a, metric.decimals)}</span>
        <span className="comparison-track left" aria-hidden="true">{a !== null && Number.isFinite(a) && <i style={{ width: width(a) }} />}</span>
        <span className="bar-label">{metric.label}</span>
        <span className="comparison-track right" aria-hidden="true">{b !== null && Number.isFinite(b) && <i style={{ width: width(b) }} />}</span>
        <span className="bar-value right" title={coverage(right)}>{formatNumber(b, metric.decimals)}</span>
      </div>;
    })}
    <p className="fine-print">Одна шкала для каждой пары показателей. «—» означает отсутствие данных. Частичное покрытие доступно в профиле.</p>
  </div>;
}

export function ComparisonPair({ left, right }: { left: Player; right: Player }) {
  return <div className="compare-identities"><Link className="compare-player-card" href={`/players/${left.id}`}><PlayerIdentity player={left} /><span className="index-chip">{formatNumber(left.scoutIndex)}</span></Link>
    <span className="compare-between" aria-hidden="true"><ArrowLeftRight size={16} /></span>
    <Link className="compare-player-card" href={`/players/${right.id}`}><PlayerIdentity player={right} /><span className="index-chip blue">{formatNumber(right.scoutIndex)}</span></Link>
  </div>;
}
