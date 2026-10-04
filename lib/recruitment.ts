import type { Player, Position, DetailedPosition, RoleRadarMetrics } from '../types/players';
import type { TeamNeed } from '../types/decisions';

/** Relative statistical similarity, not a probability of a successful transfer. */
export function getSimilarPlayers(target: Player | null, players: Player[], cheaperOnly = false) {
  if (!target || target.position === 'UNKNOWN' || (cheaperOnly && target.rawMarketValueEUR === null)) return [];
  const keys: (keyof RoleRadarMetrics)[] = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'];
  const period = (p: Player) => JSON.stringify(p.statsSeasonIds ?? [p.statsSeasonLabel]);
  const axes = keys.filter(k => target.radar[k] !== null);
  if (axes.length < (target.position === 'GK' ? 2 : 3)) return [];
  return players.filter(p => p.id !== target.id && p.position === target.position && p.league === target.league && period(p) === period(target))
    .filter(p => !cheaperOnly || (p.rawMarketValueEUR !== null && p.rawMarketValueEUR < target.rawMarketValueEUR!))
    .flatMap(player => {
      if (axes.some(k => player.radar[k] === null)) return [];
      const distance = axes.reduce((sum, k) => sum + Math.abs(target.radar[k]! - player.radar[k]!), 0) / axes.length;
      const costDiff = target.rawMarketValueEUR !== null && player.rawMarketValueEUR !== null ? target.rawMarketValueEUR - player.rawMarketValueEUR : null;
      return [{player, similarity: Math.round(Math.max(0, 100 - distance)), comparedMetrics: axes.length,
        costDiff, isCheaper: costDiff !== null && costDiff > 0}];
    }).sort((a,b) => b.similarity - a.similarity || a.player.id.localeCompare(b.player.id)).slice(0, 6);
}
export function getBudgetReplacements(target: Player | null, players: Player[]) {
  return getSimilarPlayers(target, players, true).slice(0, 3);
}

export type NeedProfileKey = 'GK'|'CB'|'FB_WB'|'DM'|'CM'|'AM'|'WINGER'|'ST'|'DF'|'MF'|'FW';

type MetricWeight = Record<string, number>;
interface NeedProfile {
  key: NeedProfileKey;
  metrics: MetricWeight;
  components: {role:number;minutes:number;confidence:number;position:number};
}

const broadRoleKeys: Record<Position, string[]> = {
  UNKNOWN: [],
  GK: ['savesPer90', 'passAccPct'],
  DF: ['tacklesPer90', 'interceptionsPer90', 'passAccPct', 'dribbleSuccessPct', 'keyPassesPer90'],
  MF: ['keyPassesPer90', 'assistsPer90', 'dribbleSuccessPct', 'tacklesPer90', 'passAccPct'],
  FW: ['goalsPer90', 'assistsPer90', 'shotsPer90', 'keyPassesPer90', 'dribbleSuccessPct'],
};

