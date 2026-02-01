import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { shopService } from '@/services/api';
import { TeamColors } from '@/constants/Colors';

interface Product {
  _id: string;
  name: string;
  description: string;
  price: number;
  image?: string;
  category: string;
  inStock: boolean;
}

interface MarketplaceListing {
  _id: string;
  title: string;
  price: number;
  image?: string;
  seller: { username: string };
}

type ShopTab = 'rewards' | 'marketplace' | 'raffles';

export default function ShopTabScreen() {
  const { colors } = useTheme();
  const { user, isAuthenticated } = useAuth();

  const [activeTab, setActiveTab] = useState<ShopTab>('rewards');
  const [products, setProducts] = useState<Product[]>([]);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [raffles, setRaffles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'rewards') {
        const data = await shopService.getProducts();
        setProducts(data.products || []);
      } else if (activeTab === 'marketplace') {
        // Marketplace uses same products endpoint for now
        const data = await shopService.getProducts();
        setProducts(data.products || []);
      } else if (activeTab === 'raffles') {
        const data = await shopService.getRaffles();
        setRaffles(data.raffles || []);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const tabs: { id: ShopTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { id: 'rewards', label: 'Rewards', icon: 'gift' },
    { id: 'marketplace', label: 'Marketplace', icon: 'storefront' },
    { id: 'raffles', label: 'Raffles', icon: 'ticket' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Balance Header */}
      <View style={[styles.balanceHeader, { backgroundColor: TeamColors.eagles }]}>
        <View>
          <Text style={styles.balanceLabel}>Diehard Dollars</Text>
          <View style={styles.balanceRow}>
            <Text style={styles.balanceEmoji}>🪙</Text>
            <Text style={styles.balanceValue}>
              {isAuthenticated ? Math.round(user?.coinBalance || 0).toLocaleString() : '---'}
            </Text>
          </View>
        </View>
        {!isAuthenticated && (
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity style={styles.signInButton}>
              <Text style={[styles.signInText, { color: TeamColors.eagles }]}>Sign In</Text>
            </TouchableOpacity>
          </Link>
        )}
      </View>

      {/* Tab Bar */}
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[
              styles.tab,
              activeTab === tab.id && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
            ]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Ionicons
              name={tab.icon}
              size={18}
              color={activeTab === tab.id ? colors.primary : colors.textMuted}
            />
            <Text
              style={[
                styles.tabText,
                { color: activeTab === tab.id ? colors.primary : colors.textMuted },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          {/* Rewards Tab */}
          {activeTab === 'rewards' && (
            <View style={styles.productsGrid}>
              {products.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="gift-outline" size={48} color={colors.textMuted} />
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                    No rewards available
                  </Text>
                  <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                    Check back soon for new items!
                  </Text>
                </View>
              ) : (
                products.map((product) => (
                  <Link
                    key={product._id}
                    href={{
                      pathname: '/shop/[id]',
                      params: { id: product._id },
                    }}
                    asChild
                  >
                    <TouchableOpacity
                      style={[styles.productCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    >
                      {product.image ? (
                        <Image source={{ uri: product.image }} style={styles.productImage} />
                      ) : (
                        <View style={[styles.productImagePlaceholder, { backgroundColor: colors.border }]}>
                          <Ionicons name="image-outline" size={32} color={colors.textMuted} />
                        </View>
                      )}
                      <View style={styles.productInfo}>
                        <Text style={[styles.productName, { color: colors.text }]} numberOfLines={2}>
                          {product.name}
                        </Text>
                        <View style={styles.priceRow}>
                          <Text style={styles.priceEmoji}>🪙</Text>
                          <Text style={[styles.productPrice, { color: colors.primary }]}>
                            {product.price.toLocaleString()}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  </Link>
                ))
              )}
            </View>
          )}

          {/* Marketplace Tab */}
          {activeTab === 'marketplace' && (
            <View style={styles.section}>
              <View style={[styles.marketplaceBanner, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="storefront" size={32} color={colors.primary} />
                <Text style={[styles.bannerTitle, { color: colors.text }]}>Fan Marketplace</Text>
                <Text style={[styles.bannerText, { color: colors.textSecondary }]}>
                  Buy and sell tickets, memorabilia, and gear with other fans
                </Text>
                <Link href="/marketplace" asChild>
                  <TouchableOpacity style={[styles.browseButton, { backgroundColor: colors.primary }]}>
                    <Text style={styles.browseButtonText}>Browse Listings</Text>
                  </TouchableOpacity>
                </Link>
              </View>

              <View style={styles.quickLinks}>
                <Link href="/marketplace?category=tickets" asChild>
                  <TouchableOpacity style={[styles.quickLink, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Ionicons name="ticket" size={24} color={TeamColors.eagles} />
                    <Text style={[styles.quickLinkText, { color: colors.text }]}>Tickets</Text>
                  </TouchableOpacity>
                </Link>
                <Link href="/marketplace?category=memorabilia" asChild>
                  <TouchableOpacity style={[styles.quickLink, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Ionicons name="trophy" size={24} color={TeamColors.phillies} />
                    <Text style={[styles.quickLinkText, { color: colors.text }]}>Memorabilia</Text>
                  </TouchableOpacity>
                </Link>
                <Link href="/marketplace?category=apparel" asChild>
                  <TouchableOpacity style={[styles.quickLink, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Ionicons name="shirt" size={24} color={TeamColors.sixers} />
                    <Text style={[styles.quickLinkText, { color: colors.text }]}>Apparel</Text>
                  </TouchableOpacity>
                </Link>
                <Link href="/marketplace?category=other" asChild>
                  <TouchableOpacity style={[styles.quickLink, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Ionicons name="grid" size={24} color={TeamColors.flyers} />
                    <Text style={[styles.quickLinkText, { color: colors.text }]}>Other</Text>
                  </TouchableOpacity>
                </Link>
              </View>
            </View>
          )}

          {/* Raffles Tab */}
          {activeTab === 'raffles' && (
            <View style={styles.section}>
              {raffles.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="ticket-outline" size={48} color={colors.textMuted} />
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                    No active raffles
                  </Text>
                  <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                    Check back soon for exciting prizes!
                  </Text>
                </View>
              ) : (
                raffles.map((raffle) => (
                  <Link
                    key={raffle._id}
                    href={{
                      pathname: '/raffles/[id]',
                      params: { id: raffle._id },
                    }}
                    asChild
                  >
                    <TouchableOpacity
                      style={[styles.raffleCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    >
                      {raffle.image && (
                        <Image source={{ uri: raffle.image }} style={styles.raffleImage} />
                      )}
                      <View style={styles.raffleInfo}>
                        <Text style={[styles.raffleName, { color: colors.text }]}>{raffle.name}</Text>
                        <Text style={[styles.rafflePrice, { color: colors.primary }]}>
                          🪙 {raffle.ticketPrice} per ticket
                        </Text>
                        <Text style={[styles.raffleEnds, { color: colors.textMuted }]}>
                          {raffle.ticketsSold || 0} tickets sold
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                    </TouchableOpacity>
                  </Link>
                ))
              )}
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  balanceLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginBottom: 2,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  balanceEmoji: {
    fontSize: 22,
  },
  balanceValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
  },
  signInButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  signInText: {
    fontWeight: '600',
    fontSize: 14,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    padding: 16,
  },
  productsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 48,
    width: '100%',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 4,
  },
  productCard: {
    width: '48%',
    margin: '1%',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: 140,
    resizeMode: 'cover',
  },
  productImagePlaceholder: {
    width: '100%',
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
  },
  productInfo: {
    padding: 12,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    lineHeight: 18,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  priceEmoji: {
    fontSize: 14,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '800',
  },
  marketplaceBanner: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  bannerTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 4,
  },
  bannerText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  browseButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  browseButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  quickLinks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickLink: {
    width: '47%',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  quickLinkText: {
    fontSize: 14,
    fontWeight: '600',
  },
  raffleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  raffleImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  raffleInfo: {
    flex: 1,
  },
  raffleName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  rafflePrice: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  raffleEnds: {
    fontSize: 12,
  },
});
