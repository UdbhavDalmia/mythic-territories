import * as C from '@shared/constants.js';

export function getPieceVisualState(p) {
  if (!p) return null;
  const targetX = p.col * C.CELL_SIZE;
  const targetY = p.row * C.CELL_SIZE;
  return {
    x: targetX,
    y: targetY,
    scale: 1.0,
    opacity: 1.0,
    id: p.id,
    team: p.team,
    key: p.key
  };
}

export function triggerScreenshake(intensity, duration = 150) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('screenshake', { detail: { intensity, duration } }));
  }
}
