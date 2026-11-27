import React from 'react';
import Plus from 'lucide-react/dist/esm/icons/plus.js';
import SlidersHorizontal from 'lucide-react/dist/esm/icons/sliders-horizontal.js';
import Wrench from 'lucide-react/dist/esm/icons/wrench.js';
import Minus from 'lucide-react/dist/esm/icons/minus.js';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles.js';
import CircleAlert from 'lucide-react/dist/esm/icons/circle-alert.js';
import CalendarDays from 'lucide-react/dist/esm/icons/calendar-days.js';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down.js';
import BookOpen from 'lucide-react/dist/esm/icons/book-open.js';

export const PATCHES = [
  {
    version: "2.0 (UPCOMING)",
    title: "Dawn of the Ascendants",
    date: "TBD",
    tags: ["Upcoming", "Major Overhaul"],
    colorTheme: "ice",
    highlights: [
      { text: "Battlefield Rebirth: The ancient arena awakens anew. The entire tactical combat engine has been forged from the ground up to empower relentless strategic mastery.", icon: "grid_view", color: "text-ice-light font-bold" },
      { text: "Legion Remaster: Every warrior of Frost and Ash rises with reborn power — fine-tuned combat stats, deadlier abilities, and game-changing synergies.", icon: "military_tech", color: "text-ember-gold font-bold" },
      { text: "Dynamic Board Dominion: Control the flow of war with refined tile mechanics, fluid pathfinding, and high-stakes positioning that rewards every tactical gambit.", icon: "grid_on", color: "text-secondary font-bold" },
      { text: "Ascendant Visual Spectacle: Witness clash animations with luminous particles, sizzling elemental trails, and visceral impact feedback worthy of legends.", icon: "auto_awesome", color: "text-magma-core font-bold" }
    ]
  },
  {
    version: "1.9",
    title: "The Royal Primal Overhaul",
    date: "12/05/2026",
    tags: ["Latest", "Update"],
    colorTheme: "ice",
    highlights: [
      { text: "Arena of Destiny: Step into a breathtaking 3D perspective Clash arena where opposing elemental legions face off before the horn of battle sounds.", icon: "celebration", color: "text-ice-light" },
      { text: "Lords of Legend: Behold the Frost Lord and Ash Tyrant in majestic humanoid grandeur, replacing modest cards with fearsome war commanders.", icon: "portrait", color: "text-ice-light" },
      { text: "Obsidian Void Splendor: Dark, atmospheric cosmic vistas envelop the user experience with obsidian styling and shimmering stellar dust.", icon: "palette", color: "text-ice-light" }
    ]
  },
  {
    version: "1.8",
    title: "Realms United: Online Multiplayer",
    date: "29/04/2026",
    tags: ["Multiplayer"],
    colorTheme: "magma",
    highlights: [
      { text: "Global Warfront: Challenge warlords worldwide. Real-time multiplayer lets you forge lobbies and duel friends in elemental supremacy.", icon: "language", color: "text-magma-core" },
      { text: "AI Reconditioning: The artificial mind temporarily retreats into the crucible, preparing to return smarter, deadlier, and more cunning.", icon: "smart_toy", color: "text-magma-core" },
      { text: "Vanguard Matchmaking: Initial online warfare is unleashed with lightning-fast lobby syncing and robust network resilience.", icon: "rate_review", color: "text-magma-core" },
      { text: "Tactical Mobile Command: Command your legions on the go with a touch-optimized mobile interface and responsive haptic controls.", icon: "devices", color: "text-magma-core" }
    ]
  },
  {
    version: "1.7",
    title: "Siphoner Rework: Weavers of Essence",
    date: "12/04/2026",
    tags: ["Balancing"],
    colorTheme: "ice",
    highlights: [
      { text: "Aetheric Tethering: Siphoners can weave mystical tethers between champions, draining vitality from foes and fueling allied power reserves.", icon: "link", color: "text-ice-light" },
      { text: "Essence Interception: Tethered comrades are shielded from afflictions as Siphoners absorb incoming curses directly into their spirit.", icon: "swap_horiz", color: "text-ice-light" },
      { text: "Overload Cataclysm: Channel volatile stored energy into the Rifts to ignite the Abyssal Forge or overcharge the Sacred Shrine.", icon: "wind_power", color: "text-ice-light" },
      { text: "Arcane Flourish: Devastating skills like FrenziedDash and LavaGlob now erupt with bespoke magical spellcraft animations.", icon: "auto_awesome", color: "text-ice-light" }
    ]
  },
  {
    version: "1.6",
    title: "The Architect's Rebirth",
    date: "30/03/2026",
    tags: ["Major Milestone"],
    colorTheme: "gold",
    highlights: [
      { text: "The Abyssal Forge: Holding uncontested Rift dominance awakens the Forge, gifting your legion priceless Elemental Cores and expanding dimensional cracks.", icon: "security", color: "text-ember-gold" },
      { text: "Void Collapse: When contested conduits fracture under intense pressure for 3 rounds, reality snaps — erasing contested territory from existence.", icon: "volcano", color: "text-magma-core" },
      { text: "Sacred Ascension: Offer a trapped soul at the altar to unlock game-altering Ascension destinies unique to each warrior's class.", icon: "star", color: "text-ice-light" },
      { text: "Veteran Ranks: Blood-tested warriors who slay multiple foes ascend to Veteran glory, unlocking legendary passive talents.", icon: "military_tech", color: "text-ember-gold" },
      { text: "Leader Sovereignty: Channeled ultimates cloak Commanders in radiant auras that turn the tide of entire skirmishes.", icon: "energy_savings_leaf", color: "text-secondary" }
    ]
  }
];

