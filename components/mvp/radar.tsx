import type { Player } from '@/types/players';
import { formatNumber, positionName } from '@/lib/mvp';
import { radarData, roleRadarData } from './profile-data';

export function MvpRadar({ player, players, comparison, roleProfile = false }: { player: Player; players: Player[]; comparison?: Player; roleProfile?: boolean }) {
  const { axes, peers } = roleProfile ? roleRadarData(player) : radarData(player, players, comparison);
  const point = (index: number, radius: number) => {
    const angle = -Math.PI / 2 + index * 2 * Math.PI / axes.length;
    return [180 + radius * Math.cos(angle), 148 + radius * Math.sin(angle)];
  };
  const polygon = (other: boolean) => axes.map((axis, index) => point(index, (other ? axis.other! : axis.score) * 1.02).join(',')).join(' ');
  return <section className="panel radar-panel"><h2>{roleProfile ? 'Радар Scout Index' : 'Радар показателей'}</h2>
    <p className="muted">{roleProfile ? 'Adjusted score ролевых метрик, 0–100. База: игроки той же позиции в лиге.' : `0–100: перцентили в текущей выборке. Позиция: ${positionName(player.position)} · ${peers} игроков · 2025.`}</p>
    {axes.length >= 3 ? <svg className="radar" viewBox="0 0 360 300" role="img" aria-label={`Радар ${player.name.ru}${comparison ? ' и ' + comparison.name.ru : ''}: ${axes.length} доступных осей`}>
      {[.25, .5, .75, 1].map(scale => <polygon key={scale} points={axes.map((_, i) => point(i, 102 * scale).join(',')).join(' ')} fill="none" stroke="#dce4e1" />)}
      {axes.map((axis, index) => { const [x, y] = point(index, 134); return <g key={axis.key} data-axis={axis.key}>
        <title>{axis.metricLabel}: {player.name.ru} — {formatNumber(axis.value, axis.decimals)}{comparison ? `; ${comparison.name.ru} — ${formatNumber(axis.otherValue, axis.decimals)}` : ''}. База: {formatNumber(axis.count)} игроков.</title>
        <line x1="180" y1="148" x2={point(index, 102)[0]} y2={point(index, 102)[1]} stroke="#e5ebf1" />
        <text x={x} y={y - 4} textAnchor="middle"><tspan x={x}>{axis.label}</tspan><tspan x={x} dy="12" className="radar-score">{formatNumber(axis.score)}{comparison ? ` / ${formatNumber(axis.other)}` : ''}</tspan></text>
      </g>; })}
      <polygon points={polygon(false)} fill="#18bd7a" fillOpacity=".16" stroke="#18bd7a" strokeWidth="2" />
      {comparison && <polygon points={polygon(true)} fill="#438cf5" fillOpacity=".10" stroke="#438cf5" strokeWidth="2" />}
      {axes.map((axis, index) => <g key={axis.key}><circle cx={point(index, axis.score * 1.02)[0]} cy={point(index, axis.score * 1.02)[1]} r="2.5" fill="#18bd7a" />
        {comparison && <circle cx={point(index, axis.other! * 1.02)[0]} cy={point(index, axis.other! * 1.02)[1]} r="2.5" fill="#438cf5" />}</g>)}
    </svg> : <div className="radar-insufficient"><p className="muted">{roleProfile ? 'Недостаточно ролевых данных для многоугольника. Доступные adjusted score показаны ниже.' : 'Недостаточно общих данных для многоугольника. Нужны три доступные оси; для каждой — данные минимум трёх игроков той же позиции и сезона.'}</p>
      {axes.length ? <ul>{axes.map(axis => <li key={axis.key}>{axis.label}: {formatNumber(axis.score)}{comparison ? ` / ${formatNumber(axis.other)}` : ''}</li>)}</ul> : <p className="muted">Доступные оси: —</p>}
    </div>}
    {axes.length > 0 && <><div className="chart-key"><span><i />{player.name.ru}</span>{comparison && <span><i className="comparison-color" />{comparison.name.ru}</span>}</div>
      {!roleProfile && <details className="radar-coverage"><summary>База и покрытие</summary><p className="fine-print">Сохранённые матчи 2025. База каждой оси: ≥450 покрытых минут и ≥80% минут выборки; игрок: ≥90 минут и ≥60%. Недоступные значения исключены.</p><ul>{axes.map(axis => <li key={axis.key}>{axis.label}: {axis.count} игроков в базе</li>)}</ul></details>}</>}
  </section>;
}
