import {
  BookOpen,
  Clock3,
  Footprints,
  Landmark,
  Map,
  Shield,
  Sparkles,
  Swords,
  Target,
  Users,
  X
} from 'lucide-react';

// ─── Accurate unit profiles matching constants.js ───────────────────────────
export const UNIT_PROFILES = {
  snow: [
    {
      name: "Frost Lord",
      title: "King of absolute order and cold geometry",
      role: "Frost Leader",
      portrait: "/units/frost-lord.webp",
      stats: { HP: 12, DEF: 3, STR: 5, RNG: 1.5, AGI: 1.8 },
      abilities: [
        {
          name: "Frostfall Blessing",
          type: "Active",
          desc: "AOE (Range 2.5, Rad 2) — deals 2 damage to enemies and heals allies for 1 HP for 5 turns."
        },
        {
          name: "Help From Above",
          type: "Passive",
          desc: "Lethal damage is negated; becomes invulnerable for 5 turns and grants nearby allies (Rad 1.5) +1 Strength."
        }
      ]
    },
    {
      name: "Soul Linker",
      title: "Weaver of fate between ally and enemy",
      role: "Specialist",
      portrait: "/units/soul-linker.webp",
      stats: { HP: 8, DEF: 2, STR: 3, RNG: 2, AGI: 1.8 },
      abilities: [
        {
          name: "Fate Link",
          type: "Active",
          desc: "Binds an ally and enemy (Range 3) for 4 turns; any damage taken by the ally is mirrored exactly to the enemy."
        },
        {
          name: "Cold Snap",
          type: "Passive",
          desc: "If the bound enemy dies, the Soul Linker heals 2 HP; excess healing converts into a 1-damage absorb shield."
        }
      ]
    },
    {
      name: "Glacial Mage",
      title: "Conduit of glacial fractures and frost storms",
      role: "Mage Specialist",
      portrait: "/units/cryomancer.webp",
      stats: { HP: 7, DEF: 2, STR: 2, RNG: 2.5, AGI: 1.4 },
      abilities: [
        {
          name: "Glacial Fracture",
          type: "Active",
          desc: "AOE (Range 2.5, Rad 2) — deals 2 damage, creates Frost territory, and summons 1 Ice Wisp furthest from caught enemies (Max 2 Wisps)."
        },
        {
          name: "Frost Duo",
          type: "Passive",
          desc: "Gains +0.2 Control and +0.2 Agility per active Ice Wisp; gains an additional +1 Strength if both Wisps are active."
        }
      ]
    },
    {
      name: "Glacial Brute",
      title: "Unstoppable force of glacial mass",
      role: "Warrior",
      portrait: "/units/glacial-brute.webp",
      stats: { HP: 10, DEF: 3, STR: 3, RNG: 1, AGI: 3 },
      abilities: [
        {
          name: "Frost Armor",
          type: "Active",
          desc: "Gain +2 Power (defending only) for 2 rounds."
        },
        {
          name: "Frost Stomp",
          type: "Veteran",
          desc: "Daze any adjacent enemy unit for 1 turn."
        }
      ]
    },
    {
      name: "Frostbite Stalker",
      title: "Lethal predator of the snowy plains",
      role: "Striker",
      portrait: "/units/snow-wolf.webp",
      stats: { HP: 6, DEF: 1, STR: 2, RNG: 1, AGI: 4 },
      abilities: [
        {
          name: "Hamstring",
          type: "Active",
          desc: "An adjacent enemy cannot move diagonally for 1 round."
        },
        {
          name: "Icy Shift",
          type: "Veteran",
          desc: "Swap positions with any unit within 2 squares; both are Dazed for 1 turn."
        }
      ]
    },
    {
      name: "Ice Wisp",
      title: "Ethereal spirit of frost and sacrifice",
      role: "Summon",
      portrait: "/units/wisp.webp",
      stats: { HP: 2, DEF: 1, STR: 1, RNG: 1, AGI: 2 },
      abilities: [
        {
          name: "A Cold Farewell",
          type: "Passive",
          desc: "On death, explodes (Rad 1.5) for 4 turns; allies heal 1 HP/turn and get +1 Strength; enemies lose 0.4 Agility and have Control reduced to 0."
        }
      ]
    }
  ],
  ash: [
    {
      name: "Ash Tyrant",
      title: "Lord of molten steel and volcanic fury",
      role: "Ash Leader",
      portrait: "/units/ash-tyrant.webp",
      stats: { HP: 12, DEF: 3, STR: 5, RNG: 1.5, AGI: 1.8 },
      abilities: [
        {
          name: "Reign of Fire",
          type: "Active",
          desc: "AOE (Range 2.5, Rad 2) — deals 2 damage to enemies; deals 1 damage to allies but grants them +2 Strength for 3 turns."
        },
        {
          name: "Death Meteor",
          type: "Passive",
          desc: "Lethal damage is negated; survives at 1 HP and triggers an explosion (Rad 2) dealing 4 damage to enemies and 2 damage to allies."
        }
      ]
    },
    {
      name: "Ash Reaper",
      title: "Thief of life and stolen strength",
      role: "Specialist",
      portrait: "/units/ash-reaper.webp",
      stats: { HP: 8, DEF: 2, STR: 3, RNG: 2, AGI: 1.8 },
      abilities: [
        {
          name: "The Reaper's Toll",
          type: "Active",
          desc: "Steals 1 Defence and 0.4 Agility from an enemy (Range 3) for 4 turns, transferring the stats to self."
        },
        {
          name: "Ashes To Ashes",
          type: "Passive",
          desc: "When The Reaper's Toll expires, the stolen stats return and the enemy has a 50% chance to take 1 unavoidable damage."
        }
      ]
    },
    {
      name: "Magma Shaper",
      title: "Architect of igneous structures and impact",
      role: "Mystic",
      portrait: "/units/magma-shaper.webp",
      stats: { HP: 7, DEF: 1, STR: 2, RNG: 2, AGI: 2 },
      abilities: [
        {
          name: "Obsidian Pillar",
          type: "Active",
          desc: "Spawns an Obsidian Pillar: deals damage and pushback to enemies, works as cover, and forms an Obsidian Shield when targeting allies."
        }
      ]
    },
    {
      name: "Magma Prowler",
      title: "Hunter of the volcanic wastelands",
      role: "Warrior",
      portrait: "/units/magma-prowler.webp",
      stats: { HP: 8, DEF: 2, STR: 3, RNG: 1, AGI: 3 },
      abilities: [
        {
          name: "Frenzied Dash",
          type: "Active",
          desc: "Move 2 squares in a straight line to an empty square. Cannot capture."
        },
        {
          name: "Siphon Charge",
          type: "Veteran",
          desc: "Permanent upgrade: gains the Siphon action, allowing power transfer between linked units."
        }
      ]
    },
    {
      name: "Magma Spitter",
      title: "Ranged devastator of volcanic slugs",
      role: "Mage",
      portrait: "/units/magma-spitter.webp",
      stats: { HP: 6, DEF: 0, STR: 5, RNG: 4, AGI: 2 },
      abilities: [
        {
          name: "Lava Glob",
          type: "Active",
          desc: "Deals 1 permanent damage to an enemy with base power 1 or 2, within 4 squares."
        },
        {
          name: "Volatile Cinder",
          type: "Veteran",
          desc: "Detonates a nearby Unstable Ground, dealing 1 damage to adjacent units."
        }
      ]
    },
    {
      name: "Ash Strider",
      title: "Swift assassin of the brimstone wastes",
      role: "Skirmisher",
      portrait: "/units/blaze-runner.webp",
      stats: { HP: 6, DEF: 1, STR: 2, RNG: 1, AGI: 4 },
      abilities: [
        {
          name: "Scorched Retreat",
          type: "Active",
          desc: "Move 1 square backward and create an Unstable Ground hazard on the square you left."
        }
      ]
    }
  ]
};


