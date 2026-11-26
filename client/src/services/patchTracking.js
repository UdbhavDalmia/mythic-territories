import { PATCHES } from '../data/patchNotes.jsx';

const STORAGE_KEY = 'mt_last_viewed_patch';
let cachedLastViewed = null;
let cachedLatestReleased = null;

export function getLatestReleasedVersion() {
  if (cachedLatestReleased) return cachedLatestReleased;
  const released = PATCHES.find(p => !p.version.includes('UPCOMING'));
  cachedLatestReleased = released ? released.version : '1.9';
  return cachedLatestReleased;
}

export function hasUnreadPatchNotes() {
  if (typeof window === 'undefined') return false;
  try {
    if (cachedLastViewed === null) {
      cachedLastViewed = localStorage.getItem(STORAGE_KEY);
    }
    const latest = getLatestReleasedVersion();
    return cachedLastViewed !== latest;
  } catch (_) {
    return false;
  }
}

export function markPatchNotesAsViewed() {
  if (typeof window === 'undefined') return;
  try {
    const latest = getLatestReleasedVersion();
    cachedLastViewed = latest;
    localStorage.setItem(STORAGE_KEY, latest);
    window.dispatchEvent(new CustomEvent('mt_patch_viewed', { detail: { version: latest } }));
  } catch (_) {}
}
