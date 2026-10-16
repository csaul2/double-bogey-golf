import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTournament } from '../context/TournamentContext';
import { Group, Player } from '../types/tournament';
import {
  calculateHolePoints,
  calculatePlayerRoundStats,
  formatSignedScore,
} from '../utils/scoring';

export const GroupScoringScreen: React.FC = () => {
  const {
    state,
    setHoleScore,
    createGroup,
    updateGroupHole,
    deleteGroup,
  } = useTournament();

  const sortedRounds = useMemo(
    () => [...state.rounds].sort((a, b) => a.roundNumber - b.roundNumber),
    [state.rounds]
  );

  const defaultRound = useMemo(
    () => state.rounds.find((r) => r.status === 'active') || sortedRounds[0],
    [state.rounds, sortedRounds]
  );

  const [selectedRoundId, setSelectedRoundId] = useState<string>(
    defaultRound?.id || ''
  );
  const [activeGroupId, setActiveGroupId] = useState<string | null>(() => {
    const existing = state.groups.find((g) => g.roundId === defaultRound?.id);
    return existing ? existing.id : null;
  });

  // Group Builder State (when creating a new group)
  const [isCreatingGroup, setIsCreatingGroup] = useState<boolean>(false);
  const [newGroupName, setNewGroupName] = useState<string>('');
  const [scorerName, setScorerName] = useState<string>('');
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);

  // View Mode inside Scorecard: 'hole' (1 hole at a time) vs 'grid' (all 18 holes)
  const [viewMode, setViewMode] = useState<'hole' | 'grid'>('hole');

  const currentRound = useMemo(
    () => state.rounds.find((r) => r.id === selectedRoundId) || sortedRounds[0],
    [state.rounds, selectedRoundId, sortedRounds]
  );

  const currentCourse = useMemo(
    () => state.courses.find((c) => c.id === currentRound?.courseId) || state.courses[0],
    [state.courses, currentRound]
  );

  const roundGroups = useMemo(
    () => state.groups.filter((g) => g.roundId === currentRound?.id),
    [state.groups, currentRound]
  );

  const activeGroup: Group | undefined = useMemo(
    () =>
      roundGroups.find((g) => g.id === activeGroupId) ||
      (!isCreatingGroup ? roundGroups[0] : undefined),
    [roundGroups, activeGroupId, isCreatingGroup]
  );

  // Track which players are already in a group for this round
  const assignedPlayerToGroupMap = useMemo(() => {
    const map: Record<string, string> = {};
    roundGroups.forEach((g) => {
      g.playerIds.forEach((pid) => {
        map[pid] = g.name;
      });
    });
    return map;
  }, [roundGroups]);

  const toggleSelectPlayer = (playerId: string) => {
    setSelectedPlayerIds((prev) => {
      if (prev.includes(playerId)) {
        return prev.filter((id) => id !== playerId);
      }
      if (prev.length >= 4) {
        return prev; // Max 4 players per group
      }
      return [...prev, playerId];
    });
  };

  const handleStartNewGroup = () => {
    if (!currentRound || selectedPlayerIds.length === 0) return;
    const created = createGroup(
      currentRound.id,
      newGroupName || `Group ${roundGroups.length + 1}`,
      selectedPlayerIds,
      scorerName
    );
    setActiveGroupId(created.id);
    setIsCreatingGroup(false);
    setNewGroupName('');
    setScorerName('');
    setSelectedPlayerIds([]);
  };

  if (!currentRound || !currentCourse) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyTitle}>No Round Configured</Text>
      </View>
    );
  }

  const groupPlayers: Player[] = activeGroup
    ? (activeGroup.playerIds
        .map((id) => state.players.find((p) => p.id === id))
        .filter(Boolean) as Player[])
    : [];

  const currentHoleNumber = activeGroup?.currentHole || 1;
  const currentHoleConfig =
    currentCourse.holes.find((h) => h.holeNumber === currentHoleNumber) ||
    currentCourse.holes[0];

  return (
    <View style={styles.container}>
      {/* Top Bar: Round Selector + Group Switcher */}
      <View style={styles.topBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.roundRow}
        >
          {sortedRounds.map((round) => {
            const active = round.id === currentRound.id;
            return (
              <TouchableOpacity
                key={round.id}
                style={[styles.roundChip, active && styles.roundChipActive]}
                onPress={() => {
                  setSelectedRoundId(round.id);
                  const firstGrp = state.groups.find((g) => g.roundId === round.id);
                  setActiveGroupId(firstGrp ? firstGrp.id : null);
                  setIsCreatingGroup(!firstGrp);
                }}
              >
                <Text style={[styles.roundChipText, active && styles.roundChipTextActive]}>
                  R{round.roundNumber}: {round.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.groupSwitchRow}
        >
          {roundGroups.map((grp) => {
            const isSelected = !isCreatingGroup && activeGroup?.id === grp.id;
            return (
              <TouchableOpacity
                key={grp.id}
                style={[styles.groupTab, isSelected && styles.groupTabActive]}
                onPress={() => {
                  setActiveGroupId(grp.id);
                  setIsCreatingGroup(false);
                }}
              >
                <Text style={[styles.groupTabText, isSelected && styles.groupTabTextActive]}>
                  {grp.name} ({grp.playerIds.length}P)
                </Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={[styles.newGroupBtn, isCreatingGroup && styles.newGroupBtnActive]}
            onPress={() => setIsCreatingGroup(true)}
          >
            <Text
              style={[
                styles.newGroupBtnText,
                isCreatingGroup && styles.newGroupBtnTextActive,
              ]}
            >
              + New Group (Pick Players)
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Group Builder Screen OR Active Group Scorer */}
      {isCreatingGroup || !activeGroup ? (
        <ScrollView style={styles.builderScroll} contentContainerStyle={styles.builderContent}>
          <View style={styles.builderCard}>
            <Text style={styles.builderTitle}>Build Your Playing Group (1–4 Players)</Text>
            <Text style={styles.builderSubtitle}>
              {currentRound.name} • {currentCourse.name}
            </Text>

            <View style={styles.inputRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Group Label (Optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder={`Group ${roundGroups.length + 1}`}
                  value={newGroupName}
                  onChangeText={setNewGroupName}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Scorer Name (Optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Your Name"
                  value={scorerName}
                  onChangeText={setScorerName}
                />
              </View>
            </View>

            <View style={styles.rosterHeaderRow}>
              <Text style={styles.inputLabel}>
                Select Who You Are Playing With ({selectedPlayerIds.length}/4 selected)
              </Text>
            </View>

            {state.players.map((player) => {
              const isSelected = selectedPlayerIds.includes(player.id);
              const existingGroupName = assignedPlayerToGroupMap[player.id];
              const roundQuota =
                currentRound.targetQuotas[player.id] ?? player.initialTargetQuota;

              return (
                <TouchableOpacity
                  key={player.id}
                  style={[
                    styles.playerPickRow,
                    isSelected && styles.playerPickRowSelected,
                  ]}
                  onPress={() => toggleSelectPlayer(player.id)}
                >
                  <View
                    style={[
                      styles.avatarCircle,
                      { backgroundColor: player.avatarColor },
                    ]}
                  >
                    <Text style={styles.avatarCircleText}>{player.name.charAt(0)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.playerPickName}>
                      {player.name} ({player.flight} Flight)
                    </Text>
                    <Text style={styles.playerPickMeta}>
                      Today&apos;s Target Quota: {roundQuota} pts
                      {existingGroupName ? ` • In ${existingGroupName}` : ''}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.checkbox,
                      isSelected && styles.checkboxSelected,
                    ]}
                  >
                    <Text style={styles.checkboxText}>{isSelected ? '✓' : '+'}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            <View style={styles.builderActions}>
              {roundGroups.length > 0 && (
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setIsCreatingGroup(false)}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[
                  styles.startScoringBtn,
                  selectedPlayerIds.length === 0 && styles.startScoringBtnDisabled,
                ]}
                disabled={selectedPlayerIds.length === 0}
                onPress={handleStartNewGroup}
              >
                <Text style={styles.startScoringBtnText}>
                  Start Scoring ({selectedPlayerIds.length} Player
                  {selectedPlayerIds.length === 1 ? '' : 's'})
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      ) : (
        <View style={styles.scorerContainer}>
          {/* Mode Switcher Bar: Hole-by-Hole vs Full 18-Hole Post-Round Entry */}
          <View style={styles.scorerHeaderStrip}>
            <View>
              <Text style={styles.courseLabel}>{currentCourse.name}</Text>
              <Text style={styles.groupMetaLabel}>
                {activeGroup.name}
                {activeGroup.scorerName ? ` • Scored by ${activeGroup.scorerName}` : ''}
              </Text>
            </View>
            <View style={styles.viewModeToggle}>
              <TouchableOpacity
                style={[
                  styles.viewModeBtn,
                  viewMode === 'hole' && styles.viewModeBtnActive,
                ]}
                onPress={() => setViewMode('hole')}
              >
                <Text
                  style={[
                    styles.viewModeBtnText,
                    viewMode === 'hole' && styles.viewModeBtnTextActive,
                  ]}
                >
                  Hole-by-Hole
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.viewModeBtn,
                  viewMode === 'grid' && styles.viewModeBtnActive,
                ]}
                onPress={() => setViewMode('grid')}
              >
                <Text
                  style={[
                    styles.viewModeBtnText,
                    viewMode === 'grid' && styles.viewModeBtnTextActive,
                  ]}
                >
                  18-Hole Card
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {viewMode === 'hole' ? (
            <>
              {/* 1–18 Hole Jumper Strip */}
              <View style={styles.holeJumperWrap}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.holeJumperScroll}
                >
                  {currentCourse.holes.map((h) => {
                    const isCurrent = h.holeNumber === currentHoleNumber;
                    const allScored = groupPlayers.every(
                      (p) => (currentRound.scores[p.id]?.[h.holeNumber] || 0) > 0
                    );
                    return (
                      <TouchableOpacity
                        key={h.holeNumber}
                        style={[
                          styles.holeBubble,
                          allScored && styles.holeBubbleScored,
                          isCurrent && styles.holeBubbleCurrent,
                        ]}
                        onPress={() => updateGroupHole(activeGroup.id, h.holeNumber)}
                      >
                        <Text
                          style={[
                            styles.holeBubbleNum,
                            allScored && styles.holeBubbleNumScored,
                            isCurrent && styles.holeBubbleNumCurrent,
                          ]}
                        >
                          {h.holeNumber}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Active Hole Banner */}
              <View style={styles.holeBanner}>
                <TouchableOpacity
                  style={styles.navHoleBtn}
                  onPress={() =>
                    updateGroupHole(activeGroup.id, Math.max(1, currentHoleNumber - 1))
                  }
                  disabled={currentHoleNumber <= 1}
                >
                  <Text
                    style={[
                      styles.navHoleBtnText,
                      currentHoleNumber <= 1 && { opacity: 0.35 },
                    ]}
                  >
                    ‹ Prev
                  </Text>
                </TouchableOpacity>

                <View style={styles.holeBannerCenter}>
                  <Text style={styles.holeBannerTitle}>
                    HOLE {currentHoleConfig.holeNumber}
                  </Text>
                  <View style={styles.holeBannerBadges}>
                    <View style={styles.parBadge}>
                      <Text style={styles.parBadgeText}>PAR {currentHoleConfig.par}</Text>
                    </View>
                    <View style={styles.hcpBadge}>
                      <Text style={styles.hcpBadgeText}>
                        DIFFICULTY RANK #{currentHoleConfig.difficultyRank}
                      </Text>
                    </View>
                    {currentHoleConfig.yardage ? (
                      <View style={styles.ydsBadge}>
                        <Text style={styles.ydsBadgeText}>
                          {currentHoleConfig.yardage} YDS
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.navHoleBtn}
                  onPress={() =>
                    updateGroupHole(activeGroup.id, Math.min(18, currentHoleNumber + 1))
                  }
                  disabled={currentHoleNumber >= 18}
                >
                  <Text
                    style={[
                      styles.navHoleBtnText,
                      currentHoleNumber >= 18 && { opacity: 0.35 },
                    ]}
                  >
                    Next ›
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Player Score Entry Cards for Current Hole */}
              <ScrollView
                style={styles.playersEntryList}
                contentContainerStyle={styles.playersEntryContent}
              >
                {groupPlayers.map((player) => {
                  const strokes =
                    currentRound.scores[player.id]?.[currentHoleConfig.holeNumber];
                  const holeRes = calculateHolePoints(strokes, currentHoleConfig.par);
                  const roundStats = calculatePlayerRoundStats(
                    player,
                    currentRound,
                    currentCourse
                  );

                  // Quick-tap preset buttons centered around Par
                  const quickScores = [
                    {
                      strokes: Math.max(1, currentHoleConfig.par - 2),
                      name: 'Eagle',
                      pts: 8,
                    },
                    {
                      strokes: currentHoleConfig.par - 1,
                      name: 'Birdie',
                      pts: 4,
                    },
                    {
                      strokes: currentHoleConfig.par,
                      name: 'Par',
                      pts: 2,
                    },
                    {
                      strokes: currentHoleConfig.par + 1,
                      name: 'Bogey',
                      pts: 1,
                    },
                    {
                      strokes: currentHoleConfig.par + 2,
                      name: '2x Bogey',
                      pts: 0,
                    },
                  ];

                  return (
                    <View key={player.id} style={styles.playerScoreCard}>
                      <View style={styles.playerCardTop}>
                        <View style={styles.playerCardIdentity}>
                          <View
                            style={[
                              styles.avatarSmall,
                              { backgroundColor: player.avatarColor },
                            ]}
                          >
                            <Text style={styles.avatarSmallText}>
                              {player.name.charAt(0)}
                            </Text>
                          </View>
                          <View>
                            <Text style={styles.playerCardName}>
                              {player.name} • {player.flight} Flight
                            </Text>
                            <Text style={styles.playerCardQuota}>
                              RoundPts: {roundStats.actualPoints} / {roundStats.targetQuota}{' '}
                              Target ({formatSignedScore(roundStats.netQuotaScore)})
                            </Text>
                          </View>
                        </View>

                        {/* Current Hole Points Earned Badge */}
                        <View
                          style={[
                            styles.pointsEarnedPill,
                            strokes && holeRes.points >= 4
                              ? styles.pointsEarnedBirdie
                              : strokes && holeRes.points === 2
                              ? styles.pointsEarnedPar
                              : undefined,
                          ]}
                        >
                          <Text style={styles.pointsEarnedValue}>
                            {strokes ? `+${holeRes.points} PTS` : 'NO SCORE'}
                          </Text>
                          {strokes ? (
                            <Text style={styles.pointsEarnedLabel}>{holeRes.label}</Text>
                          ) : null}
                        </View>
                      </View>

                      {/* Main Stepper + Quick Score Buttons */}
                      <View style={styles.controlsRow}>
                        <View style={styles.stepperBox}>
                          <TouchableOpacity
                            style={styles.stepperBtn}
                            onPress={() => {
                              const nextVal = strokes
                                ? Math.max(1, strokes - 1)
                                : currentHoleConfig.par;
                              setHoleScore(
                                currentRound.id,
                                player.id,
                                currentHoleConfig.holeNumber,
                                nextVal
                              );
                            }}
                          >
                            <Text style={styles.stepperBtnText}>−</Text>
                          </TouchableOpacity>

                          <View style={styles.strokesDisplay}>
                            <Text style={styles.strokesNum}>{strokes || '-'}</Text>
                            <Text style={styles.strokesSub}>STROKES</Text>
                          </View>

                          <TouchableOpacity
                            style={styles.stepperBtn}
                            onPress={() => {
                              const nextVal = strokes
                                ? strokes + 1
                                : currentHoleConfig.par;
                              setHoleScore(
                                currentRound.id,
                                player.id,
                                currentHoleConfig.holeNumber,
                                nextVal
                              );
                            }}
                          >
                            <Text style={styles.stepperBtnText}>+</Text>
                          </TouchableOpacity>
                        </View>

                        {strokes ? (
                          <TouchableOpacity
                            style={styles.clearBtn}
                            onPress={() =>
                              setHoleScore(
                                currentRound.id,
                                player.id,
                                currentHoleConfig.holeNumber,
                                null
                              )
                            }
                          >
                            <Text style={styles.clearBtnText}>Clear</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>

                      {/* One-Tap Quick Score Buttons */}
                      <View style={styles.quickTapRow}>
                        {quickScores.map((q) => {
                          const isSelected = strokes === q.strokes;
                          return (
                            <TouchableOpacity
                              key={q.name}
                              style={[
                                styles.quickTapBtn,
                                isSelected && styles.quickTapBtnSelected,
                              ]}
                              onPress={() =>
                                setHoleScore(
                                  currentRound.id,
                                  player.id,
                                  currentHoleConfig.holeNumber,
                                  q.strokes
                                )
                              }
                            >
                              <Text
                                style={[
                                  styles.quickTapStrokes,
                                  isSelected && styles.quickTapTextSelected,
                                ]}
                              >
                                {q.strokes}
                              </Text>
                              <Text
                                style={[
                                  styles.quickTapLabel,
                                  isSelected && styles.quickTapTextSelected,
                                ]}
                              >
                                {q.name} ({q.pts}p)
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}

                {/* Next Hole CTA at bottom of group */}
                <View style={styles.bottomHoleNav}>
                  {currentHoleNumber < 18 ? (
                    <TouchableOpacity
                      style={styles.nextHoleBigBtn}
                      onPress={() =>
                        updateGroupHole(activeGroup.id, currentHoleNumber + 1)
                      }
                    >
                      <Text style={styles.nextHoleBigBtnText}>
                        Continue to Hole {currentHoleNumber + 1} →
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.nextHoleBigBtn}
                      onPress={() => setViewMode('grid')}
                    >
                      <Text style={styles.nextHoleBigBtnText}>
                        Review Full 18-Hole Scorecard →
                      </Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={styles.removeGroupLink}
                    onPress={() => {
                      deleteGroup(activeGroup.id);
                      setActiveGroupId(null);
                    }}
                  >
                    <Text style={styles.removeGroupLinkText}>
                      Remove Group Card (Scores Remain Saved)
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </>
          ) : (
            /* 18-Hole Full Scorecard Grid View (Great for post-round rapid entry/review) */
            <ScrollView style={styles.gridScroll} contentContainerStyle={{ paddingBottom: 32 }}>
              <View style={styles.gridCard}>
                <Text style={styles.gridHint}>
                  Tap any hole row to jump directly to that hole, or use + / − for fast post-round entry.
                </Text>

                {/* Header Row with Player Initials */}
                <View style={styles.gridHeaderRow}>
                  <Text style={[styles.gridHeaderCell, { width: 66 }]}>Hole / HCP</Text>
                  {groupPlayers.map((p) => (
                    <View key={p.id} style={styles.gridPlayerCol}>
                      <Text style={styles.gridHeaderPlayer} numberOfLines={1}>
                        {p.name.split(' ')[0]}
                      </Text>
                    </View>
                  ))}
                </View>

                {currentCourse.holes.map((hole) => (
                  <View key={hole.holeNumber} style={styles.gridHoleRow}>
                    <TouchableOpacity
                      style={{ width: 66 }}
                      onPress={() => {
                        updateGroupHole(activeGroup.id, hole.holeNumber);
                        setViewMode('hole');
                      }}
                    >
                      <Text style={styles.gridHoleNum}>
                        H{hole.holeNumber} (P{hole.par})
                      </Text>
                      <Text style={styles.gridHoleHcp}>Rank #{hole.difficultyRank}</Text>
                    </TouchableOpacity>

                    {groupPlayers.map((p) => {
                      const st = currentRound.scores[p.id]?.[hole.holeNumber];
                      const res = calculateHolePoints(st, hole.par);
                      return (
                        <View key={p.id} style={styles.gridPlayerCol}>
                          <View style={styles.miniCellStepper}>
                            <TouchableOpacity
                              style={styles.miniStepBtn}
                              onPress={() =>
                                setHoleScore(
                                  currentRound.id,
                                  p.id,
                                  hole.holeNumber,
                                  st ? Math.max(1, st - 1) : hole.par
                                )
                              }
                            >
                              <Text style={styles.miniStepText}>−</Text>
                            </TouchableOpacity>
                            <View style={styles.miniScoreCenter}>
                              <Text style={styles.miniScoreVal}>{st || '-'}</Text>
                              <Text style={styles.miniPtsVal}>
                                {st ? `${res.points}p` : ''}
                              </Text>
                            </View>
                            <TouchableOpacity
                              style={styles.miniStepBtn}
                              onPress={() =>
                                setHoleScore(
                                  currentRound.id,
                                  p.id,
                                  hole.holeNumber,
                                  st ? st + 1 : hole.par
                                )
                              }
                            >
                              <Text style={styles.miniStepText}>+</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ))}

                {/* Totals Footer Row */}
                <View style={styles.gridTotalsRow}>
                  <View style={{ width: 66 }}>
                    <Text style={styles.gridTotalsLabel}>TOTAL</Text>
                    <Text style={styles.gridHoleHcp}>Net vs Tgt</Text>
                  </View>
                  {groupPlayers.map((p) => {
                    const st = calculatePlayerRoundStats(p, currentRound, currentCourse);
                    return (
                      <View key={p.id} style={[styles.gridPlayerCol, { alignItems: 'center' }]}>
                        <Text style={styles.gridTotalPts}>
                          {st.actualPoints} / {st.targetQuota}p
                        </Text>
                        <Text
                          style={[
                            styles.gridTotalNet,
                            st.netQuotaScore > 0
                              ? { color: '#15803D' }
                              : st.netQuotaScore < 0
                              ? { color: '#B91C1C' }
                              : undefined,
                          ]}
                        >
                          {formatSignedScore(st.netQuotaScore)} ({st.grossStrokes || '-'})
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#475569',
  },
  topBar: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 8,
  },
  roundRow: {
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 8,
  },
  roundChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
  },
  roundChipActive: {
    backgroundColor: '#064E3B',
  },
  roundChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  roundChipTextActive: {
    color: '#FFFFFF',
  },
  groupSwitchRow: {
    paddingHorizontal: 12,
    gap: 8,
  },
  groupTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    marginRight: 8,
  },
  groupTabActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#059669',
  },
  groupTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  groupTabTextActive: {
    color: '#065F46',
    fontWeight: '700',
  },
  newGroupBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  newGroupBtnActive: {
    backgroundColor: '#166534',
    borderColor: '#166534',
  },
  newGroupBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  newGroupBtnTextActive: {
    color: '#FFFFFF',
  },
  builderScroll: {
    flex: 1,
  },
  builderContent: {
    padding: 14,
  },
  builderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  builderTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  builderSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 14,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    backgroundColor: '#F8FAFC',
  },
  rosterHeaderRow: {
    marginBottom: 6,
  },
  playerPickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  playerPickRowSelected: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  avatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarCircleText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  playerPickName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  playerPickMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#059669',
  },
  checkboxText: {
    fontWeight: '800',
    color: '#0F172A',
  },
  builderActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontWeight: '700',
    color: '#475569',
  },
  startScoringBtn: {
    flex: 1,
    backgroundColor: '#059669',
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
  },
  startScoringBtnDisabled: {
    opacity: 0.45,
  },
  startScoringBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  scorerContainer: {
    flex: 1,
  },
  scorerHeaderStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  courseLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  groupMetaLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  viewModeToggle: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 2,
  },
  viewModeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  viewModeBtnActive: {
    backgroundColor: '#FFFFFF',
  },
  viewModeBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  viewModeBtnTextActive: {
    color: '#0F172A',
    fontWeight: '700',
  },
  holeJumperWrap: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  holeJumperScroll: {
    paddingHorizontal: 12,
    gap: 6,
  },
  holeBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  holeBubbleScored: {
    backgroundColor: '#DCFCE7',
  },
  holeBubbleCurrent: {
    backgroundColor: '#064E3B',
  },
  holeBubbleNum: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  holeBubbleNumScored: {
    color: '#166534',
  },
  holeBubbleNumCurrent: {
    color: '#FFFFFF',
  },
  holeBanner: {
    backgroundColor: '#064E3B',
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navHoleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 8,
  },
  navHoleBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  holeBannerCenter: {
    alignItems: 'center',
  },
  holeBannerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  holeBannerBadges: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  parBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  parBadgeText: {
    color: '#052E16',
    fontSize: 11,
    fontWeight: '800',
  },
  hcpBadge: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  hcpBadgeText: {
    color: '#ECFDF5',
    fontSize: 11,
    fontWeight: '700',
  },
  ydsBadge: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  ydsBadgeText: {
    color: '#A7F3D0',
    fontSize: 11,
    fontWeight: '600',
  },
  playersEntryList: {
    flex: 1,
  },
  playersEntryContent: {
    padding: 12,
    paddingBottom: 28,
  },
  playerScoreCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  playerCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  playerCardIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarSmall: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarSmallText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  playerCardName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  playerCardQuota: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  pointsEarnedPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignItems: 'flex-end',
  },
  pointsEarnedBirdie: {
    backgroundColor: '#DCFCE7',
  },
  pointsEarnedPar: {
    backgroundColor: '#E0F2FE',
  },
  pointsEarnedValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  pointsEarnedLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  stepperBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 4,
    flex: 1,
    justifyContent: 'space-between',
  },
  stepperBtn: {
    width: 48,
    height: 44,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
  },
  strokesDisplay: {
    alignItems: 'center',
  },
  strokesNum: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
  },
  strokesSub: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
  },
  clearBtn: {
    marginLeft: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  clearBtnText: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '600',
  },
  quickTapRow: {
    flexDirection: 'row',
    gap: 6,
  },
  quickTapBtn: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: 'center',
  },
  quickTapBtnSelected: {
    backgroundColor: '#065F46',
    borderColor: '#065F46',
  },
  quickTapStrokes: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  quickTapLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 1,
  },
  quickTapTextSelected: {
    color: '#FFFFFF',
  },
  bottomHoleNav: {
    marginTop: 6,
    alignItems: 'center',
  },
  nextHoleBigBtn: {
    width: '100%',
    backgroundColor: '#064E3B',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  nextHoleBigBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  removeGroupLink: {
    marginTop: 14,
    paddingVertical: 6,
  },
  removeGroupLinkText: {
    fontSize: 12,
    color: '#64748B',
    textDecorationLine: 'underline',
  },
  gridScroll: {
    flex: 1,
    padding: 12,
  },
  gridCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  gridHint: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 10,
  },
  gridHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
    paddingBottom: 8,
    alignItems: 'center',
  },
  gridHeaderCell: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
  },
  gridPlayerCol: {
    flex: 1,
    paddingHorizontal: 3,
  },
  gridHeaderPlayer: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  gridHoleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  gridHoleNum: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  gridHoleHcp: {
    fontSize: 10,
    color: '#64748B',
  },
  miniCellStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 2,
    paddingVertical: 3,
  },
  miniStepBtn: {
    width: 20,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniStepText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#475569',
  },
  miniScoreCenter: {
    alignItems: 'center',
  },
  miniScoreVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  miniPtsVal: {
    fontSize: 9,
    fontWeight: '700',
    color: '#059669',
  },
  gridTotalsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    marginTop: 4,
    borderTopWidth: 2,
    borderTopColor: '#CBD5E1',
  },
  gridTotalsLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  gridTotalPts: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  gridTotalNet: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
});
