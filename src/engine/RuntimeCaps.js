// RuntimeCaps.js
// Detect environment capabilities and suggest Threads/Hash.
// Also updates UI badges if provided.

export function detectCaps() {
  const sabEnabled = !!window.crossOriginIsolated;
  const cores = Math.max(1, Math.min(16, navigator.hardwareConcurrency || 2));
  // Be conservative in browser: 1 if SAB is off, else up to 4
  const threads = sabEnabled ? Math.min(4, cores) : 1;

  // navigator.deviceMemory is GB (approx), not supported everywhere
  const dm = navigator.deviceMemory || 4;
  const hashMB = dm >= 8 ? 128 : dm >= 4 ? 64 : 32;

  return { sabEnabled, threads, hashMB, cores, deviceMemoryGB: dm };
}

export function updateBadges({ threadsBadge, hashBadge }, caps) {
  if (threadsBadge) threadsBadge.textContent = `Threads: ${caps.threads}`;
  if (hashBadge)    hashBadge.textContent    = `Hash: ${caps.hashMB}MB`;
}
