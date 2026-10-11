import type { Player } from '@/types/players';
import { formatNumber } from '@/lib/mvp';
import { COMPARISON_METRICS, displayMetricValue } from './profile-data';

export function comparisonWinner(key: string, left: number | null, right: number | null): 1 | 2 | null {
  if (left === null || right === null || !Number.isFinite(left) || !Number.isFinite(right)) return null;
  // Small absolute or relative differences remain neutral; missing data never wins.
  const minimumDifference = key.endsWith('Pct') ? 2 : key.endsWith('Per90') ? .05 : 1;
  const threshold = Math.max(minimumDifference, .05 * Math.max(Math.abs(left), Math.abs(right)));
  if (Math.abs(left - right) <= threshold + 1e-9) return null;
  return left > right ? 1 : 2;
}

export function ComparisonMetricTable({ left, right }: { left: Player; right: Player }) {
  return <div className="comparison-metric-summary">
    <div className="table-scroll"><table className="comparison-metric-table">
      <caption className="sr-only">Ключевые показатели: {left.name.ru} против {right.name.ru}</caption>
      <thead><tr><th scope="col">Метрика</th><th scope="col">Игрок 1<small>{left.name.ru}</small></th><th scope="col">Игрок 2<small>{right.name.ru}</small></th></tr></thead>
      <tbody>{COMPARISON_METRICS.map(metric => {
        const values = [displayMetricValue(left, metric.key), displayMetricValue(right, metric.key)];
        const winner = comparisonWinner(metric.key, values[0], values[1]);
        return <tr key={metric.key} data-metric={metric.key}><th scope="row">{metric.label}</th>
          {values.map((value, index) => {
            const detail = (index === 0 ? left : right).statsMetricDetails?.[metric.source];
            const coverage = detail?.status === 'partial' ? `${detail.matches}/${detail.totalMatches} матчей` : undefined;
            const best = winner === index + 1;
            return <td key={index} data-player={index + 1} className={best ? 'metric-best' : undefined}
              title={coverage} aria-label={best ? `${formatNumber(value, metric.decimals)} — более высокое значение` : undefined}>
              {formatNumber(value, metric.decimals)}
            </td>;
          })}
        </tr>;
      })}</tbody>
    </table></div>
    <p className="fine-print">Зелёным — более высокое значение. Близкие значения — без выделения; «—» — нет данных.</p>
  </div>;
}
