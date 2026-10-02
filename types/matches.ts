import type { League, Position } from './players';
export interface CoreTeam { id: number; name: string | null }
export interface CorePlayer { id: number; name: string | null }
export interface CoreMatch {
  id: number; league: League; competitionId: number; seasonId: number; seasonName: string;
  date: number; homeTeamId: number; awayTeamId: number; homeScore: number | null; awayScore: number | null;
  lineupAvailable: boolean; homeFormation: string | null; awayFormation: string | null;
  source: string; sourceEventId: number; eventHash: string; lineupHash: string | null; sourcePath: string | null;
}
export interface Appearance {
  id: string; matchId: number; playerId: number; teamId: number; minutes: number;
  position: Position | null; substitute: boolean | null; stats: Record<string, number | null>;
}
export interface CoreSeason { id: number; name: string; year: string; cachedMatches: number; complete: boolean; lastSyncedAt: string | null }
export interface MatchCore {
  schemaVersion: number; calculationVersion: string; source: string;
  seasons: Record<League, CoreSeason[]>; teams: CoreTeam[]; players: CorePlayer[];
  matches: CoreMatch[]; appearances: Appearance[]; unlinkedEventIds: number[]; unconfirmedEventIds: number[];
}