export const HISTORICAL_PATCHES = [
  {
    version: "1.5",
    title: "The Specialist Update",
    date: "12/11/2025",
    colorTheme: "ice",
    bullets: [
      { prefix: "Specialist Overhaul: This major update overhauls the core tactical gameplay and AI. Standard units are replaced by a new roster of unique specialists, each bringing new active abilities and strategic roles to the battlefield.", color: "text-ice-light" },
      { prefix: "Contested Conduit: The Conduit Link no longer breaks when an enemy steps on a rift. Instead, it becomes \"Contested,\" reducing the Anchor power boost from +2 to +1 until the enemy is removed.", color: "text-ice-light" }
    ]
  },
  {
    version: "1.4.1",
    title: "Primal Reckoning",
    date: "08/11/2025",
    colorTheme: "magma",
    bullets: [
      { prefix: "Shrine Rework - The Primal Sacrifice: The Overloaded Shrine now \"Traps\" a unit. The owner can then choose to \"Sacrifice\" it (faction-wide +1 Power buff) or \"Release\" it (-1 perm power & Daze).", color: "text-magma-core" },
      { prefix: "Steal the Sacrifice: While a unit is Trapped, an opponent can move onto the Shrine to \"Steal\" the sacrifice, claiming the buff for their team.", color: "text-magma-core" },
      { prefix: "New Synergies: Ignition Point (Mark of Cinder + Lava Glob) and Conduit of Frost (Chilling Aura + Glacial Wall) have been discovered.", color: "text-magma-core" }
    ]
  },
  {
    version: "1.4",
    title: "The Maker's Gaze",
    date: "30/10/2025",
    colorTheme: "gold",
    bullets: [
      { prefix: "Challenge the Architect: Face the maker of your world! Test your strategies against a formidable AI opponent designed to push your tactical skills to the limit.", color: "text-ember-gold" },
      { prefix: "Enhanced Battlefield Visuals: Witness the clash of elements like never before! Major abilities and game states now feature significantly upgraded animations and particle effects.", color: "text-ember-gold" },
      { prefix: "Gameplay & Balance Refinements: Key adjustments have been made to abilities and mechanics for improved strategic depth, including changes to Glacial Step, Shrine Overload, Lava Glob, and Unstable Ground cooldowns.", color: "text-ember-gold" }
    ]
  },
  {
    version: "1.3.1",
    title: "QoL & Balance Pass",
    date: "10/10/2025",
    colorTheme: "ice",
    bullets: [
      { prefix: "Mobile UI Overhaul: The mobile layout has been re-ordered for a more intuitive flow, with various UI bugs fixed.", color: "text-ice-light" },
      { prefix: "Shrine Stalemate: Added a 'Stalemate' outcome if the Shrine's 'Energy Nova' destroys both leaders at once.", color: "text-ice-light" },
      { prefix: "Balance Change - Rift Assault: This ability now inflicts 'Rift Shock' on the user, leaving them 'Dazed' for one turn to add more strategic counter-play.", color: "text-ice-light" }
    ]
  },
  {
    version: "1.3",
    title: "The Awakened Conduit",
    date: "07/10/2025",
    colorTheme: "gold",
    bullets: [
      { prefix: "Total Visual Remaster: Every warrior on the battlefield has been reborn with stunning, all-new high-quality artwork.", color: "text-ember-gold" },
      { prefix: "Play Anywhere Interface: The game now fully supports all screen sizes, from mobile phones to desktops. The entire user interface has been redesigned.", color: "text-ember-gold" },
      { prefix: "The Awakened Conduit: Occupying both rifts forms a Conduit Link, unlocking incredible new strategies: Conduit Highway (teleport friendly units across the map between linked rifts) and Empowered Anchors (the two pieces holding rifts gain +2 Power and defensive passives).", color: "text-ember-gold" }
    ]
  },
  {
    version: "1.2",
    title: "Realms of Chaos",
    date: "28/09/2025",
    colorTheme: "magma",
    bullets: [
      { prefix: "Arcane Rifts: Mysterious zones pulse with unpredictable energy that evolves as the war wages on.", color: "text-magma-core" },
      { prefix: "The Shrine Crucible: The central Shrine now demands sacrifice. Spilled blood awakens it, and stepping on its Overloaded soil may infuse you with power or trigger a cataclysmic nova!", color: "text-magma-core" },
      { prefix: "Event Log: Added an in-game event log to keep track of major battlefield actions and history.", color: "text-magma-core" }
    ]
  },
  {
    version: "1.1",
    title: "Winds of Time",
    date: "22/09/2025",
    colorTheme: "ice",
    bullets: [
      { prefix: "Visual Theme Update: A stunning aesthetic upgrade enhances the battlefield, breathing new life into every clash.", color: "text-ice-light" },
      { prefix: "Timer System: A new competitive play timer forces commanders to make split-second decisions where every moment counts.", color: "text-ice-light" }
    ]
  },
  {
    version: "1.0",
    title: "Awakening of the Realms",
    date: "21/09/2025",
    colorTheme: "gold",
    bullets: [
      { prefix: "Core War Forged: Take command of mythical armies and clash for dominion over shifting lands.", color: "text-ember-gold" }
    ]
  }
];

