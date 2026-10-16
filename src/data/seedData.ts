import { Course, Player, Round, TournamentState } from '../types/tournament';
import { calculateAdjustedTargetQuota, calculatePlayerRoundStats } from '../utils/scoring';

// 5 Courses from Uncle Joe's 2026 Tournament Sheet
const COLONIAL_HERITAGE: Course = {
  id: 'course-colonial',
  name: 'Colonial Heritage',
  location: 'Williamsburg, VA',
  holes: [
    { holeNumber: 1, par: 4, difficultyRank: 11, yardage: 395 },
    { holeNumber: 2, par: 4, difficultyRank: 3, yardage: 420 },
    { holeNumber: 3, par: 3, difficultyRank: 17, yardage: 175 },
    { holeNumber: 4, par: 5, difficultyRank: 1, yardage: 535 },
    { holeNumber: 5, par: 4, difficultyRank: 7, yardage: 410 },
    { holeNumber: 6, par: 4, difficultyRank: 15, yardage: 360 },
    { holeNumber: 7, par: 3, difficultyRank: 9, yardage: 185 },
    { holeNumber: 8, par: 4, difficultyRank: 5, yardage: 430 },
    { holeNumber: 9, par: 5, difficultyRank: 13, yardage: 510 },
    { holeNumber: 10, par: 4, difficultyRank: 6, yardage: 415 },
    { holeNumber: 11, par: 4, difficultyRank: 2, yardage: 440 },
    { holeNumber: 12, par: 3, difficultyRank: 18, yardage: 160 },
    { holeNumber: 13, par: 5, difficultyRank: 10, yardage: 525 },
    { holeNumber: 14, par: 4, difficultyRank: 4, yardage: 425 },
    { holeNumber: 15, par: 4, difficultyRank: 14, yardage: 380 },
    { holeNumber: 16, par: 3, difficultyRank: 16, yardage: 170 },
    { holeNumber: 17, par: 5, difficultyRank: 8, yardage: 540 },
    { holeNumber: 18, par: 4, difficultyRank: 12, yardage: 405 },
  ],
};

const GH_GREEN: Course = {
  id: 'course-gh-green',
  name: 'G.H. Green',
  location: 'Williamsburg, VA',
  holes: Array.from({ length: 18 }, (_, i) => ({
    holeNumber: i + 1,
    par: ((i % 4 === 1 ? 5 : i % 4 === 3 ? 3 : 4) as 3 | 4 | 5),
    difficultyRank: i + 1,
    yardage: 380 + (i * 10),
  })),
};

const GH_GOLD: Course = {
  id: 'course-gh-gold',
  name: 'G.H. Gold',
  location: 'Williamsburg, VA',
  holes: Array.from({ length: 18 }, (_, i) => ({
    holeNumber: i + 1,
    par: ((i % 4 === 0 ? 5 : i % 4 === 2 ? 3 : 4) as 3 | 4 | 5),
    difficultyRank: 18 - i,
    yardage: 375 + (i * 12),
  })),
};

const KISKIACK: Course = {
  id: 'course-kiskiack',
  name: 'Kiskiack',
  location: 'Williamsburg, VA',
  holes: Array.from({ length: 18 }, (_, i) => ({
    holeNumber: i + 1,
    par: ((i % 5 === 2 ? 3 : i % 5 === 4 ? 5 : 4) as 3 | 4 | 5),
    difficultyRank: (i * 7) % 18 + 1,
    yardage: 390 + (i * 8),
  })),
};

const ROYAL_NEW_KENT: Course = {
  id: 'course-royal-new-kent',
  name: 'Royal New Kent',
  location: 'Providence Forge, VA',
  holes: Array.from({ length: 18 }, (_, i) => ({
    holeNumber: i + 1,
    par: ((i % 4 === 1 ? 5 : i % 4 === 3 ? 3 : 4) as 3 | 4 | 5),
    difficultyRank: (i * 11) % 18 + 1,
    yardage: 410 + (i * 5),
  })),
};

