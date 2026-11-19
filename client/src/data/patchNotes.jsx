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
    title: "The New Era of Tactics",
    date: "TBD",
    tags: ["Upcoming", "Major Overhaul"],
    colorTheme: "ice",
    highlights: [
      { text: "Complete Game Overhaul: The entire battlefield has been rebuilt from the ground up to support a new era of deep, tactical competitive play.", icon: "grid_view", color: "text-ice-light font-bold" },
      { text: "Total Unit & Ability Remaster: Every single piece across the Factions of Frost and Ash has been completely reworked with modernized base stats, balanced ability sets, and strategic active/passive loops.", icon: "military_tech", color: "text-ember-gold font-bold" },
      { text: "Overhauled Movement & Board Dynamics: Redesigned spatial control, pathfinding grids, and core movement mechanics to reward positional play and calculated maneuvers.", icon: "grid_on", color: "text-secondary font-bold" },
      { text: "High-Fidelity Visual Systems: Upgraded animations, particle systems, and visual cues across combat, projectile trails, and status rings for a premium gameplay feel.", icon: "auto_awesome", color: "text-magma-core font-bold" }
    ]
  },
  {
    version: "1.9",
    title: "The Royal Primal Overhaul",
    date: "12/05/2026",
    tags: ["Latest", "Update"],
    colorTheme: "ice",
    highlights: [
      { text: "Cinematic Menu Redesign: New 3D perspective \"Clash\" layout for faction selection, creating an immersive arena feel.", icon: "celebration", color: "text-ice-light" },
      { text: "Humanoid Leader Portraits: High-fidelity humanoid forms for the Frost Lord and Ash Tyrant, replacing the generic unit cards.", icon: "portrait", color: "text-ice-light" },
      { text: "Obsidian Void Aesthetics: Complete visual overhaul of menu backgrounds and UI elements with the new Obsidian Void theme for a premium, darker look.", icon: "palette", color: "text-ice-light" }
    ]
  },
  {
    version: "1.8",
    title: "Multiplayer Added; AI Temporarily Removed",
    date: "29/04/2026",
    tags: ["Multiplayer"],
    colorTheme: "magma",
    highlights: [
      { text: "Multiplayer (MP): Full multiplayer support has been introduced — invite friends and battle online.", icon: "language", color: "text-magma-core" },
      { text: "AI Removals: The single-player AI has been temporarily removed for a major rework to improve balance and strategic behavior. It will return in a future update.", icon: "smart_toy", color: "text-magma-core" },
      { text: "Notes: This is an early release of multiplayer features; expect follow-up patches to polish matchmaking and latency handling.", icon: "rate_review", color: "text-magma-core" },
      { text: "Mobile Menu: Mobile menu fully redesigned and polished for a smoother, more intuitive on-device experience.", icon: "devices", color: "text-magma-core" }
    ]
  },
  {
    version: "1.7",
    title: "Siphoner Rework",
    date: "12/04/2026",
    tags: ["Balancing"],
    colorTheme: "ice",
    highlights: [
      { text: "Tether System: Siphoners can form persistent Tethers to shift Power between units and perform targeted drains. Tethers generate Overload which must be managed.", icon: "link", color: "text-ice-light" },
      { text: "Status Siphoning: Tethered allies can have debuffs intercepted by their Siphoner (the Siphoner absorbs the debuff and gains Overload).", icon: "swap_horiz", color: "text-ice-light" },
      { text: "Venting: Siphoners can vent accumulated Overload into Rifts (triggers the Abyssal Forge) or into the Overloaded Shrine (adds shrine charge).", icon: "wind_power", color: "text-ice-light" },
      { text: "Enhanced Ability Visuals: Few major abilities now feature distinct animations, such as FrenziedDash, LavaGlob, and many more.", icon: "auto_awesome", color: "text-ice-light" }
    ]
  },
  {
    version: "1.6",
    title: "The Architect's Rebirth",
    date: "30/03/2026",
    tags: ["Major Milestone"],
    colorTheme: "gold",
    highlights: [
      { text: "The Abyssal Forge: Uncontested Conduit control now triggers the Forge, expanding Rift size or spawning Elemental Cores (Ruby, Topaz, Emerald, Sapphire) for permanent unit buffs.", icon: "security", color: "text-ember-gold" },
      { text: "The Void Snap: Highly charged Conduits that remain contested for 3 turns will now collapse, triggering a Void Snap that permanently deletes those squares from the map.", icon: "volcano", color: "text-magma-core" },
      { text: "Dynamic Ascension: Sacrificing a trapped unit at the Shrine now offers unique Ascension Paths (Path A or Path B) based specifically on that unit's role, such as Shaper, Brawler, or Siphoner.", icon: "star", color: "text-ice-light" },
      { text: "Veteran Promotion: Specialist units that vanquish 2 enemies achieve Veteran status, unlocking new permanent passives or secondary abilities like Glacial Fortress or Volatile Forge.", icon: "military_tech", color: "text-ember-gold" },
      { text: "Leader Ultimates: Leaders now channel their Ultimates to generate charges. Once active, they emit a persistent Aura, though the Leader remains locked down while channeling.", icon: "energy_savings_leaf", color: "text-secondary" }
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
      { prefix: "Leader Ultimates: Leaders gain a one-time-use Ultimate: King's Edict (Frost Lord). A new visual flair shows when the ultimate is ready.", color: "text-magma-core" },
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

export const versionId = (version) => `version-${version.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;

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

export function ReleaseCard({ patch, expanded, onToggle, onViewRules, featured = false, archived = false }) {
  const changes = patch.highlights?.map((item) => item.text) || patch.bullets?.map((item) => item.prefix) || [];
  const themeClass = patch.colorTheme === 'magma'
    ? 'from-magma-core/20 border-magma-core/35'
    : patch.colorTheme === 'gold'
      ? 'from-ember-gold/20 border-ember-gold/35'
      : 'from-ice-light/20 border-ice-light/35';
  const accentClass = patch.colorTheme === 'magma'
    ? 'text-magma-core'
    : patch.colorTheme === 'gold'
      ? 'text-ember-gold'
      : 'text-ice-light';
  const summary = changes.length ? splitChange(changes[0]).description : '';

  return (
    <article
      id={versionId(patch.version)}
      className={`scroll-mt-36 overflow-hidden rounded-2xl border bg-gradient-to-br ${themeClass} via-surface-container/90 to-void-black/95 transition-all duration-300 shadow-[0_20px_70px_rgba(0,0,0,0.3)] ${featured ? 'ring-1 ring-ice-light/15' : ''} ${expanded ? 'note-card-expanded border-opacity-70' : ''}`}
    >
      <button
        className="w-full p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ember-gold sm:p-7 cursor-pointer"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={`${versionId(patch.version)}-changes`}
      >
        <div className="flex items-start justify-between gap-5">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {featured && (
                <span className="rounded-full border border-ice-light/30 bg-ice-light/10 px-2.5 py-1 font-label-caps text-[9px] tracking-[0.18em] text-ice-light">
                  Current release
                </span>
              )}
              {archived && (
                <span className="rounded-full border border-outline/30 bg-void-black/30 px-2.5 py-1 font-label-caps text-[9px] tracking-[0.18em] text-on-surface-variant">
                  Archive
                </span>
              )}
              <span className={`font-label-caps text-[10px] tracking-[0.2em] ${accentClass}`}>
                Version {patch.version}
              </span>
            </div>
            <h2 className={`font-almendra font-semibold text-on-surface ${featured ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl'}`}>
              {patch.title}
            </h2>
            <div className="mt-3 flex items-center gap-2 text-xs text-on-surface-variant/80">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
              <time>{patch.date}</time>
              <span aria-hidden="true">·</span>
              <span>{changes.length} changes</span>
            </div>
            {summary && (
              <div className={`note-summary-wrapper ${expanded ? 'collapsed' : ''}`}>
                <div className="note-summary-inner">
                  <p className="mt-4 max-w-2xl text-sm leading-relaxed text-on-surface-variant">{summary}</p>
                </div>
              </div>
            )}
          </div>
          <span className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-outline/20 bg-void-black/30 text-on-surface-variant transition-colors duration-300 ${expanded ? 'text-ember-gold border-ember-gold/40' : ''}`}>
            <ChevronDown className={`h-4 w-4 transition-transform duration-300 ease-out ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
          </span>
        </div>
      </button>

      <div
        id={`${versionId(patch.version)}-changes`}
        className={`note-accordion-wrapper ${expanded ? 'open' : ''}`}
        aria-hidden={!expanded}
      >
        <div className="note-accordion-inner">
          <div className="note-accordion-content border-t border-outline-variant/20 px-5 pb-5 pt-4 sm:px-7 sm:pb-7">
            <ul className="grid gap-3">
              {changes.map((change, index) => <ChangeRow key={`${patch.version}-${index}`} text={change} />)}
            </ul>
            {onViewRules && (
              <div className="mt-4 flex justify-end">
                <button
                  className="inline-flex items-center gap-2 rounded-full px-3 py-2 font-label-caps text-[9px] tracking-wider text-on-surface-variant transition-colors hover:bg-ice-light/10 hover:text-ice-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice-light cursor-pointer"
                  onClick={onViewRules}
                >
                  <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                  View current rules
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

