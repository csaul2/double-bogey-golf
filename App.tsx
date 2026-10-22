import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { TournamentProvider, useTournament } from './src/context/TournamentContext';
import { AdminScreen, AdminTab } from './src/screens/AdminScreen';
import { EnterScoresScreen } from './src/screens/EnterScoresScreen';
import { MasterSheetScreen } from './src/screens/MasterSheetScreen';
import { StandingsScreen } from './src/screens/StandingsScreen';
import { StartMenuScreen } from './src/screens/StartMenuScreen';

type Tab = 'scores' | 'standings';
type AdminModal =
  | { type: 'admin'; initialTab?: AdminTab; skipPinGate?: boolean }
  | { type: 'mastersheet' }
  | null;

const MainShell: React.FC = () => {
  const { state, updateRoundStatus } = useTournament();

  const hasActiveRound = state.rounds.some((r) => r.status === 'active');

  const [showStartMenu, setShowStartMenu] = useState<boolean>(!hasActiveRound);
  const [standingsPreviewFromMenu, setStandingsPreviewFromMenu] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<Tab>('scores');
  const [isPickingCart, setIsPickingCart] = useState<boolean>(true);
  const [adminModal, setAdminModal] = useState<AdminModal>(null);

  // Whenever no round is active (e.g. initial load or after advancing/completing a round),
  // automatically return to the Start Menu.
  useEffect(() => {
    if (!hasActiveRound && !standingsPreviewFromMenu) {
      setShowStartMenu(true);
    }
  }, [hasActiveRound, standingsPreviewFromMenu]);

  const handleStartRoundFromMenu = async (roundId: string) => {
    // Clear any cached cart lock for this round so the user is prompted to select their cart
    await AsyncStorage.removeItem(`@dbt_locked_cart_${roundId}`);
    state.rounds.forEach((r) => {
      if (r.id === roundId && r.status !== 'active') {
        updateRoundStatus(r.id, 'active');
      } else if (r.id !== roundId && r.status === 'active') {
        updateRoundStatus(r.id, 'upcoming');
      }
    });
    setIsPickingCart(true);
    setStandingsPreviewFromMenu(false);
    setActiveTab('scores');
    setShowStartMenu(false);
  };

  if (adminModal?.type === 'admin') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        <AdminScreen
          initialTab={adminModal.initialTab}
          skipPinGate={adminModal.skipPinGate}
          onClose={() => setAdminModal(null)}
          onOpenMasterSheet={() => setAdminModal({ type: 'mastersheet' })}
        />
      </SafeAreaView>
    );
  }

  if (adminModal?.type === 'mastersheet') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        <MasterSheetScreen
          onClose={() => setAdminModal(null)}
          onOpenAdmin={() => setAdminModal({ type: 'admin', skipPinGate: showStartMenu })}
        />
      </SafeAreaView>
    );
  }

  // Launch to Start Menu when loaded and a round is not in progress (or user returned to menu)
  if (showStartMenu) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        <StartMenuScreen
          onStartRound={handleStartRoundFromMenu}
          onOpenAdminTab={(tab) =>
            setAdminModal({ type: 'admin', initialTab: tab, skipPinGate: true })
          }
          onOpenStandings={() => {
            setStandingsPreviewFromMenu(true);
            setShowStartMenu(false);
            setActiveTab('standings');
          }}
          onOpenMasterSheet={() => setAdminModal({ type: 'mastersheet' })}
        />
      </SafeAreaView>
    );
  }

  // If viewing Standings preview directly from the Start Menu before a round starts
  if (standingsPreviewFromMenu && !hasActiveRound) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        <View style={styles.content}>
          <StandingsScreen
            onEnterScores={() => {
              setStandingsPreviewFromMenu(false);
              setShowStartMenu(true);
            }}
            onOpenAdmin={() => setAdminModal({ type: 'admin', skipPinGate: true })}
            onBackToMenu={() => {
              setStandingsPreviewFromMenu(false);
              setShowStartMenu(true);
            }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />

      {/* Main View: Either Enter Scores (with Cart Picker first) or Standings */}
      <View style={styles.content}>
        {activeTab === 'scores' ? (
          <EnterScoresScreen
            onOpenStandings={() => setActiveTab('standings')}
            onOpenAdmin={() => setAdminModal({ type: 'admin' })}
            onBackToMenu={() => setShowStartMenu(true)}
            onCartPickingChange={setIsPickingCart}
          />
        ) : (
          <StandingsScreen
            onEnterScores={() => setActiveTab('scores')}
            onOpenAdmin={() => setAdminModal({ type: 'admin' })}
          />
        )}
      </View>

      {/* Show In-Round Bottom Navigation only after the user has selected their cart */}
      {!isPickingCart && (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.bottomTab, activeTab === 'scores' && styles.bottomTabActive]}
            onPress={() => setActiveTab('scores')}
          >
            <Text style={styles.tabIcon}>⛳</Text>
            <Text
              style={[
                styles.tabLabel,
                activeTab === 'scores' && styles.tabLabelActive,
              ]}
            >
              Enter Scores
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.bottomTab,
              activeTab === 'standings' && styles.bottomTabActive,
            ]}
            onPress={() => setActiveTab('standings')}
          >
            <Text style={styles.tabIcon}>🏆</Text>
            <Text
              style={[
                styles.tabLabel,
                activeTab === 'standings' && styles.tabLabelActive,
              ]}
            >
              Standings (A/B)
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

export default function App() {
  return (
    <TournamentProvider>
      <MainShell />
    </TournamentProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#064E3B',
  },
  content: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  bottomBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 2,
    borderTopColor: '#E2E8F0',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 12,
  },
  bottomTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    gap: 8,
  },
  bottomTabActive: {
    backgroundColor: '#064E3B',
  },
  tabIcon: {
    fontSize: 20,
  },
  tabLabel: {
    fontSize: 16,
    fontWeight: '800',
    color: '#475569',
  },
  tabLabelActive: {
    color: '#FFFFFF',
  },
});
