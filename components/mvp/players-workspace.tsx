'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { ArrowLeftRight, Search, SlidersHorizontal } from 'lucide-react';
import type { Player } from '@/types/players';
import { EMPTY_FILTERS, filterPlayers, formatNumber, groupTeams, positionName } from '@/lib/mvp';
import { PlayerIdentity, PageHeading } from './common';
import { PlayerProfile } from './profile';
import { ComparisonBars, ComparisonPair } from './comparison-visual';

export function PlayersWorkspace({ players, query = '' }: { players: Player[]; query?: string }) {
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS, search: query });
  const [selected, setSelected] = useState(players[0].id);
  const [opponentId, setOpponentId] = useState<string | null>(players[1]?.id || null);
  const compareRef = useRef<HTMLElement>(null);
  const results = filterPlayers(players, filters);
  const primary = results.find(player => player.id === selected) || results[0];
  const opponent = players.find(player => player.id === opponentId && player.id !== primary?.id);
  const update = (key: keyof typeof filters, value: string) => setFilters(current => ({ ...current, [key]: value }));
  const choose = (player: Player) => {
    if (player.id === opponentId) setOpponentId(primary?.id !== player.id ? primary?.id || null : players.find(item => item.id !== player.id)?.id || null);
    setSelected(player.id);
  };
  return <>
    <div className="players-page-heading"><PageHeading title="Игроки" description="Выберите игрока, изучите профиль и сравните показатели." /><span className="scope-chip">Узбекистан · 2025</span></div>
    <div className="players-workspace">
      <section className="roster-panel" aria-label="Список игроков">
        <div className="roster-heading"><div><h2>Игроки</h2><span>{players.length} игроков в выборке</span></div><SlidersHorizontal size={17} aria-hidden="true" /></div>
        <div className="position-tabs"><span aria-current="true">Все</span><span>{positionName(players[0].position)}</span></div>
        <label className="roster-search"><span className="sr-only">Поиск по имени</span><Search size={16} aria-hidden="true" /><input type="search" value={filters.search} placeholder="Найти игрока…" onChange={event => update('search', event.target.value)} /></label>
        <details className="roster-filters"><summary><SlidersHorizontal size={14} />Фильтры</summary><div className="filters">
          <label>Команда<select value={filters.team} onChange={event => update('team', event.target.value)}><option value="">Все команды</option>{groupTeams(players).map(club => <option key={club.id} value={club.name}>{club.name}</option>)}</select></label>
          <label>Максимальный возраст<input type="number" min="0" value={filters.maxAge} placeholder="Без ограничения" onChange={event => update('maxAge', event.target.value)} /></label>
          <label>Максимальная стоимость, €<input type="number" min="0" value={filters.maxCost} placeholder="Без ограничения" onChange={event => update('maxCost', event.target.value)} /></label>
        </div></details>
        <div className="roster-results"><span aria-live="polite">Найдено: {results.length} из {players.length}</span><button onClick={() => setFilters({ ...EMPTY_FILTERS })} aria-label="Сбросить фильтры">Сбросить</button></div>
        <div className="roster-list">{results.map(player => <button className="roster-item" key={player.id} aria-pressed={primary?.id === player.id} onClick={() => choose(player)}>
          <PlayerIdentity player={player} /><span className="index-chip">{formatNumber(player.scoutIndex)}</span>
        </button>)}</div>
        {!results.length && <p className="roster-empty">Игроки не найдены. Измените условия или сбросьте фильтры.</p>}
      </section>
      <section className="players-profile" aria-label="Профиль выбранного игрока">{primary
        ? <PlayerProfile player={primary} players={players} embedded onCompare={() => compareRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })} />
        : <div className="empty"><h2>Нет подходящих игроков</h2><p>Сбросьте фильтры, чтобы увидеть профили.</p></div>}
      </section>
      <aside className="comparison-panel" ref={compareRef} aria-label="Сравнение игроков"><div className="section-heading"><h2>Сравнение</h2><button className="text-button" onClick={() => setOpponentId(null)}>Очистить</button></div>
        {primary ? <>
          {opponent ? <ComparisonPair left={primary} right={opponent} /> : <div className="compare-placeholder"><ArrowLeftRight size={24} /><p>Выберите второго игрока для сравнения.</p></div>}
          <label className="opponent-select">Сравнить с<select value={opponent?.id || ''} onChange={event => setOpponentId(event.target.value || null)}><option value="">Выберите игрока</option>{players.filter(player => player.id !== primary.id).map(player => <option key={player.id} value={player.id}>{player.name.ru}</option>)}</select></label>
          {opponent && <><ComparisonBars left={primary} right={opponent} /><Link className="button secondary compare-full-link" href={`/compare?a=${primary.id}&b=${opponent.id}`}>Открыть сравнение<ArrowLeftRight size={14} /></Link></>}
        </> : <p className="muted">Выберите игрока из списка.</p>}
      </aside>
    </div>
  </>;
}
