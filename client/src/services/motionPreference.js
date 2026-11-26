/**
 * Motion preference detection and management
 * In-memory caching avoids repeated localStorage reads and media-query evaluations.
 */

let cachedMotionMode = null;

export function getMotionPreference() {
  if (cachedMotionMode !== null) return cachedMotionMode;
  if (typeof window === 'undefined') return 'full';
  try {
    const saved = localStorage.getItem('mythic_motion_mode');
    if (saved === 'full' || saved === 'reduced') {
      cachedMotionMode = saved;
      return cachedMotionMode;
    }
    cachedMotionMode = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduced' : 'full';
  } catch {
    cachedMotionMode = 'full';
  }
  return cachedMotionMode;
}

export function applyMotionPreference(mode) {
  cachedMotionMode = mode;
  if (typeof document === 'undefined') return;
  if (mode === 'reduced') {
    document.documentElement.classList.add('reduced-motion');
  } else {
    document.documentElement.classList.remove('reduced-motion');
  }
  try {
    localStorage.setItem('mythic_motion_mode', mode);
  } catch {
    // Graceful fallback on restricted storage
  }
}
