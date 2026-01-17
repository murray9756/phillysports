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
  Alert,
} from 'react-native';
import { Stack, Link } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { shopService } from '@/services/api';

interface Product {
  _id: string;
  name: string;
  description: string;
  price: number;
  image?: string;
  category: string;
  inStock: boolean;
}

const categories = [
  { id: 'all', name: 'All', icon: 'grid' },
  { id: 'apparel', name: 'Apparel', icon: 'shirt' },
  { id: 'accessories', name: 'Accessories', icon: 'watch' },
  { id: 'collectibles', name: 'Collectibles', icon: 'trophy' },
  { id: 'digital', name: 'Digital', icon: 'phone-portrait' },
];

export default function ShopScreen() {
  const { colors } = useTheme();
  const { user, isAuthenticated, refreshUser } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    loadProducts();
  }, [selectedCategory]);

  const loadProducts = async () => {
    try {
      const category = selectedCategory === 'all' ? undefined : selectedCategory;
      const data = await shopService.getProducts(category);
      setProducts(data.products || []);
    } catch (error) {
      console.error('Failed to load products:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadProducts();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Shop' }} />
        <View style={[styles.container, styles.centerContent, { backgroundColor: colors.background }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Shop' }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Balance Header */}
        {isAuthenticated && (
          <View style={[styles.balanceHeader, { backgroundColor: colors.primary }]}>
            <View>
              <Text style={styles.balanceLabel}>Your Balance</Text>
              <View style={styles.balanceRow}>
                <Text style={styles.balanceEmoji}>🪙</Text>
                <Text style={styles.balanceValue}>
                  {Math.round(user?.coinBalance || 0).toLocaleString()}
                </Text>
              </View>
            </View>
            <Link href="/raffles" asChild>
              <TouchableOpacity style={styles.rafflesButton}>
                <Ionicons name="ticket" size={18} color={colors.primary} />
                <Text style={[styles.rafflesButtonText, { color: colors.primary }]}>Raffles</Text>
              </TouchableOpacity>
            </Link>
          </View>
        )}

        {/* Category Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.categoryBar, { backgroundColor: colors.card, borderColor: colors.border }]}
          contentContainerStyle={styles.categoryContent}
        >
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoryTab,
                selectedCategory === cat.id && { backgroundColor: colors.primary },
              ]}
              onPress={() => setSelectedCategory(cat.id)}
            >
              <Ionicons
                name={cat.icon as any}
                size={16}
                color={selectedCategory === cat.id ? '#fff' : colors.textMuted}
              />
              <Text
                style={[
                  styles.categoryText,
                  { color: selectedCategory === cat.id ? '#fff' : colors.text },
                ]}
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
        >
          {/* Products Grid */}
          <View style={styles.productsGrid}>
            {products.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="storefront-outline" size={48} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  No products in this category
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
                      {!product.inStock && (
                        <Text style={styles.outOfStock}>Out of Stock</Text>
                      )}
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
  rafflesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  rafflesButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  categoryBar: {
    borderBottomWidth: 1,
    maxHeight: 56,
  },
  categoryContent: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  categoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '600',
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
    marginTop: 12,
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
  outOfStock: {
    color: '#E53935',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
});
