import type { Player } from '@/types/players';
import { formatNumber } from '@/lib/mvp';
import { roleMetricScores } from './profile-data';

export function IndexExplanation({ player }: { player: Player }) {
  return <details className="index-explanation"><summary>Как рассчитан индекс?</summary>
    <div className="index-explanation-content"><p className="muted">Scout Index — относительная оценка среди игроков той же позиции в той же лиге. Это не «процент качества игрока».</p>
      <p className="muted">При достаточном числе метрик индекс — округлённое среднее доступных adjusted score. При малом числе покрытых минут перцентиль корректируется к 50: adjusted score = 50 + (перцентиль − 50) × min(1, минуты / {formatNumber(player.scoutingEngine.benchmarkMinMinutes)}), с округлением до целого.</p>
      <div className="table-scroll"><table className="index-breakdown"><caption className="sr-only">Метрики расчёта Scout Index</caption>
        <thead><tr><th>Метрика</th><th>Перцентиль</th><th>Adjusted score</th></tr></thead>
        <tbody>{roleMetricScores(player).map(metric => <tr key={metric.key} data-role-metric={metric.key}><th scope="row">{metric.label}</th><td>{formatNumber(metric.percentile)}</td><td>{formatNumber(metric.adjustedScore)}</td></tr>)}</tbody>
        <tfoot><tr><th scope="row" colSpan={2}>Итоговый Scout Index</th><td>{formatNumber(player.scoutIndex)} / 100</td></tr></tfoot>
      </table></div>
      <p className="fine-print">Покрытие: {formatNumber(player.scoutingEngine.metricCoverage)}/{formatNumber(player.scoutingEngine.totalRoleMetrics)} ролевых метрик · {player.statsCoverageComplete ? 'полный сезон' : 'частичный сезон'}. База: {formatNumber(player.scoutingEngine.benchmarkPlayers)} игроков той же позиции в лиге. Недоступные значения — «—».</p>
    </div>
  </details>;
}
