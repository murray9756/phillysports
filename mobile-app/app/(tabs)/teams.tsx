import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/context/ThemeContext';
import { TeamColors } from '@/constants/Colors';

interface Team {
  slug: string;
  name: string;
  sport: string;
  color: string;
  icon: string;
  league: string;
}

const proTeams: Team[] = [
  { slug: 'eagles', name: 'Philadelphia Eagles', sport: 'Football', color: TeamColors.eagles, icon: '🦅', league: 'NFL' },
  { slug: 'phillies', name: 'Philadelphia Phillies', sport: 'Baseball', color: TeamColors.phillies, icon: '⚾', league: 'MLB' },
  { slug: 'sixers', name: 'Philadelphia 76ers', sport: 'Basketball', color: TeamColors.sixers, icon: '🏀', league: 'NBA' },
  { slug: 'flyers', name: 'Philadelphia Flyers', sport: 'Hockey', color: TeamColors.flyers, icon: '🏒', league: 'NHL' },
];

const collegeTeams: Team[] = [
  { slug: 'villanova', name: 'Villanova Wildcats', sport: 'Basketball', color: '#003366', icon: '🐱', league: 'Big East' },
  { slug: 'penn', name: 'Penn Quakers', sport: 'Basketball', color: '#990000', icon: '🏛️', league: 'Ivy League' },
  { slug: 'temple', name: 'Temple Owls', sport: 'Basketball', color: '#9D2235', icon: '🦉', league: 'AAC' },
  { slug: 'drexel', name: 'Drexel Dragons', sport: 'Basketball', color: '#07294D', icon: '🐉', league: 'CAA' },
  { slug: 'lasalle', name: 'La Salle Explorers', sport: 'Basketball', color: '#003882', icon: '⚓', league: 'A-10' },
  { slug: 'stjosephs', name: "St. Joseph's Hawks", sport: 'Basketball', color: '#9E1B34', icon: '🦅', league: 'A-10' },
];

export default function TeamsScreen() {
  const { colors } = useTheme();

  const renderTeamCard = (team: Team) => (
    <Link
      key={team.slug}
      href={{
        pathname: '/team/[slug]',
        params: { slug: team.slug },
      }}
      asChild
    >
      <TouchableOpacity
        style={[styles.teamCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <View style={[styles.teamIcon, { backgroundColor: team.color }]}>
          <Text style={styles.teamEmoji}>{team.icon}</Text>
        </View>
        <View style={styles.teamInfo}>
          <Text style={[styles.teamName, { color: colors.text }]}>{team.name}</Text>
          <Text style={[styles.teamMeta, { color: colors.textMuted }]}>
            {team.league} · {team.sport}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </TouchableOpacity>
    </Link>
  );

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Pro Teams */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          <Ionicons name="trophy" size={18} color={colors.primary} /> Pro Teams
        </Text>
        {proTeams.map(renderTeamCard)}
      </View>

      {/* College Teams */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          <Ionicons name="school" size={18} color={colors.primary} /> College Teams
        </Text>
        {collegeTeams.map(renderTeamCard)}
      </View>

      {/* Other Sections */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          <Ionicons name="grid" size={18} color={colors.primary} /> More
        </Text>

        <Link href="/team/esports" asChild>
          <TouchableOpacity
            style={[styles.teamCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={[styles.teamIcon, { backgroundColor: '#6441a5' }]}>
              <Text style={styles.teamEmoji}>🎮</Text>
            </View>
            <View style={styles.teamInfo}>
              <Text style={[styles.teamName, { color: colors.text }]}>eSports</Text>
              <Text style={[styles.teamMeta, { color: colors.textMuted }]}>Gaming & Competitive</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </Link>

        <Link href="/team/youth" asChild>
          <TouchableOpacity
            style={[styles.teamCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={[styles.teamIcon, { backgroundColor: '#4CAF50' }]}>
              <Text style={styles.teamEmoji}>⚽</Text>
            </View>
            <View style={styles.teamInfo}>
              <Text style={[styles.teamName, { color: colors.text }]}>Youth Sports</Text>
              <Text style={[styles.teamMeta, { color: colors.textMuted }]}>Local Youth Coverage</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </Link>
      </View>

      {/* Bottom Padding */}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  teamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  teamIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamEmoji: {
    fontSize: 24,
  },
  teamInfo: {
    flex: 1,
    marginLeft: 12,
  },
  teamName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  teamMeta: {
    fontSize: 13,
  },
});
