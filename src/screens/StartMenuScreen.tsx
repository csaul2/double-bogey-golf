import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTournament } from '../context/TournamentContext';
import { AdminTab } from './AdminScreen';

interface StartMenuScreenProps {
  onStartRound: (roundId: string) => void;
  onOpenAdminTab: (tab: AdminTab) => void;
  onOpenStandings: () => void;
  onOpenMasterSheet: () => void;
}

export const StartMenuScreen: React.FC<StartMenuScreenProps> = ({
  onStartRound,
  onOpenAdminTab,
  onOpenStandings,
  onOpenMasterSheet,
}) => {
  const {
    state,
    syncStatus,
    pendingSyncCount,
    manualSync,
    updateRoundCourse,
  } = useTournament();

  const sortedRounds = useMemo(
    () => [...state.rounds].sort((a, b) => a.roundNumber - b.roundNumber),
    [state.rounds]
  );

  const defaultRound = useMemo(() => {
    return (
      sortedRounds.find((r) => r.status === 'active') ||
      sortedRounds.find((r) => r.status === 'upcoming') ||
      sortedRounds[0]
    );
  }, [sortedRounds]);

  const [selectedRoundId, setSelectedRoundId] = useState<string>(
    defaultRound?.id || ''
  );
  const [showCoursePicker, setShowCoursePicker] = useState<boolean>(false);

  const selectedRound = useMemo(
    () =>
      sortedRounds.find((r) => r.id === selectedRoundId) ||
      defaultRound ||
      sortedRounds[0],
    [sortedRounds, selectedRoundId, defaultRound]
  );

  const selectedCourse = useMemo(
    () => state.courses.find((c) => c.id === selectedRound?.courseId),
    [state.courses, selectedRound]
  );

  const coursePar = useMemo(
    () =>
      selectedCourse
        ? selectedCourse.holes.reduce((sum, h) => sum + h.par, 0)
        : 72,
    [selectedCourse]
  );

  const activePlayers = useMemo(
    () => state.players.filter((p) => p.isActive !== false),
    [state.players]
  );

  const flightACount = useMemo(
    () => activePlayers.filter((p) => p.flight === 'A').length,
    [activePlayers]
  );

  const flightBCount = useMemo(
    () => activePlayers.filter((p) => p.flight === 'B').length,
    [activePlayers]
  );

  const roundGroups = useMemo(
    () => state.groups.filter((g) => g.roundId === selectedRound?.id),
    [state.groups, selectedRound]
  );

  return (
    <View style={styles.container}>
      {/* Top Banner */}
      <View style={styles.topHeader}>
        <View style={styles.headerInfo}>
          <Text style={styles.brandLabel}>DBT GOLF • START MENU</Text>
          <Text style={styles.eventTitle} numberOfLines={1}>
            {state.settings.tournamentName}
          </Text>
          <View style={styles.subtitleRow}>
            <Text style={styles.eventSubtitle} numberOfLines={1}>
              {state.settings.subtitle}
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
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        {/* HERO CARD: NEXT / SELECTED ROUND LAUNCHER */}
        {selectedRound && (
          <View style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <View style={styles.statusBadge}>
                <Text style={styles.statusBadgeText}>
                  {selectedRound.status === 'active'
                    ? '🟢 ROUND IN PROGRESS'
                    : selectedRound.status === 'completed'
                    ? '✅ ROUND COMPLETED'
                    : '⏳ PRE-ROUND SETUP READY'}
                </Text>
              </View>
              <Text style={styles.roundCountLabel}>
                Round {selectedRound.roundNumber} of {sortedRounds.length}
              </Text>
            </View>

            {/* Round Selector Pills */}
            {sortedRounds.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.roundTabsScroll}
                contentContainerStyle={styles.roundTabsRow}
              >
                {sortedRounds.map((r) => {
                  const isSel = r.id === selectedRound.id;
                  return (
                    <TouchableOpacity
                      key={r.id}
                      style={[
                        styles.roundTabPill,
                        isSel && styles.roundTabPillActive,
                      ]}
                      onPress={() => setSelectedRoundId(r.id)}
                    >
                      <Text
                        style={[
                          styles.roundTabPillText,
                          isSel && styles.roundTabPillTextActive,
                        ]}
                      >
                        R{r.roundNumber}: {r.name.replace(/^Round \d+\s*-\s*/i, '')}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <Text style={styles.heroRoundTitle}>{selectedRound.name}</Text>

            {/* Course Display + Quick Switcher */}
            <View style={styles.courseBox}>
              <View style={{ flex: 1 }}>
                <Text style={styles.courseBoxLabel}>ASSIGNED COURSE</Text>
                <Text style={styles.courseBoxName}>
                  ⛳ {selectedCourse?.name || 'Select a Course'}
                </Text>
                <Text style={styles.courseBoxMeta}>
                  {selectedCourse?.location
                    ? `${selectedCourse.location} • `
                    : ''}
                  Par {coursePar} •{' '}
                  {selectedCourse?.holes.filter((h) => h.par === 3).length || 4}{' '}
                  Par 3s
                </Text>
              </View>
              <TouchableOpacity
                style={styles.changeCourseBtn}
                onPress={() => setShowCoursePicker((prev) => !prev)}
              >
                <Text style={styles.changeCourseBtnText}>
                  {showCoursePicker ? 'Done' : 'Change'}
                </Text>
              </TouchableOpacity>
            </View>

            {showCoursePicker && (
              <View style={styles.inlineCourseList}>
                {state.courses.map((c) => {
                  const isCurrent = c.id === selectedRound.courseId;
                  const par = c.holes.reduce((s, h) => s + h.par, 0);
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[
                        styles.inlineCourseOption,
                        isCurrent && styles.inlineCourseOptionSelected,
                      ]}
                      onPress={() => {
                        updateRoundCourse(selectedRound.id, c.id);
                        setShowCoursePicker(false);
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.inlineCourseOptionName,
                            isCurrent && styles.inlineCourseOptionNameSelected,
                          ]}
                        >
                          {c.name}
                        </Text>
                        <Text style={styles.inlineCourseOptionMeta}>
                          {c.location ? `${c.location} • ` : ''}Par {par}
                        </Text>
                      </View>
                      {isCurrent && (
                        <Text style={styles.inlineCourseCheck}>✓ Active</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Readiness Summary Pills */}
            <View style={styles.readinessRow}>
              <TouchableOpacity
                style={styles.readinessPill}
                onPress={() => onOpenAdminTab('players')}
              >
                <Text style={styles.readinessPillValue}>
                  👥 {activePlayers.length} Players
                </Text>
                <Text style={styles.readinessPillSub}>
                  {flightACount} A-Flight • {flightBCount} B-Flight
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.readinessPill}
                onPress={() => onOpenAdminTab('pairings')}
              >
                <Text style={styles.readinessPillValue}>
                  🛺 {roundGroups.length} Carts Ready
                </Text>
                <Text style={styles.readinessPillSub}>
                  Tap to edit pairings
                </Text>
              </TouchableOpacity>
            </View>

            {/* Primary CTA: Start Round & Prompt Cart Selection */}
            <TouchableOpacity
              style={styles.startRoundBtn}
              onPress={() => onStartRound(selectedRound.id)}
              activeOpacity={0.85}
            >
              <Text style={styles.startRoundBtnIcon}>⛳</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.startRoundBtnTitle}>
                  {selectedRound.status === 'active'
                    ? `Select Cart & Enter ${selectedRound.name} ›`
                    : `Start ${selectedRound.name} & Select Cart ›`}
                </Text>
                <Text style={styles.startRoundBtnSub}>
                  Prompts you to lock into your foursome cart before scoring
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* PRE-ROUND SETUP & ADMIN HUB */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeaderTitle}>
            PRE-ROUND SETUP & ADMIN TOOLS
          </Text>
          <Text style={styles.sectionHeaderSub}>
            Configure before locking into a cart
          </Text>
        </View>

        <View style={styles.adminGrid}>
          <TouchableOpacity
            style={styles.adminCard}
            onPress={() => onOpenAdminTab('pairings')}
            activeOpacity={0.75}
          >
            <Text style={styles.adminCardIcon}>🛺</Text>
            <Text style={styles.adminCardTitle}>Carts & Pairings</Text>
            <Text style={styles.adminCardMeta}>
              {roundGroups.length} Carts assigned
            </Text>
            <Text style={styles.adminCardAction}>Assign Groups ›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.adminCard}
            onPress={() => onOpenAdminTab('players')}
            activeOpacity={0.75}
          >
            <Text style={styles.adminCardIcon}>👥</Text>
            <Text style={styles.adminCardTitle}>Players & Roster</Text>
            <Text style={styles.adminCardMeta}>
              {activePlayers.length} Active / {state.players.length} Total
            </Text>
            <Text style={styles.adminCardAction}>Manage Roster ›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.adminCard}
            onPress={() => onOpenAdminTab('rounds')}
            activeOpacity={0.75}
          >
            <Text style={styles.adminCardIcon}>📅</Text>
            <Text style={styles.adminCardTitle}>Rounds & Quotas</Text>
            <Text style={styles.adminCardMeta}>
              {state.rounds.length} Rounds • {state.settings.targetAdjustmentPercent}% Adj
            </Text>
            <Text style={styles.adminCardAction}>Edit Quotas ›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.adminCard}
            onPress={() => onOpenAdminTab('courses')}
            activeOpacity={0.75}
          >
            <Text style={styles.adminCardIcon}>⛳</Text>
            <Text style={styles.adminCardTitle}>Courses & Holes</Text>
            <Text style={styles.adminCardMeta}>
              {state.courses.length} Courses Loaded
            </Text>
            <Text style={styles.adminCardAction}>Par & HCP Ranks ›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.adminCard}
            onPress={() => onOpenAdminTab('ctp')}
            activeOpacity={0.75}
          >
            <Text style={styles.adminCardIcon}>🎯</Text>
            <Text style={styles.adminCardTitle}>Par 3 CTP Reveal</Text>
            <Text style={styles.adminCardMeta}>
              Flight A & B Closest to Pin
            </Text>
            <Text style={styles.adminCardAction}>Dinner Results ›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.adminCard}
            onPress={() => onOpenAdminTab('settings')}
            activeOpacity={0.75}
          >
            <Text style={styles.adminCardIcon}>⚙️</Text>
            <Text style={styles.adminCardTitle}>Formula & PINs</Text>
            <Text style={styles.adminCardMeta}>
              PIN: {state.settings.adminPin}
            </Text>
            <Text style={styles.adminCardAction}>Settings ›</Text>
          </TouchableOpacity>
        </View>

        {/* QUICK VIEW BUTTONS */}
        <View style={styles.quickViewsRow}>
          <TouchableOpacity
            style={styles.quickViewBtn}
            onPress={onOpenStandings}
          >
            <Text style={styles.quickViewBtnIcon}>🏆</Text>
            <View>
              <Text style={styles.quickViewBtnTitle}>View Standings</Text>
              <Text style={styles.quickViewBtnSub}>Flight A & B Leaderboard</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickViewBtn}
            onPress={onOpenMasterSheet}
          >
            <Text style={styles.quickViewBtnIcon}>📋</Text>
            <View>
              <Text style={styles.quickViewBtnTitle}>Master Sheet</Text>
              <Text style={styles.quickViewBtnSub}>Full Paper Summary</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 16,
  },
  headerInfo: {
    gap: 2,
  },
  brandLabel: {
    color: '#A7F3D0',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  eventTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  eventSubtitle: {
    color: '#D1FAE5',
    fontSize: 13,
    fontWeight: '600',
  },
  syncBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  syncBadgeSynced: {
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
  },
  syncBadgeSyncing: {
    backgroundColor: 'rgba(245, 158, 11, 0.3)',
  },
  syncBadgeOffline: {
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
  },
  syncBadgeText: {
    color: '#ECFDF5',
    fontSize: 11,
    fontWeight: '800',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 36,
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: '#064E3B',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 20,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusBadge: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    color: '#065F46',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  roundCountLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  roundTabsScroll: {
    marginBottom: 12,
  },
  roundTabsRow: {
    gap: 8,
  },
  roundTabPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  roundTabPillActive: {
    backgroundColor: '#064E3B',
    borderColor: '#064E3B',
  },
  roundTabPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  roundTabPillTextActive: {
    color: '#FFFFFF',
  },
  heroRoundTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 12,
  },
  courseBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 10,
  },
  courseBoxLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
  },
  courseBoxName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  courseBoxMeta: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginTop: 2,
  },
  changeCourseBtn: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  changeCourseBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E293B',
  },
  inlineCourseList: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 8,
    marginBottom: 12,
    gap: 6,
  },
  inlineCourseOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  inlineCourseOptionSelected: {
    backgroundColor: '#ECFDF5',
    borderColor: '#059669',
  },
  inlineCourseOptionName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
  },
  inlineCourseOptionNameSelected: {
    color: '#065F46',
  },
  inlineCourseOptionMeta: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  inlineCourseCheck: {
    fontSize: 12,
    fontWeight: '900',
    color: '#059669',
  },
  readinessRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  readinessPill: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  readinessPillValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  readinessPillSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  startRoundBtn: {
    backgroundColor: '#064E3B',
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#064E3B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  startRoundBtnIcon: {
    fontSize: 26,
  },
  startRoundBtnTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  startRoundBtnSub: {
    color: '#A7F3D0',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  sectionHeaderRow: {
    marginBottom: 10,
  },
  sectionHeaderTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#475569',
    letterSpacing: 0.8,
  },
  sectionHeaderSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  adminGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 18,
  },
  adminCard: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  adminCardIcon: {
    fontSize: 22,
    marginBottom: 6,
  },
  adminCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  adminCardMeta: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
    marginBottom: 8,
  },
  adminCardAction: {
    fontSize: 12,
    fontWeight: '800',
    color: '#059669',
  },
  quickViewsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickViewBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
  },
  quickViewBtnIcon: {
    fontSize: 22,
  },
  quickViewBtnTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  quickViewBtnSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
});
