export type Position = 'FW' | 'MF' | 'DF' | 'GK';
export type ShotResult = 'goal' | 'saved' | 'missed' | 'blocked';

export interface ShotEvent {
  id: string;
  x: number;
  y: number;
  xG: number;
  result: ShotResult;
  minute: number;
  opponent: string;
  bodyPart: 'left_foot' | 'right_foot' | 'head';
}

export interface RadarMetrics {
  finishing: number;
  creativity: number;
  dribbling: number;
  defending: number;
  physicality: number;
  passing: number;
}

export interface MatchForm {
  round: number;
  opponent: string;
  rating: number;
  xG: number;
  xA: number;
  minutes: number;
}

export interface Player {
  id: string;
  name: string;
  age: number;
  isU21: boolean;
  club: string;
  position: Position;
  number: number;
  marketValue: string;
  contractUntil: string;
  photoUrl: string;
  scoutIndex: number;
  tags: string[];
  minutesPlayed: number;
  matchesPlayed: number;
  goals: number;
  assists: number;
  xG: number;
  xA: number;
  shotsPer90: number;
  keyPassesPer90: number;
  dribbleSuccessRate: number;
  duelWinRate: number;
  progressiveRunsPer90: number;
  aerialWinRate: number;
  radar: RadarMetrics;
  shotMap: ShotEvent[];
  recentForm?: MatchForm[];
}
