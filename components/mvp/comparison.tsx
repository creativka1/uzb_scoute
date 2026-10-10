'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { Player } from '@/types/players';
import { formatMoney, formatNumber, metricValue, MVP_METRICS, positionName } from '@/lib/mvp';
import { DataNote, PageHeading, PlayerIdentity } from './common';
import { SaveButton } from './shell';
import { MvpRadar } from './radar';

export function PlayerComparison({ players, first, second }: { players: Player[]; first?: string; second?: string }) {
  const router = useRouter();
  const initialA = players.find(player => player.id === first) || players[0];
  const initialB = players.find(player => player.id === second && player.id !== initialA.id) || players.find(player => player.id !== initialA.id)!;
  const [a, setA] = useState(initialA.id), [b, setB] = useState(initialB.id);
  const left = players.find(player => player.id === a)!, right = players.find(player => player.id === b)!;
  const change = (side: 'a' | 'b', id: string) => {
    const nextA = side === 'a' ? id : a, nextB = side === 'b' ? id : b;
    setA(nextA); setB(nextB); router.replace(`/compare?a=${nextA}&b=${nextB}`, { scroll: false });
  };
  const metricCell = (player: Player, metric: typeof MVP_METRICS[number]) => {
    const detail = player.statsMetricDetails?.[metric.source];
    return <span>{formatNumber(metricValue(player, metric.key), metric.decimals)}
      {detail?.status === 'partial' && <small className="comparison-coverage">{detail.matches}/{detail.totalMatches} матчей</small>}
    </span>;
  };
  const rows: [string, ReactNode, ReactNode][] = [
    ['Возраст', formatNumber(left.age), formatNumber(right.age)],
    ['Команда', left.club.ru, right.club.ru], ['Позиция', positionName(left.position), positionName(right.position)],
    ['Матчи', formatNumber(left.matchesPlayed), formatNumber(right.matchesPlayed)],
    ['Минуты', formatNumber(left.minutesPlayed), formatNumber(right.minutesPlayed)],
    ['Стоимость', formatMoney(left.rawMarketValueEUR), formatMoney(right.rawMarketValueEUR)],
    ['Scout Index', formatNumber(left.scoutIndex), formatNumber(right.scoutIndex)],
    ...MVP_METRICS.map((metric): [string, ReactNode, ReactNode] => [metric.label, metricCell(left, metric), metricCell(right, metric)]),
  ];
  return <><PageHeading title="Сравнение игроков" description="Два игрока, один сезон, одинаковые показатели." />
    <div className="compare-pickers">{([['a', a, b], ['b', b, a]] as const).map(([side, value, excluded]) => <label key={side}>Игрок {side === 'a' ? '1' : '2'}
      <select value={value} onChange={event => change(side, event.target.value)}>{players.filter(player => player.id !== excluded).map(player => <option key={player.id} value={player.id}>{player.name.ru}</option>)}</select>
    </label>)}</div>
    <div className="compare-identities">{[left, right].map(player => <div key={player.id}><Link href={`/players/${player.id}`}><PlayerIdentity player={player} /></Link><SaveButton id={player.id} /></div>)}</div>
    <DataNote /><div className="table-scroll"><table className="comparison-table"><caption className="sr-only">{left.name.ru} против {right.name.ru}</caption>
      <thead><tr><th>Показатель</th><th>{left.name.ru}</th><th>{right.name.ru}</th></tr></thead>
      <tbody>{rows.map(([label, valueA, valueB]) => <tr key={label}><th scope="row">{label}</th><td>{valueA}</td><td>{valueB}</td></tr>)}</tbody>
    </table></div><MvpRadar player={left} comparison={right} />
  </>;
}
