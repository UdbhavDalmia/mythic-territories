/**
 * Frost Lord (snowFrostLord) Stats & Metadata
 */
export const FROST_LORD_STATS = {
  key: "snowFrostLord",
  name: "Frost Lord",
  power: 5,
  stats: { 
    hp: 12, 
    def: 3, 
    strength: 5, 
    range: 1.5, 
    agility: 1.8, 
    control: 1.3 
  },
  ability: { 
    name: "Frostfall Blessing", 
    key: "FrostfallBlessing" 
  },
  veteranAbility: null
};

export const FROST_LORD_IMAGE = "units/frost-lord.webp";
export const FROST_LORD_VALUE = 1000;
export const FROST_LORD_ROLE = "Tyrant"; // Leader piece in TEAM_PIECES.snow

export const FROST_LORD_PASSIVE_DESCRIPTION = 
  "Help From Above — Lethal damage is negated; becomes invulnerable for 3 turns and grants nearby allies (Rad 1.5) +1 Strength.";
