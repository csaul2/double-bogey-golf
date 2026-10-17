export interface HoleConfig {
  holeNumber: number; // 1 to 18
  par: 3 | 4 | 5;
  difficultyRank: number; // 1 (hardest) to 18 (easiest)
  yardage?: number;
}

export interface Course {
  id: string;
  name: string;
  location?: string;
  holes: HoleConfig[]; // Always length 18
}

export type Flight = 'A' | 'B';

export interface Player {
  id: string;
  name: string;
  flight: Flight;
  avatarColor: string;
  initialTargetQuota: number; // Starting target quota for Round 1
  isActive?: boolean; // Whether player is attending/active for the current tournament
}

export type RoundStatus = 'upcoming' | 'active' | 'completed';

export interface Round {
  id: string;
  roundNumber: number; // 1, 2, 3, ...
  name: string; // e.g., "Round 1 - Friday"
  courseId: string;
  status: RoundStatus;
  /**
   * Maps playerId -> Target Points Quota for this specific round.
   * For Round 1, initialized from player.initialTargetQuota.
   * For subsequent rounds, calculated from previous round using the configurable adjustment %
   * (and editable by the admin).
   */
  targetQuotas: Record<string, number>;
  /**
   * Maps playerId -> Map of holeNumber (1..18) -> gross strokes entered.
   */
  scores: Record<string, Record<number, number>>;
}

export interface Group {
  id: string;
  roundId: string;
  name: string; // e.g., "Group 1"
  playerIds: string[]; // 1 to 4 players
  scorerName?: string;
  currentHole: number; // 1 to 18
  createdAt: string;
}

export interface TournamentSettings {
  tournamentName: string;
  subtitle: string;
  tournamentPin: string;
  adminPin: string;
  /**
   * Percentage (0 to 100) used when calculating next day's target quota:
   * NewTarget = round(min(OldTarget, ActualPoints) + (adjustmentPercent / 100) * |ActualPoints - OldTarget|)
   * Default: 60
   */
  targetAdjustmentPercent: number;
}

export interface TournamentState {
  settings: TournamentSettings;
  courses: Course[];
  players: Player[];
  rounds: Round[];
  groups: Group[];
}
