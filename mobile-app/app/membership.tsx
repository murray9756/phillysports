import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { TeamColors, VintageColors, Typography, BorderRadius, Spacing } from '@/constants/Colors';

const premiumBenefits = [
  {
    icon: 'mail',
    title: '@phillysports.com Email',
    description: 'Get your own custom email address to show off your Philly pride',
  },
  {
    icon: 'ticket',
    title: 'Exclusive Raffles',
    description: 'Access premium-only raffles for tickets, gear, and experiences',
  },
  {
    icon: 'restaurant',
    title: 'Restaurant Discounts',
    description: '10% off at participating Philly sports bars and restaurants',
  },
  {
    icon: 'remove-circle',
    title: 'Ad-Free Experience',
    description: 'Enjoy the site and app without any advertisements',
  },
  {
    icon: 'gift',
    title: 'Monthly Bonus Coins',
    description: 'Get 500 Diehard Dollars added to your balance every month',
  },
  {
    icon: 'people',
    title: 'Founders Club Access',
    description: 'Join exclusive events and connect with other super fans',
  },
  {
    icon: 'chatbubble',
    title: 'Priority Support',
    description: 'Get faster responses from our team when you need help',
  },
  {
    icon: 'shield-checkmark',
    title: 'Verified Badge',
    description: 'Stand out in the community with your premium member badge',
  },
];

export default function MembershipScreen() {
  const { colors } = useTheme();
  const { user, isAuthenticated } = useAuth();

  const isPremium = user?.isPremium;

  const openMembershipPage = () => {
    Linking.openURL('https://phillysports.com/membership');
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Premium Membership',
          headerStyle: { backgroundColor: '#1a1a2e' },
          headerTintColor: '#FFD700',
        }}
      />
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Hero Section */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="star" size={48} color="#FFD700" />
          </View>
          <Text style={styles.heroTitle}>Premium Membership</Text>
          <Text style={styles.heroSubtitle}>
            The ultimate experience for Philly sports diehards
          </Text>

          {isPremium ? (
            <View style={styles.currentMemberBadge}>
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
              <Text style={styles.currentMemberText}>You're a Premium Member!</Text>
            </View>
          ) : (
            <View style={styles.priceContainer}>
              <Text style={styles.priceAmount}>$5</Text>
              <Text style={styles.pricePeriod}>/month</Text>
            </View>
          )}
        </View>

        {/* Benefits */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="checkmark-circle" size={16} color={VintageColors.navy} />
            <Text style={styles.sectionHeaderText}>PREMIUM BENEFITS</Text>
          </View>

          {premiumBenefits.map((benefit, index) => (
            <View
              key={index}
              style={[styles.benefitCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={[styles.benefitIcon, { backgroundColor: TeamColors.eagles }]}>
                <Ionicons name={benefit.icon as any} size={24} color="#fff" />
              </View>
              <View style={styles.benefitContent}>
                <Text style={[styles.benefitTitle, { color: colors.text }]}>
                  {benefit.title}
                </Text>
                <Text style={[styles.benefitDescription, { color: colors.textSecondary }]}>
                  {benefit.description}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* CTA */}
        {!isPremium && (
          <View style={styles.ctaSection}>
            <TouchableOpacity
              style={styles.ctaButton}
              onPress={openMembershipPage}
            >
              <Ionicons name="star" size={20} color="#1a1a2e" />
              <Text style={styles.ctaButtonText}>Become a Premium Member</Text>
            </TouchableOpacity>
            <Text style={[styles.ctaNote, { color: colors.textMuted }]}>
              Cancel anytime. No commitment required.
            </Text>
          </View>
        )}

        {/* Founders Club Section */}
        <View style={styles.section}>
          <View style={[styles.foundersCard, { backgroundColor: '#1a1a2e' }]}>
            <View style={styles.foundersHeader}>
              <Text style={styles.foundersTitle}>Founders Club</Text>
              <View style={styles.foundersBadge}>
                <Text style={styles.foundersBadgeText}>LIMITED</Text>
              </View>
            </View>
            <Text style={styles.foundersDescription}>
              Be one of just 76 Founders Club members. Get lifetime premium access,
              exclusive gear, and your name enshrined in PhillySports history.
            </Text>
            <TouchableOpacity
              style={styles.foundersButton}
              onPress={() => Linking.openURL('https://phillysports.com/founders')}
            >
              <Text style={styles.foundersButtonText}>Learn About Founders Club</Text>
              <Ionicons name="arrow-forward" size={16} color="#FFD700" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  hero: {
    backgroundColor: VintageColors.navy,
    padding: Spacing.xl,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: VintageColors.gold,
  },
  heroIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,215,0,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 2,
    borderColor: VintageColors.gold,
  },
  heroTitle: {
    color: '#FFD700',
    fontSize: Typography['3xl'],
    fontWeight: '800',
    marginBottom: Spacing.sm,
    letterSpacing: 1,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: Typography.base,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  currentMemberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76,175,80,0.2)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: 8,
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  currentMemberText: {
    color: '#4CAF50',
    fontSize: Typography.sm,
    fontWeight: '700',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceAmount: {
    color: '#fff',
    fontSize: 48,
    fontWeight: '800',
  },
  pricePeriod: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: Typography.lg,
    marginLeft: 4,
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
  benefitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    marginBottom: Spacing.sm,
  },
  benefitIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  benefitContent: {
    flex: 1,
    marginLeft: 14,
  },
  benefitTitle: {
    fontSize: Typography.base,
    fontWeight: '700',
    marginBottom: 2,
  },
  benefitDescription: {
    fontSize: Typography.sm,
    lineHeight: 18,
  },
  ctaSection: {
    padding: Spacing.md,
    alignItems: 'center',
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD700',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
    gap: 10,
    borderWidth: 2,
    borderColor: VintageColors.navy,
  },
  ctaButtonText: {
    color: VintageColors.navy,
    fontSize: Typography.lg,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  ctaNote: {
    fontSize: Typography.xs,
    marginTop: Spacing.sm,
  },
  foundersCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: VintageColors.gold,
  },
  foundersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  foundersTitle: {
    color: '#FFD700',
    fontSize: Typography.xl,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  foundersBadge: {
    backgroundColor: 'rgba(255,215,0,0.2)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  foundersBadgeText: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  foundersDescription: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: Typography.sm,
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  foundersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFD700',
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: 8,
  },
  foundersButtonText: {
    color: '#FFD700',
    fontSize: Typography.sm,
    fontWeight: '700',
  },
});
