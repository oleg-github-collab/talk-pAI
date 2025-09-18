// Talk pAI Service Worker
// Ultra-modern PWA functionality with glassmorphism theming

const CACHE_NAME = 'talk-pai-v2.0.0';
const STATIC_CACHE = 'talk-pai-static-v2.0.0';
const DYNAMIC_CACHE = 'talk-pai-dynamic-v2.0.0';

// Files to cache for offline functionality
const staticAssets = [
    '/',
    '/index.html',
    '/manifest.json',
    '/favicon.svg',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap',
    'https://cdn.socket.io/4.6.1/socket.io.min.js',
    'https://cdn.jsdelivr.net/npm/marked@5.1.1/marked.min.js'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('🔧 Service Worker installing...');

    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('📦 Caching static assets');
                return cache.addAll(staticAssets);
            })
            .then(() => {
                console.log('✅ Static assets cached successfully');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('❌ Error caching static assets:', error);
            })
    );
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
    console.log('🚀 Service Worker activating...');

    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
                            console.log('🗑️ Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('✅ Service Worker activated');
                return self.clients.claim();
            })
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Handle different types of requests
    if (request.method === 'GET') {
        // API requests - network first, cache fallback
        if (url.pathname.startsWith('/api/')) {
            event.respondWith(networkFirstStrategy(request));
        }
        // Static assets - cache first, network fallback
        else if (isStaticAsset(url)) {
            event.respondWith(cacheFirstStrategy(request));
        }
        // HTML pages - network first, cache fallback
        else if (request.headers.get('accept')?.includes('text/html')) {
            event.respondWith(networkFirstStrategy(request));
        }
        // Other resources - stale while revalidate
        else {
            event.respondWith(staleWhileRevalidateStrategy(request));
        }
    }
});

// Cache first strategy (for static assets)
async function cacheFirstStrategy(request) {
    try {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }

        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        console.error('❌ Cache first strategy failed:', error);
        return new Response('Offline - content not available', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
        });
    }
}

// Network first strategy (for API and HTML)
async function networkFirstStrategy(request) {
    try {
        const networkResponse = await fetch(request);
        if (networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    } catch (error) {
        console.warn('⚠️ Network failed, trying cache:', error);
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }

        // Return offline page for HTML requests
        if (request.headers.get('accept')?.includes('text/html')) {
            const offlineResponse = await caches.match('/');
            if (offlineResponse) {
                return offlineResponse;
            }
        }

        return new Response('Offline - please check your connection', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
        });
    }
}

// Stale while revalidate strategy
async function staleWhileRevalidateStrategy(request) {
    const cache = await caches.open(DYNAMIC_CACHE);
    const cachedResponse = await cache.match(request);

    // Fetch in background and update cache
    const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    }).catch(() => {
        // Silently fail background fetch
        console.warn('⚠️ Background fetch failed for:', request.url);
    });

    // Return cached version immediately if available
    if (cachedResponse) {
        return cachedResponse;
    }

    // Otherwise wait for network
    return fetchPromise;
}

// Check if request is for a static asset
function isStaticAsset(url) {
    const staticExtensions = ['.css', '.js', '.png', '.jpg', '.jpeg', '.svg', '.ico', '.woff', '.woff2', '.ttf'];
    return staticExtensions.some(ext => url.pathname.endsWith(ext)) ||
           url.hostname === 'fonts.googleapis.com' ||
           url.hostname === 'fonts.gstatic.com' ||
           url.hostname === 'cdn.socket.io' ||
           url.hostname === 'cdn.jsdelivr.net';
}

// Handle background sync for message sending
self.addEventListener('sync', (event) => {
    console.log('🔄 Background sync triggered:', event.tag);

    if (event.tag === 'background-message-sync') {
        event.waitUntil(syncPendingMessages());
    }
});

// Sync pending messages when back online
async function syncPendingMessages() {
    try {
        // Get pending messages from IndexedDB or localStorage
        const pendingMessages = await getPendingMessages();

        for (const message of pendingMessages) {
            try {
                await fetch('/api/chat/message', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(message)
                });

                // Remove from pending after successful send
                await removePendingMessage(message.id);
                console.log('✅ Synced pending message:', message.id);
            } catch (error) {
                console.error('❌ Failed to sync message:', message.id, error);
            }
        }
    } catch (error) {
        console.error('❌ Background sync failed:', error);
    }
}

// Push notification handling
self.addEventListener('push', (event) => {
    console.log('📲 Push notification received');

    const options = {
        body: 'You have a new message in Talk pAI',
        icon: '/favicon.svg',
        badge: '/favicon.svg',
        tag: 'talk-pai-message',
        renotify: true,
        requireInteraction: false,
        actions: [
            {
                action: 'open',
                title: 'Open Chat',
                icon: '/favicon.svg'
            },
            {
                action: 'close',
                title: 'Dismiss'
            }
        ]
    };

    if (event.data) {
        try {
            const data = event.data.json();
            options.body = data.message || options.body;
            options.data = data;
        } catch (error) {
            console.warn('⚠️ Could not parse push data:', error);
        }
    }

    event.waitUntil(
        self.registration.showNotification('Talk pAI', options)
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    console.log('👆 Notification clicked:', event.action);

    event.notification.close();

    if (event.action === 'open' || !event.action) {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// Helper functions for message storage (would typically use IndexedDB)
async function getPendingMessages() {
    // In a real implementation, this would read from IndexedDB
    try {
        const pending = localStorage.getItem('talkpai-pending-messages');
        return pending ? JSON.parse(pending) : [];
    } catch {
        return [];
    }
}

async function removePendingMessage(messageId) {
    // In a real implementation, this would remove from IndexedDB
    try {
        const pending = await getPendingMessages();
        const filtered = pending.filter(msg => msg.id !== messageId);
        localStorage.setItem('talkpai-pending-messages', JSON.stringify(filtered));
    } catch (error) {
        console.error('❌ Failed to remove pending message:', error);
    }
}

// Skip waiting when new version is available
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        console.log('⏭️ Skipping waiting, activating new service worker');
        self.skipWaiting();
    }
});

console.log('🎯 Talk pAI Service Worker loaded successfully!');