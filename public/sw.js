/* 中学受験勉強アプリ — 最小 Service Worker（PWA 登録用） */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
