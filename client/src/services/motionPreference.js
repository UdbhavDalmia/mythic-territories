export function getMotionPreference() {
  if (typeof window === 'undefined') return 'full';
  const saved = localStorage.getItem('mythic_motion_mode');
  if (saved === 'full' || saved === 'reduced') return saved;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduced' : 'full';
}

export function applyMotionPreference(mode) {
  if (typeof document === 'undefined') return;
  if (mode === 'reduced') {
    document.documentElement.classList.add('reduced-motion');
  } else {
    document.documentElement.classList.remove('reduced-motion');
  }
  localStorage.setItem('mythic_motion_mode', mode);
}
