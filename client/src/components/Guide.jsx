import React, { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';

// ─── Accurate unit profiles matching constants.js ───────────────────────────
const UNIT_PROFILES = {
  snow: [
    {
      name: "Frost Lord",
      title: "King of absolute order and cold geometry",
      role: "Snow Leader",
      portrait: "/units/frost-lord.png",
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
      portrait: "/units/soul-linker.png",
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
      portrait: "/units/cryomancer.png",
      stats: { HP: 7, DEF: 2, STR: 2, RNG: 2.5, AGI: 1.4 },
      abilities: [
        {
          name: "Glacial Fracture",
          type: "Active",
          desc: "AOE (Range 2.5, Rad 2) — deals 2 damage, creates Snow territory, and summons 1 Ice Wisp furthest from caught enemies (Max 2 Wisps)."
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
      portrait: "/units/glacial-brute.png",
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
      portrait: "/units/snow-wolf.png",
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
      portrait: "/units/wisp.png",
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
      portrait: "/units/ash-tyrant.png",
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
      portrait: "/units/ash-reaper.png",
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
      portrait: "/units/magma-shaper.png",
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
      portrait: "/units/magma-prowler.png",
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
      portrait: "/units/magma-spitter.png",
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
      portrait: "/units/blaze-runner.png",
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
const ASCENSION_ROLES = [
  {
    role: "Shaper",
    snow: "Ice Weaver",
    ash: "Rift Forger",
    A: { name: "Master of Creation", desc: "Snow: Leader gains Mini-Glacial Wall. Ash: Leader gains Mini-Unstable Ground." },
    B: { name: "Territorial Claim", desc: "Faction Passive: Capture +2 adjacent squares on kill." }
  },
  {
    role: "Brawler",
    snow: "Glacial Brute",
    ash: "Blazebound Beast",
    A: { name: "Rampage", desc: "Snow: Frost Armor reflects 1 permanent damage. Ash: Frenzied Dash jumps over allies." },
    B: { name: "Vengeance", desc: "Faction Passive: Enemy is Marked for 2 turns on vanquish." }
  },
  {
    role: "Skirmisher",
    snow: "Arctic Trapper",
    ash: "Cinder Scout",
    A: { name: "Acrobatic Tactics", desc: "Snow: Frostbite Stalker is Acrobat. Ash: Cinder Scout is Acrobat (jumps over allies)." },
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
    A: { name: "Primal Power", desc: "Snow: Glacial Mage's summoned Wisp is Power 1. Ash: Lava Glob targets up to Power 3." },
    B: { name: "Energy Siphon", desc: "Faction Passive: New capture adjacent to enemy Dazes that enemy for 1 turn." }
  },
  {
    role: "Mage",
    snow: "Glacial Mage",
    ash: "Magma Spitter",
    A: { name: "Elemental Harmony", desc: "Snow: Chilling Aura also Hamstrings. Ash: Mark of Cinder deals 1 permanent damage on application." },
    B: { name: "Magical Supremacy", desc: "Faction Passive: Lose combat tie: Banished, −1 Power, Dazed." }
  },
  {
    role: "Striker",
    snow: "Frostbite Stalker",
    ash: "Ash Strider",
    A: { name: "Lethal Precision", desc: "Snow: Arctic Trapper Base Power becomes 2. Ash: Ash Strider Base Power becomes 2." },
    B: { name: "Targeted Weakness", desc: "Faction Passive: Attacking a debuffed enemy grants +1 Power (attacking only)." }
  },
  {
    role: "Warrior",
    snow: "Rampaging Yeti",
    ash: "Blazebound Beast",
    A: { name: "Unstoppable Force", desc: "Snow: Rampaging Yeti gains Steadfast. Ash: Blazebound Beast gains Steadfast (Immune to Daze, Stuck, Push/Pull)." },
    B: { name: "Home-Field Advantage", desc: "Faction Passive: Units defending on starting squares gain +1 Power." }
  },
  {
    role: "Priest",
    snow: "Soul Freeze",
    ash: "Scorch Priest",
    A: { name: "Leader's Ward", desc: "Snow: Frost Lord gains Priest's Ward. Ash: Ash Tyrant gains Priest's Ward (blocks first enemy ability)." },
    B: { name: "Martyrdom", desc: "Faction Passive: Vanquished unit Dazes the attacker for 2 turns." }
  }
];

export default function Guide({ navigateTo }) {
  const [activeTab, setActiveTab] = useState('RULES');
  const [activeFaction, setActiveFaction] = useState('snow');
  const [ascFaction, setAscFaction] = useState('snow');
  const pageRef = useRef(null);

  // Entrance — slide up + fade in
  useEffect(() => {
    gsap.fromTo(pageRef.current,
      { opacity: 0, y: 40 },
      { opacity: 1, y: 0, duration: 0.75, ease: 'expo.out' }
    );
  }, []);

  // Exit — slide down + fade, then navigate
  const handleNavigate = (dest) => {
    gsap.to(pageRef.current, {
      opacity: 0, y: 50, duration: 0.32, ease: 'power2.in',
      onComplete: () => navigateTo(dest)
    });
  };

  return (
    <div ref={pageRef} className="relative min-h-screen flex flex-col bg-void-black text-on-surface select-none font-body-md overflow-y-auto" style={{ opacity: 0 }}>
      {/* Background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="sticky top-0 w-full h-screen">
          <div
            className="absolute inset-0 opacity-40 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: "url('/images/menu-bg.png')" }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-void-black/40 via-transparent to-void-black/90" />
        </div>
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-void-black/70 backdrop-blur-md border-b border-outline/20 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
        <div className="flex justify-between items-center w-full px-4 md:px-12 py-4 max-w-7xl mx-auto">
          <div
            className="font-almendra text-lg sm:text-2xl tracking-wider text-ember-gold cursor-pointer"
            onClick={() => handleNavigate('LOBBY')}
          >
            Mythic Territories
          </div>
          {/* Ghost → filled hover button */}
          <button
            className="relative font-label-caps text-xs sm:text-sm text-ember-gold px-5 py-2 rounded overflow-hidden group transition-colors duration-300"
            onClick={() => handleNavigate('LOBBY')}
          >
            <span className="absolute inset-0 bg-ember-gold scale-x-0 group-hover:scale-x-100 origin-left transition-transform duration-300 rounded" />
            <span className="relative z-10 group-hover:text-void-black transition-colors duration-300">
              ← Back to Menu
            </span>
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 flex-grow pt-32 pb-20 px-4 md:px-12 max-w-6xl mx-auto w-full">
        <header className="text-center mb-10 space-y-4">
          <h1 className="font-almendra text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-gradient-dual uppercase">
            Game Guidebook
          </h1>
          <p className="font-libre text-base sm:text-lg italic text-on-surface-variant max-w-2xl mx-auto">
            Master the elemental forces of Snow and Ash. A comprehensive guide to survival, conquest, and ascension.
          </p>
        </header>

        {/* Tab Selection */}
        <div className="flex justify-center border-b border-outline/20 mb-8 max-w-2xl mx-auto">
          <button
            className={`flex-1 py-3 text-center font-label-caps text-sm border-b-2 font-bold transition-all duration-300 ${
              activeTab === 'RULES'
                ? 'border-ember-gold text-ember-gold'
                : 'border-transparent text-on-surface-variant hover:text-white'
            }`}
            onClick={() => setActiveTab('RULES')}
          >
            Core Rules
          </button>
          <button
            className={`flex-1 py-3 text-center font-label-caps text-sm border-b-2 font-bold transition-all duration-300 ${
              activeTab === 'ASCENSION'
                ? 'border-ember-gold text-ember-gold'
                : 'border-transparent text-on-surface-variant hover:text-white'
            }`}
            onClick={() => setActiveTab('ASCENSION')}
          >
            Ascension Paths
          </button>
          <button
            className={`flex-1 py-3 text-center font-label-caps text-sm border-b-2 font-bold transition-all duration-300 ${
              activeTab === 'UNITS'
                ? 'border-ember-gold text-ember-gold'
                : 'border-transparent text-on-surface-variant hover:text-white'
            }`}
            onClick={() => setActiveTab('UNITS')}
          >
            Unit Catalog
          </button>
        </div>

        {/* ═══════════════════════════ RULES TAB ═══════════════════════════ */}
        {activeTab === 'RULES' && (
          <div className="space-y-8 animate-[fadeIn_0.3s_ease-out]">

            {/* ── Objective ── */}
            <section className="bg-surface-container/60 backdrop-blur-md rounded-xl p-6 sm:p-8 border border-outline/10 shadow-lg">
              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="flex-1">
                  <h2 className="font-almendra text-2xl sm:text-3xl font-bold text-ember-gold mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined">flag</span>
                    The Objective
                  </h2>
                  <div className="h-[2px] bg-gradient-to-r from-ember-gold to-transparent mb-4" />
                  <p className="font-libre text-base sm:text-lg leading-relaxed text-on-surface-variant">
                    Command the elemental forces of Snow or Ash. The primary victory condition is simple yet daunting:{' '}
                    <span className="text-ember-gold font-bold">Vanquish the enemy leader</span>. Eliminate the enemy's
                    Frost Lord or Ash Tyrant to secure your dominion over the realm.
                  </p>
                </div>
                <div className="flex gap-4 shrink-0">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-lg border-2 border-ice-light overflow-hidden shadow-md">
                    <img alt="Frost Lord" className="w-full h-full object-cover grayscale-[30%] hover:grayscale-0 transition-all duration-300" src="/units/frost-lord.png" />
                  </div>
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-lg border-2 border-magma-core overflow-hidden shadow-md">
                    <img alt="Ash Tyrant" className="w-full h-full object-cover grayscale-[30%] hover:grayscale-0 transition-all duration-300" src="/units/ash-tyrant.png" />
                  </div>
                </div>
              </div>
            </section>

            {/* ── Core Gameplay + Shrine — one row ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <section className="lg:col-span-7 bg-surface-container/60 backdrop-blur-md rounded-xl p-6 sm:p-8 border border-outline/10 shadow-lg space-y-6">
                <h2 className="font-almendra text-2xl sm:text-3xl font-bold text-ice-light flex items-center gap-2">
                  <span className="material-symbols-outlined">swords</span>
                  Core Gameplay
                </h2>
                <div className="h-[2px] bg-gradient-to-r from-ice-light to-transparent" />
                <div className="space-y-5">
                  <div>
                    <h3 className="font-label-caps text-xs sm:text-sm text-ice-light mb-1">Turns &amp; Movement</h3>
                    <p className="text-on-surface-variant text-sm sm:text-base leading-relaxed">
                      Each turn one unit may be moved. A full round is one Snow turn then one Ash turn. Movement range is
                      determined by a unit's <span className="text-ice-light italic">Agility</span> stat. Units affected
                      by <span className="text-ice-light italic">Hamstrung</span> cannot move diagonally;
                      <span className="text-ice-light italic"> Stuck</span> units cannot move at all.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-label-caps text-xs sm:text-sm text-magma-core mb-1">Combat &amp; Territory</h3>
                    <p className="text-on-surface-variant text-sm sm:text-base leading-relaxed">
                      Move onto an enemy unit's square to initiate combat. The unit with the higher{' '}
                      <span className="text-ember-gold font-bold">Effective Power</span> (Strength + all boosts − all
                      debuffs) wins and captures the enemy. Ties are broken in favor of the player controlling more
                      territory. Moving onto an empty square automatically converts it to your faction's territory.
                    </p>
                  </div>
                  <div className="bg-void-black/40 border-l-4 border-ember-gold p-4 italic text-xs sm:text-sm text-on-surface-variant">
                    Abilities, status effects, Shrine boosts, Conduit Anchor boosts, Unstable Ground, Icy Ground, and
                    Void Scars all directly affect Effective Power at the moment of combat resolution.
                  </div>
                </div>
              </section>

              {/* ── Shrine (same row, right column) ── */}
              <section className="lg:col-span-5 bg-surface-container/60 backdrop-blur-md rounded-xl p-6 sm:p-8 border border-outline/10 shadow-lg space-y-5">
                <h2 className="font-almendra text-2xl font-bold text-ember-gold flex items-center gap-2">
                  <span className="material-symbols-outlined">temple_buddhist</span>
                  The Sacred Shrine
                </h2>
                <div className="h-[2px] bg-gradient-to-r from-ember-gold to-transparent" />
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  The <span className="text-ember-gold font-bold">Sacred Shrine</span> occupies a 2×2 zone at the
                  centre of the board. Capturing an enemy on a Shrine square grants permanent{' '}
                  <span className="text-ember-gold font-bold">+1 Power</span> and charges the Shrine by 1.
                </p>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  After <span className="text-white font-bold">2 charges</span>, the Shrine enters{' '}
                  <span className="text-magma-core font-bold">Overload</span>. Any unit on the Shrine becomes{' '}
                  <span className="text-magma-core font-bold">Trapped</span> — unable to move until Ascension is
                  triggered or cancelled.
                </p>
                <div className="bg-void-black/50 border border-amber-500/30 rounded-lg p-3 space-y-1">
                  <div className="font-label-caps text-[10px] text-amber-500">Ascension Trigger</div>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">
                    <span className="text-amber-400 font-bold">Sacrifice</span> the Trapped unit to unlock a faction{' '}
                    <span className="text-amber-400 font-bold">Ascension</span> — unit upgrade (A) or faction passive (B).{' '}
                    <button className="text-amber-400 underline" onClick={() => setActiveTab('ASCENSION')}>View Paths →</button>
                  </p>
                </div>
                <div className="bg-void-black/50 border border-red-500/30 rounded-lg p-3 space-y-1">
                  <div className="font-label-caps text-[10px] text-red-400">Release Escape</div>
                  <p className="text-[11px] text-on-surface-variant leading-relaxed">
                    <span className="text-red-400 font-bold">Release</span> the unit instead — loses −1 Power and is Dazed for 3 turns, no Ascension triggered.
                  </p>
                </div>
              </section>
            </div>

            {/* ── Conduit & Rifts ── */}
            <section className="bg-surface-container/60 backdrop-blur-md rounded-xl p-6 sm:p-8 border border-outline/10 shadow-lg space-y-6">
              <h2 className="font-almendra text-2xl sm:text-3xl font-bold text-ice-light flex items-center gap-2">
                <span className="material-symbols-outlined">hub</span>
                Power Rifts &amp; the Conduit
              </h2>
              <div className="h-[2px] bg-gradient-to-r from-ice-light to-transparent" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <p className="text-sm sm:text-base text-on-surface-variant leading-relaxed">
                    Two <span className="text-purple-400 font-bold">Power Rifts</span> (3×3 zones) are fixed in opposite
                    corners of the board — top-left and bottom-right. They pulse with void energy that alters combat
                    math for any unit standing within them.
                  </p>
                  <div className="bg-void-black/50 border border-purple-500/30 rounded-lg p-4 space-y-2">
                    <div className="font-label-caps text-xs text-purple-400">Conduit Link</div>
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                      When a single faction has{' '}
                      <span className="text-white font-bold">at least one unit on each Rift</span> (both top-left AND
                      bottom-right), the <span className="text-purple-400 font-bold">Conduit Link</span> activates.
                    </p>
                    <ul className="text-xs text-on-surface-variant space-y-1 mt-2 list-none">
                      <li>
                        <span className="text-white font-bold">Uncontested</span> — Both Rift units gain{' '}
                        <span className="text-green-400 font-bold">+2 Anchor Boost</span> to Effective Power and
                        become immune to captures (<span className="text-cyan-300">Defensive Ward</span>).
                      </li>
                      <li className="mt-1">
                        <span className="text-white font-bold">Contested</span> — An enemy also occupies a Rift. Anchor
                        Boost drops to{' '}
                        <span className="text-amber-400 font-bold">+1</span> (unless{' '}
                        <em>Rift Reinforcement</em> Ascension is active, which always gives +2).
                      </li>
                    </ul>
                  </div>
                  <div className="bg-void-black/50 border border-cyan-500/30 rounded-lg p-4 space-y-2">
                    <div className="font-label-caps text-xs text-cyan-400">Void Scars</div>
                    <p className="text-xs text-on-surface-variant leading-relaxed">
                      The area surrounding each Rift generates{' '}
                      <span className="text-cyan-400 font-bold">Void Scars</span> — hazardous terrain that modifies
                      movement and combat in that zone. Units standing on Void Scars suffer altered combat resolution
                      and cannot pass freely.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-void-black/50 border border-amber-500/20 rounded-lg p-4 space-y-3">
                    <div className="font-label-caps text-xs text-amber-500">Special Terrain Effects</div>
                    <div className="space-y-2.5 text-xs text-on-surface-variant">
                      <div className="flex gap-2">
                        <span className="text-red-400 font-bold shrink-0 w-28">Unstable Ground</span>
                        <span>Created by Rift Forger or Scorched Retreat. Enemies entering take 1 damage. Lasts 3 turns. Can be detonated by Volatile Cinder.</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-blue-300 font-bold shrink-0 w-28">Icy Ground</span>
                        <span>Created by Frigid Path. First enemy to enter is Dazed for 1 turn.</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-purple-400 font-bold shrink-0 w-28">Void Scar</span>
                        <span>Radiates outward from both Rift corners. Alters combat resolution for units standing inside.</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-slate-300 font-bold shrink-0 w-28">Glacial Wall</span>
                        <span>Impassable solid barrier placed by Ice Weaver. Lasts 3 turns. Blocks movement and line of sight.</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-orange-400 font-bold shrink-0 w-28">Obsidian Pillar</span>
                        <span>Placed by Magma Shaper. Acts as cover. Deals damage/pushback to enemies nearby and forms a temporary shield on allies.</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-void-black/50 border border-outline/10 rounded-lg p-4 space-y-3">
                    <div className="font-label-caps text-xs text-on-surface-variant">Status Effects Reference</div>
                    <div className="grid grid-cols-2 gap-2 text-[10px] text-on-surface-variant">
                      {[
                        { name: "Dazed", col: "text-yellow-400", desc: "Cannot act this turn." },
                        { name: "Stuck", col: "text-red-400", desc: "Cannot move for N turns." },
                        { name: "Hamstrung", col: "text-orange-400", desc: "No diagonal movement for 1 round." },
                        { name: "Steadfast", col: "text-blue-300", desc: "Immune to Daze, Stuck, Push." }
                      ].map(s => (
                        <div key={s.name} className="bg-void-black/30 rounded p-1.5">
                          <div className={`font-bold ${s.col}`}>{s.name}</div>
                          <div>{s.desc}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>

          </div>
        )}

        {/* ═══════════════════════════ ASCENSION TAB ═══════════════════════════ */}
        {activeTab === 'ASCENSION' && (
          <div className="space-y-8 animate-[fadeIn_0.3s_ease-out]">
            <section className="bg-surface-container/60 backdrop-blur-md rounded-xl p-6 sm:p-8 border border-outline/10 shadow-lg space-y-6">
              <h2 className="font-almendra text-2xl sm:text-3xl font-bold text-ember-gold flex items-center gap-2">
                <span className="material-symbols-outlined">auto_awesome</span>
                Ascension Paths
              </h2>
              <div className="h-[2px] bg-gradient-to-r from-ember-gold to-transparent" />
              <p className="text-sm text-on-surface-variant leading-relaxed max-w-3xl">
                When a faction's unit is <span className="text-magma-core font-bold">Trapped</span> on the Overloaded
                Shrine, their controller may <span className="text-amber-400 font-bold">Sacrifice</span> it to unlock
                a permanent Ascension. Each sacrificed unit unlocks a specific path determined by its combat role.
                Choose between <span className="text-amber-400 font-bold">Option A</span> (a targeted unit upgrade) or{' '}
                <span className="text-green-400 font-bold">Option B</span> (a faction-wide passive buff).
              </p>

              {/* Faction filter */}
              <div className="flex gap-3">
                <button
                  className={`px-5 py-1.5 rounded font-label-caps text-xs border font-semibold transition-all duration-200 ${
                    ascFaction === 'both'
                      ? 'bg-ember-gold/10 border-ember-gold text-ember-gold'
                      : 'border-outline/30 text-on-surface-variant hover:text-white'
                  }`}
                  onClick={() => setAscFaction('both')}
                >All</button>
                <button
                  className={`px-5 py-1.5 rounded font-label-caps text-xs border font-semibold transition-all duration-200 ${
                    ascFaction === 'snow'
                      ? 'bg-ice-light/10 border-ice-light text-ice-light'
                      : 'border-outline/30 text-on-surface-variant hover:text-white'
                  }`}
                  onClick={() => setAscFaction('snow')}
                >Snow</button>
                <button
                  className={`px-5 py-1.5 rounded font-label-caps text-xs border font-semibold transition-all duration-200 ${
                    ascFaction === 'ash'
                      ? 'bg-magma-core/10 border-magma-core text-magma-core'
                      : 'border-outline/30 text-on-surface-variant hover:text-white'
                  }`}
                  onClick={() => setAscFaction('ash')}
                >Ash</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {ASCENSION_ROLES.map((r) => (
                  <div key={r.role} className="bg-void-black/50 border border-outline/10 rounded-xl overflow-hidden">
                    {/* Role header */}
                    <div className="px-5 py-3 border-b border-outline/10 flex items-baseline justify-between">
                      <span className="font-almendra text-base text-ember-gold font-bold">{r.role}</span>
                      <div className="flex gap-3 text-[10px]">
                        {(ascFaction === 'snow' || ascFaction === 'both') && (
                          <span className="text-ice-light">❄ {r.snow}</span>
                        )}
                        {(ascFaction === 'ash' || ascFaction === 'both') && (
                          <span className="text-magma-core">🔥 {r.ash}</span>
                        )}
                      </div>
                    </div>
                    {/* Option A */}
                    <div className="px-5 py-3 border-b border-outline/5 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-label-caps px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-400/30">Option A</span>
                        <span className="font-label-caps text-xs text-on-surface font-bold">{r.A.name}</span>
                      </div>
                      <p className="text-[11px] text-on-surface-variant leading-relaxed">
                        {ascFaction === 'snow' ? r.A.snowDesc || r.A.desc
                          : ascFaction === 'ash' ? r.A.ashDesc || r.A.desc
                          : r.A.desc}
                      </p>
                    </div>
                    {/* Option B */}
                    <div className="px-5 py-3 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-label-caps px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 border border-green-400/30">Option B</span>
                        <span className="font-label-caps text-xs text-on-surface font-bold">{r.B.name}</span>
                      </div>
                      <p className="text-[11px] text-on-surface-variant leading-relaxed">{r.B.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* ═══════════════════════════ UNITS TAB ═══════════════════════════ */}
        {activeTab === 'UNITS' && (
          <div className="space-y-8 animate-[fadeIn_0.3s_ease-out]">
            {/* Faction Selector */}
            <div className="flex justify-center gap-4">
              <button
                className={`px-6 py-2 rounded font-label-caps text-sm border font-semibold tracking-wider transition-all duration-300 ${activeFaction === 'snow'
                    ? 'bg-ice-light/10 border-ice-light text-ice-light shadow-[0_0_15px_rgba(165,243,252,0.2)]'
                    : 'border-outline/30 text-on-surface-variant hover:text-white'
                  }`}
                onClick={() => setActiveFaction('snow')}
              >
                Snow Faction
              </button>
              <button
                className={`px-6 py-2 rounded font-label-caps text-sm border font-semibold tracking-wider transition-all duration-300 ${activeFaction === 'ash'
                    ? 'bg-magma-core/10 border-magma-core text-magma-core shadow-[0_0_15px_rgba(239,68,68,0.2)]'
                    : 'border-outline/30 text-on-surface-variant hover:text-white'
                  }`}
                onClick={() => setActiveFaction('ash')}
              >
                Ash Faction
              </button>
            </div>

            {/* Units Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {UNIT_PROFILES[activeFaction].map((unit, idx) => (
                <div
                  key={idx}
                  className="bg-surface-container/60 backdrop-blur-md rounded-xl border border-outline/10 overflow-hidden flex flex-col hover:border-outline/30 transition-all duration-300 shadow-lg"
                >
                  {/* Portrait */}
                  <div className="relative h-56 bg-void-black/80 flex items-center justify-center overflow-hidden border-b border-outline/10">
                    <img
                      src={unit.portrait}
                      alt={unit.name}
                      className="w-40 h-40 object-contain hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-void-black via-transparent to-transparent pointer-events-none" />
                    <div className="absolute top-4 left-4">
                      <span className={`text-[10px] font-label-caps px-2 py-0.5 rounded border uppercase backdrop-blur-md ${activeFaction === 'snow'
                          ? 'bg-ice-light/10 text-ice-light border-ice-light/20'
                          : 'bg-magma-core/10 text-magma-core border-magma-core/20'
                        }`}>
                        {unit.role}
                      </span>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-6 flex-grow flex flex-col justify-between space-y-5">
                    <div>
                      <h3 className={`font-almendra text-2xl font-bold ${activeFaction === 'snow' ? 'text-ice-light' : 'text-magma-core'
                        }`}>
                        {unit.name}
                      </h3>
                      <p className="font-libre text-xs italic text-on-surface-variant mt-1.5 leading-relaxed">
                        {unit.title}
                      </p>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-5 gap-1.5 text-center">
                      {Object.entries(unit.stats).map(([stat, val]) => (
                        <div key={stat} className="bg-void-black/50 border border-outline/15 rounded py-1.5 px-0.5">
                          <div className="text-[9px] font-label-caps text-on-surface-variant font-medium">{stat}</div>
                          <div className="text-sm font-bold text-white font-mono mt-0.5">{val}</div>
                        </div>
                      ))}
                    </div>

                    {/* Abilities */}
                    <div className="space-y-3">
                      {unit.abilities.map((ability, abIdx) => (
                        <div key={abIdx} className="bg-void-black/30 border border-outline/5 rounded-lg p-3.5 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-label-caps px-1.5 py-0.5 rounded border uppercase ${ability.type === 'Active'
                                ? 'bg-ember-gold/15 text-ember-gold border-ember-gold/30'
                                : ability.type === 'Veteran'
                                  ? 'bg-blue-500/15 text-blue-300 border-blue-400/30'
                                  : 'bg-green-500/15 text-green-400 border-green-400/30'
                              }`}>
                              {ability.type}
                            </span>
                            <h4 className="font-label-caps text-xs font-bold text-on-surface">{ability.name}</h4>
                          </div>
                          <p className="text-[11px] sm:text-xs text-on-surface-variant leading-relaxed">
                            {ability.desc}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-void-black border-t border-outline/10 w-full py-8 mt-auto relative z-10 select-none font-label-caps">
        <div className="flex flex-col md:flex-row justify-between items-center px-6 md:px-12 max-w-7xl mx-auto w-full gap-4 text-center md:text-left">
          <div
            className="font-almendra text-sm tracking-wider text-on-surface-variant cursor-pointer"
            onClick={() => handleNavigate('LOBBY')}
          >
            Mythic Territories
          </div>
          <div className="text-xs text-on-surface-variant">
            © 2025 Mythic Territories. All rights reserved.
          </div>
          <div className="flex gap-6">
            <button
              className="text-xs text-ember-gold font-bold transition-colors duration-200 cursor-pointer bg-transparent border-none"
              onClick={() => handleNavigate('GUIDE')}
            >
              Rulebook
            </button>
            <button
              className="text-xs text-on-surface-variant hover:text-ember-gold transition-colors duration-200 cursor-pointer bg-transparent border-none"
              onClick={() => handleNavigate('NOTES')}
            >
              Patch Notes
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
