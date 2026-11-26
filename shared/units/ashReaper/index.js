import { 
  ASH_REAPER_STATS, 
  ASH_REAPER_IMAGE, 
  ASH_REAPER_VALUE, 
  ASH_REAPER_ROLE,
  ASH_REAPER_PASSIVE_DESCRIPTION 
} from './constants.js';

import { 
  TheReapersTollAbility,
  THE_REAPERS_TOLL_VALUES 
} from './ability.js';

export const AshReaperUnit = {
  key: "ashAshReaper",
  team: "ash",
  name: "Ash Reaper",
  image: ASH_REAPER_IMAGE,
  value: ASH_REAPER_VALUE,
  role: ASH_REAPER_ROLE,
  stats: ASH_REAPER_STATS,
  passiveDescription: ASH_REAPER_PASSIVE_DESCRIPTION,
  abilities: {
    TheReapersToll: TheReapersTollAbility
  },
  abilityValues: {
    TheReapersToll: THE_REAPERS_TOLL_VALUES
  },
  handlers: {}
};

export * from './constants.js';
export * from './ability.js';
