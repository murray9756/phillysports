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
  TextInput,
} from 'react-native';
import { Stack, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';

interface Listing {
  _id: string;
  title: string;
  description: string;
  price: number;
  image?: string;
  category: string;
  condition: 'new' | 'like-new' | 'good' | 'fair';
  seller: {
    _id: string;
    username: string;
  };
  createdAt: string;
  isSold?: boolean;
}

const categories = ['All', 'Tickets', 'Memorabilia', 'Apparel', 'Equipment', 'Other'];

export default function MarketplaceScreen() {
  const { colors } = useTheme();
  const { isAuthenticated, user } = useAuth();

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadListings();
  }, [selectedCategory]);

  const loadListings = async () => {
    try {
      const params: any = {};
      if (selectedCategory !== 'All') params.category = selectedCategory.toLowerCase();
      const response = await api.get('/marketplace', { params });
      setListings(response.data.listings || []);
    } catch (error) {
      console.error('Failed to load listings:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadListings();
    setRefreshing(false);
  };

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'new': return '#4CAF50';
      case 'like-new': return '#8BC34A';
      case 'good': return '#FFC107';
      case 'fair': return '#FF9800';
      default: return colors.textMuted;
    }
  };

  const timeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const hours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const filteredListings = listings.filter((listing) =>
    listing.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Marketplace' }} />
        <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Marketplace',
          headerRight: () => (
            <Link href="/marketplace/create" asChild>
              <TouchableOpacity style={styles.headerButton}>
                <Ionicons name="add-circle" size={28} color={colors.primary} />
              </TouchableOpacity>
            </Link>
          ),
        }}
      />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Search Bar */}
        <View style={[styles.searchContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search listings..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* Category Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryBar}
          contentContainerStyle={styles.categoryContent}
        >
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.categoryTab,
                selectedCategory === cat && { backgroundColor: colors.primary },
                selectedCategory !== cat && { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
              ]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Text
                style={[
                  styles.categoryText,
                  { color: selectedCategory === cat ? '#fff' : colors.text },
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          {/* Listings Grid */}
          <View style={styles.listingsGrid}>
            {filteredListings.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="pricetag-outline" size={48} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>No listings found</Text>
              </View>
            ) : (
              filteredListings.map((listing) => (
                <Link
                  key={listing._id}
                  href={{
                    pathname: '/marketplace/[id]',
                    params: { id: listing._id },
                  }}
                  asChild
                >
                  <TouchableOpacity
                    style={[styles.listingCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  >
                    {listing.image ? (
                      <Image source={{ uri: listing.image }} style={styles.listingImage} />
                    ) : (
                      <View style={[styles.imagePlaceholder, { backgroundColor: colors.border }]}>
                        <Ionicons name="image-outline" size={32} color={colors.textMuted} />
                      </View>
                    )}

                    {listing.isSold && (
                      <View style={styles.soldBanner}>
                        <Text style={styles.soldText}>SOLD</Text>
                      </View>
                    )}

                    <View style={styles.listingInfo}>
                      <Text style={[styles.listingTitle, { color: colors.text }]} numberOfLines={2}>
                        {listing.title}
                      </Text>

                      <Text style={[styles.listingPrice, { color: colors.primary }]}>
                        ${listing.price.toLocaleString()}
                      </Text>

                      <View style={styles.listingMeta}>
                        <View style={[styles.conditionBadge, { backgroundColor: getConditionColor(listing.condition) }]}>
                          <Text style={styles.conditionText}>{listing.condition}</Text>
                        </View>
                        <Text style={[styles.timeText, { color: colors.textMuted }]}>
                          {timeAgo(listing.createdAt)}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                </Link>
              ))
            )}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButton: {
    marginRight: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  categoryBar: {
    maxHeight: 50,
    marginBottom: 8,
  },
  categoryContent: {
    paddingHorizontal: 12,
    gap: 8,
  },
  categoryTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  listingsGrid: {
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
    marginTop: 12,
  },
  listingCard: {
    width: '48%',
    margin: '1%',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  listingImage: {
    width: '100%',
    height: 140,
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    width: '100%',
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
  },
  soldBanner: {
    position: 'absolute',
    top: 10,
    right: -30,
    backgroundColor: '#E53935',
    paddingHorizontal: 30,
    paddingVertical: 4,
    transform: [{ rotate: '45deg' }],
  },
  soldText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  listingInfo: {
    padding: 10,
  },
  listingTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    lineHeight: 18,
  },
  listingPrice: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
  },
  listingMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  conditionBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  conditionText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  timeText: {
    fontSize: 11,
  },
});
