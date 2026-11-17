/**
 * Safe mobile haptic feedback helper
 * Gracefully ignores unsupported devices, desktop browsers, or restricted execution contexts.
 */

export function getHapticsEnabled() {
  if (typeof window === 'undefined') return true;
  const val = localStorage.getItem('mt_haptics_enabled');
  return val === null ? true : val === 'true';
}

export function setHapticsEnabled(enabled) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('mt_haptics_enabled', enabled ? 'true' : 'false');
}

export function triggerHaptic(type = 'light') {
  if (typeof window === 'undefined' || typeof navigator === 'undefined' || !('vibrate' in navigator)) {
    return;
  }
  if (!getHapticsEnabled()) {
    return;
  }
  try {
    switch (type) {
      case 'light':
      case 'select':
        navigator.vibrate(12);
        break;
      case 'medium':
      case 'move':
        navigator.vibrate(22);
        break;
      case 'heavy':
      case 'capture':
        navigator.vibrate([30, 40, 30]);
        break;
      case 'ability':
        navigator.vibrate([20, 30, 20]);
        break;
      case 'turn':
        navigator.vibrate([35, 50, 35]);
        break;
      case 'victory':
        navigator.vibrate([40, 60, 40, 60, 80]);
        break;
      case 'defeat':
        navigator.vibrate([80, 50, 80]);
        break;
      default:
        if (typeof type === 'number' || Array.isArray(type)) {
          navigator.vibrate(type);
        } else {
          navigator.vibrate(15);
        }
    }
  } catch {
    // Graceful no-op on platforms without vibration permissions
  }
}
