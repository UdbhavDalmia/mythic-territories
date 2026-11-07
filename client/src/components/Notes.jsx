import React, { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import '../../styles/notes.css';
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  ChevronDown,
  CircleAlert,
  Minus,
  Plus,
  ScrollText,
  SlidersHorizontal,
  Sparkles,
  Wrench,
} from 'lucide-react';

const PATCHES = [
  {
    version: "2.0 (UPCOMING)",
    title: "The New Era of Tactics",
    date: "TBD",
    tags: ["Upcoming", "Major Overhaul"],
    colorTheme: "ice",
    highlights: [
      { text: "Complete Game Overhaul: The entire battlefield has been rebuilt from the ground up to support a new era of deep, tactical competitive play.", icon: "grid_view", color: "text-ice-light font-bold" },
      { text: "Total Unit & Ability Remaster: Every single piece across the Factions of Snow and Ash has been completely reworked with modernized base stats, balanced ability sets, and strategic active/passive loops.", icon: "military_tech", color: "text-ember-gold font-bold" },
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

const HISTORICAL_PATCHES = [
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

const versionId = (version) => `version-${version.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;

function ChangeRow({ text }) {
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

function ReleaseCard({ patch, expanded, onToggle, onViewRules, featured = false, archived = false }) {
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
      className={`scroll-mt-36 overflow-hidden rounded-2xl border bg-gradient-to-br ${themeClass} via-surface-container/90 to-void-black/95 shadow-[0_20px_70px_rgba(0,0,0,0.3)] ${featured ? 'ring-1 ring-ice-light/15' : ''}`}
    >
      <button
        className="w-full p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ember-gold sm:p-7"
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
            {!expanded && summary && (
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-on-surface-variant">{summary}</p>
            )}
          </div>
          <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-outline/20 bg-void-black/30 text-on-surface-variant">
            <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
          </span>
        </div>
      </button>

      {expanded && (
        <div id={`${versionId(patch.version)}-changes`} className="border-t border-outline-variant/20 px-5 pb-5 pt-4 sm:px-7 sm:pb-7">
          <ul className="grid gap-3">
            {changes.map((change, index) => <ChangeRow key={`${patch.version}-${index}`} text={change} />)}
          </ul>
          {onViewRules && (
            <div className="mt-4 flex justify-end">
              <button
                className="inline-flex items-center gap-2 rounded-full px-3 py-2 font-label-caps text-[9px] tracking-wider text-on-surface-variant transition-colors hover:bg-ice-light/10 hover:text-ice-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice-light"
                onClick={onViewRules}
              >
                <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                View current rules
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export default function Notes({ navigateTo }) {
  const requestedVersion = new URLSearchParams(window.location.search).get('version');
  const archivedVersionRequested = HISTORICAL_PATCHES.some((patch) => patch.version === requestedVersion);
  const initialVersion = [...PATCHES, ...HISTORICAL_PATCHES].some((patch) => patch.version === requestedVersion)
    ? requestedVersion
    : PATCHES[1].version;
  const [showArchive, setShowArchive] = useState(archivedVersionRequested);
  const [expandedVersions, setExpandedVersions] = useState(() => new Set([initialVersion]));
  const pageRef = useRef(null);
  const upcomingPatch = PATCHES[0];
  const releasedPatches = PATCHES.slice(1);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(pageRef.current, { opacity: 1, y: 0 });
      return;
    }
    gsap.fromTo(pageRef.current,
      { opacity: 0, y: 40 },
      { opacity: 1, y: 0, duration: 0.75, ease: 'expo.out' }
    );
  }, []);

  useEffect(() => {
    if (!requestedVersion) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(versionId(requestedVersion))?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start'
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [requestedVersion]);

  const handleNavigate = (dest) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      navigateTo(dest);
      return;
    }
    gsap.to(pageRef.current, {
      opacity: 0, y: 50, duration: 0.32, ease: 'power2.in',
      onComplete: () => navigateTo(dest)
    });
  };

  const openVersion = (version, archived = false) => {
    if (archived) setShowArchive(true);
    setExpandedVersions((current) => {
      const next = new Set(current);
      if (next.has(version)) next.delete(version);
      else next.add(version);
      return next;
    });

    const url = new URL(window.location.href);
    url.searchParams.set('page', 'notes');
    url.searchParams.set('version', version);
    window.history.replaceState({}, '', url);

    window.requestAnimationFrame(() => {
      document.getElementById(versionId(version))?.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start'
      });
    });
  };

  return (
    <div ref={pageRef} className="relative min-h-screen flex flex-col bg-void-black text-on-surface font-body-md select-text" style={{ opacity: 0 }}>
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="sticky top-0 w-full h-screen">
          <div
            className="absolute inset-0 opacity-30 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: "url('/images/menu-bg.webp')" }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-void-black/50 via-void-black/75 to-void-black" />
          <div className="absolute left-0 top-0 h-[32rem] w-1/2 bg-[radial-gradient(circle_at_top_left,rgba(165,243,252,0.12),transparent_65%)]" />
          <div className="absolute right-0 top-0 h-[32rem] w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(239,68,68,0.1),transparent_65%)]" />
        </div>
      </div>

      <nav className="fixed top-0 w-full z-50 bg-void-black/80 backdrop-blur-xl border-b border-outline/15">
        <div className="flex justify-between items-center w-full px-4 md:px-12 py-4 max-w-7xl mx-auto">
          <button
            className="font-almendra text-lg sm:text-2xl tracking-wider text-ember-gold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-gold rounded"
            onClick={() => handleNavigate('LOBBY')}
          >
            Mythic Territories
          </button>
          <button
            className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full border border-ember-gold/25 px-4 py-2 font-label-caps text-[10px] sm:text-xs tracking-wider text-ember-gold transition-colors duration-300 hover:text-void-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-gold"
            onClick={() => handleNavigate('LOBBY')}
          >
            <span className="absolute inset-0 origin-left scale-x-0 bg-ember-gold transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-x-100 group-focus-visible:scale-x-100" />
            <ArrowLeft className="relative z-10 h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-x-0.5" aria-hidden="true" />
            <span className="relative z-10">Back to menu</span>
          </button>
        </div>
      </nav>

      <main className="relative z-10 flex-grow pt-32 pb-20 px-4 md:px-8 max-w-6xl mx-auto w-full">
        <header className="text-center mb-12 space-y-4">
          <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-outline/20 bg-void-black/40 px-3 py-1.5 font-label-caps text-[9px] tracking-[0.24em] text-on-surface-variant">
            <ScrollText className="h-3.5 w-3.5 text-ember-gold" aria-hidden="true" />
            Release archive
          </div>
          <h1 className="font-almendra text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight text-gradient-dual uppercase mb-4">
            PATCH NOTES
          </h1>
          <p className="text-base sm:text-lg text-on-surface-variant max-w-2xl mx-auto leading-relaxed">
            Follow new features, balance changes, fixes, and every evolution of the battle between Frost and Flame.
          </p>
        </header>

        <section id={versionId(upcomingPatch.version)} className="scroll-mt-36 mb-8 rounded-2xl border border-ember-gold/25 bg-gradient-to-r from-ember-gold/10 via-surface-container/75 to-magma-core/10 p-5 sm:p-7">
          <div className="grid items-center gap-6 md:grid-cols-[1fr_auto]">
            <div>
              <div className="mb-2 flex items-center gap-2 font-label-caps text-[9px] tracking-[0.22em] text-ember-gold">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                On the horizon
              </div>
              <h2 className="font-almendra text-2xl sm:text-3xl text-on-surface">{upcomingPatch.title}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-on-surface-variant">
                Version 2.0 is a planned major overhaul. Its scope is evolving and does not represent the current live ruleset.
              </p>
            </div>
            <button
              className="rounded-full border border-ember-gold/30 px-4 py-2.5 font-label-caps text-[10px] tracking-wider text-ember-gold transition-colors hover:bg-ember-gold hover:text-void-black"
              onClick={() => openVersion(upcomingPatch.version)}
            >
              View roadmap
            </button>
          </div>
          {expandedVersions.has(upcomingPatch.version) && (
            <ul className="mt-6 grid gap-3 border-t border-ember-gold/15 pt-5 md:grid-cols-2">
              {upcomingPatch.highlights.map((change, index) => <ChangeRow key={`roadmap-${index}`} text={change.text} />)}
            </ul>
          )}
        </section>

        <section aria-labelledby="released-heading">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="font-label-caps text-[9px] tracking-[0.22em] text-ice-light">Live history</p>
              <h2 id="released-heading" className="mt-1 font-almendra text-2xl sm:text-3xl text-on-surface">Released updates</h2>
            </div>
            <p className="hidden text-xs text-on-surface-variant md:block">Select a release to view every change</p>
          </div>

          <div className="space-y-5">
            {releasedPatches.map((patch, index) => (
              <ReleaseCard
                key={patch.version}
                patch={patch}
                featured={index === 0}
                expanded={expandedVersions.has(patch.version)}
                onToggle={() => openVersion(patch.version)}
                onViewRules={() => handleNavigate('GUIDE')}
              />
            ))}
          </div>
        </section>

        <section className="mt-12 border-t border-outline/15 pt-8" aria-labelledby="archive-heading">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="font-label-caps text-[9px] tracking-[0.22em] text-ember-gold">Legacy chronicle</p>
              <h2 id="archive-heading" className="mt-1 font-almendra text-2xl sm:text-3xl text-on-surface">Historical archive</h2>
            </div>
            <button
              className="inline-flex items-center gap-2 rounded-full border border-ember-gold/25 px-4 py-2.5 font-label-caps text-[10px] tracking-wider text-ember-gold transition-colors hover:bg-ember-gold hover:text-void-black"
              onClick={() => setShowArchive((current) => !current)}
              aria-expanded={showArchive}
            >
              {showArchive ? 'Hide archive' : `Browse ${HISTORICAL_PATCHES.length} releases`}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showArchive ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
          </div>

          {showArchive && (
            <div className="mt-6 space-y-4">
              {HISTORICAL_PATCHES.map((patch) => (
                <ReleaseCard
                  key={patch.version}
                  patch={patch}
                  archived
                  expanded={expandedVersions.has(patch.version)}
                  onToggle={() => openVersion(patch.version, true)}
                  onViewRules={() => handleNavigate('GUIDE')}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="bg-void-black border-t border-outline/10 w-full py-8 mt-auto relative z-10 select-none font-label-caps">
        <div className="flex flex-col md:flex-row justify-between items-center px-6 md:px-12 max-w-7xl mx-auto w-full gap-4 text-center md:text-left">
          <button
            className="text-sm tracking-wider text-on-surface-variant cursor-pointer hover:text-ember-gold transition-colors"
            onClick={() => handleNavigate('LOBBY')}
            style={{ fontVariant: 'small-caps' }}
          >
            Mythic Territories
          </button>
          <div className="text-[10px] text-on-surface-variant/60">
            © 2025 Mythic Territories
          </div>
          <div className="flex gap-6">
            <button
              className="inline-flex items-center gap-2 text-xs text-on-surface-variant hover:text-ember-gold transition-colors duration-200 cursor-pointer bg-transparent border-none"
              onClick={() => handleNavigate('GUIDE')}
            >
              <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
              Rulebook
            </button>
            <button
              className="inline-flex items-center gap-2 text-xs text-ember-gold font-bold transition-colors duration-200 cursor-pointer bg-transparent border-none"
              onClick={() => handleNavigate('NOTES')}
            >
              <ScrollText className="h-3.5 w-3.5" aria-hidden="true" />
              Patch Notes
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
