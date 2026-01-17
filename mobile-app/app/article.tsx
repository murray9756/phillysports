import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Linking,
  Share,
} from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';

import { useTheme } from '@/context/ThemeContext';

export default function ArticleScreen() {
  const { url, title, image, source } = useLocalSearchParams<{
    url: string;
    title: string;
    image?: string;
    source?: string;
  }>();
  const { colors } = useTheme();
  const router = useRouter();

  const handleShare = async () => {
    try {
      await Share.share({
        title: title || 'PhillySports Article',
        message: `${title}\n\n${url}`,
        url: url,
      });
    } catch (error) {
      console.error('Failed to share:', error);
    }
  };

  const handleOpenInBrowser = async () => {
    if (url) {
      await Linking.openURL(url);
    }
  };

  if (!url) {
    return (
      <View style={[styles.container, styles.errorContainer, { backgroundColor: colors.background }]}>
        <Ionicons name="alert-circle" size={48} color={colors.textMuted} />
        <Text style={[styles.errorText, { color: colors.text }]}>Article not found</Text>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: colors.primary }]}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: source || 'Article',
          headerRight: () => (
            <View style={styles.headerButtons}>
              <TouchableOpacity onPress={handleShare} style={styles.headerButton}>
                <Ionicons name="share-outline" size={24} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleOpenInBrowser} style={styles.headerButton}>
                <Ionicons name="open-outline" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
          ),
        }}
      />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <WebView
          source={{ uri: url }}
          style={styles.webview}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
              <View style={styles.loadingContent}>
                {image && <Image source={{ uri: image }} style={styles.previewImage} />}
                <Text style={[styles.loadingTitle, { color: colors.text }]} numberOfLines={3}>
                  {title}
                </Text>
                <Text style={[styles.loadingSource, { color: colors.textMuted }]}>
                  Loading from {source || 'source'}...
                </Text>
              </View>
            </View>
          )}
          onError={() => {
            // WebView error, show fallback
          }}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 24,
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
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    padding: 8,
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingContent: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
  },
  loadingTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 12,
  },
  loadingSource: {
    fontSize: 14,
  },
});
