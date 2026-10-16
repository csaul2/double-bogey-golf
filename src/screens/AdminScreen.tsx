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

export const AdminScreen: React.FC = () => {
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
    addRound,
    updateRoundStatus,
    updateRoundCourse,
    updatePlayerRoundQuota,
    recalculateRoundQuotasFromPrevious,
    updateSettings,
    resetDemoData,
  } = useTournament();

  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const [activeTab, setActiveTab] = useState<
    'rounds' | 'courses' | 'players' | 'settings'
  >('rounds');

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
          <TouchableOpacity
            style={styles.pinUnlockBtn}
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
              { id: 'courses', label: 'Courses (Par/HCP)' },
              { id: 'players', label: 'Players' },
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
        </View>
        <TouchableOpacity style={styles.lockBtn} onPress={lockAdmin}>
          <Text style={styles.lockBtnText}>Lock</Text>
        </TouchableOpacity>
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
              <Text style={styles.sectionTitle}>
                Tournament Roster ({state.players.length} Players)
              </Text>
              <Text style={[styles.sectionDesc, { marginBottom: 8 }]}>
                Tap a player&apos;s Flight A / B pill to switch their flight assignment.
              </Text>
              {state.players.map((p) => (
                <View key={p.id} style={styles.quotaPlayerRow}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.quotaPlayerName}>{p.name}</Text>
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
                      Starting Round 1 Target: {p.initialTargetQuota} pts
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
                        updatePlayer(p.id, p.name, p.initialTargetQuota + 1, p.flight)
                      }
                    >
                      <Text style={styles.quotaStepBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={{ marginLeft: 10 }}
                    onPress={() => deletePlayer(p.id)}
                  >
                    <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '700' }}>
                      Remove
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
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
    marginTop: 14,
  },
  pinUnlockBtnText: {
    color: '#FFFFFF',
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
    marginLeft: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
  },
  lockBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#991B1B',
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
});
