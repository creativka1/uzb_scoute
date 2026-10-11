import type { SimilarityResult } from '@/lib/recruitment';
import { SIMILARITY_CATEGORIES } from '@/lib/recruitment';
import { formatNumber } from '@/lib/mvp';

export function SimilarityDetails({ result }: { result: SimilarityResult }) {
  const counts = result.metrics.map(metric => metric.benchmarkPlayers);
  const minimum = counts.length ? Math.min(...counts) : null;
  const maximum = counts.length ? Math.max(...counts) : null;
  return <div className="similarity-details" data-similarity-status={result.status}>
    {result.similarity === null && <p className="muted">Недостаточно данных</p>}
    <details><summary>Покрытие {formatNumber(result.coverage * 100)}% · {result.comparedMetrics} метрик</summary>
      <dl>{Object.entries(SIMILARITY_CATEGORIES).map(([key, label]) => {
        const score = result.subscores[key as keyof typeof result.subscores];
        return <div key={key} data-similarity-category={key}><dt>{label}</dt><dd>{formatNumber(score.similarity)}</dd>
          <small>Покрытие {formatNumber(score.coverage * 100)}%</small></div>;
      })}</dl>
      <p className="fine-print">Модель {result.profileKey ?? '—'}: взвешенное расстояние между процентилями в загруженной выборке одной лиги, сезона и позиции/роли. Игроков в базе метрик: {formatNumber(minimum)}{minimum !== maximum && `–${formatNumber(maximum)}`}. Надёжность учитывает меньшую выборку покрытых минут двух игроков. Для каждой оценки нужно ≥60% веса ожидаемых метрик.</p>
    </details>
  </div>;
}
