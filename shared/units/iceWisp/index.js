import { 
  ICE_WISP_STATS, 
  ICE_WISP_IMAGE, 
  ICE_WISP_VALUE, 
  ICE_WISP_ROLE,
  ICE_WISP_PASSIVE_DESCRIPTION 
} from './constants.js';

import { 
  AColdFarewellAbility,
  SummonIceWispAbility,
  A_COLD_FAREWELL_VALUES, 
  SUMMON_ICE_WISP_VALUES,
  handleColdFarewellDeath
} from './ability.js';

export const IceWispUnit = {
  key: "snowIceWisp",
  team: "snow",
  name: "Ice Wisp",
  image: ICE_WISP_IMAGE,
  value: ICE_WISP_VALUE,
  role: ICE_WISP_ROLE,
  stats: ICE_WISP_STATS,
  passiveDescription: ICE_WISP_PASSIVE_DESCRIPTION,
  abilities: {
    AColdFarewell: AColdFarewellAbility,
    SummonIceWisp: SummonIceWispAbility
  },
  abilityValues: {
    AColdFarewell: A_COLD_FAREWELL_VALUES,
    SummonIceWisp: SUMMON_ICE_WISP_VALUES
  },
  handlers: {
    onDeath: handleColdFarewellDeath,
    cannotAttack: (piece) => (piece.power || 0) <= 0
  }
};

export * from './constants.js';
export * from './ability.js';
