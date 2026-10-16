import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { TournamentProvider, useTournament } from './src/context/TournamentContext';
import { EnterScoresScreen } from './src/screens/EnterScoresScreen';
import { MasterSheetScreen } from './src/screens/MasterSheetScreen';
import { StandingsScreen } from './src/screens/StandingsScreen';

type Tab = 'scores' | 'standings';

const MainShell: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('scores');
  const [showAdminMasterSheet, setShowAdminMasterSheet] = useState<boolean>(false);

  if (showAdminMasterSheet) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        <MasterSheetScreen onClose={() => setShowAdminMasterSheet(false)} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />

      {/* Main View: Either Enter Scores or Standings */}
      <View style={styles.content}>
        {activeTab === 'scores' ? (
          <EnterScoresScreen
            onOpenStandings={() => setActiveTab('standings')}
            onOpenAdmin={() => setShowAdminMasterSheet(true)}
          />
        ) : (
          <StandingsScreen
            onEnterScores={() => setActiveTab('scores')}
            onOpenAdmin={() => setShowAdminMasterSheet(true)}
          />
        )}
      </View>

      {/* Simplified 2-Tab Bottom Navigation */}
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
