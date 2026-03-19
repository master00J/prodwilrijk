// Service Worker voor Foresco Product Controle PWA
const CACHE_NAME = 'foresco-v1.4.0';
const OFFLINE_PAGE = '/offline.html';

// Bestanden die altijd gecacht moeten worden
const STATIC_CACHE_FILES = [
    '/',
    '/dashboard.html',
    '/uitvoeren_controle.html',
    '/monitor_controles.html',
    '/checklist_beheer.html',
    '/header.html',
    '/offline.html',
    '/css/styles.css',
    '/js/monitor_controles.js',
    '/manifest.json',
    // CDN resources
    'https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
    'https://cdn.jsdelivr.net/npm/chart.js'
];

// API routes die gecacht kunnen worden
const CACHEABLE_API_ROUTES = [
    '/api/checklist-beheer/templates',
    '/api/product-inspectie/dashboard/stats',
    '/api/product-inspectie/dashboard/trends'
];

// Install event - cache static files
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Caching static files');
                return cache.addAll(STATIC_CACHE_FILES);
            })
            .then(() => {
                console.log('Service Worker: Installed successfully');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('Service Worker: Installation failed', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('Service Worker: Deleting old cache', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('Service Worker: Activated successfully');
                return self.clients.claim();
            })
    );
});

// Fetch event - handle requests with cache-first or network-first strategy
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip cross-origin requests die niet in onze control staan
    if (url.origin !== self.location.origin && !STATIC_CACHE_FILES.includes(request.url)) {
        return;
    }

    // HTML pagina's - Network first, cache fallback
    if (request.destination === 'document') {
        event.respondWith(handlePageRequest(request));
        return;
    }

    // API requests - Network first met cache backup
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(handleAPIRequest(request));
        return;
    }

    // Static assets (CSS, JS, images) - Cache first
    if (request.destination === 'style' || 
        request.destination === 'script' || 
        request.destination === 'image' ||
        request.destination === 'font') {
        event.respondWith(handleStaticRequest(request));
        return;
    }

    // Default cache-first strategy
    event.respondWith(handleDefaultRequest(request));
});

// Handle page requests (HTML)
async function handlePageRequest(request) {
    try {
        // Probeer eerst network
        const networkResponse = await fetch(request);
        
        // Cache succesvolle responses
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.log('Service Worker: Network failed, checking cache for', request.url);
        
        // Fallback naar cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        
        // Laatste fallback naar offline pagina
        return caches.match(OFFLINE_PAGE);
    }
}

// Handle API requests
async function handleAPIRequest(request) {
    const url = new URL(request.url);
    
    try {
        // Probeer eerst network voor API calls
        const networkResponse = await fetch(request);
        
        // Cache alleen GET requests die succesvol zijn
        if (request.method === 'GET' && networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            
            // Cache alleen bepaalde API routes
            if (CACHEABLE_API_ROUTES.some(route => url.pathname.includes(route))) {
                cache.put(request, networkResponse.clone());
            }
        }
        
        return networkResponse;
    } catch (error) {
        console.log('Service Worker: API network failed, checking cache for', request.url);
        
        // Voor GET requests, probeer cache
        if (request.method === 'GET') {
            const cachedResponse = await caches.match(request);
            if (cachedResponse) {
                // Voeg header toe om te indiceren dat dit cached data is
                const response = cachedResponse.clone();
                response.headers.set('X-Served-By', 'ServiceWorker-Cache');
                return response;
            }
        }
        
        // Voor POST/PUT/DELETE requests, return error response
        return new Response(
            JSON.stringify({ 
                error: 'Offline - deze actie vereist een internetverbinding',
                offline: true 
            }), 
            { 
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'application/json' }
            }
        );
    }
}

// Handle static resources (CSS, JS, images)
async function handleStaticRequest(request) {
    // Cache first strategie voor static assets
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
        return cachedResponse;
    }
    
    try {
        const networkResponse = await fetch(request);
        
        // Cache succesvolle responses
        if (networkResponse.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        console.log('Service Worker: Failed to fetch static resource', request.url);
        
        // Voor images, return placeholder
        if (request.destination === 'image') {
            return new Response(
                '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#f0f0f0"/><text x="100" y="100" text-anchor="middle" fill="#999">Offline</text></svg>',
                { headers: { 'Content-Type': 'image/svg+xml' } }
            );
        }
        
        throw error;
    }
}

// Default request handler
async function handleDefaultRequest(request) {
    const cachedResponse = await caches.match(request);
    return cachedResponse || fetch(request);
}

// Background sync event
self.addEventListener('sync', (event) => {
    console.log('Service Worker: Background sync triggered', event.tag);
    
    if (event.tag === 'upload-controle') {
        event.waitUntil(syncPendingUploads());
    }
});

// Sync pending uploads when connection is restored
async function syncPendingUploads() {
    try {
        // Hier zou je pending uploads uit IndexedDB kunnen halen en uploaden
        console.log('Service Worker: Syncing pending uploads...');
        
        // Voor nu loggen we alleen - dit kan later uitgebreid worden
        // met echte offline data synchronisatie
    } catch (error) {
        console.error('Service Worker: Failed to sync uploads', error);
    }
}

// Push event voor notifications (toekomstige functionaliteit)
self.addEventListener('push', (event) => {
    if (!event.data) return;
    
    const data = event.data.json();
    const options = {
        body: data.body,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        data: data.data || {},
        actions: [
            {
                action: 'view',
                title: 'Bekijken'
            },
            {
                action: 'dismiss',
                title: 'Sluiten'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    if (event.action === 'view') {
        event.waitUntil(
            clients.openWindow(event.notification.data.url || '/dashboard.html')
        );
    }
});

// Message event voor communicatie met main thread
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({ version: CACHE_NAME });
    }
});

console.log('Service Worker: Loaded successfully'); 