// ─── Shrine Ascension roles, both choices ──────────────────────────────────
export const ASCENSION_ROLES = [
  {
    role: "Shaper",
    snow: "Ice Weaver",
    ash: "Rift Forger",
    A: { name: "Master of Creation", desc: "Frost: Leader gains Mini-Glacial Wall. Ash: Leader gains Mini-Unstable Ground." },
    B: { name: "Territorial Claim", desc: "Faction Passive: Capture +2 adjacent squares on kill." }
  },
  {
    role: "Brawler",
    snow: "Glacial Brute",
    ash: "Blazebound Beast",
    A: { name: "Rampage", desc: "Frost: Frost Armor reflects 1 permanent damage. Ash: Frenzied Dash jumps over allies." },
    B: { name: "Vengeance", desc: "Faction Passive: Enemy is Marked for 2 turns on vanquish." }
  },
  {
    role: "Skirmisher",
    snow: "Arctic Trapper",
    ash: "Cinder Scout",
    A: { name: "Acrobatic Tactics", desc: "Frost: Frostbite Stalker is Acrobat. Ash: Cinder Scout is Acrobat (jumps over allies)." },
    B: { name: "Hit and Run", desc: "Faction Passive: New capture grants Entrenched (wins combat tie)." }
  },
  {
    role: "Mystic",
    snow: "Hoarfrost Mystic",
    ash: "Magma Shaper",
    A: { name: "Arcane Attunement", desc: "Siphoners may use Siphon on friendly territory." },
    B: { name: "Rift Reinforcement", desc: "Faction Passive: Conduit Contested state always gives full +2 Power." }
  },
  {
    role: "Siphoner",
    snow: "Soul Linker",
    ash: "Ash Reaper",
    A: { name: "Primal Power", desc: "Frost: Glacial Mage's summoned Wisp is Power 1. Ash: Lava Glob targets up to Power 3." },
    B: { name: "Energy Siphon", desc: "Faction Passive: New capture adjacent to enemy Dazes that enemy for 1 turn." }
  },
  {
    role: "Mage",
    snow: "Glacial Mage",
    ash: "Magma Spitter",
    A: { name: "Elemental Harmony", desc: "Frost: Chilling Aura also Hamstrings. Ash: Mark of Cinder deals 1 permanent damage on application." },
    B: { name: "Magical Supremacy", desc: "Faction Passive: Lose combat tie: Banished, −1 Power, Dazed." }
  },
  {
    role: "Striker",
    snow: "Frostbite Stalker",
    ash: "Ash Strider",
    A: { name: "Lethal Precision", desc: "Frost: Arctic Trapper Base Power becomes 2. Ash: Ash Strider Base Power becomes 2." },
    B: { name: "Targeted Weakness", desc: "Faction Passive: Attacking a debuffed enemy grants +1 Power (attacking only)." }
  },
  {
    role: "Warrior",
    snow: "Rampaging Yeti",
    ash: "Blazebound Beast",
    A: { name: "Unstoppable Force", desc: "Frost: Rampaging Yeti gains Steadfast. Ash: Blazebound Beast gains Steadfast (Immune to Daze, Stuck, Push/Pull)." },
    B: { name: "Home-Field Advantage", desc: "Faction Passive: Units defending on starting squares gain +1 Power." }
  },
  {
    role: "Priest",
    snow: "Soul Freeze",
    ash: "Scorch Priest",
    A: { name: "Leader's Ward", desc: "Frost: Frost Lord gains Priest's Ward. Ash: Ash Tyrant gains Priest's Ward (blocks first enemy ability)." },
    B: { name: "Martyrdom", desc: "Faction Passive: Vanquished unit Dazes the attacker for 2 turns." }
  }
];

