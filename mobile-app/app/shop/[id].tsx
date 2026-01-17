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
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';

interface Product {
  _id: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  category: string;
  inStock: boolean;
  stockCount?: number;
  details?: string[];
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { user, isAuthenticated, refreshUser } = useAuth();
  const router = useRouter();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    loadProduct();
  }, [id]);

  const loadProduct = async () => {
    try {
      const response = await api.get(`/shop/products/${id}`);
      setProduct(response.data.product);
    } catch (error) {
      console.error('Failed to load product:', error);
      Alert.alert('Error', 'Failed to load product');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!isAuthenticated) {
      Alert.alert('Sign In Required', 'Please sign in to make purchases');
      return;
    }

    if (!product) return;

    const totalCost = product.price * quantity;
    if ((user?.coinBalance || 0) < totalCost) {
      Alert.alert('Insufficient Balance', `You need ${totalCost.toLocaleString()} Diehard Dollars for this purchase`);
      return;
    }

    Alert.alert(
      'Confirm Purchase',
      `Buy ${quantity}x ${product.name} for ${totalCost.toLocaleString()} coins?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Buy Now',
          onPress: async () => {
            setPurchasing(true);
            try {
              await api.post('/shop/purchase', { productId: id, quantity });
              await refreshUser();
              Alert.alert('Success!', 'Your order has been placed!', [
                { text: 'OK', onPress: () => router.back() },
              ]);
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.message || 'Purchase failed');
            } finally {
              setPurchasing(false);
            }
          },
        },
      ]
    );
  };

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

  if (!product) {
    return (
      <>
        <Stack.Screen options={{ title: 'Not Found' }} />
        <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
          <Ionicons name="alert-circle" size={48} color={colors.textMuted} />
          <Text style={[styles.errorText, { color: colors.text }]}>Product not found</Text>
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
      <Stack.Screen options={{ title: product.name }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView>
          {/* Image Gallery */}
          <View style={styles.imageContainer}>
            {product.images && product.images.length > 0 ? (
              <>
                <Image source={{ uri: product.images[selectedImage] }} style={styles.mainImage} />
                {product.images.length > 1 && (
                  <ScrollView horizontal style={styles.thumbnails} showsHorizontalScrollIndicator={false}>
                    {product.images.map((img, index) => (
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

          {/* Product Info */}
          <View style={styles.infoContainer}>
            <View style={[styles.categoryBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.categoryText}>{product.category}</Text>
            </View>

            <Text style={[styles.productName, { color: colors.text }]}>{product.name}</Text>

            <View style={styles.priceRow}>
              <Text style={styles.priceEmoji}>🪙</Text>
              <Text style={[styles.price, { color: colors.primary }]}>
                {product.price.toLocaleString()}
              </Text>
            </View>

            {!product.inStock && (
              <View style={[styles.outOfStockBanner, { backgroundColor: '#E53935' }]}>
                <Ionicons name="alert-circle" size={16} color="#fff" />
                <Text style={styles.outOfStockText}>Out of Stock</Text>
              </View>
            )}

            <Text style={[styles.description, { color: colors.textSecondary }]}>
              {product.description}
            </Text>

            {product.details && product.details.length > 0 && (
              <View style={[styles.detailsSection, { borderColor: colors.border }]}>
                <Text style={[styles.detailsTitle, { color: colors.text }]}>Details</Text>
                {product.details.map((detail, index) => (
                  <View key={index} style={styles.detailRow}>
                    <Ionicons name="checkmark" size={16} color={colors.primary} />
                    <Text style={[styles.detailText, { color: colors.textSecondary }]}>{detail}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Quantity Selector */}
            {product.inStock && (
              <View style={[styles.quantitySection, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.quantityLabel, { color: colors.text }]}>Quantity</Text>
                <View style={styles.quantityControls}>
                  <TouchableOpacity
                    style={[styles.quantityButton, { backgroundColor: colors.border }]}
                    onPress={() => setQuantity(Math.max(1, quantity - 1))}
                  >
                    <Ionicons name="remove" size={20} color={colors.text} />
                  </TouchableOpacity>
                  <Text style={[styles.quantityValue, { color: colors.text }]}>{quantity}</Text>
                  <TouchableOpacity
                    style={[styles.quantityButton, { backgroundColor: colors.border }]}
                    onPress={() => setQuantity(quantity + 1)}
                  >
                    <Ionicons name="add" size={20} color={colors.text} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Purchase Bar */}
        <View style={[styles.purchaseBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.totalSection}>
            <Text style={[styles.totalLabel, { color: colors.textMuted }]}>Total</Text>
            <View style={styles.totalRow}>
              <Text style={styles.totalEmoji}>🪙</Text>
              <Text style={[styles.totalPrice, { color: colors.text }]}>
                {(product.price * quantity).toLocaleString()}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[
              styles.purchaseButton,
              { backgroundColor: product.inStock ? colors.primary : colors.textMuted },
            ]}
            onPress={handlePurchase}
            disabled={!product.inStock || purchasing}
          >
            {purchasing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.purchaseButtonText}>
                {product.inStock ? 'Buy Now' : 'Out of Stock'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
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
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 12,
  },
  categoryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  productName: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 12,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  priceEmoji: {
    fontSize: 24,
  },
  price: {
    fontSize: 28,
    fontWeight: '800',
  },
  outOfStockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    gap: 8,
    marginBottom: 16,
  },
  outOfStockText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  description: {
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 20,
  },
  detailsSection: {
    borderTopWidth: 1,
    paddingTop: 16,
    marginBottom: 16,
  },
  detailsTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
  },
  quantitySection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  quantityLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  quantityButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityValue: {
    fontSize: 18,
    fontWeight: '700',
    minWidth: 30,
    textAlign: 'center',
  },
  purchaseBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
  },
  totalSection: {
    flex: 1,
  },
  totalLabel: {
    fontSize: 12,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  totalEmoji: {
    fontSize: 18,
  },
  totalPrice: {
    fontSize: 22,
    fontWeight: '800',
  },
  purchaseButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  purchaseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
