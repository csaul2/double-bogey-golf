import React, { useMemo, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTournament } from '../context/TournamentContext';
import { Course, Flight, Player, Round } from '../types/tournament';
import {
  buildLeaderboard,
  calculateHolePoints,
  calculatePlayerRoundStats,
  formatSignedScore,
  LeaderboardEntry,
} from '../utils/scoring';

interface StandingsScreenProps {
  onEnterScores: () => void;
  onOpenAdmin: () => void;
}

export const StandingsScreen: React.FC<StandingsScreenProps> = ({
  onEnterScores,
  onOpenAdmin,
}) => {
  const { state } = useTournament();
  const [activeFlight, setActiveFlight] = useState<Flight>('A');
  const [inspectedPlayer, setInspectedPlayer] = useState<Player | null>(null);

  const activeRound = useMemo(
    () => state.rounds.find((r) => r.status === 'active') || state.rounds[0],
    [state.rounds]
  );

  const activeCourse = useMemo(
    () => state.courses.find((c) => c.id === activeRound?.courseId),
    [state.courses, activeRound]
  );

  const flightPlayers = useMemo(
    () => state.players.filter((p) => p.flight === activeFlight),
    [state.players, activeFlight]
  );

  const leaderboard = useMemo(
    () =>
      buildLeaderboard(
        flightPlayers,
        state.rounds,
        state.courses,
        'overall',
        'netQuota'
      ),
    [flightPlayers, state.rounds, state.courses]
  );

  return (
    <View style={styles.container}>
      {/* Clean Top Banner */}
      <View style={styles.topHeader}>
        <View style={styles.titleArea}>
          <Text style={styles.eventTitle}>{state.settings.tournamentName}</Text>
          <Text style={styles.eventSubtitle}>
            {activeRound?.name || 'Tournament Standings'}
          </Text>
        </View>
        <View style={styles.headerRightButtons}>
          <TouchableOpacity style={styles.scoreNavBtn} onPress={onEnterScores}>
            <Text style={styles.scoreNavBtnText}>⛳ Enter Scores</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.adminGearBtn} onPress={onOpenAdmin}>
            <Text style={styles.adminGearText}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Flight Division Switcher: Large High-Contrast Pills */}
      <View style={styles.flightToggleRow}>
        <TouchableOpacity
          style={[
            styles.flightPill,
            activeFlight === 'A' && styles.flightPillActiveA,
          ]}
          onPress={() => setActiveFlight('A')}
        >
          <Text
            style={[
              styles.flightPillText,
              activeFlight === 'A' && styles.flightPillTextActive,
            ]}
          >
            A - GROUP
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.flightPill,
            activeFlight === 'B' && styles.flightPillActiveB,
          ]}
          onPress={() => setActiveFlight('B')}
        >
          <Text
            style={[
              styles.flightPillText,
              activeFlight === 'B' && styles.flightPillTextActive,
            ]}
          >
            B - GROUP
          </Text>
        </TouchableOpacity>
      </View>

      {/* Table Headers matching Uncle Joe's sheet: Tgt/Act, INS (Today), ONS (Overall) */}
      <View style={styles.tableHeaderRow}>
        <Text style={[styles.thText, { width: 38, textAlign: 'center' }]}>#</Text>
        <Text style={[styles.thText, { flex: 1, paddingLeft: 4 }]}>PLAYER</Text>
        <Text style={[styles.thText, { width: 75, textAlign: 'center' }]}>
          TGT / ACT
        </Text>
        <Text style={[styles.thText, { width: 62, textAlign: 'center' }]}>
          INS (TODAY)
        </Text>
        <Text style={[styles.thText, { width: 68, textAlign: 'center' }]}>
          ONS (TOTAL)
        </Text>
      </View>

      {/* Player Rows */}
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {leaderboard.map((entry: LeaderboardEntry) => {
          const isLeader = entry.rankDisplay === '1';
          const isTop3 =
            entry.rankDisplay === '1' ||
            entry.rankDisplay === '2' ||
            entry.rankDisplay === '3';

          const todayStats = activeRound ? entry.roundStats[activeRound.id] : undefined;
          const todayIns = todayStats?.holesPlayed ? todayStats.netQuotaScore : 0;
          const todayThru = todayStats?.holesPlayed
            ? todayStats.holesPlayed === 18
              ? 'F'
              : `${todayStats.holesPlayed}H`
            : '-';

          return (
            <TouchableOpacity
              key={entry.player.id}
              style={[styles.playerRow, isLeader && styles.leaderRow]}
              onPress={() => setInspectedPlayer(entry.player)}
              activeOpacity={0.7}
            >
              {/* Rank Badge */}
              <View style={styles.rankCol}>
                <View
                  style={[
                    styles.rankBadge,
                    isTop3 && styles.rankBadgeTop,
                  ]}
                >
                  <Text style={[styles.rankText, isTop3 && styles.rankTextTop]}>
                    {entry.rankDisplay}
                  </Text>
                </View>
              </View>

              {/* Player Name & Round Info */}
              <View style={styles.nameCol}>
                <Text style={styles.playerName}>{entry.player.name}</Text>
                {entry.tiebrokenBy ? (
                  <Text style={styles.tiebreakText} numberOfLines={1}>
                    {entry.tiebrokenBy}
                  </Text>
                ) : (
                  <Text style={styles.thruSubText}>Thru: {todayThru}</Text>
                )}
              </View>

              {/* Target / Actual Fraction */}
              <View style={styles.fractionCol}>
                <Text style={styles.fractionTop}>
                  {entry.totalActualPoints} pts
                </Text>
                <Text style={styles.fractionBot}>
                  / {entry.totalTargetQuota} tgt
                </Text>
              </View>

              {/* INS (Today's Net Score) */}
              <View style={styles.insCol}>
                <Text
                  style={[
                    styles.insText,
                    todayIns > 0
                      ? styles.scoreGreen
                      : todayIns < 0
                      ? styles.scoreRed
                      : undefined,
                  ]}
                >
                  {todayStats?.holesPlayed ? formatSignedScore(todayIns) : '-'}
                </Text>
              </View>

              {/* ONS (Overall Net Score Badge) */}
              <View style={styles.onsCol}>
                <View
                  style={[
                    styles.onsPill,
                    entry.totalNetQuotaScore > 0
                      ? styles.onsPillGreen
                      : entry.totalNetQuotaScore < 0
                      ? styles.onsPillRed
                      : undefined,
                  ]}
                >
                  <Text
                    style={[
                      styles.onsText,
                      entry.totalNetQuotaScore > 0
                        ? styles.onsTextGreen
                        : entry.totalNetQuotaScore < 0
                        ? styles.onsTextRed
                        : undefined,
                    ]}
                  >
                    {formatSignedScore(entry.totalNetQuotaScore)}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Worksheet Explanation Note */}
        <View style={styles.sheetLegendCard}>
          <Text style={styles.sheetLegendTitle}>Uncle Joe&apos;s Scoring Keys:</Text>
          <Text style={styles.sheetLegendText}>
            • <Text style={{ fontWeight: '700' }}>INS (International Net Score)</Text> = Today&apos;s Actual Points minus Target.
            {'\n'}• <Text style={{ fontWeight: '700' }}>ONS (Overall Net Score)</Text> = Cumulative tournament $+/-$ across rounds.
            {'\n'}• <Text style={{ fontWeight: '700' }}>Tie-Breakers</Text> = Broken by points scored starting from Hole Difficulty Rank #1 through #18.
          </Text>
        </View>
      </ScrollView>

      {/* Hole-by-Hole Player Card Modal */}
      {inspectedPlayer && (
        <PlayerScorecardModal
          player={inspectedPlayer}
          rounds={state.rounds}
          courses={state.courses}
          initialRoundId={activeRound?.id || state.rounds[0]?.id}
          onClose={() => setInspectedPlayer(null)}
        />
      )}
    </View>
  );
};

interface PlayerScorecardModalProps {
  player: Player;
  rounds: Round[];
  courses: Course[];
  initialRoundId: string;
  onClose: () => void;
}

const PlayerScorecardModal: React.FC<PlayerScorecardModalProps> = ({
  player,
  rounds,
  courses,
  initialRoundId,
  onClose,
}) => {
  const [roundId, setRoundId] = useState(initialRoundId);
  const round = rounds.find((r) => r.id === roundId) || rounds[0];
  const course = courses.find((c) => c.id === round?.courseId);
  const stats = round ? calculatePlayerRoundStats(player, round, course) : null;
  const playerHoleScores = round?.scores[player.id] || {};

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>{player.name} ({player.flight}-Group)</Text>
              <Text style={styles.modalSubtitle}>
                {course?.name || 'Course'} • Target: {stats?.targetQuota ?? '-'} pts
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>Done</Text>
            </TouchableOpacity>
          </View>

          {/* Round Selector inside Modal */}
          <View style={styles.modalRoundTabs}>
            {rounds.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={[styles.modalRoundTab, r.id === round?.id && styles.modalRoundTabActive]}
                onPress={() => setRoundId(r.id)}
              >
                <Text
                  style={[
                    styles.modalRoundTabText,
                    r.id === round?.id && styles.modalRoundTabTextActive,
                  ]}
                >
                  R{r.roundNumber}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {stats && (
            <View style={styles.modalSummaryStrip}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Target</Text>
                <Text style={styles.statValue}>{stats.targetQuota}p</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Actual</Text>
                <Text style={styles.statValue}>{stats.actualPoints}p</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>INS (Today)</Text>
                <Text style={styles.statValue}>{formatSignedScore(stats.netQuotaScore)}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Strokes</Text>
                <Text style={styles.statValue}>{stats.grossStrokes || '-'}</Text>
              </View>
            </View>
          )}

          <ScrollView style={{ paddingHorizontal: 16 }}>
            {course?.holes.map((hole) => {
              const strokes = playerHoleScores[hole.holeNumber];
              const res = calculateHolePoints(strokes, hole.par);
              return (
                <View key={hole.holeNumber} style={styles.modalHoleRow}>
                  <Text style={styles.modalHoleNum}>Hole #{hole.holeNumber}</Text>
                  <Text style={styles.modalHolePar}>Par {hole.par} (HCP {hole.difficultyRank})</Text>
                  <Text style={styles.modalHoleStrokes}>{strokes ? `${strokes} st` : '-'}</Text>
                  <Text style={styles.modalHolePts}>
                    {strokes ? `+${res.points} pts (${res.label})` : '-'}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
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
  titleArea: {
    flex: 1,
    paddingRight: 10,
  },
  eventTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  eventSubtitle: {
    color: '#A7F3D0',
    fontSize: 12,
    marginTop: 2,
  },
  headerRightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scoreNavBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  scoreNavBtnText: {
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
  flightToggleRow: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 10,
  },
  flightPill: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  flightPillActiveA: {
    backgroundColor: '#1E40AF',
  },
  flightPillActiveB: {
    backgroundColor: '#B45309',
  },
  flightPillText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  flightPillTextActive: {
    color: '#FFFFFF',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  thText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#334155',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 24,
  },
  playerRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 13,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  leaderRow: {
    backgroundColor: '#FDFBF7',
  },
  rankCol: {
    width: 38,
    alignItems: 'center',
  },
  rankBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeTop: {
    backgroundColor: '#FEF3C7',
  },
  rankText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  rankTextTop: {
    color: '#92400E',
    fontWeight: '800',
  },
  nameCol: {
    flex: 1,
    paddingLeft: 6,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  thruSubText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  tiebreakText: {
    fontSize: 10,
    color: '#0369A1',
    fontWeight: '700',
    marginTop: 2,
  },
  fractionCol: {
    width: 75,
    alignItems: 'center',
  },
  fractionTop: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  fractionBot: {
    fontSize: 10,
    color: '#64748B',
  },
  insCol: {
    width: 62,
    alignItems: 'center',
  },
  insText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#475569',
  },
  onsCol: {
    width: 68,
    alignItems: 'center',
  },
  onsPill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    minWidth: 44,
    alignItems: 'center',
  },
  onsPillGreen: {
    backgroundColor: '#DCFCE7',
  },
  onsPillRed: {
    backgroundColor: '#FEE2E2',
  },
  onsText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#1E293B',
  },
  onsTextGreen: {
    color: '#166534',
  },
  onsTextRed: {
    color: '#991B1B',
  },
  scoreGreen: {
    color: '#166534',
  },
  scoreRed: {
    color: '#991B1B',
  },
  sheetLegendCard: {
    margin: 12,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sheetLegendTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  sheetLegendText: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    maxHeight: '85%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  closeBtnText: {
    fontWeight: '800',
    color: '#0F172A',
  },
  modalRoundTabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  modalRoundTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
  },
  modalRoundTabActive: {
    backgroundColor: '#064E3B',
  },
  modalRoundTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  modalRoundTabTextActive: {
    color: '#FFFFFF',
  },
  modalSummaryStrip: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '700',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 2,
  },
  modalHoleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    alignItems: 'center',
  },
  modalHoleNum: {
    width: 65,
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalHolePar: {
    flex: 1,
    fontSize: 12,
    color: '#64748B',
  },
  modalHoleStrokes: {
    width: 50,
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  modalHolePts: {
    width: 110,
    fontSize: 12,
    fontWeight: '800',
    color: '#059669',
    textAlign: 'right',
  },
});