export const QUICK_STEPS = [
  {
    number: '01',
    title: 'Defeat the leader',
    description: 'Vanquish the opposing Frost Lord or Ash Tyrant to win the battle.',
    icon: Target,
    accent: 'text-ember-gold border-ember-gold/25 bg-ember-gold/10'
  },
  {
    number: '02',
    title: 'Take one turn',
    description: 'Frost and Ash alternate turns. Choose one unit to move, attack, or use an available ability.',
    icon: Users,
    accent: 'text-ice-light border-ice-light/25 bg-ice-light/10'
  },
  {
    number: '03',
    title: 'Move by Agility',
    description: 'A unit’s Agility determines its movement range. Occupying an empty square claims that territory.',
    icon: Footprints,
    accent: 'text-ice-light border-ice-light/25 bg-ice-light/10'
  },
  {
    number: '04',
    title: 'Fight with Power',
    description: 'Move onto an enemy to attack. Higher Effective Power wins; territory control breaks most ties.',
    icon: Swords,
    accent: 'text-magma-core border-magma-core/25 bg-magma-core/10'
  },
  {
    number: '05',
    title: 'Control the landmarks',
    description: 'Rifts create Conduit bonuses, while Shrine captures build toward permanent Ascension upgrades.',
    icon: Landmark,
    accent: 'text-ember-gold border-ember-gold/25 bg-ember-gold/10'
  }
];

export const RULEBOOK_TABS = [
  { id: 'QUICK', label: 'Quick Read', icon: Clock3 },
  { id: 'RULES', label: 'Common Rules', icon: BookOpen },
  { id: 'ASCENSION', label: 'Ascension', icon: Sparkles },
  { id: 'UNITS', label: 'Unit Catalog', icon: Shield }
];

export const COMMON_RULES = [
  {
    title: 'Turn sequence',
    description: 'Frost and Ash alternate turns. On your turn, choose one unit to move, attack, or use an available ability.',
    icon: Users,
    accent: 'text-ice-light border-ice-light/25 bg-ice-light/10'
  },
  {
    title: 'Movement',
    description: 'Agility determines movement range. Hamstrung units cannot move diagonally; Stuck units cannot move.',
    icon: Footprints,
    accent: 'text-ice-light border-ice-light/25 bg-ice-light/10'
  },
  {
    title: 'Territory',
    description: 'Moving onto an empty square claims it for your faction. Territory control breaks standard combat ties.',
    icon: Map,
    accent: 'text-ember-gold border-ember-gold/25 bg-ember-gold/10'
  },
  {
    title: 'Combat',
    description: 'Move onto an enemy square to attack. The unit with the higher Effective Power vanquishes its opponent.',
    icon: Swords,
    accent: 'text-magma-core border-magma-core/25 bg-magma-core/10'
  }
];

