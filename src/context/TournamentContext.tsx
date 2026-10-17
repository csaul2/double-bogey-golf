import React, { createContext, useContext, useState } from 'react';
import { getInitialTournamentState } from '../data/seedData';
import {
  Course,
  Flight,
  Group,
  HoleConfig,
  Player,
  Round,
  RoundStatus,
  TournamentSettings,
  TournamentState,
} from '../types/tournament';
import { calculateAdjustedTargetQuota, calculatePlayerRoundStats } from '../utils/scoring';
import { syncManager, SyncStatus } from '../services/syncManager';

interface TournamentContextValue {
  state: TournamentState;
  isUnlocked: boolean;
  isAdminUnlocked: boolean;
  syncStatus: SyncStatus;
  pendingSyncCount: number;
  manualSync: () => void;
  unlockTournament: (pin: string) => boolean;
  unlockAdmin: (pin: string) => boolean;
  lockAdmin: () => void;

  // Score Entry & Group Management
  setHoleScore: (
    roundId: string,
    playerId: string,
    holeNumber: number,
    strokes: number | null
  ) => void;
  createGroup: (roundId: string, name: string, playerIds: string[], scorerName?: string) => Group;
  updateGroup: (group: Group) => void;
  updateGroupHole: (groupId: string, currentHole: number) => void;
  deleteGroup: (groupId: string) => void;
  setRoundGroups: (roundId: string, groups: Group[]) => void;
  autoGeneratePairings: (roundId: string) => void;
  advanceRound: (completedRoundId: string) => void;

  // Admin: Courses
  saveCourse: (course: Course) => void;
  deleteCourse: (courseId: string) => void;

  // Admin: Players
  addPlayer: (name: string, initialTargetQuota: number, flight: Flight) => void;
  updatePlayer: (playerId: string, name: string, initialTargetQuota: number, flight?: Flight) => void;
  deletePlayer: (playerId: string) => void;
  togglePlayerActive: (playerId: string) => void;

  // Admin: Rounds & Quotas
  addRound: (name: string, courseId: string) => void;
  updateRoundStatus: (roundId: string, status: RoundStatus) => void;
  updateRoundCourse: (roundId: string, courseId: string) => void;
  updatePlayerRoundQuota: (roundId: string, playerId: string, quota: number) => void;
  recalculateRoundQuotasFromPrevious: (roundId: string) => void;

  // Admin: Settings
  updateSettings: (settings: Partial<TournamentSettings>) => void;
  resetDemoData: () => void;
}

const AVATAR_COLORS = [
  '#15803D',
  '#0369A1',
  '#B45309',
  '#6D28D9',
  '#BE123C',
  '#0F766E',
  '#4338CA',
  '#A16207',
];

const TournamentContext = createContext<TournamentContextValue | undefined>(undefined);

