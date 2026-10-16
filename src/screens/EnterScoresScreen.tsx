import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTournament } from '../context/TournamentContext';
import { Player } from '../types/tournament';
import { calculateHolePoints, calculatePlayerRoundStats, formatSignedScore } from '../utils/scoring';

interface EnterScoresScreenProps {
  onOpenStandings: () => void;
  onOpenAdmin: () => void;
}

export const EnterScoresScreen: React.FC<EnterScoresScreenProps> = ({
  onOpenStandings,
  onOpenAdmin,
}) => {
  const {
    state,
    setHoleScore,
    createGroup,
    updateGroupHole,
    syncStatus,
    pendingSyncCount,
    manualSync,
  } = useTournament();

  const activeRound = useMemo(
    () => state.rounds.find((r) => r.status === 'active') || state.rounds[0],
    [state.rounds]
  );

  const activeCourse = useMemo(
    () => state.courses.find((c) => c.id === activeRound?.courseId),
    [state.courses, activeRound]
  );

  // Find or select group
  const roundGroups = useMemo(
    () => state.groups.filter((g) => g.roundId === activeRound?.id),
    [state.groups, activeRound]
  );

  const [activeGroupId, setActiveGroupId] = useState<string | null>(() => {
    return roundGroups[0]?.id || null;
  });

  const [isPickingCart, setIsPickingCart] = useState<boolean>(() => roundGroups.length === 0);
  const [cartName, setCartName] = useState<string>('Cart 1');
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);

  // Draft scores keyed by `${playerId}_${holeNumber}`
  const [draftScores, setDraftScores] = useState<Record<string, number>>({});

  const activeGroup = useMemo(
    () => roundGroups.find((g) => g.id === activeGroupId) || roundGroups[0],
    [roundGroups, activeGroupId]
  );

  const groupPlayers: Player[] = useMemo(() => {
    if (!activeGroup) return [];
    return activeGroup.playerIds
      .map((id) => state.players.find((p) => p.id === id))
      .filter(Boolean) as Player[];
  }, [activeGroup, state.players]);

  const currentHoleNum = activeGroup?.currentHole || 1;
  const currentHoleConfig =
    activeCourse?.holes.find((h) => h.holeNumber === currentHoleNum) ||
    activeCourse?.holes[0];

  const handleCreateCart = () => {
    if (!activeRound || selectedPlayerIds.length === 0) return;
    const created = createGroup(
      activeRound.id,
      cartName || `Cart ${roundGroups.length + 1}`,
      selectedPlayerIds
    );
    setActiveGroupId(created.id);
    setIsPickingCart(false);
    setSelectedPlayerIds([]);
  };

  const togglePickPlayer = (id: string) => {
    setSelectedPlayerIds((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  };

  /**
   * Helper to resolve the player's current stroke value for the hole:
   * 1. If user modified locally in draft -> use draft
   * 2. If committed score exists in round -> use committed score
   * 3. Otherwise -> DEFAULT TO DOUBLE BOGEY (par + 2 = 0 points)!
   */
  const getPlayerStrokes = (playerId: string, holeNumber: number, par: number): number => {
    const key = `${playerId}_${holeNumber}`;
    if (draftScores[key] !== undefined) {
      return draftScores[key];
    }
    const committed = activeRound?.scores[playerId]?.[holeNumber];
    if (committed !== undefined) {
      return committed;
    }
    // Default to Double Bogey (par + 2 = 0 points)
    return par + 2;
  };

  /**
   * Check whether a player's score is committed / locked in.
   * If the user changed the draft score after committing, it reverts to pending commit.
   */
  const isPlayerLocked = (playerId: string, holeNumber: number): boolean => {
    const committed = activeRound?.scores[playerId]?.[holeNumber];
    if (committed === undefined) return false;
    const key = `${playerId}_${holeNumber}`;
    if (draftScores[key] !== undefined && draftScores[key] !== committed) {
      return false;
    }
    return true;
  };

  const handleDraftChange = (playerId: string, holeNumber: number, newStrokes: number) => {
    const key = `${playerId}_${holeNumber}`;
    setDraftScores((prev) => ({
      ...prev,
      [key]: Math.max(1, newStrokes),
    }));
  };

  const handleLockInPlayer = (playerId: string, holeNumber: number, strokes: number) => {
    if (!activeRound) return;
    setHoleScore(activeRound.id, playerId, holeNumber, strokes);
    const key = `${playerId}_${holeNumber}`;
    setDraftScores((prev) => ({
      ...prev,
      [key]: strokes,
    }));
  };

  const handleUnlockPlayer = (playerId: string, holeNumber: number) => {
    const key = `${playerId}_${holeNumber}`;
    const committed = activeRound?.scores[playerId]?.[holeNumber];
    setDraftScores((prev) => ({
      ...prev,
      [key]: committed ?? ((currentHoleConfig?.par || 4) + 2),
    }));
  };

  const allCartPlayersLocked = useMemo(() => {
    if (groupPlayers.length === 0) return false;
    return groupPlayers.every((p) => isPlayerLocked(p.id, currentHoleNum));
  }, [groupPlayers, currentHoleNum, activeRound?.scores, draftScores]);

  const handleCommitAllAndAdvance = () => {
    if (!activeRound) return;
    const par = currentHoleConfig?.par || 4;
    groupPlayers.forEach((p) => {
      const strokes = getPlayerStrokes(p.id, currentHoleNum, par);
      setHoleScore(activeRound.id, p.id, currentHoleNum, strokes);
      const key = `${p.id}_${currentHoleNum}`;
      setDraftScores((prev) => ({ ...prev, [key]: strokes }));
    });

    if (currentHoleNum < 18) {
      updateGroupHole(activeGroup.id, currentHoleNum + 1);
    } else {
      onOpenStandings();
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Banner */}
      <View style={styles.topHeader}>
        <View style={styles.headerInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.eventTitle}>{activeRound?.name || 'Current Round'}</Text>
            <TouchableOpacity
              style={[
                styles.syncBadge,
                syncStatus === 'synced'
                  ? styles.syncBadgeSynced
                  : syncStatus === 'syncing'
                  ? styles.syncBadgeSyncing
                  : styles.syncBadgeOffline,
              ]}
              onPress={manualSync}
              activeOpacity={0.7}
            >
              <Text style={styles.syncBadgeText}>
                {syncStatus === 'synced'
                  ? '● Synced'
                  : syncStatus === 'syncing'
                  ? '🔄 Syncing...'
                  : syncStatus === 'offline'
                  ? `● Offline (${pendingSyncCount})`
                  : `● Pending (${pendingSyncCount})`}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.courseSubtitle}>
            {activeCourse?.name || 'Golf Course'}
          </Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity style={styles.standingsNavBtn} onPress={onOpenStandings}>
            <Text style={styles.standingsNavBtnText}>🏆 Standings</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.adminGearBtn} onPress={onOpenAdmin}>
            <Text style={styles.adminGearText}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Cart Picker View vs Active Hole Scorer */}
      {isPickingCart || !activeGroup ? (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.cartPickerContent}>
          <View style={styles.cartCard}>
            <Text style={styles.cartCardTitle}>Who Is In Your Cart?</Text>
            <Text style={styles.cartCardSubtitle}>
              Select 1 to 4 players you are scoring today.
            </Text>

            {/* List of Players with Big Checkboxes */}
            <View style={styles.rosterList}>
              {state.players.map((player) => {
                const isSelected = selectedPlayerIds.includes(player.id);
                return (
                  <TouchableOpacity
                    key={player.id}
                    style={[
                      styles.playerCheckRow,
                      isSelected && styles.playerCheckRowSelected,
                    ]}
                    onPress={() => togglePickPlayer(player.id)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.bigCheckbox,
                        isSelected && styles.bigCheckboxSelected,
                      ]}
                    >
                      <Text style={styles.bigCheckboxCheck}>
                        {isSelected ? '✓' : ''}
                      </Text>
                    </View>

                    <View style={{ flex: 1, paddingLeft: 12 }}>
                      <Text style={styles.playerPickName}>{player.name}</Text>
                      <Text style={styles.playerPickSub}>
                        {player.flight}-Group • Target Quota: {player.initialTargetQuota} pts
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Big Action Button */}
            <TouchableOpacity
              style={[
                styles.startPlayingBtn,
                selectedPlayerIds.length === 0 && { opacity: 0.4 },
              ]}
              disabled={selectedPlayerIds.length === 0}
              onPress={handleCreateCart}
            >
              <Text style={styles.startPlayingBtnText}>
                {selectedPlayerIds.length === 0
                  ? 'Select Players to Start'
                  : `Start Scoring (${selectedPlayerIds.length} Players)`}
              </Text>
            </TouchableOpacity>

            {roundGroups.length > 0 && (
              <TouchableOpacity
                style={styles.cancelCartBtn}
                onPress={() => setIsPickingCart(false)}
              >
                <Text style={styles.cancelCartBtnText}>
                  Back to {roundGroups[0].name}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      ) : (
        <View style={styles.scorerView}>
          {/* Active Cart & Hole Header */}
          <View style={styles.holeHeaderStrip}>
            <View style={styles.holeHeaderLeft}>
              <Text style={styles.holeBigTitle}>
                HOLE {currentHoleConfig?.holeNumber}
              </Text>
              <Text style={styles.holeMetaText}>
                PAR {currentHoleConfig?.par} • DIFFICULTY RANK #{currentHoleConfig?.difficultyRank}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.switchCartBtn}
              onPress={() => setIsPickingCart(true)}
            >
              <Text style={styles.switchCartBtnText}>+ Switch Cart</Text>
            </TouchableOpacity>
          </View>

          {/* Quick Hole Jumper Pills (1 to 18) with completion indicator */}
          <View style={styles.jumperBar}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 12, gap: 6 }}
            >
              {activeCourse?.holes.map((h) => {
                const isCurrent = h.holeNumber === currentHoleNum;
                const isHoleDone =
                  groupPlayers.length > 0 &&
                  groupPlayers.every((p) => activeRound.scores[p.id]?.[h.holeNumber] !== undefined);

                return (
                  <TouchableOpacity
                    key={h.holeNumber}
                    style={[
                      styles.jumperPill,
                      isHoleDone && styles.jumperPillDone,
                      isCurrent && styles.jumperPillActive,
                    ]}
                    onPress={() => updateGroupHole(activeGroup.id, h.holeNumber)}
                  >
                    <Text
                      style={[
                        styles.jumperPillText,
                        isHoleDone && styles.jumperPillTextDone,
                        isCurrent && styles.jumperPillTextActive,
                      ]}
                    >
                      {h.holeNumber}
                    </Text>
                    {isHoleDone && !isCurrent && (
                      <View style={styles.jumperDoneDot} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Score Entry Cards for Cart Players */}
          <ScrollView
            style={styles.playerEntryList}
            contentContainerStyle={styles.playerEntryContent}
          >
            {groupPlayers.map((player) => {
              const par = currentHoleConfig?.par || 4;
              const strokes = getPlayerStrokes(player.id, currentHoleNum, par);
              const isLocked = isPlayerLocked(player.id, currentHoleNum);
              const holeResult = calculateHolePoints(strokes, par);
              const roundStats = calculatePlayerRoundStats(
                player,
                activeRound,
                activeCourse
              );
              const hasScoredPoints = holeResult.points > 0;

              return (
                <View
                  key={player.id}
                  style={[
                    styles.playerHoleCard,
                    isLocked && styles.playerHoleCardLocked,
                    !isLocked && hasScoredPoints && styles.playerHoleCardPointsPending,
                  ]}
                >
                  {/* Player Name & Points Status */}
                  <View style={styles.playerCardTopRow}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.cardPlayerName}>{player.name}</Text>
                        <View
                          style={[
                            styles.flightTag,
                            player.flight === 'A' ? styles.flightTagA : styles.flightTagB,
                          ]}
                        >
                          <Text style={styles.flightTagText}>{player.flight}</Text>
                        </View>
                      </View>
                      <Text style={styles.cardPlayerTarget}>
                        Today: {roundStats.actualPoints} / {roundStats.targetQuota} pts ({formatSignedScore(roundStats.netQuotaScore)})
                      </Text>
                    </View>

                    {/* Commit Status Badge */}
                    <View
                      style={[
                        styles.statusBadge,
                        isLocked
                          ? (hasScoredPoints ? styles.statusBadgeLockedPoints : styles.statusBadgeLockedDefault)
                          : (hasScoredPoints ? styles.statusBadgeDraftPoints : styles.statusBadgeDraftDefault),
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          isLocked
                            ? (hasScoredPoints ? styles.statusBadgeTextLockedPoints : styles.statusBadgeTextLockedDefault)
                            : (hasScoredPoints ? styles.statusBadgeTextDraftPoints : styles.statusBadgeTextDraftDefault),
                        ]}
                      >
                        {isLocked
                          ? (hasScoredPoints ? `✅ +${holeResult.points} PTS (${holeResult.label})` : '✅ 0 PTS (2x BOGEY)')
                          : (hasScoredPoints ? `⭐ +${holeResult.points} PTS (${holeResult.label})` : '0 PTS (2x BOGEY)')}
                      </Text>
                      <Text style={styles.statusBadgeSub}>
                        {isLocked
                          ? 'Locked In'
                          : hasScoredPoints
                          ? 'Points scored! Lock in below'
                          : 'Default • Tap below if scored'}
                      </Text>
                    </View>
                  </View>

                  {/* Big Touch-Friendly Stepper Buttons */}
                  <View style={styles.stepperRow}>
                    <TouchableOpacity
                      style={styles.stepperBigBtn}
                      onPress={() => handleDraftChange(player.id, currentHoleNum, strokes - 1)}
                    >
                      <Text style={styles.stepperBigBtnText}>−</Text>
                    </TouchableOpacity>

                    <View style={styles.stepperValueBox}>
                      <Text style={styles.stepperNumber}>{strokes}</Text>
                      <Text style={styles.stepperLabel}>
                        {strokes >= par + 2
                          ? 'DOUBLE BOGEY+ (0 PTS)'
                          : `${holeResult.label.toUpperCase()} (+${holeResult.points} PTS)`}
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={styles.stepperBigBtn}
                      onPress={() => handleDraftChange(player.id, currentHoleNum, strokes + 1)}
                    >
                      <Text style={styles.stepperBigBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Quick Points Buttons: Eagle, Birdie, Par, Bogey, and 2x Bogey (Default) */}
                  <View style={styles.quickScoreRow}>
                    {[
                      { label: 'Eagle', pts: 8, val: par - 2 },
                      { label: 'Birdie', pts: 4, val: par - 1 },
                      { label: 'Par', pts: 2, val: par },
                      { label: 'Bogey', pts: 1, val: par + 1 },
                      { label: '2x Bogey', pts: 0, val: par + 2 },
                    ].map((q) => {
                      const isSelected = strokes === q.val;
                      return (
                        <TouchableOpacity
                          key={q.label}
                          style={[
                            styles.quickScorePill,
                            isSelected &&
                              (q.pts > 0
                                ? styles.quickScorePillSelectedPoints
                                : styles.quickScorePillSelectedDefault),
                          ]}
                          onPress={() => handleDraftChange(player.id, currentHoleNum, q.val)}
                        >
                          <Text
                            style={[
                              styles.quickScorePillText,
                              isSelected && styles.quickScorePillTextSelected,
                            ]}
                          >
                            {q.label}
                          </Text>
                          <Text
                            style={[
                              styles.quickScorePillSub,
                              isSelected && styles.quickScorePillSubSelected,
                            ]}
                          >
                            {q.pts > 0 ? `+${q.pts}p` : '0p'}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Lock In / Commit Action for this player */}
                  <View style={styles.playerCardActionArea}>
                    {!isLocked ? (
                      <TouchableOpacity
                        style={[
                          styles.lockInBtn,
                          hasScoredPoints ? styles.lockInBtnPoints : styles.lockInBtnDefault,
                        ]}
                        onPress={() => handleLockInPlayer(player.id, currentHoleNum, strokes)}
                      >
                        <Text style={styles.lockInBtnText}>
                          {hasScoredPoints
                            ? `🔒 Lock In ${player.name.split(' ')[0]}'s +${holeResult.points} PTS (${holeResult.label})`
                            : `🔒 Lock In ${player.name.split(' ')[0]} as 0 PTS (Double Bogey)`}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.lockedRow}>
                        <View style={styles.lockedLabelGroup}>
                          <Text style={styles.lockedCheckmark}>✓</Text>
                          <Text style={styles.lockedText}>
                            {hasScoredPoints
                              ? `Locked: +${holeResult.points} PTS (${holeResult.label} • ${strokes} strokes)`
                              : `Locked: 0 PTS (Double Bogey • ${strokes} strokes)`}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.unlockBtn}
                          onPress={() => handleUnlockPlayer(player.id, currentHoleNum)}
                        >
                          <Text style={styles.unlockBtnText}>Edit</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}

            {/* Bottom Nav / Commit All Action Button */}
            <View style={styles.bottomNavRow}>
              <TouchableOpacity
                style={[
                  styles.nextHoleActionBtn,
                  !allCartPlayersLocked && styles.nextHoleActionBtnCommit,
                ]}
                onPress={() => {
                  if (!allCartPlayersLocked) {
                    handleCommitAllAndAdvance();
                  } else {
                    if (currentHoleNum < 18) {
                      updateGroupHole(activeGroup.id, currentHoleNum + 1);
                    } else {
                      onOpenStandings();
                    }
                  }
                }}
              >
                <Text style={styles.nextHoleActionBtnText}>
                  {!allCartPlayersLocked
                    ? currentHoleNum < 18
                      ? `🔒 Commit Hole ${currentHoleNum} & Go to Hole ${currentHoleNum + 1} ›`
                      : `🔒 Commit Hole 18 & Finish Round 🏆`
                    : currentHoleNum < 18
                    ? `Continue to Hole ${currentHoleNum + 1} ›`
                    : `Round Complete! View Final Standings 🏆`}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
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
  topHeader: {
    backgroundColor: '#064E3B',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerInfo: {
    flex: 1,
  },
  eventTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  syncBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  syncBadgeSynced: {
    backgroundColor: '#065F46',
  },
  syncBadgeSyncing: {
    backgroundColor: '#0284C7',
  },
  syncBadgeOffline: {
    backgroundColor: '#854D0E',
  },
  syncBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  courseSubtitle: {
    color: '#A7F3D0',
    fontSize: 12,
    marginTop: 2,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  standingsNavBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  standingsNavBtnText: {
    color: '#052E16',
    fontWeight: '800',
    fontSize: 12,
  },
  adminGearBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  adminGearText: {
    fontSize: 16,
  },
  scroll: {
    flex: 1,
  },
  cartPickerContent: {
    padding: 14,
  },
  cartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  cartCardTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
  },
  cartCardSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    marginBottom: 14,
  },
  rosterList: {
    marginBottom: 16,
  },
  playerCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    borderRadius: 8,
  },
  playerCheckRowSelected: {
    backgroundColor: '#ECFDF5',
  },
  bigCheckbox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigCheckboxSelected: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  bigCheckboxCheck: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 16,
  },
  playerPickName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  playerPickSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  startPlayingBtn: {
    backgroundColor: '#064E3B',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  startPlayingBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 16,
  },
  cancelCartBtn: {
    marginTop: 12,
    alignItems: 'center',
    paddingVertical: 8,
  },
  cancelCartBtnText: {
    color: '#64748B',
    fontWeight: '700',
    fontSize: 13,
  },
  scorerView: {
    flex: 1,
  },
  holeHeaderStrip: {
    backgroundColor: '#064E3B',
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  holeHeaderLeft: {},
  holeBigTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  holeMetaText: {
    color: '#A7F3D0',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  switchCartBtn: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  switchCartBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  jumperBar: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  jumperPill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  jumperPillDone: {
    backgroundColor: '#E2E8F0',
  },
  jumperPillActive: {
    backgroundColor: '#064E3B',
  },
  jumperPillText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
  },
  jumperPillTextDone: {
    color: '#0F172A',
  },
  jumperPillTextActive: {
    color: '#FFFFFF',
  },
  jumperDoneDot: {
    position: 'absolute',
    bottom: 3,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#059669',
  },
  playerEntryList: {
    flex: 1,
  },
  playerEntryContent: {
    padding: 12,
    paddingBottom: 90,
  },
  playerHoleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  playerHoleCardLocked: {
    borderColor: '#86EFAC',
    backgroundColor: '#F0FDF4',
  },
  playerHoleCardPointsPending: {
    borderColor: '#FCD34D',
    backgroundColor: '#FFFBEB',
  },
  playerCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardPlayerName: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
  },
  flightTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  flightTagA: {
    backgroundColor: '#DBEAFE',
  },
  flightTagB: {
    backgroundColor: '#FEF3C7',
  },
  flightTagText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#1E293B',
  },
  cardPlayerTarget: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    alignItems: 'flex-end',
  },
  statusBadgeDraftDefault: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusBadgeDraftPoints: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  statusBadgeLockedDefault: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  statusBadgeLockedPoints: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '900',
  },
  statusBadgeTextDraftDefault: {
    color: '#64748B',
  },
  statusBadgeTextDraftPoints: {
    color: '#B45309',
  },
  statusBadgeTextLockedDefault: {
    color: '#475569',
  },
  statusBadgeTextLockedPoints: {
    color: '#15803D',
  },
  statusBadgeSub: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 1,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  stepperBigBtn: {
    width: 60,
    height: 52,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  stepperBigBtnText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
  },
  stepperValueBox: {
    alignItems: 'center',
  },
  stepperNumber: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0F172A',
  },
  stepperLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    marginTop: 1,
  },
  quickScoreRow: {
    flexDirection: 'row',
    gap: 5,
    marginBottom: 10,
  },
  quickScorePill: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickScorePillSelectedDefault: {
    backgroundColor: '#475569',
  },
  quickScorePillSelectedPoints: {
    backgroundColor: '#064E3B',
  },
  quickScorePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
  },
  quickScorePillSub: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 1,
  },
  quickScorePillTextSelected: {
    color: '#FFFFFF',
  },
  quickScorePillSubSelected: {
    color: '#A7F3D0',
  },
  playerCardActionArea: {
    marginTop: 4,
  },
  lockInBtn: {
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  lockInBtnDefault: {
    backgroundColor: '#334155',
  },
  lockInBtnPoints: {
    backgroundColor: '#064E3B',
  },
  lockInBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  lockedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  lockedLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lockedCheckmark: {
    color: '#15803D',
    fontWeight: '900',
    fontSize: 14,
  },
  lockedText: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 12,
  },
  unlockBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#94A3B8',
  },
  unlockBtnText: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '700',
  },
  bottomNavRow: {
    marginTop: 8,
    marginBottom: 20,
  },
  nextHoleActionBtn: {
    backgroundColor: '#064E3B',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  nextHoleActionBtnCommit: {
    backgroundColor: '#047857',
  },
  nextHoleActionBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 16,
  },
});
