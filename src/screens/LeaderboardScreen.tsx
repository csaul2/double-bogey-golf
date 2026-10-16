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

interface LeaderboardScreenProps {
  onStartScoring: () => void;
}

type FlightViewMode = 'split' | 'A' | 'B' | 'combined';

export const LeaderboardScreen: React.FC<LeaderboardScreenProps> = ({ onStartScoring }) => {
  const { state } = useTournament();
  const [selectedRoundId, setSelectedRoundId] = useState<string | 'overall'>('overall');
  const [flightView, setFlightView] = useState<FlightViewMode>('split');
  const [sortBy, setSortBy] = useState<'netQuota' | 'grossPoints' | 'grossStrokes'>('netQuota');
  const [inspectedPlayer, setInspectedPlayer] = useState<Player | null>(null);

  const sortedRounds = useMemo(
    () => [...state.rounds].sort((a, b) => a.roundNumber - b.roundNumber),
    [state.rounds]
  );

  // Build separate flight leaderboards so Flight A and Flight B each rank 1..N independently
  // with their own difficulty-rank tie-breakers
  const flightALeaderboard = useMemo(
    () =>
      buildLeaderboard(
        state.players.filter((p) => p.flight === 'A'),
        state.rounds,
        state.courses,
        selectedRoundId,
        sortBy
      ),
    [state.players, state.rounds, state.courses, selectedRoundId, sortBy]
  );

  const flightBLeaderboard = useMemo(
    () =>
      buildLeaderboard(
        state.players.filter((p) => p.flight === 'B'),
        state.rounds,
        state.courses,
        selectedRoundId,
        sortBy
      ),
    [state.players, state.rounds, state.courses, selectedRoundId, sortBy]
  );

  const combinedLeaderboard = useMemo(
    () =>
      buildLeaderboard(
        state.players,
        state.rounds,
        state.courses,
        selectedRoundId,
        sortBy
      ),
    [state.players, state.rounds, state.courses, selectedRoundId, sortBy]
  );

  const activeRound = useMemo(
    () => state.rounds.find((r) => r.status === 'active') || sortedRounds[0],
    [state.rounds, sortedRounds]
  );

  const renderEntryRow = (entry: LeaderboardEntry) => {
    const isTop3 =
      entry.rankDisplay === '1' ||
      entry.rankDisplay === '2' ||
      entry.rankDisplay === '3' ||
      entry.rankDisplay === 'T1' ||
      entry.rankDisplay === 'T2' ||
      entry.rankDisplay === 'T3';

    const displayRound =
      selectedRoundId === 'overall'
        ? activeRound
        : state.rounds.find((r) => r.id === selectedRoundId);

    const activeStats = displayRound ? entry.roundStats[displayRound.id] : undefined;
    const thruDisplay =
      selectedRoundId === 'overall'
        ? `${entry.totalHolesPlayed}H`
        : activeStats?.holesPlayed === 18
        ? 'F'
        : activeStats?.holesPlayed
        ? `${activeStats.holesPlayed}`
        : '-';

    const primaryDisplay =
      sortBy === 'grossStrokes'
        ? entry.totalHolesPlayed > 0
          ? `${formatSignedScore(entry.totalGrossDiffToPar)} (${entry.totalGrossStrokes})`
          : '-'
        : sortBy === 'grossPoints'
        ? `${entry.totalActualPoints}`
        : formatSignedScore(entry.totalNetQuotaScore);

    return (
      <TouchableOpacity
        key={entry.player.id}
        style={styles.row}
        onPress={() => setInspectedPlayer(entry.player)}
        activeOpacity={0.75}
      >
        <View style={styles.colPos}>
          <View style={[styles.rankBadge, isTop3 && styles.rankBadgeTop]}>
            <Text style={[styles.rankText, isTop3 && styles.rankTextTop]}>
              {entry.rankDisplay}
            </Text>
          </View>
        </View>

        <View style={styles.colPlayer}>
          <View style={styles.playerRowMain}>
            <View
              style={[
                styles.avatarDot,
                { backgroundColor: entry.player.avatarColor },
              ]}
            >
              <Text style={styles.avatarInitial}>
                {entry.player.name.charAt(0)}
              </Text>
            </View>
            <View style={styles.playerTextWrap}>
              <View style={styles.playerNameLine}>
                <Text style={styles.playerName} numberOfLines={1}>
                  {entry.player.name}
                </Text>
                <View
                  style={[
                    styles.flightMiniBadge,
                    entry.player.flight === 'A'
                      ? styles.flightBadgeA
                      : styles.flightBadgeB,
                  ]}
                >
                  <Text
                    style={[
                      styles.flightMiniBadgeText,
                      entry.player.flight === 'A'
                        ? styles.flightBadgeTextA
                        : styles.flightBadgeTextB,
                    ]}
                  >
                    FLIGHT {entry.player.flight}
                  </Text>
                </View>
              </View>
              {selectedRoundId === 'overall' ? (
                <View style={styles.roundMiniPills}>
                  {sortedRounds.map((r) => {
                    const rs = entry.roundStats[r.id];
                    if (!rs || (rs.holesPlayed === 0 && r.status === 'upcoming')) {
                      return (
                        <Text key={r.id} style={styles.roundMiniMuted}>
                          R{r.roundNumber}: Tgt {rs?.targetQuota ?? '-'}
                        </Text>
                      );
                    }
                    return (
                      <Text key={r.id} style={styles.roundMiniText}>
                        R{r.roundNumber}: {rs.actualPoints}/{rs.targetQuota} (
                        {formatSignedScore(rs.netQuotaScore)})
                      </Text>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.playerSub}>
                  Gross Strokes: {entry.totalGrossStrokes || '-'}
                </Text>
              )}
              {entry.tiebrokenBy ? (
                <Text style={styles.tiebreakNote}>{entry.tiebrokenBy}</Text>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.colQuota}>
          <Text style={styles.quotaNumbers}>
            {entry.totalActualPoints} / {entry.totalTargetQuota}
          </Text>
          <Text style={styles.quotaSub}>pts / target</Text>
        </View>

        <View style={styles.colThru}>
          <Text style={styles.thruText}>{thruDisplay}</Text>
        </View>

        <View style={styles.colScore}>
          <View
            style={[
              styles.scorePill,
              sortBy === 'netQuota' &&
                entry.totalNetQuotaScore > 0 &&
                styles.scorePillPositive,
              sortBy === 'netQuota' &&
                entry.totalNetQuotaScore < 0 &&
                styles.scorePillNegative,
            ]}
          >
            <Text
              style={[
                styles.scorePillText,
                sortBy === 'netQuota' &&
                  entry.totalNetQuotaScore > 0 &&
                  styles.scorePillTextPositive,
                sortBy === 'netQuota' &&
                  entry.totalNetQuotaScore < 0 &&
                  styles.scorePillTextNegative,
              ]}
            >
              {primaryDisplay}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderFlightSection = (flight: Flight, entries: LeaderboardEntry[]) => {
    const leader = entries[0];
    return (
      <View key={`flight-${flight}`} style={styles.flightSectionWrap}>
        <View
          style={[
            styles.flightSectionHeader,
            flight === 'A' ? styles.flightHeaderBgA : styles.flightHeaderBgB,
          ]}
        >
          <View style={styles.flightHeaderLeft}>
            <View
              style={[
                styles.flightTitleBadge,
                flight === 'A' ? styles.flightBadgeA : styles.flightBadgeB,
              ]}
            >
              <Text
                style={[
                  styles.flightTitleBadgeText,
                  flight === 'A' ? styles.flightBadgeTextA : styles.flightBadgeTextB,
                ]}
              >
                {flight} FLIGHT
              </Text>
            </View>
            <Text style={styles.flightHeaderCount}>
              {entries.length} Player{entries.length === 1 ? '' : 's'}
            </Text>
          </View>
          {leader ? (
            <Text style={styles.flightLeaderCallout}>
              Leader: {leader.player.name} ({formatSignedScore(leader.totalNetQuotaScore)})
            </Text>
          ) : null}
        </View>

        {entries.length === 0 ? (
          <View style={styles.emptyFlightRow}>
            <Text style={styles.emptyFlightText}>
              No players assigned to {flight} Flight yet.
            </Text>
          </View>
        ) : (
          entries.map(renderEntryRow)
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Tournament Hero Banner */}
      <View style={styles.banner}>
        <View style={styles.bannerLeft}>
          <Text style={styles.tournamentTitle}>{state.settings.tournamentName}</Text>
          <Text style={styles.tournamentSubtitle}>
            A & B Flights • {state.settings.targetAdjustmentPercent}% Quota Adj.
          </Text>
        </View>
        <TouchableOpacity style={styles.scoreCta} onPress={onStartScoring}>
          <Text style={styles.scoreCtaText}>+ Score Group</Text>
        </TouchableOpacity>
      </View>

      {/* Round + Flight + Mode Filter Bar */}
      <View style={styles.filterBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.roundPills}
        >
          <TouchableOpacity
            style={[
              styles.roundPill,
              selectedRoundId === 'overall' && styles.roundPillActive,
            ]}
            onPress={() => setSelectedRoundId('overall')}
          >
            <Text
              style={[
                styles.roundPillText,
                selectedRoundId === 'overall' && styles.roundPillTextActive,
              ]}
            >
              Overall Standings
            </Text>
          </TouchableOpacity>
          {sortedRounds.map((round) => (
            <TouchableOpacity
              key={round.id}
              style={[
                styles.roundPill,
                selectedRoundId === round.id && styles.roundPillActive,
              ]}
              onPress={() => setSelectedRoundId(round.id)}
            >
              <Text
                style={[
                  styles.roundPillText,
                  selectedRoundId === round.id && styles.roundPillTextActive,
                ]}
              >
                R{round.roundNumber}
                {round.status === 'active' ? ' (Live)' : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Flight Division Switcher */}
        <View style={styles.flightSwitchRow}>
          {(
            [
              { id: 'split', label: 'A & B Flights (Split)' },
              { id: 'A', label: 'A Flight Only' },
              { id: 'B', label: 'B Flight Only' },
              { id: 'combined', label: 'Combined Field' },
            ] as const
          ).map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.flightFilterBtn,
                flightView === tab.id && styles.flightFilterBtnActive,
              ]}
              onPress={() => setFlightView(tab.id)}
            >
              <Text
                style={[
                  styles.flightFilterText,
                  flightView === tab.id && styles.flightFilterTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Scoring Mode Toggle */}
        <View style={styles.modeSwitchRow}>
          <TouchableOpacity
            style={[styles.modeBtn, sortBy === 'netQuota' && styles.modeBtnActive]}
            onPress={() => setSortBy('netQuota')}
          >
            <Text
              style={[
                styles.modeBtnText,
                sortBy === 'netQuota' && styles.modeBtnTextActive,
              ]}
            >
              Net vs. Quota (+/-)
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, sortBy === 'grossPoints' && styles.modeBtnActive]}
            onPress={() => setSortBy('grossPoints')}
          >
            <Text
              style={[
                styles.modeBtnText,
                sortBy === 'grossPoints' && styles.modeBtnTextActive,
              ]}
            >
              Total Points
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, sortBy === 'grossStrokes' && styles.modeBtnActive]}
            onPress={() => setSortBy('grossStrokes')}
          >
            <Text
              style={[
                styles.modeBtnText,
                sortBy === 'grossStrokes' && styles.modeBtnTextActive,
              ]}
            >
              Gross Strokes
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Table Header */}
      <View style={styles.tableHeader}>
        <Text style={[styles.thText, styles.colPos]}>POS</Text>
        <Text style={[styles.thText, styles.colPlayer]}>PLAYER</Text>
        <Text style={[styles.thText, styles.colQuota]}>PTS / TARGET</Text>
        <Text style={[styles.thText, styles.colThru]}>THRU</Text>
        <Text style={[styles.thText, styles.colScore]}>
          {sortBy === 'grossStrokes'
            ? 'TO PAR'
            : sortBy === 'grossPoints'
            ? 'PTS'
            : 'NET'}
        </Text>
      </View>

      {/* Leaderboard Rows (Split by Flight A & B, Single Flight, or Combined) */}
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {flightView === 'split' && (
          <>
            {renderFlightSection('A', flightALeaderboard)}
            {renderFlightSection('B', flightBLeaderboard)}
          </>
        )}

        {flightView === 'A' && renderFlightSection('A', flightALeaderboard)}
        {flightView === 'B' && renderFlightSection('B', flightBLeaderboard)}

        {flightView === 'combined' && combinedLeaderboard.map(renderEntryRow)}

        {/* Scoring Legend Card */}
        <View style={styles.legendCard}>
          <Text style={styles.legendTitle}>Modified Stableford Scoring & Tie-Breaker</Text>
          <View style={styles.legendGrid}>
            <View style={styles.legendBadge}><Text style={styles.legendBadgeText}>2x Bogey+: 0 pt</Text></View>
            <View style={styles.legendBadge}><Text style={styles.legendBadgeText}>Bogey: 1 pt</Text></View>
            <View style={styles.legendBadge}><Text style={styles.legendBadgeText}>Par: 2 pts</Text></View>
            <View style={styles.legendBadge}><Text style={styles.legendBadgeText}>Birdie: 4 pts</Text></View>
            <View style={styles.legendBadge}><Text style={styles.legendBadgeText}>Eagle: 8 pts</Text></View>
            <View style={styles.legendBadge}><Text style={styles.legendBadgeText}>Albatross: 16 pts</Text></View>
          </View>
          <Text style={styles.legendNote}>
            Individual winners are crowned in both A Flight and B Flight. Within each flight, ties are broken by comparing points earned starting on the #1 Difficulty Rank (HCP 1) hole through #18.
          </Text>
        </View>
      </ScrollView>

      {/* Player Scorecard Modal */}
      {inspectedPlayer && (
        <PlayerScorecardModal
          player={inspectedPlayer}
          rounds={sortedRounds}
          courses={state.courses}
          initialRoundId={
            selectedRoundId === 'overall' ? activeRound?.id || sortedRounds[0]?.id : selectedRoundId
          }
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.modalTitle}>{player.name}</Text>
                <View
                  style={[
                    styles.flightMiniBadge,
                    player.flight === 'A' ? styles.flightBadgeA : styles.flightBadgeB,
                  ]}
                >
                  <Text
                    style={[
                      styles.flightMiniBadgeText,
                      player.flight === 'A'
                        ? styles.flightBadgeTextA
                        : styles.flightBadgeTextB,
                    ]}
                  >
                    FLIGHT {player.flight}
                  </Text>
                </View>
              </View>
              <Text style={styles.modalSubtitle}>
                {course?.name || 'Course'} • Target Quota: {stats?.targetQuota ?? '-'} pts
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
                  Round {r.roundNumber}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {stats && (
            <View style={styles.modalSummaryStrip}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Target Quota</Text>
                <Text style={styles.statValue}>{stats.targetQuota} pts</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Actual Points</Text>
                <Text style={styles.statValue}>{stats.actualPoints} pts</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Net Score</Text>
                <Text
                  style={[
                    styles.statValue,
                    stats.netQuotaScore > 0
                      ? { color: '#15803D' }
                      : stats.netQuotaScore < 0
                      ? { color: '#B91C1C' }
                      : undefined,
                  ]}
                >
                  {formatSignedScore(stats.netQuotaScore)}
                </Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>Gross Strokes</Text>
                <Text style={styles.statValue}>{stats.grossStrokes || '-'}</Text>
              </View>
            </View>
          )}

          <ScrollView style={styles.modalScroll}>
            <View style={styles.holeTableHeader}>
              <Text style={[styles.holeTh, { flex: 1 }]}>Hole</Text>
              <Text style={[styles.holeTh, { flex: 1 }]}>Par</Text>
              <Text style={[styles.holeTh, { flex: 1.2 }]}>Diff Rank</Text>
              <Text style={[styles.holeTh, { flex: 1.2 }]}>Gross</Text>
              <Text style={[styles.holeTh, { flex: 1.6 }]}>Result</Text>
              <Text style={[styles.holeTh, { flex: 1, textAlign: 'right' }]}>Pts</Text>
            </View>
            {course?.holes.map((hole) => {
              const strokes = playerHoleScores[hole.holeNumber];
              const res = calculateHolePoints(strokes, hole.par);
              return (
                <View key={hole.holeNumber} style={styles.holeRow}>
                  <Text style={[styles.holeTd, { flex: 1, fontWeight: '700' }]}>
                    #{hole.holeNumber}
                  </Text>
                  <Text style={[styles.holeTd, { flex: 1 }]}>{hole.par}</Text>
                  <Text style={[styles.holeTd, { flex: 1.2, color: '#64748B' }]}>
                    HCP {hole.difficultyRank}
                  </Text>
                  <Text style={[styles.holeTd, { flex: 1.2, fontWeight: '700' }]}>
                    {strokes || '-'}
                  </Text>
                  <Text style={[styles.holeTd, { flex: 1.6, fontSize: 12 }]}>
                    {strokes ? res.label : '-'}
                  </Text>
                  <Text
                    style={[
                      styles.holeTd,
                      {
                        flex: 1,
                        textAlign: 'right',
                        fontWeight: '800',
                        color: res.points >= 4 ? '#15803D' : '#0F172A',
                      },
                    ]}
                  >
                    {strokes ? `${res.points} pt${res.points === 1 ? '' : 's'}` : '-'}
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
  banner: {
    backgroundColor: '#064E3B',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bannerLeft: {
    flex: 1,
    paddingRight: 10,
  },
  tournamentTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '800',
  },
  tournamentSubtitle: {
    color: '#A7F3D0',
    fontSize: 12,
    marginTop: 2,
  },
  scoreCta: {
    backgroundColor: '#10B981',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
  },
  scoreCtaText: {
    color: '#052E16',
    fontWeight: '800',
    fontSize: 13,
  },
  filterBar: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  roundPills: {
    paddingHorizontal: 12,
    gap: 8,
  },
  roundPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    marginRight: 8,
  },
  roundPillActive: {
    backgroundColor: '#065F46',
  },
  roundPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  roundPillTextActive: {
    color: '#FFFFFF',
  },
  flightSwitchRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    marginTop: 8,
    gap: 6,
  },
  flightFilterBtn: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  flightFilterBtnActive: {
    backgroundColor: '#0F172A',
  },
  flightFilterText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  flightFilterTextActive: {
    color: '#FFFFFF',
  },
  modeSwitchRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    marginTop: 8,
    gap: 6,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  modeBtnActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#059669',
  },
  modeBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  modeBtnTextActive: {
    color: '#065F46',
    fontWeight: '700',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F1F5F9',
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
  },
  thText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  colPos: {
    width: 44,
    justifyContent: 'center',
  },
  colPlayer: {
    flex: 1,
    paddingRight: 6,
  },
  colQuota: {
    width: 78,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  colThru: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colScore: {
    width: 68,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 28,
  },
  flightSectionWrap: {
    marginBottom: 10,
  },
  flightSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
  },
  flightHeaderBgA: {
    backgroundColor: '#EFF6FF',
  },
  flightHeaderBgB: {
    backgroundColor: '#FEF3C7',
  },
  flightHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  flightTitleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  flightTitleBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  flightHeaderCount: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  flightLeaderCallout: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0F172A',
  },
  emptyFlightRow: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  emptyFlightText: {
    fontSize: 12,
    color: '#64748B',
  },
  row: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    alignItems: 'center',
  },
  rankBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
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
  playerRowMain: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  playerTextWrap: {
    flex: 1,
  },
  playerNameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  playerName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    flexShrink: 1,
  },
  flightMiniBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
  },
  flightBadgeA: {
    backgroundColor: '#DBEAFE',
  },
  flightBadgeB: {
    backgroundColor: '#FDE68A',
  },
  flightMiniBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  flightBadgeTextA: {
    color: '#1E40AF',
  },
  flightBadgeTextB: {
    color: '#92400E',
  },
  playerSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  roundMiniPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 3,
  },
  roundMiniText: {
    fontSize: 11,
    color: '#334155',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  roundMiniMuted: {
    fontSize: 11,
    color: '#94A3B8',
  },
  tiebreakNote: {
    fontSize: 10,
    color: '#0369A1',
    fontWeight: '600',
    marginTop: 3,
  },
  quotaNumbers: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  quotaSub: {
    fontSize: 10,
    color: '#94A3B8',
  },
  thruText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  scorePill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    minWidth: 48,
    alignItems: 'center',
  },
  scorePillPositive: {
    backgroundColor: '#DCFCE7',
  },
  scorePillNegative: {
    backgroundColor: '#FEE2E2',
  },
  scorePillText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  scorePillTextPositive: {
    color: '#15803D',
  },
  scorePillTextNegative: {
    color: '#B91C1C',
  },
  legendCard: {
    margin: 14,
    padding: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  legendTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  legendBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  legendBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
  },
  legendNote: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '88%',
    paddingBottom: 24,
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
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  closeBtnText: {
    fontWeight: '700',
    color: '#0F172A',
    fontSize: 13,
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
    backgroundColor: '#065F46',
  },
  modalRoundTabText: {
    fontSize: 12,
    fontWeight: '600',
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
    borderRadius: 10,
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
    fontWeight: '600',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  modalScroll: {
    paddingHorizontal: 16,
  },
  holeTableHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#CBD5E1',
  },
  holeTh: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  holeRow: {
    flexDirection: 'row',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    alignItems: 'center',
  },
  holeTd: {
    fontSize: 13,
    color: '#1E293B',
  },
});
