import React, { useMemo, useState, useEffect } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTournament } from '../context/TournamentContext';
import { CtpEntry, Player } from '../types/tournament';
import { calculateHolePoints, calculatePlayerRoundStats, formatSignedScore } from '../utils/scoring';

interface EnterScoresScreenProps {
  onOpenStandings: () => void;
  onOpenAdmin: () => void;
  onBackToMenu?: () => void;
  onCartPickingChange?: (isPicking: boolean) => void;
}

export const EnterScoresScreen: React.FC<EnterScoresScreenProps> = ({
  onOpenStandings,
  onOpenAdmin,
  onBackToMenu,
  onCartPickingChange,
}) => {
  const {
    state,
    setHoleScore,
    setCtpDistance,
    createGroup,
    updateGroupHole,
    advanceRound,
    syncStatus,
    pendingSyncCount,
    manualSync,
  } = useTournament();

  // Par 3 Closest to the Pin (CTP) Modal State
  const [ctpModalPlayer, setCtpModalPlayer] = useState<Player | null>(null);
  const [ctpFeet, setCtpFeet] = useState<number>(10);
  const [ctpInches, setCtpInches] = useState<number>(0);

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

  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [lockedCartId, setLockedCartId] = useState<string | null>(null);
  const [isPickingCart, setIsPickingCart] = useState<boolean>(true);
  const [cartName, setCartName] = useState<string>('Cart 1');
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [customCartBuilderOpen, setCustomCartBuilderOpen] = useState<boolean>(false);
  const [showSwitchModal, setShowSwitchModal] = useState<boolean>(false);
  const [switchPinInput, setSwitchPinInput] = useState<string>('');
  const [switchPinError, setSwitchPinError] = useState<string>('');

  // Draft scores keyed by `${playerId}_${holeNumber}`
  const [draftScores, setDraftScores] = useState<Record<string, number>>({});

  // Restore locked cart from AsyncStorage per round
  useEffect(() => {
    if (!activeRound) return;
    const key = `@dbt_locked_cart_${activeRound.id}`;
    AsyncStorage.getItem(key).then((storedCartId) => {
      if (storedCartId && roundGroups.some((g) => g.id === storedCartId)) {
        setActiveGroupId(storedCartId);
        setLockedCartId(storedCartId);
        setIsPickingCart(false);
      } else if (roundGroups.length > 0 && !activeGroupId) {
        // If device has no locked cart yet, show the cart selector
        setIsPickingCart(true);
      }
    });
  }, [activeRound?.id, roundGroups]);

  const activeGroup = useMemo(
    () => roundGroups.find((g) => g.id === activeGroupId) || roundGroups[0],
    [roundGroups, activeGroupId]
  );

  useEffect(() => {
    onCartPickingChange?.(isPickingCart || !activeGroup);
  }, [isPickingCart, activeGroup, onCartPickingChange]);

  const groupPlayers: Player[] = useMemo(() => {
    if (!activeGroup) return [];
    return activeGroup.playerIds
      .map((id) => state.players.find((p) => p.id === id))
      .filter(Boolean) as Player[];
  }, [activeGroup, state.players]);

  const attendingPlayers = useMemo(
    () => state.players.filter((p) => p.isActive !== false),
    [state.players]
  );

  const isRound18HolesComplete = useMemo(() => {
    if (attendingPlayers.length === 0 || !activeRound) return false;
    return attendingPlayers.every((p) => {
      const scores = activeRound.scores[p.id];
      if (!scores) return false;
      for (let h = 1; h <= 18; h++) {
        if (scores[h] === undefined) return false;
      }
      return true;
    });
  }, [attendingPlayers, activeRound]);

  const currentHoleNum = activeGroup?.currentHole || 1;
  const currentHoleConfig =
    activeCourse?.holes.find((h) => h.holeNumber === currentHoleNum) ||
    activeCourse?.holes[0];

  const handleSelectPreSetCart = async (groupId: string) => {
    setActiveGroupId(groupId);
    setLockedCartId(groupId);
    setIsPickingCart(false);
    if (activeRound) {
      await AsyncStorage.setItem(`@dbt_locked_cart_${activeRound.id}`, groupId);
    }
  };

  const handleUnlockAndSwitchCart = async () => {
    setShowSwitchModal(false);
    setSwitchPinInput('');
    setSwitchPinError('');
    setLockedCartId(null);
    setIsPickingCart(true);
    if (activeRound) {
      await AsyncStorage.removeItem(`@dbt_locked_cart_${activeRound.id}`);
    }
  };

  const handleCreateCart = async () => {
    if (!activeRound || selectedPlayerIds.length === 0) return;
    const created = createGroup(
      activeRound.id,
      cartName || `Cart ${roundGroups.length + 1}`,
      selectedPlayerIds
    );
    setActiveGroupId(created.id);
    setLockedCartId(created.id);
    setIsPickingCart(false);
    setCustomCartBuilderOpen(false);
    setSelectedPlayerIds([]);
    await AsyncStorage.setItem(`@dbt_locked_cart_${activeRound.id}`, created.id);
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
          <Text style={styles.eventTitle} numberOfLines={1}>
            {activeRound?.name || 'Current Round'}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 }}>
            <Text style={styles.courseSubtitle}>
              {activeCourse?.name || 'Golf Course'}
            </Text>
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
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity style={styles.adminGearBtn} onPress={onOpenAdmin}>
            <Text style={styles.adminGearText}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Cart Picker View vs Active Hole Scorer */}
      {isPickingCart || !activeGroup ? (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.cartPickerContent}>
          <View style={styles.preRoundSetupHeader}>
            {onBackToMenu && (
              <TouchableOpacity
                style={styles.backToMenuBtn}
                onPress={onBackToMenu}
                activeOpacity={0.75}
              >
                <Text style={styles.backToMenuBtnText}>‹ Back to Start Menu</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.preRoundSetupTitle}>Select Your Cart</Text>
            <Text style={styles.preRoundSetupSubtitle}>
              {activeRound?.name} • Choose your foursome to lock this device into scoring.
            </Text>
          </View>

          {/* List of Pre-Set Carts */}
          {roundGroups.map((group) => {
            const players = group.playerIds
              .map((id) => state.players.find((p) => p.id === id))
              .filter(Boolean) as Player[];

            return (
              <View key={group.id} style={styles.cartSelectCard}>
                <View style={styles.cartSelectCardTop}>
                  <Text style={styles.cartSelectCardTitle}>{group.name}</Text>
                  <Text style={styles.cartSelectCardMeta}>
                    {players.length}/4 Players • Starting Hole {group.currentHole || 1}
                  </Text>
                </View>

                <View style={styles.cartSelectPlayersList}>
                  {players.map((p) => (
                    <View key={p.id} style={styles.cartSelectPlayerItem}>
                      <View
                        style={[
                          styles.cartSelectAvatar,
                          { backgroundColor: p.avatarColor || '#059669' },
                        ]}
                      >
                        <Text style={styles.cartSelectAvatarText}>
                          {p.name.slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cartSelectPlayerName}>{p.name}</Text>
                        <Text style={styles.cartSelectPlayerSub}>
                          {p.flight}-Flight • Target: {activeRound?.targetQuotas?.[p.id] ?? p.initialTargetQuota} pts
                        </Text>
                      </View>
                    </View>
                  ))}
                  {players.length === 0 && (
                    <Text style={styles.emptyCartHint}>No players in this cart yet.</Text>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.lockIntoCartBtn}
                  onPress={() => handleSelectPreSetCart(group.id)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.lockIntoCartBtnText}>
                    🔒 Lock Device & Score {group.name}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}

          {/* Custom Cart Toggle / Builder */}
          {!customCartBuilderOpen ? (
            <TouchableOpacity
              style={styles.openCustomBuilderBtn}
              onPress={() => setCustomCartBuilderOpen(true)}
            >
              <Text style={styles.openCustomBuilderBtnText}>
                + Build Custom Cart (Pick Players Manually)
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.cartCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={styles.cartCardTitle}>Build Custom Cart</Text>
                <TouchableOpacity onPress={() => setCustomCartBuilderOpen(false)}>
                  <Text style={styles.cancelCustomText}>Cancel</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.cartCardSubtitle}>
                Select 1 to 4 players you are scoring today.
              </Text>

              <TextInput
                style={styles.customCartNameInput}
                placeholder="Cart Name (e.g. Cart 5)"
                value={cartName}
                onChangeText={setCartName}
              />

              {/* List of Players with Big Checkboxes */}
              <View style={styles.rosterList}>
                {state.players.filter((p) => p.isActive !== false).map((player) => {
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
            </View>
          )}

          {activeGroupId && (
            <TouchableOpacity
              style={styles.cancelCartBtn}
              onPress={() => setIsPickingCart(false)}
            >
              <Text style={styles.cancelCartBtnText}>
                Back to Scoring {activeGroup?.name}
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      ) : (
        <View style={styles.scorerView}>
          {/* Active Cart & Hole Header with Locked Status */}
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
              style={styles.lockedCartBadge}
              onPress={() => setShowSwitchModal(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.lockedCartBadgeText}>🔒 {activeGroup.name}</Text>
              <Text style={styles.lockedCartSubText}>Locked • Tap to Change</Text>
            </TouchableOpacity>
          </View>

          {/* Round Complete Banner if all 18 holes are scored for all active players */}
          {isRound18HolesComplete && (
            <View style={styles.roundCompleteNotice}>
              <View style={{ flex: 1 }}>
                <Text style={styles.roundCompleteNoticeTitle}>
                  🏆 All 18 Holes Finished for Round {activeRound?.roundNumber}!
                </Text>
                <Text style={styles.roundCompleteNoticeSub}>
                  All attending players scored. Advance round to calculate next day targets.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.advanceRoundBtn}
                onPress={() => advanceRound(activeRound.id)}
              >
                <Text style={styles.advanceRoundBtnText}>Finalize & Advance ›</Text>
              </TouchableOpacity>
            </View>
          )}

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

                  {/* Par 3 Closest-To-The-Pin (CTP) Prompt */}
                  {par === 3 && (
                    <View style={styles.ctpRow}>
                      {activeRound?.ctpDistances?.[player.id]?.[currentHoleNum] ? (
                        <View style={styles.ctpSavedContainer}>
                          <View style={styles.ctpSavedBadge}>
                            <Text style={styles.ctpSavedIcon}>🎯</Text>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.ctpSavedText}>
                                Green Hit: {activeRound.ctpDistances[player.id][currentHoleNum].feet}' {activeRound.ctpDistances[player.id][currentHoleNum].inches}"
                              </Text>
                              <Text style={styles.ctpSecretNote}>
                                🤫 Secret distance • Revealed at dinner!
                              </Text>
                            </View>
                          </View>
                          <TouchableOpacity
                            style={styles.ctpEditButton}
                            onPress={() => {
                              const entry = activeRound.ctpDistances![player.id][currentHoleNum];
                              setCtpModalPlayer(player);
                              setCtpFeet(entry.feet);
                              setCtpInches(entry.inches);
                            }}
                          >
                            <Text style={styles.ctpEditButtonText}>Edit</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.ctpAddButton}
                          onPress={() => {
                            setCtpModalPlayer(player);
                            setCtpFeet(10);
                            setCtpInches(0);
                          }}
                        >
                          <Text style={styles.ctpAddButtonText}>🎯 Hit Green? Enter Distance (CTP)</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

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

      {/* Locked Cart Confirmation Modal */}
      <Modal
        visible={showSwitchModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSwitchModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>🔒 Cart Locked to {activeGroup?.name}</Text>
            <Text style={styles.modalDesc}>
              This device is currently locked to scoring {activeGroup?.name}. Switching carts should only be done if you need to score for a different group.
            </Text>

            <Text style={styles.pinPromptText}>
              Enter Admin PIN ({state.settings.adminPin}) or tap Unlock:
            </Text>
            <TextInput
              style={styles.modalPinInput}
              placeholder="Admin PIN (Optional)"
              secureTextEntry
              keyboardType="number-pad"
              value={switchPinInput}
              onChangeText={(t) => {
                setSwitchPinInput(t);
                setSwitchPinError('');
              }}
            />
            {switchPinError ? (
              <Text style={styles.modalErrorText}>{switchPinError}</Text>
            ) : null}

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setShowSwitchModal(false);
                  setSwitchPinInput('');
                  setSwitchPinError('');
                }}
              >
                <Text style={styles.modalCancelBtnText}>Keep {activeGroup?.name}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={() => {
                  if (
                    switchPinInput.trim() === '' ||
                    switchPinInput.trim() === state.settings.adminPin ||
                    switchPinInput.trim() === state.settings.tournamentPin
                  ) {
                    handleUnlockAndSwitchCart();
                  } else {
                    setSwitchPinError('Incorrect PIN. Use ' + state.settings.adminPin);
                  }
                }}
              >
                <Text style={styles.modalConfirmBtnText}>Unlock & Switch</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* CTP Distance Modal for Par 3s */}
      <Modal
        visible={!!ctpModalPlayer}
        transparent
        animationType="slide"
        onRequestClose={() => setCtpModalPlayer(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.ctpModalCard}>
            <View style={styles.ctpModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.ctpModalTitle}>🎯 Closest to the Pin</Text>
                <Text style={styles.ctpModalSubtitle}>
                  Hole {currentHoleNum} (Par 3{currentHoleConfig?.yardage ? ` • ${currentHoleConfig.yardage} yds` : ''}) • {ctpModalPlayer?.name}
                </Text>
              </View>
              <View
                style={[
                  styles.flightTag,
                  ctpModalPlayer?.flight === 'A' ? styles.flightTagA : styles.flightTagB,
                ]}
              >
                <Text style={styles.flightTagText}>Flight {ctpModalPlayer?.flight}</Text>
              </View>
            </View>

            {/* Secret dinner notice */}
            <View style={styles.ctpSecretBanner}>
              <Text style={styles.ctpSecretBannerText}>
                🤫 Secret Entry: Distances remain private and are revealed at the post-round dinner!
              </Text>
            </View>

            {/* Feet Stepper */}
            <View style={styles.ctpMeasureSection}>
              <Text style={styles.ctpSectionLabel}>FEET:</Text>
              <View style={styles.ctpStepperRow}>
                <TouchableOpacity
                  style={styles.ctpStepBtn}
                  onPress={() => setCtpFeet((f) => Math.max(0, f - 1))}
                >
                  <Text style={styles.ctpStepBtnText}>−</Text>
                </TouchableOpacity>
                <View style={styles.ctpValueDisplay}>
                  <Text style={styles.ctpValueBig}>{ctpFeet}</Text>
                  <Text style={styles.ctpValueUnit}>FEET</Text>
                </View>
                <TouchableOpacity
                  style={styles.ctpStepBtn}
                  onPress={() => setCtpFeet((f) => f + 1)}
                >
                  <Text style={styles.ctpStepBtnText}>+</Text>
                </TouchableOpacity>
              </View>

              {/* Quick Feet Chips */}
              <View style={styles.ctpChipsRow}>
                {[2, 4, 6, 8, 10, 15, 20, 25, 30].map((ft) => (
                  <TouchableOpacity
                    key={ft}
                    style={[styles.ctpChip, ctpFeet === ft && styles.ctpChipActive]}
                    onPress={() => setCtpFeet(ft)}
                  >
                    <Text style={[styles.ctpChipText, ctpFeet === ft && styles.ctpChipTextActive]}>
                      {ft}'
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Inches Stepper */}
            <View style={styles.ctpMeasureSection}>
              <Text style={styles.ctpSectionLabel}>INCHES:</Text>
              <View style={styles.ctpStepperRow}>
                <TouchableOpacity
                  style={styles.ctpStepBtn}
                  onPress={() => setCtpInches((i) => Math.max(0, i - 1))}
                >
                  <Text style={styles.ctpStepBtnText}>−</Text>
                </TouchableOpacity>
                <View style={styles.ctpValueDisplay}>
                  <Text style={styles.ctpValueBig}>{ctpInches}</Text>
                  <Text style={styles.ctpValueUnit}>INCHES</Text>
                </View>
                <TouchableOpacity
                  style={styles.ctpStepBtn}
                  onPress={() => setCtpInches((i) => Math.min(11, i + 1))}
                >
                  <Text style={styles.ctpStepBtnText}>+</Text>
                </TouchableOpacity>
              </View>

              {/* Quick Inches Chips */}
              <View style={styles.ctpChipsRow}>
                {[0, 2, 4, 6, 8, 10].map((inch) => (
                  <TouchableOpacity
                    key={inch}
                    style={[styles.ctpChip, ctpInches === inch && styles.ctpChipActive]}
                    onPress={() => setCtpInches(inch)}
                  >
                    <Text style={[styles.ctpChipText, ctpInches === inch && styles.ctpChipTextActive]}>
                      {inch}"
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Total Measurement Banner */}
            <View style={styles.ctpTotalBanner}>
              <Text style={styles.ctpTotalLabel}>RECORDED DISTANCE:</Text>
              <Text style={styles.ctpTotalValue}>
                {ctpFeet} FT  {ctpInches} IN
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.ctpClearBtn}
                onPress={() => {
                  if (activeRound && ctpModalPlayer) {
                    setCtpDistance(activeRound.id, ctpModalPlayer.id, currentHoleNum, null);
                  }
                  setCtpModalPlayer(null);
                }}
              >
                <Text style={styles.ctpClearBtnText}>Missed Green / Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.ctpSaveBtn}
                onPress={() => {
                  if (activeRound && ctpModalPlayer) {
                    setCtpDistance(activeRound.id, ctpModalPlayer.id, currentHoleNum, {
                      feet: ctpFeet,
                      inches: ctpInches,
                    });
                  }
                  setCtpModalPlayer(null);
                }}
              >
                <Text style={styles.ctpSaveBtnText}>💾 Save Distance</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  preRoundSetupHeader: {
    marginBottom: 16,
  },
  preRoundSetupTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
  },
  preRoundSetupSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    fontWeight: '600',
  },
  cartSelectCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cartSelectCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 10,
    marginBottom: 12,
  },
  cartSelectCardTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#064E3B',
  },
  cartSelectCardMeta: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  cartSelectPlayersList: {
    gap: 8,
    marginBottom: 14,
  },
  cartSelectPlayerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cartSelectAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartSelectAvatarText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  cartSelectPlayerName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  cartSelectPlayerSub: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  cartSelectPlayerQuota: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  emptyCartHint: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  lockIntoCartBtn: {
    backgroundColor: '#064E3B',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  lockIntoCartBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  openCustomBuilderBtn: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#94A3B8',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
  },
  openCustomBuilderBtnText: {
    color: '#475569',
    fontWeight: '800',
    fontSize: 13,
  },
  cancelCustomText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 13,
  },
  customCartNameInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 12,
  },
  lockedCartBadge: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#10B981',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignItems: 'flex-end',
  },
  lockedCartBadgeText: {
    color: '#065F46',
    fontWeight: '800',
    fontSize: 13,
  },
  lockedCartSubText: {
    color: '#059669',
    fontSize: 9,
    fontWeight: '700',
  },
  roundCompleteNotice: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 10,
    marginHorizontal: 12,
    marginTop: 8,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roundCompleteNoticeTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400E',
  },
  roundCompleteNoticeSub: {
    fontSize: 11,
    color: '#B45309',
    marginTop: 1,
  },
  advanceRoundBtn: {
    backgroundColor: '#065F46',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 6,
  },
  advanceRoundBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 11,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 380,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 8,
  },
  modalDesc: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 19,
    marginBottom: 14,
  },
  pinPromptText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  modalPinInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 15,
    marginBottom: 6,
  },
  modalErrorText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
  },
  modalCancelBtnText: {
    color: '#475569',
    fontWeight: '700',
    fontSize: 13,
  },
  modalConfirmBtn: {
    flex: 1,
    backgroundColor: '#DC2626',
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
  },
  modalConfirmBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  // CTP In-Card Styles
  ctpRow: {
    marginTop: 8,
    marginBottom: 4,
  },
  ctpAddButton: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#86EFAC',
    borderStyle: 'dashed',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctpAddButtonText: {
    color: '#15803D',
    fontSize: 13,
    fontWeight: '700',
  },
  ctpSavedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#10B981',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 8,
  },
  ctpSavedBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ctpSavedIcon: {
    fontSize: 18,
  },
  ctpSavedText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#065F46',
  },
  ctpSecretNote: {
    fontSize: 10,
    fontWeight: '600',
    color: '#047857',
    marginTop: 1,
  },
  ctpEditButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  ctpEditButtonText: {
    color: '#047857',
    fontSize: 11,
    fontWeight: '700',
  },

  // CTP Modal Styles
  ctpModalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    width: '92%',
    maxWidth: 420,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  ctpModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  ctpModalTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#064E3B',
  },
  ctpModalSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginTop: 2,
  },
  ctpSecretBanner: {
    backgroundColor: '#FEF3C7',
    borderLeftWidth: 4,
    borderLeftColor: '#D97706',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 6,
    marginBottom: 12,
  },
  ctpSecretBannerText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#92400E',
    lineHeight: 15,
  },
  ctpMeasureSection: {
    marginBottom: 12,
  },
  ctpSectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  ctpStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ctpStepBtn: {
    backgroundColor: '#064E3B',
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctpStepBtnText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 24,
  },
  ctpValueDisplay: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  ctpValueBig: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
  },
  ctpValueUnit: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  ctpChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  ctpChip: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  ctpChipActive: {
    backgroundColor: '#064E3B',
    borderColor: '#064E3B',
  },
  ctpChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  ctpChipTextActive: {
    color: '#FFFFFF',
  },
  ctpTotalBanner: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1.5,
    borderColor: '#22C55E',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  ctpTotalLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
    letterSpacing: 0.5,
  },
  ctpTotalValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#064E3B',
    marginTop: 2,
  },
  ctpClearBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  ctpClearBtnText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 12,
  },
  ctpSaveBtn: {
    flex: 1.2,
    backgroundColor: '#064E3B',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  ctpSaveBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  backToMenuBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 8,
  },
  backToMenuBtnText: {
    color: '#1E293B',
    fontSize: 13,
    fontWeight: '800',
  },
});