const CATEGORY_STYLES = {
  New: {
    icon: Plus,
    className: 'border-ice-light/25 bg-ice-light/10 text-ice-light'
  },
  Balance: {
    icon: SlidersHorizontal,
    className: 'border-ember-gold/25 bg-ember-gold/10 text-ember-gold'
  },
  Fixed: {
    icon: Wrench,
    className: 'border-emerald-300/25 bg-emerald-300/10 text-emerald-300'
  },
  Removed: {
    icon: Minus,
    className: 'border-magma-core/25 bg-magma-core/10 text-magma-core'
  },
  Improved: {
    icon: Sparkles,
    className: 'border-violet-300/25 bg-violet-300/10 text-violet-300'
  },
  Notice: {
    icon: CircleAlert,
    className: 'border-on-surface-variant/25 bg-on-surface-variant/10 text-on-surface-variant'
  }
};

const getCategory = (text) => {
  const value = text.toLowerCase();
  if (value.includes('removed') || value.includes('removal')) return 'Removed';
  if (value.includes('fix') || value.includes('polish') || value.includes('latency')) return 'Fixed';
  if (value.includes('balance') || value.includes('rework') || value.includes('overhaul')) return 'Balance';
  if (value.includes('new ') || value.includes('added') || value.includes('introduced')) return 'New';
  if (value.includes('note:') || value.includes('notes:')) return 'Notice';
  return 'Improved';
};

const splitChange = (text) => {
  const separator = text.indexOf(':');
  if (separator === -1) return { title: 'Update', description: text };
  return {
    title: text.slice(0, separator).trim(),
    description: text.slice(separator + 1).trim()
  };
};

