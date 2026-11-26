/**
 * Frost Lord Unit Module Manifest (Pure JS / Shared Contract)
 */
import { 
  FROST_LORD_STATS, 
  FROST_LORD_IMAGE, 
  FROST_LORD_VALUE, 
  FROST_LORD_ROLE,
  FROST_LORD_PASSIVE_DESCRIPTION 
} from './constants.js';

import { 
  FrostfallBlessingAbility, 
  FROSTFALL_BLESSING_VALUES, 
  HELP_FROM_ABOVE_VALUES,
  handleHelpFromAboveLethal,
  isHelpFromAboveInvulnerable,
  getFrostLordDynamicStats
} from './ability.js';

export const FrostLordUnit = {
  key: "snowFrostLord",
  team: "snow",
  name: "Frost Lord",
  image: FROST_LORD_IMAGE,
  value: FROST_LORD_VALUE,
  role: FROST_LORD_ROLE,
  stats: FROST_LORD_STATS,
  passiveDescription: FROST_LORD_PASSIVE_DESCRIPTION,
  abilities: {
    FrostfallBlessing: FrostfallBlessingAbility
  },
  abilityValues: {
    FrostfallBlessing: FROSTFALL_BLESSING_VALUES,
    HelpFromAbove: HELP_FROM_ABOVE_VALUES
  },
  handlers: {
    handleLethal: handleHelpFromAboveLethal,
    onLethalBlow: handleHelpFromAboveLethal,
    isInvulnerable: isHelpFromAboveInvulnerable,
    getDynamicStats: getFrostLordDynamicStats
  }
};

export * from './constants.js';
export * from './ability.js';
