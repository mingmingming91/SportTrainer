const CACHE_NAME = 'command-player-v1';
const ASSETS = [
  './',                  // 快取根目錄 (等同於 index.html)
  './index.html',
  './script.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// 安裝 Service Worker 並快取檔案
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Caching all assets');
      // 使用 catch 捕獲錯誤，避免因為單個檔案抓不到而導致整個 SW 掛掉
      return cache.addAll(ASSETS).catch(err => {
        console.error('[Service Worker] Cache addAll 失敗，請檢查檔案路徑:', err);
      });
    })
  );
});

// 啟用並清理舊快取
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim()) // 讓新 SW 立即取得控制權
  );
});

// 攔截請求並優先從快取讀取 (離線支援)
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(e.request);
    })
  );
});