const getScope = (text) => {
  const value = text.toLowerCase();
  if (/(visual|animation|interface|mobile|portrait|aesthetic|performance)/.test(value)) return 'Presentation';
  if (/(multiplayer|ai |artificial intelligence|matchmaking|room)/.test(value)) return 'Game modes';
  return 'Gameplay';
};

export const versionId = (version) => `version-${String(version).replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase()}`;

export function ChangeRow({ text }) {
  const category = getCategory(text);
  const scope = getScope(text);
  const { title, description } = splitChange(text);
  const categoryStyle = CATEGORY_STYLES[category];
  const Icon = categoryStyle.icon;

  return (
    <li className="grid gap-3 rounded-xl border border-outline-variant/20 bg-void-black/35 p-4 sm:grid-cols-[auto_1fr]">
      <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${categoryStyle.className}`}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div>
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <h4 className="font-label-caps text-xs tracking-wider text-on-surface">{title}</h4>
          <span className={`rounded-full border px-2 py-0.5 font-label-caps text-[8px] tracking-widest ${categoryStyle.className}`}>
            {category}
          </span>
          <span className="font-label-caps text-[8px] tracking-widest text-on-surface-variant/60">{scope}</span>
        </div>
        <p className="text-sm leading-relaxed text-on-surface-variant">{description}</p>
      </div>
    </li>
  );
}

export function ReleaseCard({ patch, expanded, onToggle, onViewRules, featured = false, archived = false, targeted = false }) {
  const changes = patch.highlights?.map((item) => item.text) || patch.bullets?.map((item) => item.prefix) || [];
  const summary = changes.length ? splitChange(changes[0]).description : '';

  return (
    <article
      id={versionId(patch.version)}
      className={`scroll-mt-24 group transition-all duration-300 ${targeted ? 'ring-1 ring-amber-400/50 rounded-xl px-4 -mx-4 bg-amber-400/5 shadow-[0_0_20px_rgba(245,158,11,0.1)]' : ''}`}
    >
      <button
        className="w-full py-5 text-left focus:outline-none cursor-pointer flex items-start justify-between gap-4"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={`${versionId(patch.version)}-changes`}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5 mb-1.5">
            <span className="font-mono text-xs font-bold text-amber-400 tracking-wider">
              v{patch.version}
            </span>
            {featured && (
              <span className="text-[9px] uppercase font-bold tracking-[0.18em] px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-300 border border-amber-400/30">
                Latest Release
              </span>
            )}
            {archived && (
              <span className="text-[9px] uppercase font-bold tracking-[0.18em] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                Legacy
              </span>
            )}
            <span className="text-slate-500 text-xs">•</span>
            <time className="text-xs text-slate-400 font-mono tracking-wide">{patch.date}</time>
          </div>

          <h3 className="font-almendra text-xl sm:text-2xl font-bold text-white group-hover:text-amber-300 transition-colors tracking-wide">
            {patch.title}
          </h3>

          {!expanded && summary && (
            <p className="mt-1.5 text-xs text-slate-300/90 line-clamp-1 leading-relaxed max-w-xl lg:max-w-3xl">
              {summary}
            </p>
          )}
        </div>

        <span className={`mt-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-700/80 bg-slate-800/80 text-slate-300 transition-all duration-200 ${expanded ? 'text-amber-400 border-amber-400/50 rotate-180 bg-amber-400/10' : 'group-hover:text-white group-hover:border-slate-500'}`}>
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </span>
      </button>

      <div
        id={`${versionId(patch.version)}-changes`}
        className={`note-accordion-wrapper ${expanded ? 'open' : ''}`}
        aria-hidden={!expanded}
      >
        <div className="note-accordion-inner">
          <div className="note-accordion-content pb-6 pt-1 text-slate-200">
            <ul className="space-y-3.5 border-l-2 border-slate-700/80 pl-4 ml-1">
              {changes.map((change, index) => <ChangeRow key={`${patch.version}-${index}`} text={change} />)}
            </ul>
            {onViewRules && (
              <div className="mt-4 flex justify-end">
                <button
                  className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
                  onClick={onViewRules}
                >
                  <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Consult Rulebook</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