const profiles: Record<NeedProfileKey, NeedProfile> = {
  GK: {
    key:'GK',
    metrics:{savesPer90:.70,passAccPct:.30},
    components:{role:.70,minutes:.12,confidence:.10,position:.08},
  },
  CB: {
    key:'CB',
    metrics:{interceptionsPer90:.30,tacklesPer90:.25,passAccPct:.30,keyPassesPer90:.10,dribbleSuccessPct:.05},
    components:{role:.65,minutes:.15,confidence:.12,position:.08},
  },
  FB_WB: {
    key:'FB_WB',
    metrics:{tacklesPer90:.23,interceptionsPer90:.15,passAccPct:.15,dribbleSuccessPct:.22,keyPassesPer90:.25},
    components:{role:.65,minutes:.12,confidence:.10,position:.13},
  },
  DM: {
    key:'DM',
    metrics:{tacklesPer90:.35,passAccPct:.30,keyPassesPer90:.15,assistsPer90:.10,dribbleSuccessPct:.10},
    components:{role:.65,minutes:.15,confidence:.10,position:.10},
  },
  CM: {
    key:'CM',
    metrics:{keyPassesPer90:.25,passAccPct:.25,tacklesPer90:.20,assistsPer90:.15,dribbleSuccessPct:.15},
    components:{role:.60,minutes:.15,confidence:.10,position:.15},
  },
  AM: {
    key:'AM',
    metrics:{keyPassesPer90:.35,assistsPer90:.25,dribbleSuccessPct:.20,passAccPct:.10,tacklesPer90:.10},
    components:{role:.65,minutes:.12,confidence:.10,position:.13},
  },
  WINGER: {
    key:'WINGER',
    // The profile spans MF and FW source positions. Missing metrics are not
    // treated as zero; available weights are renormalized transparently.
    metrics:{dribbleSuccessPct:.28,keyPassesPer90:.25,assistsPer90:.18,shotsPer90:.12,goalsPer90:.07,passAccPct:.06,tacklesPer90:.04},
    components:{role:.65,minutes:.12,confidence:.10,position:.13},
  },
  ST: {
    key:'ST',
    metrics:{goalsPer90:.35,shotsPer90:.25,dribbleSuccessPct:.20,assistsPer90:.10,keyPassesPer90:.10},
    components:{role:.68,minutes:.12,confidence:.10,position:.10},
  },
  DF: {
    key:'DF',
    metrics:{tacklesPer90:.25,interceptionsPer90:.25,passAccPct:.20,dribbleSuccessPct:.15,keyPassesPer90:.15},
    components:{role:.60,minutes:.17,confidence:.13,position:.10},
  },
  MF: {
    key:'MF',
    metrics:{keyPassesPer90:.25,assistsPer90:.20,dribbleSuccessPct:.20,tacklesPer90:.15,passAccPct:.20},
    components:{role:.60,minutes:.17,confidence:.13,position:.10},
  },
  FW: {
    key:'FW',
    metrics:{goalsPer90:.28,shotsPer90:.22,assistsPer90:.15,keyPassesPer90:.15,dribbleSuccessPct:.20},
    components:{role:.63,minutes:.15,confidence:.12,position:.10},
  },
};

function needProfile(position: Position, detailed: DetailedPosition | null): NeedProfile {
  if (position === 'GK') return profiles.GK;
  if (detailed === 'CB') return profiles.CB;
  if (detailed && ['RB','LB','RWB','LWB'].includes(detailed)) return profiles.FB_WB;
  if (detailed === 'DM') return profiles.DM;
  if (detailed === 'CM') return profiles.CM;
  if (detailed === 'AM') return profiles.AM;
  if (detailed && ['RM','LM','RW','LW'].includes(detailed)) return profiles.WINGER;
  if (detailed === 'ST') return profiles.ST;
  return position === 'DF' ? profiles.DF : position === 'MF' ? profiles.MF : position === 'FW' ? profiles.FW : profiles.GK;
}

function percentileByMetric(player: Player): Record<string, number> {
  const keys = broadRoleKeys[player.position] || [];
  const axes: (keyof RoleRadarMetrics)[] = ['m1','m2','m3','m4','m5','m6'];
  const result: Record<string, number> = {};
  keys.forEach((key,index)=>{
    const value = player.scoutingEngine?.adjustedRadar
      ? player.scoutingEngine.adjustedRadar[axes[index]]
      : player.radar?.[axes[index]];
    if (typeof value === 'number' && Number.isFinite(value)) result[key] = value;
  });
  return result;
}

function calibratedRoleScore(player: Player, profile: NeedProfile) {
  const percentiles = percentileByMetric(player);
  const totalWeight = Object.values(profile.metrics).reduce((sum,value)=>sum+value,0);
  const available = Object.entries(profile.metrics)
    .filter(([key]) => typeof percentiles[key] === 'number')
    .map(([key,weight]) => ({key,weight,percentile:percentiles[key]}));
  const availableWeight = available.reduce((sum,item)=>sum+item.weight,0);
  const coverage = totalWeight > 0 ? availableWeight / totalWeight : 0;

  // Require at least two role-relevant axes before replacing the broad role
  // score. Otherwise the broad score is a safer fallback and coverage is made
  // explicit in the reasons.
  if (available.length < 2 || availableWeight <= 0) {
    return {
      score: player.scoutingEngine?.roleScore ?? null,
      coverage,
      usedFallback: true,
      contributions: [] as {key:string;percentile:number;weight:number}[],
    };
  }

  const score = available.reduce((sum,item)=>sum+item.percentile*(item.weight/availableWeight),0);
  return {
    score: Math.round(score),
    coverage,
    usedFallback: false,
    contributions: available
      .map(item=>({key:item.key,percentile:item.percentile,weight:item.weight/availableWeight}))
      .sort((a,b)=>b.weight-a.weight),
  };
}

export const NEED_FIT_VERSION = 'role-v3' as const;

