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
import { Flight, Player } from '../types/tournament';
import {
  calculateAdjustedTargetQuota,
  calculatePlayerRoundStats,
  formatSignedScore,
} from '../utils/scoring';

interface MasterSheetScreenProps {
  onClose: () => void;
  onOpenAdmin?: () => void;
}

export const MasterSheetScreen: React.FC<MasterSheetScreenProps> = ({
  onClose,
  onOpenAdmin,
}) => {
  const {
    state,
    isAdminUnlocked,
    unlockAdmin,
    lockAdmin,
    recalculateRoundQuotasFromPrevious,
    updatePlayerRoundQuota,
    updatePlayer,
    updateSettings,
  } = useTournament();

  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const [activeFlight, setActiveFlight] = useState<Flight>('A');

  const sortedRounds = useMemo(
    () => [...state.rounds].sort((a, b) => a.roundNumber - b.roundNumber),
    [state.rounds]
  );

  const flightPlayers = useMemo(
    () => state.players.filter((p) => p.flight === activeFlight),
    [state.players, activeFlight]
  );

  if (!isAdminUnlocked) {
    return (
      <View style={styles.pinGate}>
        <View style={styles.pinCard}>
          <Text style={styles.pinTitle}>Uncle Joe&apos;s Master Sheet</Text>
          <Text style={styles.pinSubtitle}>
            Enter Admin PIN to review the tournament grid, calculate daily target adjustments, or edit course pars.
          </Text>
          <Text style={styles.pinHint}>Default PIN: 9999</Text>
          <TextInput
            style={styles.pinInput}
            secureTextEntry
            keyboardType="number-pad"
            placeholder="PIN"
            value={pinInput}
            onChangeText={(t) => {
              setPinInput(t);
              setPinError('');
            }}
          />
          {pinError ? <Text style={styles.pinErrorText}>{pinError}</Text> : null}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.unlockBtn}
              onPress={() => {
                if (!unlockAdmin(pinInput)) {
                  setPinError('Invalid Admin PIN. (Default: 9999)');
                } else {
                  setPinInput('');
                }
              }}
            >
              <Text style={styles.unlockBtnText}>Unlock Sheet</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <View>
          <Text style={styles.sheetTitle}>Uncle Joe&apos;s Master Scoring Sheet</Text>
          <Text style={styles.sheetSubtitle}>
            {state.settings.tournamentName} • {state.settings.targetAdjustmentPercent}% Rule
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {onOpenAdmin && (
            <TouchableOpacity style={styles.manageAdminBtn} onPress={onOpenAdmin}>
              <Text style={styles.manageAdminBtnText}>⚙️ Manage Players</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
            <Text style={styles.doneBtnText}>Close Sheet</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Flight Picker + One-Click Adjustments Action */}
      <View style={styles.actionBar}>
        <View style={styles.flightToggleGroup}>
          <TouchableOpacity
            style={[
              styles.flightBtn,
              activeFlight === 'A' && styles.flightBtnActiveA,
            ]}
            onPress={() => setActiveFlight('A')}
          >
            <Text
              style={[
                styles.flightBtnText,
                activeFlight === 'A' && styles.flightBtnTextActive,
              ]}
            >
              A - Group ({state.players.filter((p) => p.flight === 'A').length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.flightBtn,
              activeFlight === 'B' && styles.flightBtnActiveB,
            ]}
            onPress={() => setActiveFlight('B')}
          >
            <Text
              style={[
                styles.flightBtnText,
                activeFlight === 'B' && styles.flightBtnTextActive,
              ]}
            >
              B - Group ({state.players.filter((p) => p.flight === 'B').length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Quick Calculation for Next Round */}
        <TouchableOpacity
          style={styles.autoCalcBtn}
          onPress={() => {
            const nextRound = state.rounds.find((r) => r.roundNumber === 2);
            if (nextRound) recalculateRoundQuotasFromPrevious(nextRound.id);
          }}
        >
          <Text style={styles.autoCalcBtnText}>
            ⚡ Calculate Next Round Targets ({state.settings.targetAdjustmentPercent}%)
          </Text>
        </TouchableOpacity>
      </View>

      {/* The Master Paper Worksheet Grid */}
      <ScrollView horizontal style={styles.gridScroll}>
        <View>
          {/* Header Row: Courses & Dates */}
          <View style={styles.gridHeaderRow}>
            <View style={[styles.gridCell, styles.nameHeaderCol]}>
              <Text style={styles.headerLabel}>NAME & IH</Text>
            </View>

            {sortedRounds.map((round) => {
              const course = state.courses.find((c) => c.id === round.courseId);
              return (
                <View key={round.id} style={[styles.gridCell, styles.roundHeaderCol]}>
                  <Text style={styles.roundColTitle} numberOfLines={1}>
                    {course?.name || `Round ${round.roundNumber}`}
                  </Text>
                  <View style={styles.roundSubHeaders}>
                    <Text style={styles.roundSubCol}>TGT/ACT</Text>
                    <Text style={styles.roundSubCol}>INS</Text>
                    <Text style={styles.roundSubCol}>ONS</Text>
                  </View>
                </View>
              );
            })}

            <View style={[styles.gridCell, styles.standingsHeaderCol]}>
              <Text style={styles.headerLabel}>FINAL</Text>
            </View>
          </View>

          {/* Player Rows */}
          <ScrollView style={{ flex: 1 }}>
            {flightPlayers.map((player) => {
              let runningOns = 0;
              return (
                <View key={player.id} style={styles.gridPlayerRow}>
                  {/* Name Col */}
                  <View style={[styles.gridCell, styles.nameHeaderCol]}>
                    <Text style={styles.gridPlayerName}>{player.name}</Text>
                    <Text style={styles.gridPlayerIh}>IH: {player.initialTargetQuota}</Text>
                  </View>

                  {/* Round Columns */}
                  {sortedRounds.map((round) => {
                    const course = state.courses.find((c) => c.id === round.courseId);
                    const stats = calculatePlayerRoundStats(player, round, course);
                    const quota = round.targetQuotas[player.id] ?? player.initialTargetQuota;
                    const hasPlayed = stats.holesPlayed > 0;

                    if (hasPlayed) {
                      runningOns += stats.netQuotaScore;
                    }

                    return (
                      <View key={round.id} style={[styles.gridCell, styles.roundHeaderCol]}>
                        <View style={styles.cellFractionBox}>
                          <Text style={styles.cellFractionText}>
                            {quota} / {hasPlayed ? stats.actualPoints : '—'}
                          </Text>
                        </View>
                        <View style={styles.cellStatCol}>
                          <Text
                            style={[
                              styles.cellNetText,
                              hasPlayed && stats.netQuotaScore > 0
                                ? styles.scoreGreen
                                : hasPlayed && stats.netQuotaScore < 0
                                ? styles.scoreRed
                                : undefined,
                            ]}
                          >
                            {hasPlayed ? formatSignedScore(stats.netQuotaScore) : '—'}
                          </Text>
                        </View>
                        <View style={styles.cellStatCol}>
                          <Text
                            style={[
                              styles.cellNetText,
                              hasPlayed && runningOns > 0
                                ? styles.scoreGreen
                                : hasPlayed && runningOns < 0
                                ? styles.scoreRed
                                : undefined,
                            ]}
                          >
                            {hasPlayed ? formatSignedScore(runningOns) : '—'}
                          </Text>
                        </View>
                      </View>
                    );
                  })}

                  {/* Cumulative Total */}
                  <View style={[styles.gridCell, styles.standingsHeaderCol]}>
                    <Text style={styles.finalOnsText}>{formatSignedScore(runningOns)}</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </ScrollView>

      {/* Quick Settings Footer Strip */}
      <View style={styles.footerStrip}>
        <Text style={styles.footerNote}>
          Tap &quot;⚡ Calculate Next Round Targets&quot; to apply Uncle Joe&apos;s 60% rule: min(Old, Act) + 60% × diff.
        </Text>
        <TouchableOpacity style={styles.lockBtn} onPress={lockAdmin}>
          <Text style={styles.lockBtnText}>🔒 Lock Sheet</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  pinGate: {
    flex: 1,
    backgroundColor: '#064E3B',
    justifyContent: 'center',
    padding: 20,
  },
  pinCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
  },
  pinTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
  },
  pinSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 18,
  },
  pinHint: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
    marginTop: 8,
  },
  pinInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginTop: 12,
  },
  pinErrorText: {
    color: '#DC2626',
    fontSize: 12,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontWeight: '700',
    color: '#475569',
  },
  unlockBtn: {
    flex: 2,
    backgroundColor: '#064E3B',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  unlockBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  topBar: {
    backgroundColor: '#064E3B',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  sheetSubtitle: {
    color: '#A7F3D0',
    fontSize: 12,
    marginTop: 2,
  },
  manageAdminBtn: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  manageAdminBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  doneBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  doneBtnText: {
    color: '#052E16',
    fontWeight: '800',
    fontSize: 12,
  },
  actionBar: {
    padding: 10,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
    gap: 8,
  },
  flightToggleGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  flightBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
  },
  flightBtnActiveA: {
    backgroundColor: '#1E40AF',
  },
  flightBtnActiveB: {
    backgroundColor: '#B45309',
  },
  flightBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
  },
  flightBtnTextActive: {
    color: '#FFFFFF',
  },
  autoCalcBtn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#93C5FD',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  autoCalcBtnText: {
    color: '#1D4ED8',
    fontWeight: '800',
    fontSize: 12,
  },
  gridScroll: {
    flex: 1,
  },
  gridHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#334155',
  },
  gridCell: {
    borderRightWidth: 1,
    borderRightColor: '#CBD5E1',
    paddingVertical: 8,
    paddingHorizontal: 6,
    justifyContent: 'center',
  },
  nameHeaderCol: {
    width: 120,
    backgroundColor: '#1E293B',
  },
  roundHeaderCol: {
    width: 160,
  },
  standingsHeaderCol: {
    width: 80,
    alignItems: 'center',
    backgroundColor: '#1E293B',
  },
  headerLabel: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 11,
    textAlign: 'center',
  },
  roundColTitle: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 11,
    textAlign: 'center',
  },
  roundSubHeaders: {
    flexDirection: 'row',
    marginTop: 4,
    justifyContent: 'space-around',
  },
  roundSubCol: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
  },
  gridPlayerRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  gridPlayerName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  gridPlayerIh: {
    fontSize: 11,
    color: '#64748B',
  },
  cellFractionBox: {
    flex: 1.5,
    alignItems: 'center',
  },
  cellFractionText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  cellStatCol: {
    flex: 1,
    alignItems: 'center',
  },
  cellNetText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
  },
  scoreGreen: {
    color: '#166534',
  },
  scoreRed: {
    color: '#991B1B',
  },
  finalOnsText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  footerStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F1F5F9',
    borderTopWidth: 1,
    borderTopColor: '#CBD5E1',
  },
  footerNote: {
    flex: 1,
    fontSize: 11,
    color: '#64748B',
    paddingRight: 8,
  },
  lockBtn: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  lockBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#991B1B',
  },
});
