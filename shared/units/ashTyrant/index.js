import { 
  ASH_TYRANT_STATS, 
  ASH_TYRANT_IMAGE, 
  ASH_TYRANT_VALUE, 
  ASH_TYRANT_ROLE,
  ASH_TYRANT_PASSIVE_DESCRIPTION 
} from './constants.js';

import { 
  ReignOfFireAbility,
  REIGN_OF_FIRE_VALUES, 
  DEATH_METEOR_VALUES,
  handleDeathMeteorLethal
} from './ability.js';

export const AshTyrantUnit = {
  key: "ashAshTyrant",
  team: "ash",
  name: "Ash Tyrant",
  image: ASH_TYRANT_IMAGE,
  value: ASH_TYRANT_VALUE,
  role: ASH_TYRANT_ROLE,
  stats: ASH_TYRANT_STATS,
  passiveDescription: ASH_TYRANT_PASSIVE_DESCRIPTION,
  abilities: {
    ReignOfFire: ReignOfFireAbility
  },
  abilityValues: {
    ReignOfFire: REIGN_OF_FIRE_VALUES,
    DeathMeteor: DEATH_METEOR_VALUES
  },
  handlers: {
    onLethalBlow: handleDeathMeteorLethal,
    isInvulnerable: (piece) => !!(piece && piece.hasDeathMeteorInvincibility)
  }
};

export * from './constants.js';
export * from './ability.js';
