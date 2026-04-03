const CACHE_NAME = "shop-pos-v1";
const ASSETS_TO_CACHE = [
    "/",
    "/index.html",
    "/admin.html",
    "/style.css",
    "/script.js",
    "/admin.js",
    "/manifest.json"
];

// Install Event - Caches files
self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// Fetch Event - Serves files from cache if offline
self.addEventListener("fetch", event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request);
        })
    );
});