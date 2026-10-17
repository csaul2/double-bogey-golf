import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { createBlankCourse, useTournament } from '../context/TournamentContext';
import { Course, Flight, RoundStatus } from '../types/tournament';
import {
  calculateAdjustedTargetQuota,
  calculatePlayerRoundStats,
  formatSignedScore,
} from '../utils/scoring';

interface AdminScreenProps {
  onClose?: () => void;
  onOpenMasterSheet?: () => void;
}

export const AdminScreen: React.FC<AdminScreenProps> = ({
  onClose,
  onOpenMasterSheet,
}) => {
  const {
    state,
    isAdminUnlocked,
    unlockAdmin,
    lockAdmin,
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
    createGroup,
    updateGroup,
    deleteGroup,
    autoGeneratePairings,
    advanceRound,
    updateSettings,
    resetDemoData,
  } = useTournament();

  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const [activeTab, setActiveTab] = useState<
    'rounds' | 'pairings' | 'courses' | 'players' | 'settings'
  >('pairings');
  const [playerFilter, setPlayerFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Pairings & Carts State
  const [pairingRoundId, setPairingRoundId] = useState<string>(() => {
    return state.rounds.find((r) => r.status === 'active')?.id || state.rounds[0]?.id || '';
  });
  const [newCartName, setNewCartName] = useState<string>('');
  const [playerPickerCartId, setPlayerPickerCartId] = useState<string | null>(null);

  // Courses Editor State
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  // Players Editor State
  const [newPlayerName, setNewPlayerName] = useState<string>('');
  const [newPlayerQuota, setNewPlayerQuota] = useState<string>('24');
  const [newPlayerFlight, setNewPlayerFlight] = useState<Flight>('A');

  // Rounds Editor State
  const [newRoundName, setNewRoundName] = useState<string>('');
  const [newRoundCourseId, setNewRoundCourseId] = useState<string>(
    state.courses[0]?.id || ''
  );

  // Settings Editor State
  const [adjPercentText, setAdjPercentText] = useState<string>(
    String(state.settings.targetAdjustmentPercent)
  );

  const sortedRounds = useMemo(
    () => [...state.rounds].sort((a, b) => a.roundNumber - b.roundNumber),
    [state.rounds]
  );

  const activePlayersCount = useMemo(
    () => state.players.filter((p) => p.isActive !== false).length,
    [state.players]
  );

  const inactivePlayersCount = useMemo(
    () => state.players.filter((p) => p.isActive === false).length,
    [state.players]
  );

  const displayedPlayers = useMemo(() => {
    if (playerFilter === 'active') return state.players.filter((p) => p.isActive !== false);
    if (playerFilter === 'inactive') return state.players.filter((p) => p.isActive === false);
    return state.players;
  }, [state.players, playerFilter]);

  if (!isAdminUnlocked) {
    return (
      <View style={styles.pinGateContainer}>
        <View style={styles.pinCard}>
          <Text style={styles.pinTitle}>Tournament Admin Portal</Text>
          <Text style={styles.pinSubtitle}>
            Enter the Admin PIN to configure courses, hole par & difficulty ranks, player quotas, and daily target adjustments.
          </Text>
          <Text style={styles.pinDemoHint}>
            Demo Admin PIN: <Text style={{ fontWeight: '800' }}>{state.settings.adminPin}</Text>
          </Text>
          <TextInput
            style={styles.pinInput}
            placeholder="Enter Admin PIN"
            secureTextEntry
            keyboardType="number-pad"
            value={pinInput}
            onChangeText={(t) => {
              setPinInput(t);
              setPinError('');
            }}
          />
          {pinError ? <Text style={styles.pinErrorText}>{pinError}</Text> : null}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            {onClose && (
              <TouchableOpacity style={styles.pinCancelBtn} onPress={onClose}>
                <Text style={styles.pinCancelBtnText}>Back</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.pinUnlockBtn, { flex: onClose ? 2 : 1 }]}
              onPress={() => {
                if (!unlockAdmin(pinInput)) {
                  setPinError('Incorrect Admin PIN. Try ' + state.settings.adminPin);
                } else {
                  setPinInput('');
                }
              }}
            >
              <Text style={styles.pinUnlockBtnText}>Unlock Admin Panel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // Validate if editingCourse has unique 1..18 difficulty ranks
  const getDuplicateRanks = (course: Course): number[] => {
    const counts: Record<number, number> = {};
    course.holes.forEach((h) => {
      counts[h.difficultyRank] = (counts[h.difficultyRank] || 0) + 1;
    });
    return Object.entries(counts)
      .filter(([, count]) => count > 1)
      .map(([rank]) => Number(rank));
  };

  return (
    <View style={styles.container}>
      {/* Sub-navigation bar */}
      <View style={styles.subNav}>
        <View style={styles.subNavTabs}>
          {(
            [
              { id: 'rounds', label: 'Rounds & Quotas' },
              { id: 'pairings', label: 'Carts & Pairings' },
              { id: 'players', label: 'Players' },
              { id: 'courses', label: 'Courses (Par/HCP)' },
              { id: 'settings', label: 'Formula & PINs' },
            ] as const
          ).map((t) => (
            <TouchableOpacity
              key={t.id}
              style={[
                styles.subNavTab,
                activeTab === t.id && styles.subNavTabActive,
              ]}
              onPress={() => {
                setActiveTab(t.id);
                setEditingCourse(null);
              }}
            >
              <Text
                style={[
                  styles.subNavTabText,
                  activeTab === t.id && styles.subNavTabTextActive,
                ]}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
          {onOpenMasterSheet && (
            <TouchableOpacity
              style={styles.subNavTab}
              onPress={onOpenMasterSheet}
            >
              <Text style={styles.subNavTabText}>📋 Paper Sheet</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <TouchableOpacity style={styles.lockBtn} onPress={lockAdmin}>
            <Text style={styles.lockBtnText}>Lock</Text>
          </TouchableOpacity>
          {onClose && (
            <TouchableOpacity style={styles.closeAdminBtn} onPress={onClose}>
              <Text style={styles.closeAdminBtnText}>Done ✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* TAB 1: ROUNDS & DAILY TARGET QUOTA ADJUSTMENTS */}
        {activeTab === 'rounds' && (
          <View>
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Daily Target Quota Formula</Text>
              <Text style={styles.sectionDesc}>
                Current Formula: Next Round Target ={' '}
                <Text style={{ fontWeight: '700' }}>
                  round(min(Old Target, Actual Pts) + {state.settings.targetAdjustmentPercent}% × |Actual Pts − Old Target|)
                </Text>
              </Text>
            </View>

            {sortedRounds.map((round, idx) => {
              const prevRound = idx > 0 ? sortedRounds[idx - 1] : undefined;
              const prevCourse = prevRound
                ? state.courses.find((c) => c.id === prevRound.courseId)
                : undefined;
              const roundCourse = state.courses.find((c) => c.id === round.courseId);

              return (
                <View key={round.id} style={styles.sectionCard}>
                  <View style={styles.roundHeaderRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.roundCardTitle}>
                        Round {round.roundNumber}: {round.name}
                      </Text>
                      <Text style={styles.roundCardMeta}>
                        Course: {roundCourse?.name || 'Unassigned'}
                      </Text>
                    </View>
                    <View style={styles.statusPills}>
                      {(['upcoming', 'active', 'completed'] as RoundStatus[]).map(
                        (st) => (
                          <TouchableOpacity
                            key={st}
                            style={[
                              styles.statusPill,
                              round.status === st && styles.statusPillActive,
                            ]}
                            onPress={() => updateRoundStatus(round.id, st)}
                          >
                            <Text
                              style={[
                                styles.statusPillText,
                                round.status === st && styles.statusPillTextActive,
                              ]}
                            >
                              {st.toUpperCase()}
                            </Text>
                          </TouchableOpacity>
                        )
                      )}
                    </View>
                  </View>

                  {/* Course Assignment Selector */}
                  <Text style={styles.fieldLabel}>Assigned Course:</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={{ marginBottom: 12 }}
                  >
                    {state.courses.map((c) => {
                      const selected = c.id === round.courseId;
                      return (
                        <TouchableOpacity
                          key={c.id}
                          style={[
                            styles.courseSelectChip,
                            selected && styles.courseSelectChipActive,
                          ]}
                          onPress={() => updateRoundCourse(round.id, c.id)}
                        >
                          <Text
                            style={[
                              styles.courseSelectChipText,
                              selected && styles.courseSelectChipTextActive,
                            ]}
                          >
                            {c.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  {/* Auto-Recalculate Quotas Button for R2+ */}
                  {prevRound && (
                    <TouchableOpacity
                      style={styles.recalcBtn}
                      onPress={() => recalculateRoundQuotasFromPrevious(round.id)}
                    >
                      <Text style={styles.recalcBtnText}>
                        ↻ Recalculate R{round.roundNumber} Target Quotas from R
                        {prevRound.roundNumber} ({state.settings.targetAdjustmentPercent}% Rule)
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Finalize Round & Advance Button */}
                  {round.status === 'active' && idx < sortedRounds.length - 1 && (
                    <TouchableOpacity
                      style={styles.finalizeRoundBtn}
                      onPress={() => advanceRound(round.id)}
                    >
                      <Text style={styles.finalizeRoundBtnText}>
                        🏆 Finalize Round {round.roundNumber} & Advance to Round {sortedRounds[idx + 1].roundNumber}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Per-Player Quota Table for this Round */}
                  <View style={styles.quotaTableHeader}>
                    <Text style={[styles.quotaTh, { flex: 1.5 }]}>Player</Text>
                    {prevRound ? (
                      <Text style={[styles.quotaTh, { flex: 1.3 }]}>
                        R{prevRound.roundNumber} (Pts/Tgt)
                      </Text>
                    ) : null}
                    <Text style={[styles.quotaTh, { width: 110, textAlign: 'center' }]}>
                      R{round.roundNumber} Target Quota
                    </Text>
                  </View>

                  {state.players.map((player) => {
                    const currentQuota =
                      round.targetQuotas[player.id] ?? player.initialTargetQuota;
                    const prevStats = prevRound
                      ? calculatePlayerRoundStats(player, prevRound, prevCourse)
                      : null;
                    const suggestedQuota = prevStats
                      ? calculateAdjustedTargetQuota(
                          prevStats.targetQuota,
                          prevStats.actualPoints,
                          state.settings.targetAdjustmentPercent
                        )
                      : player.initialTargetQuota;

                    return (
                      <View key={player.id} style={styles.quotaPlayerRow}>
                        <View style={{ flex: 1.5 }}>
                          <Text style={styles.quotaPlayerName}>{player.name}</Text>
                          {prevStats ? (
                            <Text style={styles.quotaFormulaSub}>
                              Formula: {suggestedQuota} pts
                            </Text>
                          ) : null}
                        </View>

                        {prevStats ? (
                          <View style={{ flex: 1.3 }}>
                            <Text style={styles.prevRoundStatText}>
                              {prevStats.actualPoints} / {prevStats.targetQuota} (
                              {formatSignedScore(prevStats.netQuotaScore)})
                            </Text>
                          </View>
                        ) : null}

                        <View style={styles.quotaStepper}>
                          <TouchableOpacity
                            style={styles.quotaStepBtn}
                            onPress={() =>
                              updatePlayerRoundQuota(
                                round.id,
                                player.id,
                                Math.max(1, currentQuota - 1)
                              )
                            }
                          >
                            <Text style={styles.quotaStepBtnText}>−</Text>
                          </TouchableOpacity>
                          <Text style={styles.quotaValueText}>{currentQuota}</Text>
                          <TouchableOpacity
                            style={styles.quotaStepBtn}
                            onPress={() =>
                              updatePlayerRoundQuota(
                                round.id,
                                player.id,
                                currentQuota + 1
                              )
                            }
                          >
                            <Text style={styles.quotaStepBtnText}>+</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              );
            })}

            {/* Add New Round Card */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>+ Add Another Tournament Round</Text>
              <TextInput
                style={styles.input}
                placeholder={`Round ${sortedRounds.length + 1} Name (e.g. Sunday Finale)`}
                value={newRoundName}
                onChangeText={setNewRoundName}
              />
              <TouchableOpacity
                style={styles.primaryActionBtn}
                onPress={() => {
                  addRound(
                    newRoundName || `Round ${sortedRounds.length + 1}`,
                    newRoundCourseId || state.courses[0]?.id || ''
                  );
                  setNewRoundName('');
                }}
              >
                <Text style={styles.primaryActionBtnText}>
                  Create Round {sortedRounds.length + 1} (Auto-Applies{' '}
                  {state.settings.targetAdjustmentPercent}% Quota Adjustment)
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* TAB: CARTS & PAIRINGS (PRE-ROUND GROUP SETUP) */}
        {activeTab === 'pairings' && (() => {
          const currentPairingRound =
            state.rounds.find((r) => r.id === pairingRoundId) || sortedRounds[0];
          const attendingPlayers = state.players.filter((p) => p.isActive !== false);
          const roundGroups = state.groups.filter((g) => g.roundId === pairingRoundId);
          const assignedPlayerIds = new Set(roundGroups.flatMap((g) => g.playerIds));
          const unassignedPlayers = attendingPlayers.filter((p) => !assignedPlayerIds.has(p.id));

          return (
            <View>
              {/* Round Selector Bar */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>1. Select Round for Pairings</Text>
                <Text style={styles.sectionDesc}>
                  Configure foursomes in advance. On the course, scorers simply select their pre-set Cart to lock into scoring.
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
                  {sortedRounds.map((r) => {
                    const isSelected = r.id === pairingRoundId;
                    return (
                      <TouchableOpacity
                        key={r.id}
                        style={[
                          styles.roundSelectChip,
                          isSelected && styles.roundSelectChipActive,
                        ]}
                        onPress={() => setPairingRoundId(r.id)}
                      >
                        <Text
                          style={[
                            styles.roundSelectChipText,
                            isSelected && styles.roundSelectChipTextActive,
                          ]}
                        >
                          Round {r.roundNumber} {r.status === 'active' ? '● Active' : ''}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Status & Quick Actions Bar */}
              <View style={styles.sectionCard}>
                <View style={{ marginBottom: 12 }}>
                  <Text style={styles.sectionTitle}>
                    2. {currentPairingRound?.name || 'Round'} Pairings
                  </Text>
                  <TouchableOpacity
                    style={[styles.autoAssignBtn, { alignSelf: 'flex-start', marginTop: 8 }]}
                    onPress={() => autoGeneratePairings(pairingRoundId)}
                  >
                    <Text style={styles.autoAssignBtnText}>⚡ Auto-Assign Attending Foursomes</Text>
                  </TouchableOpacity>
                </View>

                {/* Status summary pills */}
                <View style={styles.pairingSummaryRow}>
                  <View style={styles.pairingSummaryPill}>
                    <Text style={styles.pairingSummaryLabel}>Attending</Text>
                    <Text style={styles.pairingSummaryValue}>{attendingPlayers.length}</Text>
                  </View>
                  <View style={styles.pairingSummaryPill}>
                    <Text style={styles.pairingSummaryLabel}>Carts</Text>
                    <Text style={styles.pairingSummaryValue}>{roundGroups.length}</Text>
                  </View>
                  <View style={styles.pairingSummaryPill}>
                    <Text style={styles.pairingSummaryLabel}>Assigned</Text>
                    <Text style={styles.pairingSummaryValue}>{assignedPlayerIds.size}</Text>
                  </View>
                  <View
                    style={[
                      styles.pairingSummaryPill,
                      unassignedPlayers.length > 0 && { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.pairingSummaryLabel,
                        unassignedPlayers.length > 0 && { color: '#B45309' },
                      ]}
                    >
                      Unassigned
                    </Text>
                    <Text
                      style={[
                        styles.pairingSummaryValue,
                        unassignedPlayers.length > 0 && { color: '#B45309' },
                      ]}
                    >
                      {unassignedPlayers.length}
                    </Text>
                  </View>
                </View>

                {unassignedPlayers.length > 0 && (
                  <View style={styles.unassignedNoticeBox}>
                    <Text style={styles.unassignedNoticeTitle}>
                      ⚠️ {unassignedPlayers.length} Attending Player(s) Need a Cart:
                    </Text>
                    <Text style={styles.unassignedNoticeText}>
                      {unassignedPlayers.map((p) => p.name).join(', ')}
                    </Text>
                  </View>
                )}
              </View>

              {/* Groups / Carts List */}
              {roundGroups.map((group) => {
                const groupPlayers = group.playerIds
                  .map((id) => state.players.find((p) => p.id === id))
                  .filter(Boolean);

                return (
                  <View key={group.id} style={styles.cartCard}>
                    <View style={styles.cartCardHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cartCardName}>
                          {group.name}
                        </Text>
                        <Text style={styles.cartCardMeta}>
                          {groupPlayers.length}/4 Players Assigned • Starting Hole {group.currentHole || 1}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.cartDeleteBtn}
                        onPress={() => deleteGroup(group.id)}
                      >
                        <Text style={styles.cartDeleteBtnText}>Delete Cart</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Players in Cart */}
                    <View style={styles.cartPlayersList}>
                      {groupPlayers.map((p) => (
                        <View key={p!.id} style={styles.cartPlayerRow}>
                          <View
                            style={[
                              styles.cartPlayerAvatar,
                              { backgroundColor: p!.avatarColor || '#059669' },
                            ]}
                          >
                            <Text style={styles.cartPlayerAvatarText}>
                              {p!.name.slice(0, 2).toUpperCase()}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.cartPlayerName}>{p!.name}</Text>
                            <Text style={styles.cartPlayerSub}>
                              {p!.flight}-Flight • Target: {currentPairingRound?.targetQuotas?.[p!.id] ?? p!.initialTargetQuota} pts
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={styles.removePlayerBtn}
                            onPress={() => {
                              updateGroup({
                                ...group,
                                playerIds: group.playerIds.filter((id) => id !== p!.id),
                              });
                            }}
                          >
                            <Text style={styles.removePlayerBtnText}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      ))}

                      {groupPlayers.length === 0 && (
                        <Text style={styles.emptyCartHint}>No players in this cart yet.</Text>
                      )}
                    </View>

                    {/* Add Player to Cart Action */}
                    {group.playerIds.length < 4 && (
                      <View style={{ marginTop: 8 }}>
                        {playerPickerCartId === group.id ? (
                          <View style={styles.pickerBox}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                              <Text style={styles.pickerTitle}>Add Attending Player to {group.name}:</Text>
                              <TouchableOpacity onPress={() => setPlayerPickerCartId(null)}>
                                <Text style={styles.pickerCancelText}>Cancel</Text>
                              </TouchableOpacity>
                            </View>
                            {unassignedPlayers.length > 0 ? (
                              <View style={styles.pickerChipsRow}>
                                {unassignedPlayers.map((p) => (
                                  <TouchableOpacity
                                    key={p.id}
                                    style={styles.pickerChip}
                                    onPress={() => {
                                      updateGroup({
                                        ...group,
                                        playerIds: [...group.playerIds, p.id],
                                      });
                                      setPlayerPickerCartId(null);
                                    }}
                                  >
                                    <Text style={styles.pickerChipText}>+ {p.name}</Text>
                                  </TouchableOpacity>
                                ))}
                              </View>
                            ) : (
                              <Text style={styles.pickerNoPlayersText}>
                                All attending players are already assigned to a cart.
                              </Text>
                            )}
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={styles.addPlayerToCartBtn}
                            onPress={() => setPlayerPickerCartId(group.id)}
                          >
                            <Text style={styles.addPlayerToCartBtnText}>
                              + Add Player to {group.name} ({4 - group.playerIds.length} spots open)
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}

              {/* Add New Custom Cart */}
              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>+ Create New Cart</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <TextInput
                    style={[styles.input, { flex: 1, marginBottom: 0 }]}
                    placeholder={`e.g. Cart ${roundGroups.length + 1}`}
                    value={newCartName}
                    onChangeText={setNewCartName}
                  />
                  <TouchableOpacity
                    style={styles.addCartSubmitBtn}
                    onPress={() => {
                      const name = newCartName.trim() || `Cart ${roundGroups.length + 1}`;
                      createGroup(pairingRoundId, name, []);
                      setNewCartName('');
                    }}
                  >
                    <Text style={styles.addCartSubmitBtnText}>Create Cart</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })()}

        {/* TAB 2: COURSES (HOLE PAR & DIFFICULTY RANK 1–18) */}
        {activeTab === 'courses' && (
          <View>
            {editingCourse ? (
              <View style={styles.sectionCard}>
                <View style={styles.editorHeader}>
                  <Text style={styles.sectionTitle}>Configure Course & 18 Holes</Text>
                  <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={() => setEditingCourse(null)}
                  >
                    <Text style={styles.secondaryBtnText}>Cancel</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.fieldLabel}>Course Name</Text>
                <TextInput
                  style={styles.input}
                  value={editingCourse.name}
                  onChangeText={(name) =>
                    setEditingCourse({ ...editingCourse, name })
                  }
                  placeholder="Course Name"
                />

                <Text style={styles.fieldLabel}>Location (Optional)</Text>
                <TextInput
                  style={styles.input}
                  value={editingCourse.location || ''}
                  onChangeText={(location) =>
                    setEditingCourse({ ...editingCourse, location })
                  }
                  placeholder="City, State"
                />

                {(() => {
                  const dupes = getDuplicateRanks(editingCourse);
                  const totalPar = editingCourse.holes.reduce((s, h) => s + h.par, 0);
                  return (
                    <View style={styles.courseValidationBanner}>
                      <Text style={styles.courseValidationTitle}>
                        Course Total Par: {totalPar}
                      </Text>
                      {dupes.length > 0 ? (
                        <Text style={styles.dupeWarningText}>
                          Duplicate Difficulty Ranks detected: #{dupes.join(', #')}. For clean tie-breakers, each hole should have a unique rank 1–18.
                        </Text>
                      ) : (
                        <Text style={styles.validRanksText}>
                          ✓ All 18 holes have unique Difficulty Ranks (1–18).
                        </Text>
                      )}
                    </View>
                  );
                })()}

                <View style={styles.holeEditorHeader}>
                  <Text style={[styles.quotaTh, { width: 52 }]}>Hole</Text>
                  <Text style={[styles.quotaTh, { flex: 1, textAlign: 'center' }]}>
                    Par (3 / 4 / 5)
                  </Text>
                  <Text style={[styles.quotaTh, { width: 120, textAlign: 'center' }]}>
                    Difficulty Rank (1-18)
                  </Text>
                </View>

                {editingCourse.holes.map((hole) => (
                  <View key={hole.holeNumber} style={styles.holeEditRow}>
                    <Text style={styles.holeEditNum}>#{hole.holeNumber}</Text>

                    {/* Par Selector: 3, 4, 5 */}
                    <View style={styles.parSegmentRow}>
                      {([3, 4, 5] as const).map((parVal) => (
                        <TouchableOpacity
                          key={parVal}
                          style={[
                            styles.parSegBtn,
                            hole.par === parVal && styles.parSegBtnActive,
                          ]}
                          onPress={() => {
                            const updatedHoles = editingCourse.holes.map((h) =>
                              h.holeNumber === hole.holeNumber
                                ? { ...h, par: parVal }
                                : h
                            );
                            setEditingCourse({
                              ...editingCourse,
                              holes: updatedHoles,
                            });
                          }}
                        >
                          <Text
                            style={[
                              styles.parSegText,
                              hole.par === parVal && styles.parSegTextActive,
                            ]}
                          >
                            Par {parVal}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Difficulty Rank Stepper (1..18) */}
                    <View style={styles.rankStepper}>
                      <TouchableOpacity
                        style={styles.quotaStepBtn}
                        onPress={() => {
                          const nextRank =
                            hole.difficultyRank <= 1 ? 18 : hole.difficultyRank - 1;
                          const updatedHoles = editingCourse.holes.map((h) =>
                            h.holeNumber === hole.holeNumber
                              ? { ...h, difficultyRank: nextRank }
                              : h
                          );
                          setEditingCourse({
                            ...editingCourse,
                            holes: updatedHoles,
                          });
                        }}
                      >
                        <Text style={styles.quotaStepBtnText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.rankValText}>#{hole.difficultyRank}</Text>
                      <TouchableOpacity
                        style={styles.quotaStepBtn}
                        onPress={() => {
                          const nextRank =
                            hole.difficultyRank >= 18 ? 1 : hole.difficultyRank + 1;
                          const updatedHoles = editingCourse.holes.map((h) =>
                            h.holeNumber === hole.holeNumber
                              ? { ...h, difficultyRank: nextRank }
                              : h
                          );
                          setEditingCourse({
                            ...editingCourse,
                            holes: updatedHoles,
                          });
                        }}
                      >
                        <Text style={styles.quotaStepBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}

                <TouchableOpacity
                  style={[styles.primaryActionBtn, { marginTop: 14 }]}
                  onPress={() => {
                    saveCourse(editingCourse);
                    setEditingCourse(null);
                  }}
                >
                  <Text style={styles.primaryActionBtnText}>Save Course Configuration</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.primaryActionBtn, { marginBottom: 14 }]}
                  onPress={() =>
                    setEditingCourse(
                      createBlankCourse(`New Course ${state.courses.length + 1}`, '')
                    )
                  }
                >
                  <Text style={styles.primaryActionBtnText}>
                    + Create New 18-Hole Course
                  </Text>
                </TouchableOpacity>

                {state.courses.map((course) => {
                  const totalPar = course.holes.reduce((s, h) => s + h.par, 0);
                  return (
                    <View key={course.id} style={styles.sectionCard}>
                      <View style={styles.courseListRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.roundCardTitle}>{course.name}</Text>
                          <Text style={styles.roundCardMeta}>
                            {course.location || 'Custom Course'} • Total Par {totalPar}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.editCourseBtn}
                          onPress={() => setEditingCourse(course)}
                        >
                          <Text style={styles.editCourseBtnText}>
                            Edit Holes (Par & Rank)
                          </Text>
                        </TouchableOpacity>
                      </View>
                      {state.courses.length > 1 && (
                        <TouchableOpacity
                          style={{ marginTop: 8 }}
                          onPress={() => deleteCourse(course.id)}
                        >
                          <Text style={{ fontSize: 11, color: '#EF4444' }}>
                            Delete Course
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </>
            )}
          </View>
        )}

        {/* TAB 3: PLAYERS ROSTER */}
        {activeTab === 'players' && (
          <View>
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Add Tournament Player</Text>
              <View style={styles.addPlayerRow}>
                <View style={{ flex: 2 }}>
                  <Text style={styles.fieldLabel}>Player Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Full Name"
                    value={newPlayerName}
                    onChangeText={setNewPlayerName}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Initial Target (Pts)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="number-pad"
                    value={newPlayerQuota}
                    onChangeText={setNewPlayerQuota}
                  />
                </View>
              </View>

              <Text style={styles.fieldLabel}>Assign Tournament Flight</Text>
              <View style={styles.flightSelectorRow}>
                {(['A', 'B'] as Flight[]).map((fl) => (
                  <TouchableOpacity
                    key={fl}
                    style={[
                      styles.flightOptionBtn,
                      newPlayerFlight === fl && styles.flightOptionBtnActive,
                    ]}
                    onPress={() => setNewPlayerFlight(fl)}
                  >
                    <Text
                      style={[
                        styles.flightOptionText,
                        newPlayerFlight === fl && styles.flightOptionTextActive,
                      ]}
                    >
                      {fl} Flight
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={styles.primaryActionBtn}
                onPress={() => {
                  if (!newPlayerName.trim()) return;
                  addPlayer(
                    newPlayerName,
                    parseInt(newPlayerQuota, 10) || 20,
                    newPlayerFlight
                  );
                  setNewPlayerName('');
                }}
              >
                <Text style={styles.primaryActionBtnText}>
                  + Add Player to {newPlayerFlight} Flight
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.rosterHeaderStrip}>
                <Text style={styles.sectionTitle}>
                  Tournament Roster ({state.players.length} Total)
                </Text>
                <Text style={styles.sectionDesc}>
                  {activePlayersCount} Attending / Active • {inactivePlayersCount} Sitting Out (Tap badge to toggle)
                </Text>
              </View>

              {/* Roster Filter Tabs */}
              <View style={styles.rosterFilterRow}>
                {(
                  [
                    { id: 'all', label: `All (${state.players.length})` },
                    { id: 'active', label: `Attending (${activePlayersCount})` },
                    { id: 'inactive', label: `Sitting Out (${inactivePlayersCount})` },
                  ] as const
                ).map((f) => (
                  <TouchableOpacity
                    key={f.id}
                    style={[
                      styles.rosterFilterPill,
                      playerFilter === f.id && styles.rosterFilterPillActive,
                    ]}
                    onPress={() => setPlayerFilter(f.id)}
                  >
                    <Text
                      style={[
                        styles.rosterFilterPillText,
                        playerFilter === f.id && styles.rosterFilterPillTextActive,
                      ]}
                    >
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {displayedPlayers.map((p) => {
                const isActive = p.isActive !== false;
                return (
                  <View
                    key={p.id}
                    style={[
                      styles.quotaPlayerRow,
                      !isActive && styles.quotaPlayerRowInactive,
                    ]}
                  >
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          flexWrap: 'wrap',
                        }}
                      >
                        <Text
                          style={[
                            styles.quotaPlayerName,
                            !isActive && styles.quotaPlayerNameInactive,
                          ]}
                        >
                          {p.name}
                        </Text>

                        {/* Active / Sitting Out Toggle Button */}
                        <TouchableOpacity
                          style={[
                            styles.activeStatusBadge,
                            isActive
                              ? styles.activeStatusBadgeActive
                              : styles.activeStatusBadgeInactive,
                          ]}
                          onPress={() => togglePlayerActive(p.id)}
                        >
                          <Text
                            style={[
                              styles.activeStatusBadgeText,
                              isActive
                                ? styles.activeStatusBadgeTextActive
                                : styles.activeStatusBadgeTextInactive,
                            ]}
                          >
                            {isActive ? '● Attending' : '○ Sitting Out'}
                          </Text>
                        </TouchableOpacity>

                        {/* Flight Toggle Badge */}
                        <TouchableOpacity
                          style={[
                            styles.flightToggleBadge,
                            p.flight === 'A'
                              ? styles.flightToggleBadgeA
                              : styles.flightToggleBadgeB,
                          ]}
                          onPress={() =>
                            updatePlayer(
                              p.id,
                              p.name,
                              p.initialTargetQuota,
                              p.flight === 'A' ? 'B' : 'A'
                            )
                          }
                        >
                          <Text
                            style={[
                              styles.flightToggleBadgeText,
                              p.flight === 'A'
                                ? styles.flightToggleBadgeTextA
                                : styles.flightToggleBadgeTextB,
                            ]}
                          >
                            Flight {p.flight} ⇄
                          </Text>
                        </TouchableOpacity>
                      </View>

                      <Text style={styles.quotaFormulaSub}>
                        {isActive
                          ? `Starting Round 1 Target: ${p.initialTargetQuota} pts`
                          : `Inactive • Excluded from carts & leaderboards`}
                      </Text>
                    </View>

                    <View style={styles.quotaStepper}>
                      <TouchableOpacity
                        style={styles.quotaStepBtn}
                        onPress={() =>
                          updatePlayer(
                            p.id,
                            p.name,
                            Math.max(1, p.initialTargetQuota - 1),
                            p.flight
                          )
                        }
                      >
                        <Text style={styles.quotaStepBtnText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.quotaValueText}>{p.initialTargetQuota}</Text>
                      <TouchableOpacity
                        style={styles.quotaStepBtn}
                        onPress={() =>
                          updatePlayer(
                            p.id,
                            p.name,
                            p.initialTargetQuota + 1,
                            p.flight
                          )
                        }
                      >
                        <Text style={styles.quotaStepBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      style={{ marginLeft: 8 }}
                      onPress={() => deletePlayer(p.id)}
                    >
                      <Text
                        style={{ color: '#EF4444', fontSize: 11, fontWeight: '700' }}
                      >
                        Remove
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* TAB 4: TOURNAMENT FORMULA & SETTINGS */}
        {activeTab === 'settings' && (
          <View>
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>
                Target Quota Adjustment Percentage
              </Text>
              <Text style={styles.sectionDesc}>
                Controls how much a player&apos;s daily Target Quota adjusts from day to day:
                {'\n'}
                New Target = round(min(Old Target, Actual) + X% × |Actual − Old Target|)
              </Text>

              <View style={styles.percentControlRow}>
                <TouchableOpacity
                  style={styles.percentStepBtn}
                  onPress={() => {
                    const next = Math.max(
                      0,
                      state.settings.targetAdjustmentPercent - 5
                    );
                    updateSettings({ targetAdjustmentPercent: next });
                    setAdjPercentText(String(next));
                  }}
                >
                  <Text style={styles.percentStepBtnText}>− 5%</Text>
                </TouchableOpacity>

                <View style={styles.percentDisplayBox}>
                  <Text style={styles.percentBigValue}>
                    {state.settings.targetAdjustmentPercent}%
                  </Text>
                  <Text style={styles.percentSubLabel}>Adjustment Weight</Text>
                </View>

                <TouchableOpacity
                  style={styles.percentStepBtn}
                  onPress={() => {
                    const next = Math.min(
                      100,
                      state.settings.targetAdjustmentPercent + 5
                    );
                    updateSettings({ targetAdjustmentPercent: next });
                    setAdjPercentText(String(next));
                  }}
                >
                  <Text style={styles.percentStepBtnText}>+ 5%</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Custom Percentage (0–100)</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  keyboardType="number-pad"
                  value={adjPercentText}
                  onChangeText={setAdjPercentText}
                />
                <TouchableOpacity
                  style={styles.editCourseBtn}
                  onPress={() => {
                    const parsed = Math.max(
                      0,
                      Math.min(100, parseInt(adjPercentText, 10) || 60)
                    );
                    updateSettings({ targetAdjustmentPercent: parsed });
                    setAdjPercentText(String(parsed));
                  }}
                >
                  <Text style={styles.editCourseBtnText}>Apply %</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Tournament Identity & PINs</Text>
              <Text style={styles.fieldLabel}>Tournament Name</Text>
              <TextInput
                style={styles.input}
                value={state.settings.tournamentName}
                onChangeText={(tournamentName) =>
                  updateSettings({ tournamentName })
                }
              />

              <Text style={styles.fieldLabel}>Player Access PIN</Text>
              <TextInput
                style={styles.input}
                value={state.settings.tournamentPin}
                onChangeText={(tournamentPin) => updateSettings({ tournamentPin })}
              />

              <Text style={styles.fieldLabel}>Admin PIN</Text>
              <TextInput
                style={styles.input}
                value={state.settings.adminPin}
                onChangeText={(adminPin) => updateSettings({ adminPin })}
              />

              <TouchableOpacity
                style={[styles.secondaryBtn, { marginTop: 10, alignSelf: 'flex-start' }]}
                onPress={resetDemoData}
              >
                <Text style={styles.secondaryBtnText}>
                  Reset All Data to Initial Seeded Tournament
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  pinGateContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 20,
    justifyContent: 'center',
  },
  pinCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pinTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  pinSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 6,
    lineHeight: 18,
  },
  pinDemoHint: {
    marginTop: 10,
    fontSize: 12,
    color: '#065F46',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  pinInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginTop: 14,
    backgroundColor: '#F8FAFC',
  },
  pinErrorText: {
    color: '#DC2626',
    fontSize: 12,
    marginTop: 6,
    fontWeight: '600',
  },
  pinUnlockBtn: {
    backgroundColor: '#064E3B',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  pinUnlockBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  pinCancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  pinCancelBtnText: {
    color: '#475569',
    fontWeight: '800',
    fontSize: 15,
  },
  subNav: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subNavTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  subNavTab: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  subNavTabActive: {
    backgroundColor: '#064E3B',
  },
  subNavTabText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  subNavTabTextActive: {
    color: '#FFFFFF',
  },
  lockBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
  },
  lockBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#991B1B',
  },
  closeAdminBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#064E3B',
  },
  closeAdminBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 36,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
  },
  roundHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  roundCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  roundCardMeta: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  statusPills: {
    flexDirection: 'row',
    gap: 4,
  },
  statusPill: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  statusPillActive: {
    backgroundColor: '#059669',
  },
  statusPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
  },
  statusPillTextActive: {
    color: '#FFFFFF',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  courseSelectChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
  },
  courseSelectChipActive: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#059669',
  },
  courseSelectChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  courseSelectChipTextActive: {
    color: '#065F46',
    fontWeight: '700',
  },
  recalcBtn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  recalcBtnText: {
    color: '#1D4ED8',
    fontWeight: '700',
    fontSize: 12,
  },
  quotaTableHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
    paddingBottom: 6,
    marginBottom: 4,
  },
  quotaTh: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  quotaPlayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  quotaPlayerName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  quotaFormulaSub: {
    fontSize: 11,
    color: '#64748B',
  },
  prevRoundStatText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '600',
  },
  quotaStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 2,
  },
  quotaStepBtn: {
    width: 28,
    height: 28,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quotaStepBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  quotaValueText: {
    minWidth: 36,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    backgroundColor: '#F8FAFC',
    marginBottom: 10,
  },
  primaryActionBtn: {
    backgroundColor: '#064E3B',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  secondaryBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  secondaryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  editorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  courseValidationBanner: {
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  courseValidationTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  dupeWarningText: {
    fontSize: 11,
    color: '#B91C1C',
    fontWeight: '600',
    marginTop: 2,
  },
  validRanksText: {
    fontSize: 11,
    color: '#15803D',
    fontWeight: '600',
    marginTop: 2,
  },
  holeEditorHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
    paddingBottom: 6,
    marginBottom: 4,
  },
  holeEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  holeEditNum: {
    width: 52,
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  parSegmentRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    paddingRight: 10,
  },
  parSegBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  parSegBtnActive: {
    backgroundColor: '#059669',
  },
  parSegText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  parSegTextActive: {
    color: '#FFFFFF',
  },
  rankStepper: {
    width: 120,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 2,
  },
  rankValText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  courseListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  editCourseBtn: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    justifyContent: 'center',
  },
  editCourseBtnText: {
    color: '#065F46',
    fontWeight: '800',
    fontSize: 12,
  },
  addPlayerRow: {
    flexDirection: 'row',
    gap: 10,
  },
  flightSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  flightOptionBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
  },
  flightOptionBtnActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#059669',
  },
  flightOptionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  flightOptionTextActive: {
    color: '#065F46',
    fontWeight: '800',
  },
  flightToggleBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  flightToggleBadgeA: {
    backgroundColor: '#DBEAFE',
  },
  flightToggleBadgeB: {
    backgroundColor: '#FDE68A',
  },
  flightToggleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  flightToggleBadgeTextA: {
    color: '#1E40AF',
  },
  flightToggleBadgeTextB: {
    color: '#92400E',
  },
  percentControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 14,
  },
  percentStepBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
  },
  percentStepBtnText: {
    fontWeight: '800',
    color: '#0F172A',
    fontSize: 14,
  },
  percentDisplayBox: {
    alignItems: 'center',
  },
  percentBigValue: {
    fontSize: 28,
    fontWeight: '900',
    color: '#065F46',
  },
  percentSubLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  rosterHeaderStrip: {
    marginBottom: 8,
  },
  rosterFilterRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  rosterFilterPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  rosterFilterPillActive: {
    backgroundColor: '#064E3B',
  },
  rosterFilterPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  rosterFilterPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  quotaPlayerRowInactive: {
    opacity: 0.65,
    backgroundColor: '#F8FAFC',
  },
  quotaPlayerNameInactive: {
    color: '#64748B',
    textDecorationLine: 'line-through',
  },
  activeStatusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  activeStatusBadgeActive: {
    backgroundColor: '#DCFCE7',
  },
  activeStatusBadgeInactive: {
    backgroundColor: '#FEF3C7',
  },
  activeStatusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  activeStatusBadgeTextActive: {
    color: '#15803D',
  },
  activeStatusBadgeTextInactive: {
    color: '#B45309',
  },
  finalizeRoundBtn: {
    backgroundColor: '#065F46',
    borderRadius: 8,
    paddingVertical: 11,
    paddingHorizontal: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  finalizeRoundBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
  roundSelectChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  roundSelectChipActive: {
    backgroundColor: '#064E3B',
    borderColor: '#064E3B',
  },
  roundSelectChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  roundSelectChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  autoAssignBtn: {
    backgroundColor: '#065F46',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 7,
  },
  autoAssignBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  pairingSummaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  pairingSummaryPill: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  pairingSummaryLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  pairingSummaryValue: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 2,
  },
  unassignedNoticeBox: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  unassignedNoticeTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#B45309',
    marginBottom: 2,
  },
  unassignedNoticeText: {
    fontSize: 12,
    color: '#92400E',
    fontWeight: '600',
  },
  cartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  cartCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
    marginBottom: 10,
  },
  cartCardName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  cartCardMeta: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  cartDeleteBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
  },
  cartDeleteBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  cartPlayersList: {
    gap: 8,
  },
  cartPlayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
  },
  cartPlayerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartPlayerAvatarText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  cartPlayerName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  cartPlayerSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  removePlayerBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removePlayerBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
  },
  emptyCartHint: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  addPlayerToCartBtn: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#059669',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
  },
  addPlayerToCartBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#065F46',
  },
  pickerBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 10,
  },
  pickerTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  pickerCancelText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  pickerChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  pickerChip: {
    backgroundColor: '#064E3B',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  pickerChipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  pickerNoPlayersText: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
    marginTop: 4,
  },
  addCartSubmitBtn: {
    backgroundColor: '#064E3B',
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCartSubmitBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
  },
});
