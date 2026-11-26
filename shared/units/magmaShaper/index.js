import { 
  MAGMA_SHAPER_STATS, 
  MAGMA_SHAPER_IMAGE, 
  MAGMA_SHAPER_VALUE, 
  MAGMA_SHAPER_ROLE,
  MAGMA_SHAPER_PASSIVE_DESCRIPTION 
} from './constants.js';

import { 
  ObsidianPillarAbility,
  OBSIDIAN_PILLAR_VALUES 
} from './ability.js';

export const MagmaShaperUnit = {
  key: "ashMagmaShaper",
  team: "ash",
  name: "Magma Shaper",
  image: MAGMA_SHAPER_IMAGE,
  value: MAGMA_SHAPER_VALUE,
  role: MAGMA_SHAPER_ROLE,
  stats: MAGMA_SHAPER_STATS,
  passiveDescription: MAGMA_SHAPER_PASSIVE_DESCRIPTION,
  abilities: {
    ObsidianPillar: ObsidianPillarAbility
  },
  abilityValues: {
    ObsidianPillar: OBSIDIAN_PILLAR_VALUES
  },
  handlers: {}
};

export * from './constants.js';
export * from './ability.js';