// Players directly transcribed from Uncle Joe's official worksheets
export const SEEDED_PLAYERS: Player[] = [
  // A-Group
  { id: 'p_kulik', name: 'Kulik', flight: 'A', avatarColor: '#15803D', initialTargetQuota: 29 },
  { id: 'p_et', name: 'E.T.', flight: 'A', avatarColor: '#0369A1', initialTargetQuota: 25 },
  { id: 'p_unclejoe', name: 'Uncle Joe', flight: 'A', avatarColor: '#B45309', initialTargetQuota: 22 },
  { id: 'p_scorecard', name: 'Scorecard', flight: 'A', avatarColor: '#6D28D9', initialTargetQuota: 19 },
  { id: 'p_blake', name: 'Blake', flight: 'A', avatarColor: '#BE123C', initialTargetQuota: 19 },
  { id: 'p_tigger', name: 'tigger', flight: 'A', avatarColor: '#0F766E', initialTargetQuota: 18 },
  { id: 'p_stevieb', name: 'Stevie B', flight: 'A', avatarColor: '#4338CA', initialTargetQuota: 17 },
  { id: 'p_ow', name: 'O.W.', flight: 'A', avatarColor: '#A16207', initialTargetQuota: 16 },
  { id: 'p_jerry', name: 'Jerry', flight: 'A', avatarColor: '#059669', initialTargetQuota: 16 },
  { id: 'p_sandbagger', name: 'sandbagger', flight: 'A', avatarColor: '#DC2626', initialTargetQuota: 15 },
  { id: 'p_rj', name: 'R.J.', flight: 'A', avatarColor: '#475569', initialTargetQuota: 15 },

  // B-Group
  { id: 'p_baldy', name: 'Baldy', flight: 'B', avatarColor: '#0284C7', initialTargetQuota: 14 },
  { id: 'p_creskin', name: 'Creskin', flight: 'B', avatarColor: '#16A34A', initialTargetQuota: 14 },
  { id: 'p_anthony', name: 'Anthony', flight: 'B', avatarColor: '#D97706', initialTargetQuota: 14 },
  { id: 'p_todd', name: 'Todd', flight: 'B', avatarColor: '#7C3AED', initialTargetQuota: 12 },
  { id: 'p_quirky', name: 'Quirky', flight: 'B', avatarColor: '#DB2777', initialTargetQuota: 12 },
  { id: 'p_werner', name: 'Werner', flight: 'B', avatarColor: '#0D9488', initialTargetQuota: 11 },
  { id: 'p_christopher', name: 'Christopher', flight: 'B', avatarColor: '#4F46E5', initialTargetQuota: 10 },
  { id: 'p_bigal', name: 'Big Al', flight: 'B', avatarColor: '#CA8A04', initialTargetQuota: 7 },
  { id: 'p_sean', name: 'Sean', flight: 'B', avatarColor: '#10B981', initialTargetQuota: 5 },
  { id: 'p_charmin', name: 'Charmin', flight: 'B', avatarColor: '#E11D48', initialTargetQuota: 4 },
  { id: 'p_wes', name: 'Wes', flight: 'B', avatarColor: '#64748B', initialTargetQuota: 3 },
];

