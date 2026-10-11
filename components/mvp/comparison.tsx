'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { Player } from '@/types/players';
import { formatMoney, formatNumber, positionName } from '@/lib/mvp';
import { DataNote, PageHeading } from './common';
import { SaveButton } from './shell';
import { MvpRadar } from './radar';
import { ComparisonBars, ComparisonPair } from './comparison-visual';

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
  const rows: [string, ReactNode, ReactNode][] = [
    ['Возраст', formatNumber(left.age), formatNumber(right.age)],
    ['Команда', left.club.ru, right.club.ru], ['Позиция', positionName(left.position), positionName(right.position)],
    ['Матчи', formatNumber(left.matchesPlayed), formatNumber(right.matchesPlayed)],
    ['Минуты', formatNumber(left.minutesPlayed), formatNumber(right.minutesPlayed)],
    ['Стоимость', formatMoney(left.rawMarketValueEUR), formatMoney(right.rawMarketValueEUR)],
    ['Scout Index', formatNumber(left.scoutIndex), formatNumber(right.scoutIndex)],
  ];
  return <><PageHeading title="Сравнение игроков" description="Два игрока, один сезон, одинаковые показатели." />
    <div className="compare-pickers">{([['a', a, b], ['b', b, a]] as const).map(([side, value, excluded]) => <label key={side}>Игрок {side === 'a' ? '1' : '2'}
      <select value={value} onChange={event => change(side, event.target.value)}>{players.filter(player => player.id !== excluded).map(player => <option key={player.id} value={player.id}>{player.name.ru}</option>)}</select>
    </label>)}</div>
    <section className="panel comparison-overview"><ComparisonPair left={left} right={right} />
      <div className="comparison-save-actions">{[left, right].map(player => <SaveButton key={player.id} id={player.id} />)}</div>
    </section><DataNote /><div className="comparison-layout"><section className="panel comparison-metrics"><h2>Ключевые показатели</h2><ComparisonBars left={left} right={right} /></section><MvpRadar player={left} comparison={right} /></div>
    <div className="section-heading"><h2>Данные игроков</h2></div><div className="table-scroll"><table className="comparison-table"><caption className="sr-only">{left.name.ru} против {right.name.ru}</caption>
      <thead><tr><th>Показатель</th><th>{left.name.ru}</th><th>{right.name.ru}</th></tr></thead>
      <tbody>{rows.map(([label, valueA, valueB]) => <tr key={label}><th scope="row">{label}</th><td>{valueA}</td><td>{valueB}</td></tr>)}</tbody>
    </table></div>
  </>;
}
