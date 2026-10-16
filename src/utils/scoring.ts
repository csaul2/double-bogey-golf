import { Course, Player, Round } from '../types/tournament';

export type ScoreLabel =
  | 'Albatross'
  | 'Eagle'
  | 'Birdie'
  | 'Par'
  | 'Bogey'
  | 'Double Bogey+'
  | 'No Score';

export interface HoleScoreResult {
  strokes: number;
  par: number;
  diffToPar: number;
  points: number;
  label: ScoreLabel;
}

/**
 * Modified Stableford Points System:
 * - Double bogey or worse (+2 or more): 0 points
 * - Bogey (+1): 1 point
 * - Par (0): 2 points
 * - Birdie (-1): 4 points
 * - Eagle (-2): 8 points
 * - Albatross or better (-3 or less): 16 points
 */
export function calculateHolePoints(strokes: number | undefined, par: number): HoleScoreResult {
  if (!strokes || strokes <= 0) {
    return {
      strokes: 0,
      par,
      diffToPar: 0,
      points: 0,
      label: 'No Score',
    };
  }

  const diff = strokes - par;
  let points = 0;
  let label: ScoreLabel = 'Double Bogey+';

  if (diff <= -3) {
    points = 16;
    label = 'Albatross';
  } else if (diff === -2) {
    points = 8;
    label = 'Eagle';
  } else if (diff === -1) {
    points = 4;
    label = 'Birdie';
  } else if (diff === 0) {
    points = 2;
    label = 'Par';
  } else if (diff === 1) {
    points = 1;
    label = 'Bogey';
  } else {
    points = 0;
    label = 'Double Bogey+';
  }

  return {
    strokes,
    par,
    diffToPar: diff,
    points,
    label,
  };
}

/**
 * Calculates the next day's Target Quota:
 * NewTarget = round(min(oldTarget, actualPoints) + (adjustmentPercent / 100) * |actualPoints - oldTarget|)
 */
export function calculateAdjustedTargetQuota(
  oldTarget: number,
  actualPoints: number,
  adjustmentPercent: number = 60
): number {
  const ratio = Math.max(0, Math.min(100, adjustmentPercent)) / 100;
  const lower = Math.min(oldTarget, actualPoints);
  const diff = Math.abs(actualPoints - oldTarget);
  return Math.round(lower + ratio * diff);
}

export interface PlayerRoundStats {
  roundId: string;
  roundNumber: number;
  playerId: string;
  holesPlayed: number;
  grossStrokes: number;
  grossDiffToPar: number;
  actualPoints: number;
  targetQuota: number;
  /**
   * Net Quota Score = actualPoints - targetQuota
   */
  netQuotaScore: number;
  /**
   * Points earned indexed by Hole Difficulty Rank (1 = hardest .. 18 = easiest)
   * Used for tie-breaking.
   */
  pointsByDifficultyRank: Record<number, number>;
}

export function calculatePlayerRoundStats(
  player: Player,
  round: Round,
  course: Course | undefined
): PlayerRoundStats {
  const playerHoleScores = round.scores[player.id] || {};
  const targetQuota =
    round.targetQuotas[player.id] !== undefined
      ? round.targetQuotas[player.id]
      : player.initialTargetQuota;

  let holesPlayed = 0;
  let grossStrokes = 0;
  let grossDiffToPar = 0;
  let actualPoints = 0;
  const pointsByDifficultyRank: Record<number, number> = {};

  if (course) {
    for (const hole of course.holes) {
      const strokes = playerHoleScores[hole.holeNumber];
      if (strokes && strokes > 0) {
        const res = calculateHolePoints(strokes, hole.par);
        holesPlayed += 1;
        grossStrokes += strokes;
        grossDiffToPar += res.diffToPar;
        actualPoints += res.points;
        pointsByDifficultyRank[hole.difficultyRank] = res.points;
      } else {
        pointsByDifficultyRank[hole.difficultyRank] = 0;
      }
    }
  }

  return {
    roundId: round.id,
    roundNumber: round.roundNumber,
    playerId: player.id,
    holesPlayed,
    grossStrokes,
    grossDiffToPar,
    actualPoints,
    targetQuota,
    netQuotaScore: actualPoints - targetQuota,
    pointsByDifficultyRank,
  };
}

