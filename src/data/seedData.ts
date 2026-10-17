import { Course, Group, Player, Round, TournamentState } from '../types/tournament';
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

export const TOWN_AND_COUNTRY: Course = {
  id: 'course-town-and-country',
  name: 'Town & Country Golf Links',
  location: 'Woodstown, NJ',
  holes: [
    { holeNumber: 1, par: 4, difficultyRank: 9, yardage: 411 },
    { holeNumber: 2, par: 4, difficultyRank: 3, yardage: 372 },
    { holeNumber: 3, par: 4, difficultyRank: 7, yardage: 430 },
    { holeNumber: 4, par: 3, difficultyRank: 15, yardage: 190 },
    { holeNumber: 5, par: 4, difficultyRank: 13, yardage: 345 },
    { holeNumber: 6, par: 4, difficultyRank: 11, yardage: 390 },
    { holeNumber: 7, par: 4, difficultyRank: 1, yardage: 395 },
    { holeNumber: 8, par: 3, difficultyRank: 17, yardage: 144 },
    { holeNumber: 9, par: 5, difficultyRank: 5, yardage: 525 },
    { holeNumber: 10, par: 5, difficultyRank: 4, yardage: 540 },
    { holeNumber: 11, par: 4, difficultyRank: 6, yardage: 375 },
    { holeNumber: 12, par: 4, difficultyRank: 10, yardage: 320 },
    { holeNumber: 13, par: 3, difficultyRank: 12, yardage: 150 },
    { holeNumber: 14, par: 5, difficultyRank: 8, yardage: 465 },
    { holeNumber: 15, par: 4, difficultyRank: 16, yardage: 285 },
    { holeNumber: 16, par: 3, difficultyRank: 14, yardage: 154 },
    { holeNumber: 17, par: 4, difficultyRank: 18, yardage: 305 },
    { holeNumber: 18, par: 4, difficultyRank: 2, yardage: 360 },
  ],
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

  // Starting Round 1 quotas for all players
  const r1Quotas: Record<string, number> = {};
  SEEDED_PLAYERS.forEach((p) => {
    r1Quotas[p.id] = p.initialTargetQuota;
  });

  const round1: Round = {
    id: 'round-1',
    roundNumber: 1,
    name: roundNames[0],
    courseId: courses[0].id,
    status: 'active',
    targetQuotas: r1Quotas,
    scores: {},
  };

  const remainingRounds: Round[] = [1, 2, 3, 4].map((idx) => ({
    id: `round-${idx + 1}`,
    roundNumber: idx + 1,
    name: roundNames[idx],
    courseId: courses[idx].id,
    status: 'upcoming',
    targetQuotas: { ...r1Quotas },
    scores: {},
  }));

  return [round1, ...remainingRounds];
}

const SEEDED_GROUPS: Group[] = [
  {
    id: 'group-r1-cart1',
    roundId: 'round-1',
    name: 'Cart 1',
    playerIds: ['p_unclejoe', 'p_kulik', 'p_stevieb', 'p_jerry'],
    scorerName: 'Uncle Joe',
    currentHole: 1,
    createdAt: '2026-10-17T08:00:00Z',
  },
  {
    id: 'group-r1-cart2',
    roundId: 'round-1',
    name: 'Cart 2',
    playerIds: ['p_et', 'p_scorecard', 'p_blake', 'p_tigger'],
    scorerName: 'E.T.',
    currentHole: 1,
    createdAt: '2026-10-17T08:00:00Z',
  },
  {
    id: 'group-r1-cart3',
    roundId: 'round-1',
    name: 'Cart 3',
    playerIds: ['p_ow', 'p_sandbagger', 'p_rj', 'p_baldy'],
    scorerName: 'O.W.',
    currentHole: 1,
    createdAt: '2026-10-17T08:00:00Z',
  },
  {
    id: 'group-r1-cart4',
    roundId: 'round-1',
    name: 'Cart 4',
    playerIds: ['p_creskin', 'p_anthony', 'p_todd', 'p_quirky'],
    scorerName: 'Creskin',
    currentHole: 1,
    createdAt: '2026-10-17T08:00:00Z',
  },
  {
    id: 'group-r1-cart5',
    roundId: 'round-1',
    name: 'Cart 5',
    playerIds: ['p_werner', 'p_christopher', 'p_bigal', 'p_sean'],
    scorerName: 'Werner',
    currentHole: 1,
    createdAt: '2026-10-17T08:00:00Z',
  },
  {
    id: 'group-r1-cart6',
    roundId: 'round-1',
    name: 'Cart 6',
    playerIds: ['p_charmin', 'p_wes'],
    scorerName: 'Charmin',
    currentHole: 1,
    createdAt: '2026-10-17T08:00:00Z',
  },
];

export function getInitialTournamentState(): TournamentState {
  return {
    settings: {
      tournamentName: '26th Annual DBT Golf Tournament',
      subtitle: 'Official Individual Scoring',
      tournamentPin: '1926',
      adminPin: '9999',
      targetAdjustmentPercent: 60,
    },
    courses: [
      COLONIAL_HERITAGE,
      GH_GREEN,
      GH_GOLD,
      KISKIACK,
      ROYAL_NEW_KENT,
      TOWN_AND_COUNTRY,
    ],
    players: SEEDED_PLAYERS,
    rounds: createSeedRounds(),
    groups: SEEDED_GROUPS,
  };
}