export const TournamentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<TournamentState>(() => getInitialTournamentState());
  const [isUnlocked, setIsUnlocked] = useState<boolean>(true); // Default unlocked for immediate testing, with lock toggle available
  const [isAdminUnlocked, setIsAdminUnlocked] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() => syncManager.getStatus());
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(() => syncManager.getPendingCount());

  React.useEffect(() => {
    const unsubStatus = syncManager.onStatusChange((status, count) => {
      setSyncStatus(status);
      setPendingSyncCount(count);
    });

    const unsubScores = syncManager.onRemoteScoreReceived((remoteScore) => {
      setState((prev) => {
        const rounds = prev.rounds.map((r) => {
          if (r.id !== remoteScore.roundId) return r;
          const playerScores = { ...(r.scores[remoteScore.playerId] || {}) };
          playerScores[remoteScore.holeNumber] = remoteScore.strokes;
          return {
            ...r,
            scores: {
              ...r.scores,
              [remoteScore.playerId]: playerScores,
            },
          };
        });
        return { ...prev, rounds };
      });
    });

    return () => {
      unsubStatus();
      unsubScores();
    };
  }, []);

  const unlockTournament = (pin: string): boolean => {
    if (pin.trim() === state.settings.tournamentPin || pin.trim() === state.settings.adminPin) {
      setIsUnlocked(true);
      if (pin.trim() === state.settings.adminPin) {
        setIsAdminUnlocked(true);
      }
      return true;
    }
    return false;
  };

  const unlockAdmin = (pin: string): boolean => {
    if (pin.trim() === state.settings.adminPin) {
      setIsAdminUnlocked(true);
      return true;
    }
    return false;
  };

  const lockAdmin = () => {
    setIsAdminUnlocked(false);
  };

  const setHoleScore = (
    roundId: string,
    playerId: string,
    holeNumber: number,
    strokes: number | null
  ) => {
    setState((prev) => {
      const rounds = prev.rounds.map((r) => {
        if (r.id !== roundId) return r;
        const playerScores = { ...(r.scores[playerId] || {}) };
        if (strokes === null || strokes <= 0) {
          delete playerScores[holeNumber];
        } else {
          playerScores[holeNumber] = strokes;
        }
        return {
          ...r,
          scores: {
            ...r.scores,
            [playerId]: playerScores,
          },
        };
      });
      return { ...prev, rounds };
    });

    // Enqueue in offline sync manager
    if (strokes !== null && strokes > 0) {
      syncManager.queueScore(roundId, playerId, holeNumber, strokes);
    }
  };

  const createGroup = (
    roundId: string,
    name: string,
    playerIds: string[],
    scorerName?: string
  ): Group => {
    const newGroup: Group = {
      id: `group-${Date.now()}`,
      roundId,
      name: name.trim() || `Group ${state.groups.filter((g) => g.roundId === roundId).length + 1}`,
      playerIds: playerIds.slice(0, 4),
      scorerName: scorerName?.trim(),
      currentHole: 1,
      createdAt: new Date().toISOString(),
    };

    setState((prev) => ({
      ...prev,
      groups: [...prev.groups, newGroup],
    }));

    return newGroup;
  };

  const updateGroupHole = (groupId: string, currentHole: number) => {
    setState((prev) => ({
      ...prev,
      groups: prev.groups.map((g) =>
        g.id === groupId ? { ...g, currentHole: Math.max(1, Math.min(18, currentHole)) } : g
      ),
    }));
  };

  const deleteGroup = (groupId: string) => {
    setState((prev) => ({
      ...prev,
      groups: prev.groups.filter((g) => g.id !== groupId),
    }));
  };

  const updateGroup = (updatedGroup: Group) => {
    setState((prev) => ({
      ...prev,
      groups: prev.groups.map((g) => (g.id === updatedGroup.id ? updatedGroup : g)),
    }));
  };

  const setRoundGroups = (roundId: string, groups: Group[]) => {
    setState((prev) => ({
      ...prev,
      groups: [...prev.groups.filter((g) => g.roundId !== roundId), ...groups],
    }));
  };

  const autoGeneratePairings = (roundId: string) => {
    setState((prev) => {
      const activePlayers = prev.players.filter((p) => p.isActive !== false);
      const foursomes: Group[] = [];
      const chunkSize = 4;
      for (let i = 0; i < activePlayers.length; i += chunkSize) {
        const chunk = activePlayers.slice(i, i + chunkSize);
        const cartIndex = Math.floor(i / chunkSize) + 1;
        foursomes.push({
          id: `group-${roundId}-cart${cartIndex}-${Date.now()}`,
          roundId,
          name: `Cart ${cartIndex}`,
          playerIds: chunk.map((p) => p.id),
          scorerName: chunk[0]?.name || `Cart ${cartIndex}`,
          currentHole: 1,
          createdAt: new Date().toISOString(),
        });
      }
      return {
        ...prev,
        groups: [...prev.groups.filter((g) => g.roundId !== roundId), ...foursomes],
      };
    });
  };

  const saveCourse = (course: Course) => {
    setState((prev) => {
      const exists = prev.courses.some((c) => c.id === course.id);
      const courses = exists
        ? prev.courses.map((c) => (c.id === course.id ? course : c))
        : [...prev.courses, course];
      return { ...prev, courses };
    });
  };

  const deleteCourse = (courseId: string) => {
    setState((prev) => ({
      ...prev,
      courses: prev.courses.filter((c) => c.id !== courseId),
    }));
  };

  const addPlayer = (name: string, initialTargetQuota: number, flight: Flight = 'A') => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const newPlayer: Player = {
      id: `player-${Date.now()}`,
      name: trimmed,
      flight,
      avatarColor: AVATAR_COLORS[state.players.length % AVATAR_COLORS.length],
      initialTargetQuota,
    };

    setState((prev) => {
      const rounds = prev.rounds.map((r) => ({
        ...r,
        targetQuotas: {
          ...r.targetQuotas,
          [newPlayer.id]: initialTargetQuota,
        },
      }));
      return {
        ...prev,
        players: [...prev.players, newPlayer],
        rounds,
      };
    });
  };

  const updatePlayer = (
    playerId: string,
    name: string,
    initialTargetQuota: number,
    flight?: Flight
  ) => {
    setState((prev) => {
      const players = prev.players.map((p) =>
        p.id === playerId
          ? {
              ...p,
              name: name.trim() || p.name,
              initialTargetQuota,
              flight: flight || p.flight,
            }
          : p
      );
      // Also update Round 1 quota if it exists
      const rounds = prev.rounds.map((r) => {
        if (r.roundNumber === 1) {
          return {
            ...r,
            targetQuotas: {
              ...r.targetQuotas,
              [playerId]: initialTargetQuota,
            },
          };
        }
        return r;
      });
      return { ...prev, players, rounds };
    });
  };

  const deletePlayer = (playerId: string) => {
    setState((prev) => ({
      ...prev,
      players: prev.players.filter((p) => p.id !== playerId),
      groups: prev.groups.map((g) => ({
        ...g,
        playerIds: g.playerIds.filter((id) => id !== playerId),
      })),
    }));
  };

  const togglePlayerActive = (playerId: string) => {
    setState((prev) => ({
      ...prev,
      players: prev.players.map((p) => {
        if (p.id !== playerId) return p;
        const currentActive = p.isActive !== false;
        return {
          ...p,
          isActive: !currentActive,
        };
      }),
    }));
  };

  const addRound = (name: string, courseId: string) => {
    setState((prev) => {
      const nextNum = prev.rounds.length > 0 ? Math.max(...prev.rounds.map((r) => r.roundNumber)) + 1 : 1;
      const prevRound = [...prev.rounds].sort((a, b) => b.roundNumber - a.roundNumber)[0];
      const prevCourse = prevRound ? prev.courses.find((c) => c.id === prevRound.courseId) : undefined;

      const targetQuotas: Record<string, number> = {};
      prev.players.forEach((p) => {
        if (prevRound && prevCourse) {
          const stats = calculatePlayerRoundStats(p, prevRound, prevCourse);
          targetQuotas[p.id] =
            stats.holesPlayed > 0
              ? calculateAdjustedTargetQuota(
                  stats.targetQuota,
                  stats.actualPoints,
                  prev.settings.targetAdjustmentPercent
                )
              : stats.targetQuota;
        } else {
          targetQuotas[p.id] = p.initialTargetQuota;
        }
      });

      const newRound: Round = {
        id: `round-${Date.now()}`,
        roundNumber: nextNum,
        name: name.trim() || `Round ${nextNum}`,
        courseId: courseId || prev.courses[0]?.id || '',
        status: 'upcoming',
        targetQuotas,
        scores: {},
      };

      return {
        ...prev,
        rounds: [...prev.rounds, newRound],
      };
    });
  };

  const updateRoundStatus = (roundId: string, status: RoundStatus) => {
    setState((prev) => ({
      ...prev,
      rounds: prev.rounds.map((r) => (r.id === roundId ? { ...r, status } : r)),
    }));
  };

  const updateRoundCourse = (roundId: string, courseId: string) => {
    setState((prev) => ({
      ...prev,
      rounds: prev.rounds.map((r) => (r.id === roundId ? { ...r, courseId } : r)),
    }));
  };

  const updatePlayerRoundQuota = (roundId: string, playerId: string, quota: number) => {
    setState((prev) => ({
      ...prev,
      rounds: prev.rounds.map((r) =>
        r.id === roundId
          ? {
              ...r,
              targetQuotas: {
                ...r.targetQuotas,
                [playerId]: quota,
              },
            }
          : r
      ),
    }));
  };

  const recalculateRoundQuotasFromPrevious = (roundId: string) => {
    setState((prev) => {
      const sortedRounds = [...prev.rounds].sort((a, b) => a.roundNumber - b.roundNumber);
      const targetIndex = sortedRounds.findIndex((r) => r.id === roundId);
      if (targetIndex <= 0) return prev; // Round 1 has no previous round

      const prevRound = sortedRounds[targetIndex - 1];
      const targetRound = sortedRounds[targetIndex];
      const prevCourse = prev.courses.find((c) => c.id === prevRound.courseId);

      const newQuotas: Record<string, number> = { ...targetRound.targetQuotas };
      prev.players.forEach((player) => {
        const prevStats = calculatePlayerRoundStats(player, prevRound, prevCourse);
        newQuotas[player.id] = calculateAdjustedTargetQuota(
          prevStats.targetQuota,
          prevStats.actualPoints,
          prev.settings.targetAdjustmentPercent
        );
      });

      return {
        ...prev,
        rounds: prev.rounds.map((r) =>
          r.id === roundId ? { ...r, targetQuotas: newQuotas } : r
        ),
      };
    });
  };

  const advanceRound = (completedRoundId: string) => {
    setState((prev) => {
      const sortedRounds = [...prev.rounds].sort((a, b) => a.roundNumber - b.roundNumber);
      const currIdx = sortedRounds.findIndex((r) => r.id === completedRoundId);
      if (currIdx === -1) return prev;

      const completedRound = sortedRounds[currIdx];
      const completedCourse = prev.courses.find((c) => c.id === completedRound.courseId);
      const nextRound = sortedRounds[currIdx + 1];

      // Calculate next quotas for all players based on completed round
      const newQuotas: Record<string, number> = {};
      prev.players.forEach((player) => {
        const stats = calculatePlayerRoundStats(player, completedRound, completedCourse);
        if (stats.holesPlayed > 0) {
          newQuotas[player.id] = calculateAdjustedTargetQuota(
            stats.targetQuota,
            stats.actualPoints,
            prev.settings.targetAdjustmentPercent
          );
        } else if (nextRound && nextRound.targetQuotas[player.id]) {
          newQuotas[player.id] = nextRound.targetQuotas[player.id];
        } else {
          newQuotas[player.id] = player.initialTargetQuota;
        }
      });

      const updatedRounds = prev.rounds.map((r) => {
        if (r.id === completedRoundId) {
          return { ...r, status: 'completed' as RoundStatus };
        }
        if (nextRound && r.id === nextRound.id) {
          return { ...r, status: 'active' as RoundStatus, targetQuotas: newQuotas };
        }
        return r;
      });

      // Also ensure next round has groups/carts; if none exist, carry over active groups
      let updatedGroups = prev.groups;
      if (nextRound) {
        const nextRoundGroups = prev.groups.filter((g) => g.roundId === nextRound.id);
        if (nextRoundGroups.length === 0) {
          const prevGroups = prev.groups.filter((g) => g.roundId === completedRoundId);
          const carriedGroups: Group[] = prevGroups.map((g, idx) => ({
            id: `group-${nextRound.id}-cart${idx + 1}-${Date.now()}`,
            roundId: nextRound.id,
            name: g.name,
            playerIds: [...g.playerIds],
            scorerName: g.scorerName,
            currentHole: 1,
            createdAt: new Date().toISOString(),
          }));
          updatedGroups = [...prev.groups, ...carriedGroups];
        }
      }

      return {
        ...prev,
        rounds: updatedRounds,
        groups: updatedGroups,
      };
    });
  };

  const updateSettings = (newSettings: Partial<TournamentSettings>) => {
    setState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        ...newSettings,
      },
    }));
  };

  const resetDemoData = () => {
    setState(getInitialTournamentState());
  };

  return (
    <TournamentContext.Provider
      value={{
        state,
        isUnlocked,
        isAdminUnlocked,
        syncStatus,
        pendingSyncCount,
        manualSync: () => syncManager.flushQueue(),
        unlockTournament,
        unlockAdmin,
        lockAdmin,
        setHoleScore,
        createGroup,
        updateGroup,
        updateGroupHole,
        deleteGroup,
        setRoundGroups,
        autoGeneratePairings,
        advanceRound,
        saveCourse,
        deleteCourse,
        addPlayer,
        updatePlayer,
        deletePlayer,
        togglePlayerActive,
        addRound,
        updateRoundStatus,
        updateRoundCourse,
        updatePlayerRoundQuota,
        recalculateRoundQuotasFromPrevious,
        updateSettings,
        resetDemoData,
      }}
    >
      {children}
    </TournamentContext.Provider>
  );
};

export function useTournament(): TournamentContextValue {
  const ctx = useContext(TournamentContext);
  if (!ctx) {
    throw new Error('useTournament must be used within a TournamentProvider');
  }
  return ctx;
}

export function createBlankCourse(name: string, location?: string): Course {
  const holes: HoleConfig[] = Array.from({ length: 18 }, (_, i) => ({
    holeNumber: i + 1,
    par: 4,
    difficultyRank: i + 1,
    yardage: 400,
  }));
  return {
    id: `course-${Date.now()}`,
    name,
    location,
    holes,
  };
}