export const TERRAIN_RULES = [
  { name: 'Unstable Ground', color: 'text-red-400', description: 'Enemies entering take 1 damage. Lasts 3 turns and can be detonated by Volatile Cinder.' },
  { name: 'Icy Ground', color: 'text-blue-300', description: 'The first enemy to enter is Dazed for 1 turn.' },
  { name: 'Void Scar', color: 'text-purple-400', description: 'Radiates from each Rift and alters combat resolution inside its area.' },
  { name: 'Glacial Wall', color: 'text-slate-300', description: 'An impassable barrier lasting 3 turns that blocks movement and line of sight.' },
  { name: 'Obsidian Pillar', color: 'text-orange-400', description: 'Provides cover, disrupts nearby enemies, and can form a temporary allied shield.' }
];

export const STATUS_RULES = [
  { name: 'Dazed', color: 'text-yellow-400', description: 'Cannot act this turn.' },
  { name: 'Stuck', color: 'text-red-400', description: 'Cannot move for the stated duration.' },
  { name: 'Hamstrung', color: 'text-orange-400', description: 'Cannot move diagonally for 1 round.' },
  { name: 'Steadfast', color: 'text-blue-300', description: 'Immune to Daze, Stuck, and forced movement.' }
];

export const toRulebookId = (value) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const RULEBOOK_SEARCH_INDEX = [
  ...QUICK_STEPS.map((step) => ({
    tab: 'QUICK',
    section: 'Quick Read',
    title: step.title,
    description: step.description,
    keywords: `${step.title} ${step.description}`,
    target: `quick-${toRulebookId(step.title)}`
  })),
  ...COMMON_RULES.map((rule) => ({
    tab: 'RULES',
    section: 'Common Rules',
    title: rule.title,
    description: rule.description,
    keywords: `${rule.title} ${rule.description}`,
    target: `rule-${toRulebookId(rule.title)}`
  })),
  {
    tab: 'RULES',
    section: 'Common Rules',
    title: 'Effective Power',
    description: 'Strength plus boosts minus debuffs determines combat. Territory control breaks a standard tie.',
    keywords: 'effective power strength boosts debuffs combat tie territory',
    target: 'rule-effective-power'
  },
  {
    tab: 'RULES',
    section: 'Common Rules',
    title: 'Sacred Shrine',
    description: 'Shrine captures grant Power and charges that lead to Overload, Trapping, Release, or Ascension.',
    keywords: 'sacred shrine capture power charge overload trapped release sacrifice ascension',
    target: 'rule-sacred-shrine'
  },
  {
    tab: 'RULES',
    section: 'Common Rules',
    title: 'Power Rifts and Conduit',
    description: 'Occupy both Rifts to activate contested or uncontested Anchor bonuses.',
    keywords: 'power rift conduit anchor contested uncontested ward void scar',
    target: 'rule-power-rifts-and-conduit'
  },
  ...TERRAIN_RULES.map((terrain) => ({
    tab: 'RULES',
    section: 'Terrain',
    title: terrain.name,
    description: terrain.description,
    keywords: `${terrain.name} ${terrain.description}`,
    target: `terrain-${toRulebookId(terrain.name)}`
  })),
  ...STATUS_RULES.map((status) => ({
    tab: 'RULES',
    section: 'Status',
    title: status.name,
    description: status.description,
    keywords: `${status.name} ${status.description}`,
    target: `status-${toRulebookId(status.name)}`
  })),
  ...ASCENSION_ROLES.map((path) => ({
    tab: 'ASCENSION',
    section: 'Ascension',
    title: `${path.role} paths`,
    description: `${path.A.name} or ${path.B.name}`,
    keywords: `${path.role} ${path.snow} ${path.ash} ${path.A.name} ${path.A.desc} ${path.B.name} ${path.B.desc}`,
    target: `ascension-${toRulebookId(path.role)}`
  })),
  ...Object.entries(UNIT_PROFILES).flatMap(([faction, units]) => units.map((unit) => ({
    tab: 'UNITS',
    section: faction === 'snow' ? 'Frost Catalog' : 'Ash Catalog',
    faction,
    title: unit.name,
    description: `${unit.role} — ${unit.title}`,
    keywords: [
      unit.name,
      unit.role,
      unit.title,
      ...Object.entries(unit.stats).flatMap(([stat, value]) => [stat, value]),
      ...unit.abilities.flatMap((ability) => [ability.name, ability.type, ability.desc])
    ].join(' '),
    target: `unit-${faction}-${toRulebookId(unit.name)}`
  })))
];

