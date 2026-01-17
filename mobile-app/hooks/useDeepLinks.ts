import { useEffect } from 'react';
import { Linking } from 'react-native';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { parseURL, isPhillySportsLink } from '@/utils/linking';

/**
 * Hook to handle deep links when app is already open
 *
 * Note: Initial deep links (when app launches from a link) are handled
 * automatically by Expo Router. This hook handles links received while
 * the app is already running.
 */
export function useDeepLinks() {
  const router = useRouter();

  useEffect(() => {
    // Handle links received while app is running
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    // Check if app was opened with a link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink(url);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const handleDeepLink = (url: string) => {
    if (!isPhillySportsLink(url)) {
      return;
    }

    const { path, params } = parseURL(url);

    // Convert web paths to app paths if needed
    const appPath = mapWebPathToAppPath(path);

    // Navigate to the path
    if (Object.keys(params).length > 0) {
      router.push({
        pathname: appPath as any,
        params,
      });
    } else {
      router.push(appPath as any);
    }
  };

  return { handleDeepLink };
}

/**
 * Map web URL paths to app routes
 * Most paths are the same, but some need transformation
 */
function mapWebPathToAppPath(webPath: string): string {
  // Remove trailing slash
  let path = webPath.endsWith('/') && webPath.length > 1
    ? webPath.slice(0, -1)
    : webPath;

  // Map web-specific paths to app routes
  const pathMappings: Record<string, string> = {
    '/eagles': '/team/eagles',
    '/phillies': '/team/phillies',
    '/sixers': '/team/sixers',
    '/flyers': '/team/flyers',
    '/union': '/team/union',
    '/temple': '/team/temple',
    '/villanova': '/team/villanova',
    '/penn-state': '/team/penn-state',
    '/login': '/(auth)/login',
    '/register': '/(auth)/register',
    '/signup': '/(auth)/register',
    '/forgot-password': '/(auth)/forgot-password',
    '/reset-password': '/(auth)/forgot-password',
  };

  // Check for direct mappings
  if (pathMappings[path]) {
    return pathMappings[path];
  }

  // Handle dynamic routes
  // /article/123 -> /article?id=123 (handled by expo-router)
  // /team/eagles -> /team/eagles
  // These should work automatically with Expo Router

  return path || '/';
}

export default useDeepLinks;
