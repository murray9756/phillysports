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
import { TeamColors, VintageColors, Typography, BorderRadius, Spacing } from '@/constants/Colors';

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
        <View style={styles.sectionHeader}>
          <Ionicons name="trophy" size={16} color={VintageColors.navy} />
          <Text style={styles.sectionHeaderText}>PRO TEAMS</Text>
        </View>
        {proTeams.map(renderTeamCard)}
      </View>

      {/* Featured Categories */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="star" size={16} color={VintageColors.navy} />
          <Text style={styles.sectionHeaderText}>FEATURED</Text>
        </View>

        <Link href="/team/esports" asChild>
          <TouchableOpacity
            style={[styles.featuredCard, { backgroundColor: '#6441a5' }]}
          >
            <Text style={styles.featuredEmoji}>🎮</Text>
            <View style={styles.featuredInfo}>
              <Text style={styles.featuredName}>eSports</Text>
              <Text style={styles.featuredMeta}>Gaming & Competitive News</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        </Link>

        <Link href="/team/youth" asChild>
          <TouchableOpacity
            style={[styles.featuredCard, { backgroundColor: '#4CAF50' }]}
          >
            <Text style={styles.featuredEmoji}>⚽</Text>
            <View style={styles.featuredInfo}>
              <Text style={styles.featuredName}>Youth Sports</Text>
              <Text style={styles.featuredMeta}>Local Youth Coverage</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        </Link>
      </View>

      {/* College Teams */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Ionicons name="school" size={16} color={VintageColors.navy} />
          <Text style={styles.sectionHeaderText}>COLLEGE TEAMS</Text>
        </View>
        {collegeTeams.map(renderTeamCard)}
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
    padding: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: VintageColors.gold,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
    borderWidth: 2,
    borderColor: VintageColors.navy,
    borderRadius: BorderRadius.sm,
    gap: 8,
  },
  sectionHeaderText: {
    color: VintageColors.navy,
    fontSize: Typography.sm,
    fontWeight: '800',
    letterSpacing: 1,
  },
  teamCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
  },
  teamIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
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
    fontSize: Typography.base,
    fontWeight: '700',
    marginBottom: 2,
  },
  teamMeta: {
    fontSize: Typography.sm,
  },
  featuredCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.2)',
  },
  featuredEmoji: {
    fontSize: 32,
    marginRight: 14,
  },
  featuredInfo: {
    flex: 1,
  },
  featuredName: {
    fontSize: Typography.lg,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  featuredMeta: {
    fontSize: Typography.sm,
    color: 'rgba(255,255,255,0.85)',
  },
});
