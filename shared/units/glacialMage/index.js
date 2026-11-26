import { 
  GLACIAL_MAGE_STATS, 
  GLACIAL_MAGE_IMAGE, 
  GLACIAL_MAGE_VALUE, 
  GLACIAL_MAGE_ROLE,
  GLACIAL_MAGE_PASSIVE_DESCRIPTION 
} from './constants.js';

import { 
  GlacialFractureAbility,
  GLACIAL_FRACTURE_VALUES, 
  WISP_ENHANCEMENT_VALUES,
  getGlacialMageDynamicStats
} from './ability.js';

export const GlacialMageUnit = {
  key: "snowGlacialMage",
  team: "snow",
  name: "Glacial Mage",
  image: GLACIAL_MAGE_IMAGE,
  value: GLACIAL_MAGE_VALUE,
  role: GLACIAL_MAGE_ROLE,
  stats: GLACIAL_MAGE_STATS,
  passiveDescription: GLACIAL_MAGE_PASSIVE_DESCRIPTION,
  abilities: {
    GlacialFracture: GlacialFractureAbility
  },
  abilityValues: {
    GlacialFracture: GLACIAL_FRACTURE_VALUES,
    WispEnhancement: WISP_ENHANCEMENT_VALUES
  },
  handlers: {
    getDynamicStats: getGlacialMageDynamicStats
  }
};

export * from './constants.js';
export * from './ability.js';
