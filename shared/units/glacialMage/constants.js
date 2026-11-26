/**
 * Glacial Mage (snowGlacialMage) Stats & Metadata
 */
export const GLACIAL_MAGE_STATS = {
  key: "snowGlacialMage",
  name: "Glacial Mage",
  power: 5,
  stats: { hp: 7, def: 2, strength: 2, range: 2.5, agility: 1.4, control: 1.2 },
  ability: { name: "Glacial Fracture", key: "GlacialFracture" },
  veteranAbility: {
    key: "WispEnhancement",
    isPermanentUpgrade: true,
    isPassive: true
  }
};

export const GLACIAL_MAGE_IMAGE = "units/cryomancer.webp";
export const GLACIAL_MAGE_VALUE = 500;
export const GLACIAL_MAGE_ROLE = "Mage";
export const GLACIAL_MAGE_PASSIVE_DESCRIPTION =
  'Frost Duo — Gains +0.2 Control and +0.2 Agility per active Ice Wisp; gains an additional +1 Strength if both Wisps are active.';
