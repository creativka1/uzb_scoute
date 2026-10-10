import { cache } from 'react';
import { NextRequest } from 'next/server';
import { GET } from '../app/api/players/route';
import { selectMvpPlayers } from './mvp';
import type { Player } from '../types/players';

// Reuse the source parser, metric coverage and whole-league benchmarks.
// This is an in-process call; rendering never contacts a data provider.
export const loadMvpPlayers = cache(async (): Promise<Player[]> => {
  const response = await GET(new NextRequest('http://localhost/api/players?league=UZB&season=previous'));
  if (!response.ok) throw new Error('Сохранённые данные игроков недоступны');
  return selectMvpPlayers(await response.json());
});
