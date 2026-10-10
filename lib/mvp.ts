import type { Player, Position } from '../types/players';
import type { TeamNeed } from '../types/decisions';
import { rankPlayersForNeed } from './recruitment';

// Fixed cohort: UZB midfielders with all five eligible role axes, then most
// verified minutes in 2025. These are identifiers, never copied statistics.
export const MVP_PLAYER_IDS = [
  'UZB-573710', 'UZB-871948', 'UZB-1877845', 'UZB-1016190', 'UZB-871965',
  'UZB-1032799', 'UZB-796349', 'UZB-959094', 'UZB-1165681', 'UZB-1484961',
] as const;
export const MVP_SEASON_ID = 72383;
export const MVP_STORAGE_KEY = 'uzstat.mvp.shortlist.v1';

export function selectMvpPlayers(players: Player[]): Player[] {
  const byId = new Map(players.map(player => [player.id, player]));
  return MVP_PLAYER_IDS.map(id => {
    const player = byId.get(id);
    if (!player || player.league !== 'UZB' || player.position !== 'MF' ||
        !player.statsSeasonIds?.includes(MVP_SEASON_ID)) {
      throw new Error(`MVP source player unavailable: ${id}`);
    }
    return player;
  });
}

export function formatNumber(value: number | null | undefined, decimals = 0, suffix = ''): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return value.toLocaleString('ru-RU', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
}
export function formatMoney(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? formatNumber(value) + ' €' : '—';
}
export function positionName(position: Position): string {
  return { MF: 'Полузащитник', FW: 'Нападающий', DF: 'Защитник', GK: 'Вратарь', UNKNOWN: '—' }[position];
}
export function teamSlug(name: string): string {
  return name.toLocaleLowerCase().normalize('NFKD').replace(/[^a-z0-9а-яё]+/gu, '-').replace(/^-|-$/g, '');
}
export function groupTeams(players: Player[]) {
  const teams = new Map<string, { id: string; name: string; players: Player[] }>();
  for (const player of players) {
    const name = player.club.ru;
    if (!name || name === '—' || name === 'Без клуба') continue;
    const id = teamSlug(name);
    if (!teams.has(id)) teams.set(id, { id, name, players: [] });
    teams.get(id)!.players.push(player);
  }
  return [...teams.values()].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

export type MvpFilters = { search: string; position: string; team: string; maxAge: string; maxCost: string; minMinutes: string };
export const EMPTY_FILTERS: MvpFilters = { search: '', position: '', team: '', maxAge: '', maxCost: '', minMinutes: '' };
function limit(value: string): number | null {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}
export function filterPlayers(players: Player[], filters: MvpFilters): Player[] {
  const maxAge = limit(filters.maxAge), maxCost = limit(filters.maxCost), minMinutes = limit(filters.minMinutes);
  return players.filter(player =>
    player.name.ru.toLocaleLowerCase().includes(filters.search.trim().toLocaleLowerCase()) &&
    (!filters.position || player.position === filters.position) &&
    (!filters.team || player.club.ru === filters.team) &&
    (maxAge === null || (player.age !== null && player.age <= maxAge)) &&
    (maxCost === null || (player.rawMarketValueEUR !== null && player.rawMarketValueEUR <= maxCost)) &&
    (minMinutes === null || player.minutesPlayed >= minMinutes));
}
export function recruitPlayers(players: Player[], filters: MvpFilters, teamName = ''): Player[] {
  const need: TeamNeed = {
    id: 'mvp', league: 'UZB', teamId: 0, teamName, seasonId: MVP_SEASON_ID, seasonName: '2025',
    position: (filters.position || 'MF') as Position, detailedPosition: null,
    observation: '', requirement: '', evidence: '', matchIds: [], createdAt: '', status: 'open', candidates: [],
  };
  const eligible = rankPlayersForNeed(need, filterPlayers(players, filters));
  // Keep the existing need eligibility, but show/order the existing Scout Index
  // rather than introducing a second opaque fit score into the MVP.
  return eligible.map(candidate => candidate.player)
    .sort((a, b) => (b.scoutIndex ?? -1) - (a.scoutIndex ?? -1) || b.minutesPlayed - a.minutesPlayed || a.id.localeCompare(b.id));
}

export const MVP_METRICS = [
  { key: 'goalsPer90', label: 'Голы / 90', decimals: 2, source: 'goals' },
  { key: 'assistsPer90', label: 'Голевые передачи / 90', decimals: 2, source: 'assists' },
  { key: 'xGPer90', label: 'xG / 90', decimals: 2, source: 'xG' },
  { key: 'xAPer90', label: 'xA / 90', decimals: 2, source: 'xA' },
  { key: 'keyPassesPer90', label: 'Передачи под удар / 90', decimals: 2, source: 'keyPasses' },
  { key: 'dribbleSuccessPct', label: 'Успешный дриблинг, %', decimals: 1, source: 'dribbleSuccessRate' },
  { key: 'passAccPct', label: 'Точность передач, %', decimals: 1, source: 'passAccPct' },
  { key: 'duelWinPct', label: 'Выигранные единоборства, %', decimals: 1, source: 'duelWinPct' },
] as const;
export function metricValue(player: Player, key: string): number | null {
  if (key === 'xGPer90' || key === 'xAPer90') {
    return player.statsMetricDetails?.[key === 'xGPer90' ? 'xG' : 'xA']?.per90 ?? null;
  }
  return player.roleMetrics?.[key] ?? null;
}
export const ROLE_AXES = [
  { key: 'm1', label: 'Пас под удар' }, { key: 'm2', label: 'Голевые пасы' },
  { key: 'm3', label: 'Дриблинг' }, { key: 'm4', label: 'Отборы' }, { key: 'm5', label: 'Точность паса' },
] as const;
export function metricLabel(key: string) {
  return MVP_METRICS.find(metric => metric.key === key)?.label ??
    ({ tacklesPer90: 'Отборы / 90', shotsPer90: 'Удары / 90' } as Record<string, string>)[key] ?? 'Ролевой показатель';
}
export function parseShortlist(raw: string | null): string[] {
  if (raw === null) return [];
  const ids: unknown = JSON.parse(raw);
  if (!Array.isArray(ids) || ids.some(id => typeof id !== 'string')) throw new Error('Invalid shortlist');
  return [...new Set(ids as string[])];
}
