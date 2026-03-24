const STORAGE_PREFIX = "football-bet-api-cache:v1:";

const memoryCache = new Map();
const inFlightRequests = new Map();

function now() {
  return Date.now();
}

function storageKey(cacheKey) {
  return `${STORAGE_PREFIX}${cacheKey}`;
}

function canUseLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readFromLocalStorage(cacheKey) {
  if (!canUseLocalStorage()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(storageKey(cacheKey));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !("timestamp" in parsed)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function writeToLocalStorage(cacheKey, entry) {
  if (!canUseLocalStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(storageKey(cacheKey), JSON.stringify(entry));
  } catch {
    // Ignore quota/security errors and fall back to in-memory cache.
  }
}

function removeFromLocalStorage(cacheKey) {
  if (!canUseLocalStorage()) {
    return;
  }

  try {
    window.localStorage.removeItem(storageKey(cacheKey));
  } catch {
    // Ignore localStorage cleanup failures.
  }
}

function getCacheEntry(cacheKey) {
  const inMemory = memoryCache.get(cacheKey);
  if (inMemory) {
    return inMemory;
  }

  const persisted = readFromLocalStorage(cacheKey);
  if (persisted) {
    memoryCache.set(cacheKey, persisted);
    return persisted;
  }

  return null;
}

function setCacheEntry(cacheKey, value) {
  const entry = {
    value,
    timestamp: now()
  };

  memoryCache.set(cacheKey, entry);
  writeToLocalStorage(cacheKey, entry);
}

function isWithinAge(cacheEntry, maxAgeMs) {
  return now() - cacheEntry.timestamp <= maxAgeMs;
}

async function fetchAndCacheJson({ url, cacheKey, fetchInit }) {
  const requestKey = `${cacheKey}:${url}`;
  const existing = inFlightRequests.get(requestKey);
  if (existing) {
    return existing;
  }

  const requestPromise = (async () => {
    const response = await fetch(url, fetchInit);
    if (!response.ok) {
      throw new Error(`request failed: ${response.status}`);
    }

    const data = await response.json();
    setCacheEntry(cacheKey, data);
    return data;
  })().finally(() => {
    inFlightRequests.delete(requestKey);
  });

  inFlightRequests.set(requestKey, requestPromise);
  return requestPromise;
}

export async function getCachedJson(url, options = {}) {
  const {
    cacheKey = url,
    ttlMs = 30_000,
    swrMs = 90_000,
    fetchInit,
    forceRefresh = false,
    onRevalidate,
    onRevalidateError
  } = options;

  const cacheEntry = forceRefresh ? null : getCacheEntry(cacheKey);

  if (cacheEntry && isWithinAge(cacheEntry, ttlMs)) {
    return cacheEntry.value;
  }

  if (cacheEntry && isWithinAge(cacheEntry, ttlMs + swrMs)) {
    void fetchAndCacheJson({ url, cacheKey, fetchInit })
      .then((latestValue) => {
        onRevalidate?.(latestValue);
      })
      .catch((error) => {
        onRevalidateError?.(error);
      });

    return cacheEntry.value;
  }

  try {
    return await fetchAndCacheJson({ url, cacheKey, fetchInit });
  } catch (error) {
    if (cacheEntry) {
      return cacheEntry.value;
    }
    throw error;
  }
}

export function invalidateCachedJson(cacheKey) {
  memoryCache.delete(cacheKey);
  removeFromLocalStorage(cacheKey);
}

export function invalidateCachedJsonByPrefix(prefix) {
  const toDelete = [];
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) {
      toDelete.push(key);
    }
  }

  toDelete.forEach((key) => {
    memoryCache.delete(key);
  });

  if (!canUseLocalStorage()) {
    return;
  }

  try {
    const localKeysToDelete = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key || !key.startsWith(STORAGE_PREFIX)) {
        continue;
      }

      const cacheKey = key.slice(STORAGE_PREFIX.length);
      if (cacheKey.startsWith(prefix)) {
        localKeysToDelete.push(key);
      }
    }

    localKeysToDelete.forEach((key) => {
      window.localStorage.removeItem(key);
    });
  } catch {
    // Ignore cleanup failures.
  }
}
