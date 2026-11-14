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
  let tabId = window.name;
  if (!tabId || !tabId.startsWith('mt_tab_')) {
    tabId = 'mt_tab_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    window.name = tabId;
  }
  let pid = sessionStorage.getItem('mythic_pid_' + tabId);
  if (!pid) {
    pid = 'p_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
    sessionStorage.setItem('mythic_pid_' + tabId, pid);
  }
  return pid;
}

export const getPlayerId = getOrCreatePlayerId;