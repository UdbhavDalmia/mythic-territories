import { PATCHES } from '../data/patchNotes.jsx';

const STORAGE_KEY = 'mt_last_viewed_patch';

export function getLatestReleasedVersion() {
  const released = PATCHES.find(p => !p.version.includes('UPCOMING'));
  return released ? released.version : '1.9';
}

export function hasUnreadPatchNotes() {
  if (typeof window === 'undefined') return false;
  try {
    const lastViewed = localStorage.getItem(STORAGE_KEY);
    const latest = getLatestReleasedVersion();
    return lastViewed !== latest;
  } catch (_) {
    return false;
  }
}

export function markPatchNotesAsViewed() {
  if (typeof window === 'undefined') return;
  try {
    const latest = getLatestReleasedVersion();
    localStorage.setItem(STORAGE_KEY, latest);
    window.dispatchEvent(new CustomEvent('mt_patch_viewed', { detail: { version: latest } }));
  } catch (_) {}
}

