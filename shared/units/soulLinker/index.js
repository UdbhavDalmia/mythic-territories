import { 
  SOUL_LINKER_STATS, 
  SOUL_LINKER_IMAGE, 
  SOUL_LINKER_VALUE, 
  SOUL_LINKER_ROLE,
  SOUL_LINKER_PASSIVE_DESCRIPTION 
} from './constants.js';

import { 
  FateLinkAbility,
  FATE_LINK_VALUES 
} from './ability.js';

export const SoulLinkerUnit = {
  key: "snowSoulLinker",
  team: "snow",
  name: "Soul Linker",
  image: SOUL_LINKER_IMAGE,
  value: SOUL_LINKER_VALUE,
  role: SOUL_LINKER_ROLE,
  stats: SOUL_LINKER_STATS,
  passiveDescription: SOUL_LINKER_PASSIVE_DESCRIPTION,
  abilities: {
    FateLink: FateLinkAbility
  },
  abilityValues: {
    FateLink: FATE_LINK_VALUES
  },
  handlers: {}
};

export * from './constants.js';
export * from './ability.js';
