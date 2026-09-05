// Minimal in-memory, per-process cache for read-heavy public endpoints
// (standings, top scorers, records) whose underlying data only changes when
// a match is simulated (at most once a minute, via the cron worker). Not
// shared across API replicas — if the API is ever scaled horizontally, each
// instance just recomputes independently every TTL, which is an acceptable
// trade-off for now (a distributed cache like Redis would be the upgrade).
const store = new Map(); // key -> { value, expiresAt }

/** Returns the cached value for `key` if still fresh, otherwise computes it
 * via `fn`, caches it for `ttlMs`, and returns it. */
async function getOrSet(key, ttlMs, fn) {
  const hit = store.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  const value = await fn();
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

module.exports = { getOrSet };
