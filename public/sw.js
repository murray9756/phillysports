// PhillySports.com Service Worker for Push Notifications

const CACHE_NAME = 'phillysports-v1';

// Install event - cache essential assets
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
    if (!event.data) {
        console.log('Push event with no data');
        return;
    }

    let data;
    try {
        data = event.data.json();
    } catch (e) {
        data = {
            title: 'PhillySports.com',
            body: event.data.text(),
            icon: '/logo.png',
            url: '/'
        };
    }

    const options = {
        body: data.body || '',
        icon: data.icon || '/logo.png',
        badge: '/logo.png',
        vibrate: [100, 50, 100],
        data: {
            url: data.url || '/',
            type: data.type || 'general',
            timestamp: Date.now()
        },
        actions: data.actions || [],
        tag: data.tag || 'phillysports-notification',
        renotify: data.renotify || false,
        requireInteraction: data.requireInteraction || false
    };

    // Add team-specific styling based on notification type
    if (data.team) {
        options.tag = `phillysports-${data.team}`;
    }

    event.waitUntil(
        self.registration.showNotification(data.title || 'PhillySports.com', options)
    );
});

// Notification click event - handle user interaction
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const urlToOpen = event.notification.data?.url || '/';

    // Handle action buttons if clicked
    if (event.action) {
        switch (event.action) {
            case 'view':
                // Default action - open the URL
                break;
            case 'dismiss':
                return; // Just close the notification
            default:
                break;
        }
    }

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Check if there's already a window open
                for (const client of clientList) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        client.focus();
                        return client.navigate(urlToOpen);
                    }
                }
                // Open new window if none exists
                if (clients.openWindow) {
                    return clients.openWindow(urlToOpen);
                }
            })
    );
});

// Notification close event - track dismissals
self.addEventListener('notificationclose', (event) => {
    // Could send analytics here if needed
    console.log('Notification dismissed:', event.notification.tag);
});

// Background sync for offline actions (future enhancement)
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-notifications') {
        event.waitUntil(syncNotifications());
    }
});

async function syncNotifications() {
    // Future: sync any pending notification interactions
    console.log('Syncing notifications...');
}
