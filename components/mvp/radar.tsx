import type { Player } from '@/types/players';
import { ROLE_AXES } from '@/lib/mvp';

export function MvpRadar({ player, comparison }: { player: Player; comparison?: Player }) {
  // A polygon is only made from known shared axes. Missing values never become
  // zero or a fabricated midpoint, including in comparison mode.
  const axes = ROLE_AXES.filter(axis => {
    const value = player.scoutingEngine.adjustedRadar[axis.key];
    const other = comparison?.scoutingEngine.adjustedRadar[axis.key];
    return typeof value === 'number' && Number.isFinite(value) &&
      (!comparison || (typeof other === 'number' && Number.isFinite(other)));
  });
  if (axes.length < 3) return <section className="panel"><h2>Ролевой профиль</h2><p className="muted">Недостаточно общих данных для радара.</p></section>;
  const point = (index: number, radius: number) => {
    const angle = -Math.PI / 2 + index * 2 * Math.PI / axes.length;
    return [220 + radius * Math.cos(angle), 190 + radius * Math.sin(angle)];
  };
  const polygon = (subject: Player) => axes.map((axis, index) => point(index, Math.max(0, Math.min(100, subject.scoutingEngine.adjustedRadar[axis.key]!)) * 1.15).join(',')).join(' ');
  return <section className="panel radar-panel"><h2>Ролевой профиль</h2>
    <p className="muted">Шкала 0–100: положение среди полузащитников лиги, с поправкой на объём данных. Выше — сильнее относительно сравнимых игроков.</p>
    <svg className="radar" viewBox="0 0 440 375" role="img" aria-label={`Ролевой профиль ${player.name.ru}${comparison ? ' и ' + comparison.name.ru : ''}`}>
      {[.25, .5, .75, 1].map(scale => <polygon key={scale} points={axes.map((_, i) => point(i, 115 * scale).join(',')).join(' ')} fill="none" stroke="#dce4e1" />)}
      {axes.map((axis, index) => { const [x, y] = point(index, 156); return <g key={axis.key}>
        <line x1="220" y1="190" x2={point(index, 115)[0]} y2={point(index, 115)[1]} stroke="#dce4e1" />
        <text x={x} y={y} textAnchor="middle" dominantBaseline="middle">{axis.label}</text>
      </g>; })}
      <polygon points={polygon(player)} fill="#18bd7a" fillOpacity=".14" stroke="#18bd7a" strokeWidth="2" />
      {comparison && <polygon points={polygon(comparison)} fill="#438cf5" fillOpacity=".10" stroke="#438cf5" strokeWidth="2" />}
    </svg>
    <div className="chart-key"><span><i />{player.name.ru}</span>{comparison && <span><i className="comparison-color" />{comparison.name.ru}</span>}</div>
    <p className="fine-print">Источник: сохранённые матчи 2025. База сравнения — вся лига, а не только 10 игроков MVP. Пустые оси исключены.</p>
  </section>;
}
