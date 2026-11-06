import React, { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';

const PATCHES = [
  {
    version: "3.0 (UPCOMING)",
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
    version: "2.3",
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
    version: "2.2",
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
    version: "2.1",
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
    version: "2.0",
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

export default function Notes({ navigateTo }) {
  const [showArchive, setShowArchive] = useState(false);
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
    <div ref={pageRef} className="relative min-h-screen flex flex-col bg-void-black text-on-surface font-body-md select-text" style={{ opacity: 0 }}>

      {/* Background Image Overlay */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="sticky top-0 w-full h-screen">
          <div
            className="absolute inset-0 opacity-40 bg-cover bg-center bg-no-repeat transition-transform duration-[20s]"
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
      <main className="relative z-10 flex-grow pt-32 pb-20 px-4 md:px-12 max-w-4xl mx-auto w-full">
        <header className="text-center mb-16 space-y-4">
          <h1 className="font-almendra text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-gradient-dual uppercase mb-4" style={{ fontFamily: '"Almendra SC", serif' }}>
            PATCH NOTES
          </h1>
          <p className="font-libre text-lg sm:text-xl italic text-on-surface-variant max-w-2xl mx-auto">
            Chronicles of the eternal conflict between Frost and Flame.
          </p>
        </header>

        {/* Timeline */}
        <div className="space-y-12">

          {/* Active Major Patches */}
          {PATCHES.map((patch, idx) => {
            const isIce = patch.colorTheme === 'ice';
            const borderCol = isIce ? 'border-ice-light' : patch.colorTheme === 'magma' ? 'border-magma-core' : 'border-ember-gold';
            const textCol = isIce ? 'text-ice-light' : patch.colorTheme === 'magma' ? 'text-magma-core' : 'text-ember-gold';

            return (
              <section
                key={idx}
                className={`glass-obsidian p-6 md:p-10 border-l-4 ${borderCol} rounded-xl relative overflow-hidden group shadow-lg border border-outline/10`}
              >
                {/* Upper tags */}
                {patch.tags && (
                  <div className="absolute top-0 right-0 p-4 flex flex-col items-end gap-1">
                    {patch.tags.map((tag, tIdx) => (
                      <span
                        key={tIdx}
                        className={`text-[9px] font-label-caps px-2 py-0.5 rounded border font-semibold uppercase ${tag.toLowerCase().includes('upcoming') || tag.toLowerCase().includes('major')
                            ? 'bg-ember-gold/10 text-ember-gold border-ember-gold/30'
                            : 'bg-ice-light/10 text-ice-light border-ice-light/20'
                          }`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <header className="mb-6">
                  <p className={`font-label-caps text-xs tracking-widest mb-1 ${textCol}`}>
                    VERSION {patch.version}
                  </p>
                  <h2 className="font-almendra text-2xl sm:text-3xl text-on-surface font-semibold" style={{ fontFamily: '"Almendra SC", serif' }}>
                    {patch.title}
                  </h2>
                  <p className="text-on-surface-variant font-mono text-xs flex items-center gap-1.5 mt-2">
                    <span className="material-symbols-outlined text-sm">calendar_today</span>
                    {patch.date}
                  </p>
                </header>

                {/* Highlights (Icon list layout) */}
                {patch.highlights && (
                  <div className="grid grid-cols-1 gap-4 mt-6">
                    <div className="p-5 bg-void-black/50 border border-outline-variant/30 rounded-lg space-y-4">
                      {patch.highlights.map((hl, hlIdx) => (
                        <div key={hlIdx} className="flex gap-4">
                          <span className={`material-symbols-outlined shrink-0 mt-0.5 ${hl.color}`}>
                            {hl.icon}
                          </span>
                          <p className="text-on-surface-variant text-sm sm:text-base">
                            {hl.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            );
          })}

          {/* Historical Archives Toggle */}
          <div className="text-center py-8 select-none">
            <button
              className="px-8 py-4 border border-ember-gold/30 rounded-full font-label-caps text-ember-gold hover:bg-ember-gold hover:text-void-black transition-all duration-300 cursor-pointer font-bold text-xs"
              onClick={() => setShowArchive(!showArchive)}
            >
              {showArchive ? 'HIDE HISTORICAL ARCHIVES' : 'VIEW HISTORICAL ARCHIVES'}
            </button>
          </div>

          {/* Archive Section */}
          {showArchive && (
            <div className="space-y-8">
              {HISTORICAL_PATCHES.map((patch, idx) => {
                const isIce = patch.colorTheme === 'ice';
                const borderCol = isIce ? 'border-ice-light' : patch.colorTheme === 'magma' ? 'border-magma-core' : 'border-ember-gold';
                const textCol = isIce ? 'text-ice-light' : patch.colorTheme === 'magma' ? 'text-magma-core' : 'text-ember-gold';

                return (
                  <article
                    key={idx}
                    className={`glass-obsidian p-6 md:p-8 border border-outline-variant/20 rounded-lg opacity-95 hover:opacity-100 transition-opacity border-l-4 ${borderCol}`}
                  >
                    <header className="mb-4">
                      <p className={`font-label-caps text-xs tracking-widest mb-1 ${textCol}`}>
                        VERSION {patch.version}
                      </p>
                      <h3 className="font-almendra text-2xl text-ember-gold mb-2 font-semibold" style={{ fontFamily: '"Almendra SC", serif' }}>
                        {patch.title}
                      </h3>
                      <p className="text-on-surface-variant font-mono text-xs flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-xs">calendar_today</span>
                        {patch.date}
                      </p>
                    </header>

                    <div className="space-y-3 font-body-md text-on-surface text-sm sm:text-base leading-relaxed">
                      {patch.bullets.map((b, bIdx) => (
                        <div key={bIdx} className="flex gap-3">
                          <span className={`${b.color} font-bold text-xs mt-0.5`}>✦</span>
                          <p className="text-on-surface-variant">
                            {b.prefix}
                          </p>
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          )}

        </div>
      </main>

      {/* Footer Shell */}
      <footer className="bg-void-black border-t border-outline/10 w-full py-8 mt-auto relative z-10 select-none font-label-caps">
        <div className="flex flex-col md:flex-row justify-between items-center px-6 md:px-12 max-w-7xl mx-auto w-full gap-4 text-center md:text-left">
          <div
            className="text-sm tracking-wider text-on-surface-variant cursor-pointer"
            onClick={() => handleNavigate('LOBBY')}
            style={{ fontVariant: 'small-caps' }}
          >
            Mythic Territories
          </div>
          <div className="text-xs text-on-surface-variant">
            © 2025 Mythic Territories. All rights reserved. Ancient scripts protected.
          </div>
          <div className="flex gap-6">
            <button
              className="text-xs text-on-surface-variant hover:text-ember-gold transition-colors duration-200 cursor-pointer bg-transparent border-none"
              onClick={() => handleNavigate('GUIDE')}
            >
              Rulebook
            </button>
            <button
              className="text-xs text-ember-gold font-bold transition-colors duration-200 cursor-pointer bg-transparent border-none"
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
