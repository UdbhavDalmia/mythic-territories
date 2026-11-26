/**
 * Central Unit Registry
 * Aggregates all modular units and feeds shared engine constants, ability lookups, and passive handlers.
 */
import { FrostLordUnit } from '@frostLord/index.js';
import { AshTyrantUnit } from '@ashTyrant/index.js';
import { GlacialMageUnit } from '@glacialMage/index.js';
import { SoulLinkerUnit } from '@soulLinker/index.js';
import { MagmaShaperUnit } from '@magmaShaper/index.js';
import { AshReaperUnit } from '@ashReaper/index.js';
import { IceWispUnit } from '@iceWisp/index.js';

export const UNIT_REGISTRY = {
  snowFrostLord: FrostLordUnit,
  ashAshTyrant: AshTyrantUnit,
  snowGlacialMage: GlacialMageUnit,
  snowSoulLinker: SoulLinkerUnit,
  ashMagmaShaper: MagmaShaperUnit,
  ashAshReaper: AshReaperUnit,
  snowIceWisp: IceWispUnit
};

/**
 * Returns a unit module by key
 */
export function getUnit(key) {
  return UNIT_REGISTRY[key] || null;
}

/**
 * Checks whether a piece is currently invulnerable according to its unit domain handlers.
 */
export function isUnitInvulnerable(piece, gs) {
  if (!piece) return false;
  const unit = UNIT_REGISTRY[piece.key];
  if (unit?.handlers?.isInvulnerable) {
    return unit.handlers.isInvulnerable(piece, gs);
  }
  return false;
}

/**
 * Intercepts lethal damage for a piece via its unit domain passive handlers.
 * Returns true if death was intercepted/negated.
 */
export function handleUnitLethalBlow(piece, gs, context = {}) {
  if (!piece) return false;
  const unit = UNIT_REGISTRY[piece.key];
  if (unit?.handlers?.onLethalBlow) {
    return unit.handlers.onLethalBlow(piece, gs, context);
  }
  return false;
}

/**
 * Triggers on-death/capture passive handlers for a unit.
 */
export function handleUnitDeath(piece, attacker, gs, context = {}) {
  if (!piece) return;
  const unit = UNIT_REGISTRY[piece.key];
  if (unit?.handlers?.onDeath) {
    unit.handlers.onDeath(piece, attacker, gs, context);
  }
}

/**
 * Retrieves dynamic stats (e.g. bonus strength, agility, control) computed by a unit's domain handlers.
 */
export function getUnitDynamicStats(piece, gs) {
  if (!piece) return null;
  const unit = UNIT_REGISTRY[piece.key];
  if (unit?.handlers?.getDynamicStats) {
    return unit.handlers.getDynamicStats(piece, gs);
  }
  return null;
}
