'use client';

import { useState } from 'react';
import type { Player } from '@/types/players';
import { EMPTY_FILTERS, filterPlayers, groupTeams, positionName, recruitPlayers } from '@/lib/mvp';
import { DataNote, PageHeading, PlayerTable } from './common';

export function PlayerDirectory({ players, recruitment = false, team = '' }: { players: Player[]; recruitment?: boolean; team?: string }) {
  const initial = { ...EMPTY_FILTERS, position: recruitment ? 'MF' : '' };
  const [filters, setFilters] = useState(initial);
  const update = (key: keyof typeof filters, value: string) => setFilters(current => ({ ...current, [key]: value }));
  const results = recruitment ? recruitPlayers(players, filters, team) : filterPlayers(players, filters);
  const positions = [...new Set(players.map(player => player.position))];
  return <>
    <PageHeading title={recruitment ? 'Подбор игрока' : 'Игроки'} description={recruitment
      ? 'Задайте условия. Подходящие кандидаты будут отсортированы по Scout Index.'
      : '10 полузащитников с подтверждённой статистикой для первого знакомства и сравнения.'} />
    {team && <p className="notice">Усиление для {team}. Игроки этого клуба исключены из кандидатов.</p>}
    <div className="filters">
      {!recruitment && <label className="search-field">Поиск по имени<input type="search" value={filters.search} placeholder="Имя игрока" onChange={event => update('search', event.target.value)} /></label>}
      {(recruitment || positions.length > 1) && <label>Позиция<select value={filters.position} onChange={event => update('position', event.target.value)}>
        {!recruitment && <option value="">Все позиции</option>}{positions.map(position => <option value={position} key={position}>{positionName(position)}</option>)}
      </select></label>}
      {!recruitment && <label>Команда<select value={filters.team} onChange={event => update('team', event.target.value)}><option value="">Все команды</option>
        {groupTeams(players).map(club => <option value={club.name} key={club.id}>{club.name}</option>)}
      </select></label>}
      {players.some(player => player.age !== null) && <label>Максимальный возраст<input type="number" min="0" max="100" step="1" value={filters.maxAge} placeholder="Без ограничения" onChange={event => update('maxAge', event.target.value)} /></label>}
      {players.some(player => player.rawMarketValueEUR !== null) && <label>Максимальная стоимость, €<input type="number" min="0" step="1000" value={filters.maxCost} placeholder="Без ограничения" onChange={event => update('maxCost', event.target.value)} /></label>}
      {recruitment && <label>Минимум минут<input type="number" min="0" step="1" value={filters.minMinutes} placeholder="Без ограничения" onChange={event => update('minMinutes', event.target.value)} /></label>}
      <button className="button secondary" onClick={() => setFilters({ ...initial })}>Сбросить фильтры</button>
    </div>
    <div className="section-heading"><h2>{recruitment ? 'Кандидаты' : 'Список игроков'}</h2><span aria-live="polite">Найдено: {results.length} из {players.length}</span></div>
    <PlayerTable players={results} /><DataNote />
  </>;
}
