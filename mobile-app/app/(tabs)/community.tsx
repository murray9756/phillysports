import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/context/ThemeContext';
import { TeamColors } from '@/constants/Colors';

interface CommunityOption {
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  href: string;
}

const communityOptions: CommunityOption[] = [
  {
    title: 'Game Threads',
    description: 'Live game discussions',
    icon: 'chatbubbles',
    color: TeamColors.eagles,
    href: '/game-threads',
  },
  {
    title: 'Forums',
    description: 'Discuss all things Philly sports',
    icon: 'people',
    color: TeamColors.sixers,
    href: '/forums',
  },
  {
    title: 'Watch Parties',
    description: 'Find or host watch parties',
    icon: 'tv',
    color: TeamColors.phillies,
    href: '/watch-parties',
  },
  {
    title: 'Tailgates',
    description: 'Pre-game meetups',
    icon: 'beer',
    color: TeamColors.flyers,
    href: '/tailgates',
  },
  {
    title: 'Clubs',
    description: 'Join fan clubs',
    icon: 'shield',
    color: '#9C27B0',
    href: '/clubs',
  },
];

export default function CommunityScreen() {
  const { colors } = useTheme();

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Live Now Banner */}
      <Link href="/game-threads" asChild>
        <TouchableOpacity style={[styles.liveBanner, { backgroundColor: TeamColors.phillies }]}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>Live Game Threads</Text>
          <Ionicons name="chevron-forward" size={20} color="#fff" />
        </TouchableOpacity>
      </Link>

      {/* Community Options */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          <Ionicons name="people" size={18} color={colors.primary} /> Community
        </Text>

        {communityOptions.map((option) => (
          <Link key={option.title} href={option.href as any} asChild>
            <TouchableOpacity
              style={[styles.optionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={[styles.optionIcon, { backgroundColor: option.color }]}>
                <Ionicons name={option.icon} size={26} color="#fff" />
              </View>
              <View style={styles.optionInfo}>
                <Text style={[styles.optionTitle, { color: colors.text }]}>{option.title}</Text>
                <Text style={[styles.optionDescription, { color: colors.textSecondary }]}>
                  {option.description}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </Link>
        ))}
      </View>

      {/* Messages & Leaderboards */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          <Ionicons name="stats-chart" size={18} color={colors.primary} /> Rankings & Messages
        </Text>

        <Link href="/messages" asChild>
          <TouchableOpacity
            style={[styles.optionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={[styles.optionIcon, { backgroundColor: '#2196F3' }]}>
              <Ionicons name="mail" size={26} color="#fff" />
            </View>
            <View style={styles.optionInfo}>
              <Text style={[styles.optionTitle, { color: colors.text }]}>Messages</Text>
              <Text style={[styles.optionDescription, { color: colors.textSecondary }]}>
                Direct messages with fans
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </Link>

        <Link href="/leaderboard" asChild>
          <TouchableOpacity
            style={[styles.optionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={[styles.optionIcon, { backgroundColor: '#FF9800' }]}>
              <Ionicons name="trophy" size={26} color="#fff" />
            </View>
            <View style={styles.optionInfo}>
              <Text style={[styles.optionTitle, { color: colors.text }]}>Leaderboard</Text>
              <Text style={[styles.optionDescription, { color: colors.textSecondary }]}>
                Top Diehard Dollar earners
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </Link>

        <Link href="/badges" asChild>
          <TouchableOpacity
            style={[styles.optionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <View style={[styles.optionIcon, { backgroundColor: '#4CAF50' }]}>
              <Ionicons name="ribbon" size={26} color="#fff" />
            </View>
            <View style={styles.optionInfo}>
              <Text style={[styles.optionTitle, { color: colors.text }]}>Badges</Text>
              <Text style={[styles.optionDescription, { color: colors.textSecondary }]}>
                Achievements and rewards
              </Text>
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
  liveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    margin: 16,
    borderRadius: 12,
    gap: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  liveText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  section: {
    padding: 16,
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  optionIcon: {
    width: 52,
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionInfo: {
    flex: 1,
    marginLeft: 14,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  optionDescription: {
    fontSize: 13,
  },
});