export interface NeedFitCandidate {
  player: Player;
  fitScore: number;
  fitVersion: typeof NEED_FIT_VERSION;
  profileKey: NeedProfileKey;
  profileScore: number;
  profileCoverage: number;
  positionConfirmed: boolean;
  usesBroadFallback: boolean;
  reasons: string[];
}

/**
 * Need-driven shortlist ranking.
 *
 * This is a transparent prioritisation heuristic, not a probability of
 * transfer success. Role profiles only use percentiles already available in
 * the current dataset. Missing role metrics are excluded and the remaining
 * weights are renormalized; missing data is never converted to zero.
 */
export function rankPlayersForNeed(need: TeamNeed | null | undefined, players: Player[], options: {allowUnconfirmedPosition?: boolean} = {}): NeedFitCandidate[] {
  if (!need || need.status !== 'open' || need.position === 'UNKNOWN') return [];

  const normalizedTeam = need.teamName.trim().toLocaleLowerCase();
  const profile = needProfile(need.position, need.detailedPosition);

  return players
    .filter(player => player.league === need.league)
    .filter(player => profile.key === 'WINGER' ? ['MF','FW'].includes(player.position) : player.position === need.position)
    .filter(player => {
      if (!need.detailedPosition) return true;
      if (!player.detailedPosition) return !!options.allowUnconfirmedPosition;
      const allowed = need.detailedPosition === 'RW' || need.detailedPosition === 'RM' ? ['RW','RM']
        : need.detailedPosition === 'LW' || need.detailedPosition === 'LM' ? ['LW','LM'] : [need.detailedPosition];
      return allowed.includes(player.detailedPosition);
    })
    .filter(player => player.statsSeasonIds?.includes(need.seasonId))
    .filter(player => {
      const clubNames = [player.club?.ru, player.club?.uz].filter(Boolean).map(v => String(v).trim().toLocaleLowerCase());
      return !normalizedTeam || !clubNames.includes(normalizedTeam);
    })
    .flatMap(player => {
      const calibrated = calibratedRoleScore(player, profile);
      if (calibrated.score === null) return [];
      const positionConfirmed = !need.detailedPosition || !!player.detailedPosition;
      const minutesScore = Math.min(100, Math.max(0, (player.minutesPlayed / 900) * 100));
      const confidenceScore =
        player.scoutingEngine?.confidence === 'high' ? 100 :
        player.scoutingEngine?.confidence === 'medium' ? 72 : 42;
      const exactPositionScore = need.detailedPosition
        ? positionConfirmed ? 100 : 0
        : 70;

      const fitScore = Math.round(
        calibrated.score * profile.components.role +
        minutesScore * profile.components.minutes +
        confidenceScore * profile.components.confidence +
        exactPositionScore * profile.components.position
      );

      const reasons: string[] = [
        `profile:${profile.key}`,
        `profileScore:${calibrated.score}`,
        `profileCoverage:${Math.round(calibrated.coverage*100)}`,
      ];
      if (!positionConfirmed) reasons.push('position:unconfirmed');
      if (need.detailedPosition && player.detailedPosition === need.detailedPosition) reasons.push(`exact:${need.detailedPosition}`);
      if (player.scoutingEngine?.roleScore !== null) reasons.push(`role:${player.scoutingEngine.roleScore}`);
      reasons.push(`minutes:${player.minutesPlayed}`);
      reasons.push(`confidence:${player.scoutingEngine?.confidence || 'low'}`);
      if (calibrated.usedFallback) reasons.push('profileFallback:broadRoleScore');

      for (const item of calibrated.contributions.slice(0,4)) {
        reasons.push(`metric:${item.key}:${item.percentile}:${Math.round(item.weight*100)}`);
      }

      return [{
        player,
        positionConfirmed,
        usesBroadFallback: calibrated.usedFallback,
        fitScore: Math.max(0, Math.min(100, fitScore)),
        fitVersion: NEED_FIT_VERSION,
        profileKey: profile.key,
        profileScore: calibrated.score,
        profileCoverage: Math.round(calibrated.coverage*100),
        reasons,
      }];
    })
    .sort((a,b) => b.fitScore - a.fitScore ||
      b.profileScore - a.profileScore ||
      (b.player.scoutingEngine?.roleScore ?? -1) - (a.player.scoutingEngine?.roleScore ?? -1) ||
      a.player.id.localeCompare(b.player.id));
}
