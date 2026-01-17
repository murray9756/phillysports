import { Linking } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

/**
 * Deep link URL mappings from web routes to app routes
 *
 * The app supports these URL schemes:
 * - phillysports:// (custom scheme)
 * - https://phillysports.com (universal links on iOS)
 * - https://www.phillysports.com (universal links on iOS)
 *
 * With Expo Router, file-based routing handles most deep links automatically.
 * This file provides utilities for programmatic linking and URL handling.
 */

export const APP_SCHEME = 'phillysports';
export const WEB_DOMAIN = 'phillysports.com';

/**
 * Supported deep link paths that map to app screens
 */
export const DEEP_LINK_PATHS = {
  // Main tabs
  home: '/',
  teams: '/teams',
  gaming: '/gaming',
  community: '/community',
  profile: '/profile',

  // Team pages
  team: (slug: string) => `/team/${slug}`,

  // Gaming
  trivia: '/trivia',
  predictions: '/predictions',
  poker: '/poker',
  pokerTable: (id: string) => `/poker/table/${id}`,
  pools: '/pools',
  poolDetail: (id: string) => `/pools/${id}`,

  // Community
  forums: '/forums',
  forumPost: (id: string) => `/forums/post/${id}`,
  forumCategory: (id: string) => `/forums/category/${id}`,
  clubs: '/clubs',
  clubDetail: (id: string) => `/clubs/${id}`,
  watchParties: '/watch-parties',
  watchPartyDetail: (id: string) => `/watch-parties/${id}`,
  tailgates: '/tailgates',
  tailgateDetail: (id: string) => `/tailgates/${id}`,
  messages: '/messages',
  conversation: (id: string) => `/messages/${id}`,
  gameThreads: '/game-threads',
  gameThread: (id: string) => `/game-threads/${id}`,

  // Shop
  shop: '/shop',
  product: (id: string) => `/shop/${id}`,
  marketplace: '/marketplace',
  listing: (id: string) => `/marketplace/${id}`,
  raffles: '/raffles',
  raffle: (id: string) => `/raffles/${id}`,

  // Auth
  login: '/(auth)/login',
  register: '/(auth)/register',
  forgotPassword: '/(auth)/forgot-password',

  // Settings
  notifications: '/settings/notifications',
  security: '/settings/security',
};

/**
 * Generate a deep link URL with the app's custom scheme
 */
export function createDeepLink(path: string): string {
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${APP_SCHEME}://${cleanPath}`;
}

/**
 * Generate a universal link (web URL that opens the app)
 */
export function createUniversalLink(path: string): string {
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `https://${WEB_DOMAIN}/${cleanPath}`;
}

/**
 * Open a URL in the appropriate way
 * - Deep links open directly in the app
 * - Web URLs open in an in-app browser
 */
export async function openURL(url: string): Promise<void> {
  try {
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      // Fall back to in-app browser for web URLs
      await WebBrowser.openBrowserAsync(url);
    }
  } catch (error) {
    console.error('Failed to open URL:', error);
    throw error;
  }
}

/**
 * Share a deep link (useful for sharing content from the app)
 */
export function getShareableLink(path: string): string {
  // Always use universal links for sharing (works for everyone)
  return createUniversalLink(path);
}

/**
 * Parse a URL and extract the path and params
 */
export function parseURL(url: string): { path: string; params: Record<string, string> } {
  try {
    const urlObj = new URL(url);
    const params: Record<string, string> = {};

    urlObj.searchParams.forEach((value, key) => {
      params[key] = value;
    });

    return {
      path: urlObj.pathname,
      params,
    };
  } catch {
    // Handle custom scheme URLs (phillysports://path)
    const match = url.match(/^phillysports:\/\/(.*)$/);
    if (match) {
      const [pathWithParams] = match[1].split('?');
      return { path: `/${pathWithParams}`, params: {} };
    }
    return { path: '/', params: {} };
  }
}

/**
 * Check if a URL is a PhillySports deep link
 */
export function isPhillySportsLink(url: string): boolean {
  return (
    url.startsWith(`${APP_SCHEME}://`) ||
    url.startsWith(`https://${WEB_DOMAIN}`) ||
    url.startsWith(`https://www.${WEB_DOMAIN}`)
  );
}
