import { Info } from 'lucide-react';
import type { Player } from '@/types/players';
import { formatNumber } from '@/lib/mvp';
import { roleMetricScores } from './profile-data';
import { IndexExplanation } from './index-explanation';

export function IndexBars({ player }: { player: Player }) {
  const metrics = roleMetricScores(player);
  return <section className="panel index-bars-panel" id="scout-index" aria-labelledby="index-bars-title">
    <div className="section-heading"><h2 id="index-bars-title">Из чего состоит Scout Index</h2><Info size={16} aria-hidden="true" /></div>
    <p className="muted">Ролевые оценки среди игроков той же позиции в лиге. Шкала adjusted score: 0–100.</p>
    <div className="index-bars">{metrics.map(metric => {
      const score = metric.adjustedScore;
      const level = score === null ? 'missing' : score >= 75 ? 'strong' : score >= 40 ? 'average' : 'weak';
      return <div className={`index-bar-row ${level}`} key={metric.key} data-index-metric={metric.key}>
        <div className="index-bar-label"><span>{metric.label}</span><small>Перцентиль {formatNumber(metric.percentile)}</small></div>
        <div className="index-bar-values"><div className="index-bar-track" role={score === null ? undefined : 'progressbar'}
          aria-label={`${metric.label}: adjusted score`} aria-valuemin={score === null ? undefined : 0}
          aria-valuemax={score === null ? undefined : 100} aria-valuenow={score ?? undefined}>
          {score !== null && <span className="index-bar-fill" style={{ width: `${score}%` }} />}
        </div><strong>{formatNumber(score)}</strong></div>
      </div>;
    })}</div>
    {metrics.length === 0 && <p className="muted">Ролевые метрики: —</p>}
    <p className="fine-print">Относительная оценка, а не «процент качества игрока». Пропуски обозначены «—».</p>
    <IndexExplanation player={player} />
  </section>;
}