function createSeedRounds(): Round[] {
  const courses = [COLONIAL_HERITAGE, GH_GREEN, GH_GOLD, KISKIACK, ROYAL_NEW_KENT];
  const roundNames = [
    'Round 1: Colonial Heritage (11:00 AM)',
    'Round 2: G.H. Green (12:00 PM)',
    'Round 3: G.H. Gold (11:00 AM)',
    'Round 4: Kiskiack (11:06 AM)',
    'Round 5: Royal New Kent (11:00 AM)',
  ];

  // Starting Round 1 quotas
  const r1Quotas: Record<string, number> = {};
  SEEDED_PLAYERS.forEach((p) => {
    r1Quotas[p.id] = p.initialTargetQuota;
  });

  // Seed Round 1 realistic scores
  const r1Scores: Record<string, Record<number, number>> = {
    p_stevieb: { 1: 4, 2: 4, 3: 3, 4: 4, 5: 4, 6: 4, 7: 3, 8: 4, 9: 4, 10: 4, 11: 4, 12: 3, 13: 4, 14: 4, 15: 4, 16: 3, 17: 4, 18: 4 }, // +6
    p_kulik: { 1: 5, 2: 5, 3: 4, 4: 5, 5: 5, 6: 4, 7: 4, 8: 5, 9: 5, 10: 5, 11: 5, 12: 4, 13: 5, 14: 5, 15: 4, 16: 3, 17: 5, 18: 4 }, // -3
    p_jerry: { 1: 4, 2: 5, 3: 3, 4: 5, 5: 4, 6: 4, 7: 4, 8: 5, 9: 5, 10: 4, 11: 5, 12: 3, 13: 5, 14: 4, 15: 4, 16: 4, 17: 5, 18: 4 }, // Even
    p_unclejoe: { 1: 4, 2: 5, 3: 4, 4: 5, 5: 4, 6: 5, 7: 3, 8: 5, 9: 5, 10: 4, 11: 5, 12: 3, 13: 5, 14: 5, 15: 4, 16: 3, 17: 5, 18: 4 }, // Even
    p_bigal: { 1: 5, 2: 5, 3: 4, 4: 5, 5: 5, 6: 5, 7: 4, 8: 5, 9: 6, 10: 5, 11: 5, 12: 4, 13: 5, 14: 5, 15: 5, 16: 4, 17: 6, 18: 5 }, // +3
    p_sean: { 1: 5, 2: 6, 3: 4, 4: 6, 5: 5, 6: 5, 7: 4, 8: 6, 9: 6, 10: 5, 11: 6, 12: 4, 13: 6, 14: 5, 15: 5, 16: 4, 17: 6, 18: 5 }, // +3
  };

  const round1: Round = {
    id: 'round-1',
    roundNumber: 1,
    name: roundNames[0],
    courseId: courses[0].id,
    status: 'completed',
    targetQuotas: r1Quotas,
    scores: r1Scores,
  };

  // Round 2 Quotas calculated from Round 1 results
  const r2Quotas: Record<string, number> = {};
  SEEDED_PLAYERS.forEach((p) => {
    const r1Stats = calculatePlayerRoundStats(p, round1, courses[0]);
    r2Quotas[p.id] = r1Stats.holesPlayed > 0
      ? calculateAdjustedTargetQuota(r1Stats.targetQuota, r1Stats.actualPoints, 60)
      : p.initialTargetQuota;
  });

  // Seed live in-progress holes for Round 2
  const r2Scores: Record<string, Record<number, number>> = {
    p_stevieb: { 1: 4, 2: 4, 3: 3, 4: 4, 5: 4, 6: 3 },
    p_kulik: { 1: 4, 2: 5, 3: 3, 4: 4, 5: 4, 6: 4 },
    p_unclejoe: { 1: 4, 2: 4, 3: 4, 4: 5, 5: 4, 6: 4 },
    p_jerry: { 1: 4, 2: 4, 3: 3, 4: 5, 5: 4, 6: 4 },
  };

  const round2: Round = {
    id: 'round-2',
    roundNumber: 2,
    name: roundNames[1],
    courseId: courses[1].id,
    status: 'active',
    targetQuotas: r2Quotas,
    scores: r2Scores,
  };

  const remainingRounds: Round[] = [2, 3, 4].map((idx) => ({
    id: `round-${idx + 1}`,
    roundNumber: idx + 1,
    name: roundNames[idx],
    courseId: courses[idx].id,
    status: 'upcoming',
    targetQuotas: { ...r2Quotas },
    scores: {},
  }));

  return [round1, round2, ...remainingRounds];
}

const SEEDED_GROUPS = [
  {
    id: 'group-r2-cart1',
    roundId: 'round-2',
    name: 'Cart 1',
    playerIds: ['p_unclejoe', 'p_kulik', 'p_stevieb', 'p_jerry'],
    scorerName: 'Uncle Joe',
    currentHole: 7,
    createdAt: '2026-10-16T12:00:00Z',
  },
];

export function getInitialTournamentState(): TournamentState {
  return {
    settings: {
      tournamentName: '26th Annual Double Bogey Tournament',
      subtitle: 'Official Individual Scoring',
      tournamentPin: '1926',
      adminPin: '9999',
      targetAdjustmentPercent: 60,
    },
    courses: [COLONIAL_HERITAGE, GH_GREEN, GH_GOLD, KISKIACK, ROYAL_NEW_KENT],
    players: SEEDED_PLAYERS,
    rounds: createSeedRounds(),
    groups: SEEDED_GROUPS,
  };
}
