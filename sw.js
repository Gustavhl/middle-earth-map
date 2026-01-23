self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("fetch", () => {
  // Network-first for now
});