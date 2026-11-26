// ── Realm Words for Auto-Generated Codes (Strictly Mythic Territories Lore & Units) ──
export const REALM_WORDS = [
  'FROST',
  'EMBER'
];

export const INACTIVITY_TIMEOUT_MS = 90 * 1000; // 90s without heartbeat = inactive
export const LOBBY_WAIT_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes max wait for opponent in lobby

export function generateRoomCode() {
  const word = REALM_WORDS[Math.floor(Math.random() * REALM_WORDS.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `${word}-${num}`;
}

export function formatRoomCodeInput(raw, prev = '') {
  if (!raw) return '';
  if (raw.includes('?room=')) {
    try {
      const u = new URL(raw);
      const r = u.searchParams.get('room');
      if (r) raw = r;
    } catch (_) { }
  }

  let val = raw.toUpperCase().replace(/[^A-Z0-9-]/g, '');

  // Handle backspacing over hyphen (e.g. 'FROST-' -> user pressed Backspace -> 'FROST')
  if (prev.endsWith('-') && val === prev.slice(0, -1)) {
    return val.slice(0, -1);
  }

  const cleaned = val.replace(/-/g, '');
  const letterMatch = cleaned.match(/^[A-Z]+/);
  const letters = letterMatch ? letterMatch[0].slice(0, 5) : '';
  const digits = cleaned.slice(letters.length).replace(/[^0-9]/g, '').slice(0, 3); // exactly 3 digits

  if (!letters) return digits;

  const hasDigits = digits.length > 0;
  const userTypedHyphen = val.includes('-');

  // Auto-insert hyphen if digits are present, user typed a hyphen, or 5-letter faction word is completed
  if (hasDigits || userTypedHyphen || letters.length === 5) {
    return digits.length > 0 ? `${letters}-${digits}` : `${letters}-`;
  }

  return letters;
}

export function isValidRoomCode(code) {
  if (!code) return false;
  const upper = code.trim().toUpperCase();
  return /^(FROST|EMBER)-\d{3}$/.test(upper);
}

export function getOrCreatePlayerId() {
  if (typeof window === 'undefined') return 'p_node';
  let tabId = '';
  try {
    tabId = window.name;
    if (!tabId || !tabId.startsWith('mt_tab_')) {
      tabId = 'mt_tab_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
      window.name = tabId;
    }
  } catch (_) {
    tabId = 'mt_tab_fallback';
  }

  let pid = null;
  try {
    pid = sessionStorage.getItem('mythic_pid_' + tabId) || localStorage.getItem('mythic_player_id');
  } catch (_) {
    // Storage restricted
  }

  if (!pid) {
    pid = 'p_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
  }

  try {
    sessionStorage.setItem('mythic_pid_' + tabId, pid);
    localStorage.setItem('mythic_player_id', pid);
  } catch (_) {
    // Storage restricted
  }

  return pid;
}

export const getPlayerId = getOrCreatePlayerId;

export function saveActiveSession(session) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('mythic_active_room_session', JSON.stringify({
      ...session,
      savedAt: Date.now()
    }));
  } catch (_) { }
}

export function getActiveSession() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('mythic_active_room_session');
    if (!raw) return null;
    const data = JSON.parse(raw);
    // Discard sessions older than 2 hours
    if (!data.savedAt || (Date.now() - data.savedAt) > 2 * 60 * 60 * 1000) {
      localStorage.removeItem('mythic_active_room_session');
      return null;
    }
    return data;
  } catch (_) {
    return null;
  }
}

export function clearActiveSession() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('mythic_active_room_session');
  } catch (_) { }
}