export interface LeaderboardEntry {
  player: Player;
  rankDisplay: string; // e.g. "1", "2", "T3"
  tiebrokenBy?: string; // e.g. "Won tiebreak on #1 HCP hole (4 pts vs 2 pts)"
  totalNetQuotaScore: number;
  totalActualPoints: number;
  totalTargetQuota: number;
  totalGrossStrokes: number;
  totalGrossDiffToPar: number;
  totalHolesPlayed: number;
  roundStats: Record<string, PlayerRoundStats>; // roundId -> stats
  /**
   * Aggregated points by difficulty rank (1..18) across the evaluated rounds
   * for difficulty-rank tie-breaking.
   */
  tiebreakPointsByRank: Record<number, number>;
}

/**
 * Builds and sorts the leaderboard either for a single round (`filterRoundId` specified)
 * or overall across all rounds with at least 1 hole played (or active/completed rounds).
 *
 * Tie-breaker order:
 * 1. Primary: Higher `totalNetQuotaScore` (or `totalActualPoints` when in gross points mode)
 * 2. Tie-breaker: Compare points scored on Difficulty Rank 1 (hardest hole), then Rank 2, ..., Rank 18
 *    (checked in the latest round played first, or aggregated across rounds).
 */
export function buildLeaderboard(
  players: Player[],
  rounds: Round[],
  courses: Course[],
  filterRoundId?: string | 'overall',
  sortBy: 'netQuota' | 'grossPoints' | 'grossStrokes' = 'netQuota'
): LeaderboardEntry[] {
  const courseMap = new Map<string, Course>();
  courses.forEach((c) => courseMap.set(c.id, c));

  const sortedRounds = [...rounds].sort((a, b) => a.roundNumber - b.roundNumber);
  const targetRounds =
    filterRoundId && filterRoundId !== 'overall'
      ? sortedRounds.filter((r) => r.id === filterRoundId)
      : sortedRounds;

  const entries: LeaderboardEntry[] = players.map((player) => {
    const roundStatsMap: Record<string, PlayerRoundStats> = {};
    let totalNetQuotaScore = 0;
    let totalActualPoints = 0;
    let totalTargetQuota = 0;
    let totalGrossStrokes = 0;
    let totalGrossDiffToPar = 0;
    let totalHolesPlayed = 0;
    const tiebreakPointsByRank: Record<number, number> = {};

    for (let rank = 1; rank <= 18; rank++) {
      tiebreakPointsByRank[rank] = 0;
    }

    for (const round of targetRounds) {
      const course = courseMap.get(round.courseId);
      const stats = calculatePlayerRoundStats(player, round, course);
      roundStatsMap[round.id] = stats;

      // Include round in cumulative totals if it's a single-round view,
      // or if the player has started the round (holesPlayed > 0) or the round is completed.
      const shouldCountQuota =
        (filterRoundId && filterRoundId !== 'overall') ||
        stats.holesPlayed > 0 ||
        round.status === 'completed';

      if (shouldCountQuota) {
        totalNetQuotaScore += stats.netQuotaScore;
        totalActualPoints += stats.actualPoints;
        totalTargetQuota += stats.targetQuota;
        totalGrossStrokes += stats.grossStrokes;
        totalGrossDiffToPar += stats.grossDiffToPar;
        totalHolesPlayed += stats.holesPlayed;

        for (let rank = 1; rank <= 18; rank++) {
          tiebreakPointsByRank[rank] += stats.pointsByDifficultyRank[rank] || 0;
        }
      }
    }

    return {
      player,
      rankDisplay: '-',
      totalNetQuotaScore,
      totalActualPoints,
      totalTargetQuota,
      totalGrossStrokes,
      totalGrossDiffToPar,
      totalHolesPlayed,
      roundStats: roundStatsMap,
      tiebreakPointsByRank,
    };
  });

  // Sort entries
  entries.sort((a, b) => {
    // Players with 0 holes played go to the bottom when sorting by strokes
    if (sortBy === 'grossStrokes') {
      if (a.totalHolesPlayed === 0 && b.totalHolesPlayed > 0) return 1;
      if (b.totalHolesPlayed === 0 && a.totalHolesPlayed > 0) return -1;
      if (a.totalGrossDiffToPar !== b.totalGrossDiffToPar) {
        return a.totalGrossDiffToPar - b.totalGrossDiffToPar;
      }
    } else if (sortBy === 'grossPoints') {
      if (b.totalActualPoints !== a.totalActualPoints) {
        return b.totalActualPoints - a.totalActualPoints;
      }
    } else {
      // Default: Net Quota Score (Actual Points - Target Quota)
      if (b.totalNetQuotaScore !== a.totalNetQuotaScore) {
        return b.totalNetQuotaScore - a.totalNetQuotaScore;
      }
    }

    // Difficulty Rank Tie-Breaker:
    // Compare points earned on Difficulty Rank 1 (hardest), then 2, ..., up to 18
    for (let diffRank = 1; diffRank <= 18; diffRank++) {
      const aPts = a.tiebreakPointsByRank[diffRank] || 0;
      const bPts = b.tiebreakPointsByRank[diffRank] || 0;
      if (bPts !== aPts) {
        return bPts - aPts;
      }
    }

    return a.player.name.localeCompare(b.player.name);
  });

  // Assign rank numbers and annotate tie-breakers where primary scores are equal
  for (let i = 0; i < entries.length; i++) {
    const current = entries[i];
    const prev = i > 0 ? entries[i - 1] : undefined;

    if (!prev) {
      current.rankDisplay = '1';
      continue;
    }

    const samePrimaryScore =
      sortBy === 'grossStrokes'
        ? current.totalGrossDiffToPar === prev.totalGrossDiffToPar
        : sortBy === 'grossPoints'
        ? current.totalActualPoints === prev.totalActualPoints
        : current.totalNetQuotaScore === prev.totalNetQuotaScore;

    if (samePrimaryScore) {
      // Check which difficulty rank broke the tie between prev and current
      let brokenAtRank: number | null = null;
      for (let diffRank = 1; diffRank <= 18; diffRank++) {
        const prevPts = prev.tiebreakPointsByRank[diffRank] || 0;
        const currPts = current.tiebreakPointsByRank[diffRank] || 0;
        if (prevPts !== currPts) {
          brokenAtRank = diffRank;
          break;
        }
      }

      if (brokenAtRank !== null) {
        current.rankDisplay = `${i + 1}`;
        const prevPts = prev.tiebreakPointsByRank[brokenAtRank] || 0;
        const currPts = current.tiebreakPointsByRank[brokenAtRank] || 0;
        if (!prev.tiebrokenBy) {
          prev.tiebrokenBy = `Tiebreak win on HCP #${brokenAtRank} hole (${prevPts} vs ${currPts} pts)`;
        }
        current.tiebrokenBy = `Tiebreak loss on HCP #${brokenAtRank} hole (${currPts} vs ${prevPts} pts)`;
      } else {
        // Exact tie across all 18 difficulty ranks
        const cleanPrevRank = prev.rankDisplay.replace('T', '');
        prev.rankDisplay = `T${cleanPrevRank}`;
        current.rankDisplay = `T${cleanPrevRank}`;
      }
    } else {
      current.rankDisplay = `${i + 1}`;
    }
  }

  return entries;
}

export function formatSignedScore(score: number): string {
  if (score === 0) return 'E';
  return score > 0 ? `+${score}` : `${score}`;
}
