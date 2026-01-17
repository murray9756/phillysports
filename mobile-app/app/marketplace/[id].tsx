import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, Stack, useRouter, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';

interface Listing {
  _id: string;
  title: string;
  description: string;
  price: number;
  images: string[];
  category: string;
  condition: 'new' | 'like-new' | 'good' | 'fair';
  seller: {
    _id: string;
    username: string;
    avatar?: string;
    rating?: number;
    listingCount?: number;
  };
  createdAt: string;
  isSold?: boolean;
  location?: string;
}

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);

  useEffect(() => {
    loadListing();
  }, [id]);

  const loadListing = async () => {
    try {
      const response = await api.get(`/marketplace/${id}`);
      setListing(response.data.listing);
    } catch (error) {
      console.error('Failed to load listing:', error);
      Alert.alert('Error', 'Failed to load listing');
    } finally {
      setLoading(false);
    }
  };

  const handleContact = () => {
    if (!isAuthenticated) {
      Alert.alert('Sign In Required', 'Please sign in to contact the seller');
      return;
    }

    if (!listing) return;

    // Navigate to messages with this seller
    router.push({
      pathname: '/messages/[id]',
      params: { id: listing.seller._id, username: listing.seller.username },
    });
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const isOwnListing = user?._id === listing?.seller._id;

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Loading...' }} />
        <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </>
    );
  }

  if (!listing) {
    return (
      <>
        <Stack.Screen options={{ title: 'Not Found' }} />
        <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
          <Ionicons name="alert-circle" size={48} color={colors.textMuted} />
          <Text style={[styles.errorText, { color: colors.text }]}>Listing not found</Text>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: colors.primary }]}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: listing.title }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView>
          {/* Image Gallery */}
          <View style={styles.imageContainer}>
            {listing.images && listing.images.length > 0 ? (
              <>
                <Image source={{ uri: listing.images[selectedImage] }} style={styles.mainImage} />
                {listing.isSold && (
                  <View style={styles.soldOverlay}>
                    <Text style={styles.soldText}>SOLD</Text>
                  </View>
                )}
                {listing.images.length > 1 && (
                  <ScrollView horizontal style={styles.thumbnails} showsHorizontalScrollIndicator={false}>
                    {listing.images.map((img, index) => (
                      <TouchableOpacity key={index} onPress={() => setSelectedImage(index)}>
                        <Image
                          source={{ uri: img }}
                          style={[
                            styles.thumbnail,
                            selectedImage === index && { borderColor: colors.primary, borderWidth: 2 },
                          ]}
                        />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </>
            ) : (
              <View style={[styles.imagePlaceholder, { backgroundColor: colors.card }]}>
                <Ionicons name="image-outline" size={64} color={colors.textMuted} />
              </View>
            )}
          </View>

          {/* Listing Info */}
          <View style={styles.infoContainer}>
            <View style={styles.headerRow}>
              <View style={[styles.conditionBadge, { backgroundColor: getConditionColor(listing.condition) }]}>
                <Text style={styles.conditionText}>{listing.condition}</Text>
              </View>
              <Text style={[styles.date, { color: colors.textMuted }]}>
                Listed {formatDate(listing.createdAt)}
              </Text>
            </View>

            <Text style={[styles.title, { color: colors.text }]}>{listing.title}</Text>

            <Text style={[styles.price, { color: colors.primary }]}>
              ${listing.price.toLocaleString()}
            </Text>

            {listing.location && (
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={16} color={colors.textMuted} />
                <Text style={[styles.location, { color: colors.textSecondary }]}>{listing.location}</Text>
              </View>
            )}

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <Text style={[styles.sectionTitle, { color: colors.text }]}>Description</Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              {listing.description}
            </Text>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* Seller Info */}
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Seller</Text>
            <View style={[styles.sellerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {listing.seller.avatar ? (
                <Image source={{ uri: listing.seller.avatar }} style={styles.sellerAvatar} />
              ) : (
                <View style={[styles.sellerAvatarPlaceholder, { backgroundColor: colors.primary }]}>
                  <Text style={styles.sellerAvatarText}>
                    {listing.seller.username.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.sellerInfo}>
                <Text style={[styles.sellerName, { color: colors.text }]}>{listing.seller.username}</Text>
                {listing.seller.rating && (
                  <View style={styles.ratingRow}>
                    <Ionicons name="star" size={14} color="#FFC107" />
                    <Text style={[styles.rating, { color: colors.textSecondary }]}>
                      {listing.seller.rating.toFixed(1)}
                    </Text>
                    {listing.seller.listingCount && (
                      <Text style={[styles.listingCount, { color: colors.textMuted }]}>
                        · {listing.seller.listingCount} listings
                      </Text>
                    )}
                  </View>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </View>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Contact Bar */}
        {!listing.isSold && !isOwnListing && (
          <View style={[styles.contactBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.priceSection}>
              <Text style={[styles.priceLabel, { color: colors.textMuted }]}>Price</Text>
              <Text style={[styles.priceValue, { color: colors.text }]}>
                ${listing.price.toLocaleString()}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.contactButton, { backgroundColor: colors.primary }]}
              onPress={handleContact}
            >
              <Ionicons name="chatbubble" size={18} color="#fff" />
              <Text style={styles.contactButtonText}>Contact Seller</Text>
            </TouchableOpacity>
          </View>
        )}

        {isOwnListing && (
          <View style={[styles.contactBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.ownListingText, { color: colors.textMuted }]}>This is your listing</Text>
            <TouchableOpacity
              style={[styles.editButton, { borderColor: colors.primary }]}
              onPress={() => Alert.alert('Edit', 'Edit functionality coming soon')}
            >
              <Ionicons name="pencil" size={18} color={colors.primary} />
              <Text style={[styles.editButtonText, { color: colors.primary }]}>Edit</Text>
            </TouchableOpacity>
          </View>
        )}
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
  errorText: {
    fontSize: 18,
    marginTop: 12,
    marginBottom: 20,
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  imageContainer: {
    backgroundColor: '#fff',
    position: 'relative',
  },
  mainImage: {
    width: '100%',
    height: 300,
    resizeMode: 'contain',
  },
  imagePlaceholder: {
    width: '100%',
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  soldOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  soldText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '800',
  },
  thumbnails: {
    padding: 12,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 8,
  },
  infoContainer: {
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  conditionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  conditionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  date: {
    fontSize: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 8,
  },
  price: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  location: {
    fontSize: 14,
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  description: {
    fontSize: 15,
    lineHeight: 24,
  },
  sellerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  sellerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  sellerAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sellerAvatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  sellerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  sellerName: {
    fontSize: 16,
    fontWeight: '600',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  rating: {
    fontSize: 13,
  },
  listingCount: {
    fontSize: 13,
  },
  contactBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
  },
  priceSection: {
    flex: 1,
  },
  priceLabel: {
    fontSize: 12,
  },
  priceValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    gap: 8,
  },
  contactButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  ownListingText: {
    flex: 1,
    fontSize: 14,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    gap: 6,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
