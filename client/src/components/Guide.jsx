import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { loadGsap } from '../services/gsap.js';
import '@/styles/rules.css';
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left.js';
import BookOpen from 'lucide-react/dist/esm/icons/book-open.js';
import Clock3 from 'lucide-react/dist/esm/icons/clock-3.js';
import Flame from 'lucide-react/dist/esm/icons/flame.js';
import Flag from 'lucide-react/dist/esm/icons/flag.js';
import Footprints from 'lucide-react/dist/esm/icons/footprints.js';
import Landmark from 'lucide-react/dist/esm/icons/landmark.js';
import Map from 'lucide-react/dist/esm/icons/map.js';
import ScrollText from 'lucide-react/dist/esm/icons/scroll-text.js';
import Search from 'lucide-react/dist/esm/icons/search.js';
import SettingsIcon from 'lucide-react/dist/esm/icons/settings.js';
import Shield from 'lucide-react/dist/esm/icons/shield.js';
import Snowflake from 'lucide-react/dist/esm/icons/snowflake.js';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles.js';
import Swords from 'lucide-react/dist/esm/icons/swords.js';
import Target from 'lucide-react/dist/esm/icons/target.js';
import Users from 'lucide-react/dist/esm/icons/users.js';
import X from 'lucide-react/dist/esm/icons/x.js';
import Zap from 'lucide-react/dist/esm/icons/zap.js';

import {
  UNIT_PROFILES,
  ASCENSION_ROLES,
  QUICK_STEPS,
  RULEBOOK_TABS,
  COMMON_RULES,
  TERRAIN_RULES,
  STATUS_RULES,
  toRulebookId,
  RULEBOOK_SEARCH_INDEX
} from '../data/guideData.jsx';

export default function Guide({ navigateTo }) {
  const [activeTab, setActiveTab] = useState('QUICK');
  const [activeFaction, setActiveFaction] = useState('snow');
  const [ascFaction, setAscFaction] = useState('snow');
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingSearchTarget, setPendingSearchTarget] = useState(null);
  const [tabIndicator, setTabIndicator] = useState(null);
  const pageRef = useRef(null);
  const tabNavRef = useRef(null);
  const tabRefs = useRef({});
  const searchResults = useMemo(() => {
    const terms = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    return RULEBOOK_SEARCH_INDEX
      .filter((entry) => {
        const haystack = `${entry.title} ${entry.description} ${entry.keywords}`.toLowerCase();
        return terms.every((term) => haystack.includes(term));
      })
      .slice(0, 10);
  }, [searchQuery]);

  // Entrance — slide up + fade in
  useEffect(() => {
    let active = true;
    let entrance = null;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      if (pageRef.current) pageRef.current.style.opacity = '1';
      return;
    }
    loadGsap().then(gsap => {
      if (!active || !pageRef.current) return;
      entrance = gsap.fromTo(pageRef.current,
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out', clearProps: 'transform' }
      );
    });
    return () => {
      active = false;
      if (entrance) entrance.kill();
    };
  }, []);

  useLayoutEffect(() => {
    const nav = tabNavRef.current;
    const activeButton = tabRefs.current[activeTab];
    if (!nav || !activeButton) return;

    const updateIndicator = () => {
      setTabIndicator({
        x: activeButton.offsetLeft,
        y: activeButton.offsetTop,
        width: activeButton.offsetWidth,
        height: activeButton.offsetHeight
      });
    };

    updateIndicator();
    const observer = new ResizeObserver(updateIndicator);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [activeTab]);

  useEffect(() => {
    if (!pendingSearchTarget) return;
    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById(pendingSearchTarget);
      if (!target) return;

      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
      if (!reduceMotion) {
        target.animate(
          [
            { boxShadow: '0 0 0 1px rgba(232, 193, 94, 0)', transform: 'translateY(0)' },
            { boxShadow: '0 0 0 2px rgba(232, 193, 94, 0.8), 0 0 35px rgba(232, 193, 94, 0.28)', transform: 'translateY(-2px)' },
            { boxShadow: '0 0 0 1px rgba(232, 193, 94, 0)', transform: 'translateY(0)' }
          ],
          { duration: 1400, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' }
        );
      }
      setPendingSearchTarget(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeTab, activeFaction, pendingSearchTarget]);

  // Exit — slide down + fade, then navigate
  const handleNavigate = (dest) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      navigateTo(dest);
      return;
    }
    loadGsap().then(gsap => {
      if (pageRef.current) {
        gsap.to(pageRef.current, {
          opacity: 0, y: -15, duration: 0.25, ease: 'power2.in',
          onComplete: () => navigateTo(dest)
        });
      } else {
        navigateTo(dest);
      }
    });
  };

  const handleSearchResult = (result) => {
    setPendingSearchTarget(result.target);
    setActiveTab(result.tab);
    if (result.faction) setActiveFaction(result.faction);
    setSearchQuery('');
  };

  return (
    <>
      {/* Viewport-fixed background rendered outside the page container to prevent any height shifting */}
      <div
        className="fixed inset-0 z-0 pointer-events-none overflow-hidden"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 0
        }}
      >
        <img
          src="/images/menu-bg.webp"
          alt=""
          className="w-full h-full object-cover object-center pointer-events-none select-none opacity-25"
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }}
          fetchPriority="high"
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/80 via-slate-900/60 to-slate-900/90" />
        <div className="absolute inset-y-0 left-0 w-1/2 bg-[radial-gradient(circle_at_0%_50%,rgba(137,206,255,0.12),transparent_60%)]" />
        <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_100%_50%,rgba(239,68,68,0.10),transparent_60%)]" />
      </div>

      <div ref={pageRef} className="relative z-10 min-h-screen flex flex-col text-slate-100 select-text font-sans overflow-y-auto" style={{ opacity: 0 }}>
        {/* Navigation */}
        <header className="sticky top-0 w-full z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-700/60 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
          <div className="flex justify-between items-center w-full px-4 md:px-12 py-3.5 max-w-6xl mx-auto">
            <button
              onClick={() => handleNavigate('LOBBY')}
              className="group flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-1" />
              <span>Back</span>
            </button>
            <span className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Rulebook</span>
          </div>

          {/* Search Bar shifted directly beneath the top bar */}
          <div className="w-full border-t border-slate-800 bg-slate-900/60 backdrop-blur-md px-4 md:px-12 py-2.5">
            <div className="max-w-4xl mx-auto relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search rules, statuses, units, or abilities…"
                className="h-10 w-full rounded-lg border border-slate-700/80 bg-slate-800/80 py-2 pl-10 pr-20 text-xs sm:text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-400 focus:border-amber-400/70 focus:ring-1 focus:ring-amber-400/40"
                aria-label="Search rules, statuses, units, or abilities"
              />
              {searchQuery && (
                <button
                  className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded px-2 py-0.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear rulebook search"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Clear</span>
                </button>
              )}

              {searchQuery.trim() && (
                <div className="absolute left-0 right-0 top-full mt-2 overflow-hidden rounded-xl border border-slate-700 bg-slate-900/95 shadow-2xl backdrop-blur-xl z-50">
                  <div className="flex items-center justify-between border-b border-slate-700/80 px-4 py-2.5">
                    <p className="text-xs text-slate-400">
                      {searchResults.length ? `${searchResults.length} matching entries` : 'No matching entries'}
                    </p>
                    <p className="hidden text-xs text-slate-500 sm:block">Click an entry to jump directly</p>
                  </div>
                  {searchResults.length > 0 ? (
                    <div className="max-h-80 overflow-y-auto p-2">
                      {searchResults.map((result, index) => (
                        <button
                          key={`${result.tab}-${result.title}-${index}`}
                          className="flex w-full items-start justify-between gap-3 rounded-lg p-2.5 text-left transition-colors hover:bg-slate-800 cursor-pointer"
                          onClick={() => handleSearchResult(result)}
                        >
                          <div>
                            <span className="font-medium text-xs sm:text-sm text-white">{result.title}</span>
                            <p className="line-clamp-1 text-xs text-slate-400 mt-0.5">{result.description}</p>
                          </div>
                          <span className="shrink-0 text-[10px] uppercase font-semibold tracking-wider text-amber-400 px-2 py-0.5 rounded bg-amber-400/10 border border-amber-400/20">
                            {result.tab}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-xs text-slate-400">
                      No rule or unit found matching "{searchQuery}"
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="relative z-10 flex-grow pt-8 pb-20 px-4 md:px-8 max-w-5xl mx-auto w-full">
          {/* Horizontal Slider Tab Navigation (No Line Wrapping) */}
          <div className="mb-8 w-full border-b border-slate-700/60 pb-3">
            <nav
              ref={tabNavRef}
              aria-label="Rulebook sections"
              className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1 px-1 sm:justify-center scroll-smooth"
            >
              {RULEBOOK_TABS.map((tab) => {
                const Icon = tab.icon;
                const selected = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    ref={(element) => { tabRefs.current[tab.id] = element; }}
                    className={`relative shrink-0 whitespace-nowrap flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-medium transition-all duration-150 cursor-pointer rounded-lg ${selected
                      ? 'text-amber-400 font-semibold bg-amber-400/10 border border-amber-400/30 shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60 border border-transparent'
                      }`}
                    onClick={() => {
                      setActiveTab(tab.id);
                      tabRefs.current[tab.id]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                    }}
                    aria-pressed={selected}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* ═══════════════════════════ QUICK READ TAB ═══════════════════════════ */}
          {activeTab === 'QUICK' && (
            <div className="space-y-12 animate-[fadeIn_0.3s_ease-out]">
              {/* Header Overview */}
              <div className="border-b border-slate-800 pb-8">
                <div className="flex items-center gap-2 mb-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-[10px] uppercase font-bold tracking-[0.25em] text-amber-400">Three-Minute Briefing</span>
                </div>
                <h1 className="font-almendra text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-wide">
                  The Battle at a Glance
                </h1>
                <p className="mt-2 text-sm text-slate-300 leading-relaxed max-w-3xl">
                  Mythic Territories is a turn-based contest of positioning and power. Claim ground, unleash faction abilities,
                  control ancient landmarks, and orchestrate the lethal opening that vanquishes the enemy leader.
                </p>
              </div>

              {/* Five Quick Steps - Clean List (Open, Unboxed) */}
              <section aria-labelledby="quick-steps-heading">
                <div className="mb-6 flex items-end justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-slate-400">Tactical Fundamentals</span>
                    <h2 id="quick-steps-heading" className="font-almendra text-2xl sm:text-3xl font-bold text-white tracking-wide mt-0.5">
                      Five Rules to Start Playing
                    </h2>
                  </div>
                  <button
                    className="text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer hidden sm:block"
                    onClick={() => setActiveTab('RULES')}
                  >
                    Read common rules →
                  </button>
                </div>

                <div className="divide-y divide-slate-800/80">
                  {QUICK_STEPS.map((step) => {
                    const Icon = step.icon;
                    return (
                      <article id={`quick-${toRulebookId(step.title)}`} key={step.number} className="py-4.5 flex items-start gap-4 scroll-mt-36">
                        <span className="font-mono text-base font-bold text-amber-400/90 pt-0.5 shrink-0 w-7">
                          {step.number}
                        </span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-slate-300" aria-hidden="true" />
                            <h3 className="font-almendra text-lg font-bold text-white tracking-wide">{step.title}</h3>
                          </div>
                          <p className="mt-1 text-xs text-slate-300 leading-relaxed max-w-2xl">{step.description}</p>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>

              {/* Factions Introduction */}
              <section className="pt-6 border-t border-slate-800">
                <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-slate-400">Warring Domains</span>
                <h2 className="font-almendra text-2xl sm:text-3xl font-bold text-white tracking-wide mt-0.5 mb-6">
                  Choose Your Allegiance
                </h2>

                <div className="grid gap-6 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-800">
                  <div className="pr-0 sm:pr-6 space-y-2">
                    <div className="flex items-center gap-2">
                      <Snowflake className="h-4 w-4 text-cyan-400" aria-hidden="true" />
                      <h3 className="font-almendra text-xl font-bold text-cyan-300 tracking-wide">The Frost Host</h3>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Control space with glacial terrain, defensive wards, healing, and persistent tactical disruption.
                    </p>
                    <button className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer inline-flex items-center gap-1 pt-1" onClick={() => { setActiveFaction('snow'); setActiveTab('UNITS'); }}>
                      <span>Explore Frost units</span>
                      <span>→</span>
                    </button>
                  </div>

                  <div className="pt-6 sm:pt-0 sm:pl-6 space-y-2">
                    <div className="flex items-center gap-2">
                      <Flame className="h-4 w-4 text-rose-400" aria-hidden="true" />
                      <h3 className="font-almendra text-xl font-bold text-rose-400 tracking-wide">The Ash Legion</h3>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Break formations with volatile ground hazards, direct damage, forced displacement, and aggressive attacks.
                    </p>
                    <button className="text-xs font-semibold text-rose-400 hover:text-rose-300 transition-colors cursor-pointer inline-flex items-center gap-1 pt-1" onClick={() => { setActiveFaction('ash'); setActiveTab('UNITS'); }}>
                      <span>Explore Ash units</span>
                      <span>→</span>
                    </button>
                  </div>
                </div>
              </section>

              {/* Essential Terms Glossary */}
              <section className="pt-6 border-t border-slate-800">
                <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-slate-400">Core Concepts</span>
                <h2 className="font-almendra text-2xl sm:text-3xl font-bold text-white tracking-wide mt-0.5 mb-4">
                  Glossary
                </h2>
                <div className="divide-y divide-slate-800/80">
                  {[
                    { term: 'Agility', definition: 'How far a unit can move.', icon: Footprints },
                    { term: 'Dynamic Power', definition: 'Dynamic Strength & Defense modified by boosts, status, and terrain.', icon: Zap },
                    { term: 'Territory', definition: 'Claimed squares showing your faction’s control and presence across the map.', icon: Map },
                    { term: 'Dazed', definition: 'The unit cannot act this turn.', icon: Shield }
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.term} className="py-3 flex items-start gap-3">
                        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
                        <div>
                          <span className="font-almendra text-sm font-bold text-white tracking-wide">{item.term}</span>
                          <span className="text-xs text-slate-500 mx-2">—</span>
                          <span className="text-xs text-slate-300">{item.definition}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          )}

          {/* ═══════════════════════════ COMMON RULES TAB ═══════════════════════════ */}
          {activeTab === 'RULES' && (
            <div className="space-y-12 animate-[fadeIn_0.3s_ease-out]">
              {/* Victory Condition */}
              <div className="border-b border-slate-800 pb-8">
                <div className="flex items-center gap-2 mb-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-[10px] uppercase font-bold tracking-[0.25em] text-amber-400">Goal of the Game</span>
                </div>
                <h1 className="font-almendra text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-wide">
                  Defeat the Enemy Leader
                </h1>
                <p className="mt-2 text-sm text-slate-300 leading-relaxed max-w-3xl">
                  Kill the opposing Frost Lord or Ash Tyrant. Once the enemy leader's HP reaches 0, you win immediately.
                </p>
              </div>

              {/* Shared Foundation Rules */}
              <section aria-labelledby="foundation-heading">
                <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-slate-400">Basic Rules</span>
                <h2 id="foundation-heading" className="font-almendra text-2xl sm:text-3xl font-bold text-white tracking-wide mt-0.5 mb-6">
                  How Turns Work
                </h2>

                <div className="divide-y divide-slate-800/80">
                  {COMMON_RULES.map((rule) => {
                    const Icon = rule.icon;
                    return (
                      <article id={`rule-${toRulebookId(rule.title)}`} key={rule.title} className="py-4.5 flex items-start gap-4 scroll-mt-36">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-amber-400 border border-slate-700/60 mt-0.5">
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div>
                          <h3 className="font-almendra text-lg font-bold text-white tracking-wide">{rule.title}</h3>
                          <p className="mt-1 text-xs leading-relaxed text-slate-300 max-w-2xl">{rule.description}</p>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>

              {/* Dynamic Combat & Territory Section */}
              <section className="pt-6 border-t border-slate-800">
                <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-slate-400">Attacking & Board</span>
                <h2 className="font-almendra text-2xl sm:text-3xl font-bold text-white tracking-wide mt-0.5 mb-6">
                  Fighting and Tiles
                </h2>

                <div className="grid gap-8 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800">
                  {/* Combat */}
                  <div id="rule-effective-power" className="pr-0 md:pr-6 scroll-mt-36 space-y-4">
                    <div className="flex items-center gap-2.5">
                      <Swords className="h-5 w-5 text-rose-400" aria-hidden="true" />
                      <h3 className="font-almendra text-xl font-bold text-white tracking-wide">Attacking Enemies</h3>
                    </div>

                    <div className="space-y-3 text-xs text-slate-300">
                      <div className="flex items-start gap-2.5">
                        <span className="text-amber-400 font-bold">1.</span>
                        <span className="leading-relaxed">Walk onto an enemy unit to hit them.</span>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <span className="text-amber-400 font-bold">2.</span>
                        <span className="leading-relaxed">Damage = your <strong className="text-amber-300 font-medium">Strength</strong> minus their <strong className="text-cyan-300 font-medium">Defense</strong> (always deals at least 1 damage).</span>
                      </div>
                      <div className="flex items-start gap-2.5">
                        <span className="text-amber-400 font-bold">3.</span>
                        <span className="leading-relaxed">Their HP goes down. When HP reaches 0, the unit dies and leaves the board.</span>
                      </div>
                    </div>
                  </div>

                  {/* Territory */}
                  <div className="pt-6 md:pt-0 md:pl-6 space-y-4">
                    <div className="flex items-center gap-2.5">
                      <Map className="h-5 w-5 text-amber-400" aria-hidden="true" />
                      <h3 className="font-almendra text-xl font-bold text-white tracking-wide">Claiming Tiles</h3>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-300">
                      Moving onto an empty square paints it in your team’s color and claims it for your faction.
                    </p>
                    <p className="text-xs text-slate-400 leading-relaxed border-l-2 border-amber-400/50 pl-3">
                      More tiles on the board trigger unit abilities and give your team map control.
                    </p>
                  </div>
                </div>
              </section>

              {/* Landmarks */}
              <section aria-labelledby="landmarks-heading" className="pt-6 border-t border-slate-800">
                <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-slate-400">Special Buildings</span>
                <h2 id="landmarks-heading" className="font-almendra text-2xl sm:text-3xl font-bold text-white tracking-wide mt-0.5 mb-6">
                  Shrine and Rifts
                </h2>

                <div className="grid gap-8 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800">
                  {/* Shrine */}
                  <article id="rule-sacred-shrine" className="pr-0 md:pr-6 scroll-mt-36 space-y-4">
                    <div className="flex items-center gap-2.5">
                      <Landmark className="h-5 w-5 text-amber-400" aria-hidden="true" />
                      <h3 className="font-almendra text-xl font-bold text-amber-300 tracking-wide">The Center Shrine</h3>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-300">
                      A 2×2 zone in the center. Killing an enemy here gives your unit permanent <span className="font-semibold text-amber-300">+1 Power</span> and adds 1 charge.
                    </p>
                    <div className="space-y-2 text-xs">
                      <div className="border-l-2 border-amber-400/50 pl-3 py-0.5">
                        <span className="font-semibold text-amber-300">At 2 charges:</span>
                        <span className="text-slate-300 ml-1.5">The Shrine overloads and traps the unit inside.</span>
                      </div>
                      <div className="border-l-2 border-rose-400/50 pl-3 py-0.5">
                        <span className="font-semibold text-rose-300">Release:</span>
                        <span className="text-slate-300 ml-1.5">Free the trapped unit: lose 1 Power and skip 3 turns.</span>
                      </div>
                    </div>
                    <button className="text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer inline-flex items-center gap-1 pt-1" onClick={() => setActiveTab('ASCENSION')}>
                      <span>See Ascension rewards</span>
                      <span>→</span>
                    </button>
                  </article>

                  {/* Power Rifts */}
                  <article id="rule-power-rifts-and-conduit" className="pt-6 md:pt-0 md:pl-6 scroll-mt-36 space-y-4">
                    <div className="flex items-center gap-2.5">
                      <Zap className="h-5 w-5 text-purple-400" aria-hidden="true" />
                      <h3 className="font-almendra text-xl font-bold text-purple-300 tracking-wide">Corner Rifts</h3>
                    </div>
                    <p className="text-xs leading-relaxed text-slate-300">
                      Two 3×3 Rifts in opposite corners. Put at least one friendly unit on each Rift to connect them.
                    </p>
                    <div className="space-y-2 text-xs">
                      <div className="border-l-2 border-emerald-400/50 pl-3 py-0.5">
                        <span className="font-semibold text-emerald-300">Uncontested:</span>
                        <span className="text-slate-300 ml-1.5">Both units on the Rifts gain +2 Power and a shield.</span>
                      </div>
                      <div className="border-l-2 border-amber-400/50 pl-3 py-0.5">
                        <span className="font-semibold text-amber-300">Contested:</span>
                        <span className="text-slate-300 ml-1.5">If an enemy steps onto a Rift, your bonus drops to +1.</span>
                      </div>
                    </div>
                  </article>
                </div>
              </section>

              {/* Special Terrain & Status Reference */}
              <section className="pt-6 border-t border-slate-800">
                <div className="grid gap-8 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-800">
                  {/* Terrain */}
                  <div className="pr-0 md:pr-6 space-y-4">
                    <div className="flex items-center gap-2.5">
                      <Map className="h-5 w-5 text-cyan-400" aria-hidden="true" />
                      <h3 className="font-almendra text-xl font-bold text-white tracking-wide">Special Terrain</h3>
                    </div>
                    <div className="divide-y divide-slate-800/80">
                      {TERRAIN_RULES.map((terrain) => (
                        <div id={`terrain-${toRulebookId(terrain.name)}`} key={terrain.name} className="py-2.5 scroll-mt-36">
                          <h4 className={`font-almendra text-sm font-bold tracking-wide ${terrain.color}`}>{terrain.name}</h4>
                          <p className="mt-0.5 text-xs text-slate-300 leading-relaxed">{terrain.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Status */}
                  <div className="pt-6 md:pt-0 md:pl-6 space-y-4">
                    <div className="flex items-center gap-2.5">
                      <Shield className="h-5 w-5 text-amber-400" aria-hidden="true" />
                      <h3 className="font-almendra text-xl font-bold text-white tracking-wide">Status Reference</h3>
                    </div>
                    <div className="divide-y divide-slate-800/80">
                      {STATUS_RULES.map((status) => (
                        <div id={`status-${toRulebookId(status.name)}`} key={status.name} className="py-2.5 scroll-mt-36">
                          <h4 className={`font-almendra text-sm font-bold tracking-wide ${status.color}`}>{status.name}</h4>
                          <p className="mt-0.5 text-xs text-slate-300 leading-relaxed">{status.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* ═══════════════════════════ ASCENSION TAB ═══════════════════════════ */}
          {activeTab === 'ASCENSION' && (
            <div className="space-y-12 animate-[fadeIn_0.3s_ease-out]">
              <div className="border-b border-slate-800 pb-8">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-amber-400" aria-hidden="true" />
                  <span className="text-xs uppercase tracking-widest text-amber-400 font-semibold">Special Mechanics</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-medium text-white tracking-tight">Ascension Paths</h1>
                <p className="mt-2 text-sm text-slate-300 leading-relaxed max-w-3xl">
                  When a faction's unit is <span className="text-rose-400 font-semibold">Trapped</span> on the Overloaded
                  Shrine, their controller may <span className="text-amber-400 font-semibold">Sacrifice</span> it to unlock
                  a permanent Ascension. Choose between <span className="text-amber-400 font-semibold">Option A</span> (targeted unit upgrade) or{' '}
                  <span className="text-emerald-400 font-semibold">Option B</span> (faction-wide passive buff).
                </p>

                {/* Clean Segmented Filter */}
                <div className="mt-6 inline-flex rounded-lg bg-slate-800/80 p-1 border border-slate-700/60">
                  <button
                    className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${ascFaction === 'both' ? 'bg-amber-400 text-slate-950 font-semibold shadow-sm' : 'text-slate-300 hover:text-white'
                      }`}
                    onClick={() => setAscFaction('both')}
                  >All Roles</button>
                  <button
                    className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${ascFaction === 'snow' ? 'bg-cyan-400 text-slate-950 font-semibold shadow-sm' : 'text-slate-300 hover:text-white'
                      }`}
                    onClick={() => setAscFaction('snow')}
                  >Frost</button>
                  <button
                    className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${ascFaction === 'ash' ? 'bg-rose-500 text-white font-semibold shadow-sm' : 'text-slate-300 hover:text-white'
                      }`}
                    onClick={() => setAscFaction('ash')}
                  >Ash</button>
                </div>
              </div>

              {/* Roles List - Clean Line-Separated Entries */}
              <div className="divide-y divide-slate-800/80">
                {ASCENSION_ROLES.map((r) => (
                  <article id={`ascension-${toRulebookId(r.role)}`} key={r.role} className="py-6 scroll-mt-36">
                    <div className="flex items-center justify-between gap-4 mb-3">
                      <h2 className="text-lg font-semibold text-white tracking-wide">{r.role}</h2>
                      <div className="flex gap-3 text-xs">
                        {(ascFaction === 'snow' || ascFaction === 'both') && (
                          <span className="text-cyan-300">❄ {r.snow}</span>
                        )}
                        {(ascFaction === 'ash' || ascFaction === 'both') && (
                          <span className="text-rose-400">🔥 {r.ash}</span>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-800/80">
                      <div className="pr-0 sm:pr-4 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-400/15 text-amber-300 uppercase tracking-wide">Option A</span>
                          <span className="text-xs font-semibold text-white">{r.A.name}</span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed pt-1">
                          {ascFaction === 'snow' ? r.A.snowDesc || r.A.desc
                            : ascFaction === 'ash' ? r.A.ashDesc || r.A.desc
                              : r.A.desc}
                        </p>
                      </div>

                      <div className="pt-4 sm:pt-0 sm:pl-4 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-400/15 text-emerald-300 uppercase tracking-wide">Option B</span>
                          <span className="text-xs font-semibold text-white">{r.B.name}</span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed pt-1">{r.B.desc}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {/* ═══════════════════════════ UNITS TAB ═══════════════════════════ */}
          {activeTab === 'UNITS' && (
            <div className="space-y-12 animate-[fadeIn_0.3s_ease-out]">
              <div className="border-b border-slate-800 pb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                  <div className={`flex items-center gap-2 mb-2 ${activeFaction === 'snow' ? 'text-cyan-400' : 'text-rose-400'}`}>
                    {activeFaction === 'snow' ? <Snowflake className="h-4 w-4" aria-hidden="true" /> : <Flame className="h-4 w-4" aria-hidden="true" />}
                    <span className="text-xs uppercase tracking-widest font-semibold">Unit Catalog</span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-medium text-white tracking-tight">
                    {activeFaction === 'snow' ? 'The Frost Host' : 'The Ash Legion'}
                  </h1>
                  <p className="mt-2 text-sm text-slate-300 leading-relaxed max-w-2xl">
                    {activeFaction === 'snow'
                      ? 'A disciplined force built around control, protection, healing, and glacial terrain.'
                      : 'An aggressive force built around direct damage, disruption, hazards, and relentless pressure.'}
                  </p>
                </div>

                {/* Faction Segmented Selector */}
                <div className="inline-flex rounded-lg bg-slate-800/80 p-1 border border-slate-700/60 self-start md:self-auto shrink-0">
                  <button
                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                      activeFaction === 'snow'
                        ? 'bg-cyan-400 text-slate-950 font-semibold shadow-sm'
                        : 'text-slate-300 hover:text-white'
                    }`}
                    onClick={() => setActiveFaction('snow')}
                  >
                    <Snowflake className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Frost Host</span>
                  </button>
                  <button
                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                      activeFaction === 'ash'
                        ? 'bg-rose-500 text-white font-semibold shadow-sm'
                        : 'text-slate-300 hover:text-white'
                    }`}
                    onClick={() => setActiveFaction('ash')}
                  >
                    <Flame className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Ash Legion</span>
                  </button>
                </div>
              </div>

              {/* Units Grid - Clean Line-Separated Entries with Portrait and Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {UNIT_PROFILES[activeFaction].map((unit) => (
                  <article
                    id={`unit-${activeFaction}-${toRulebookId(unit.name)}`}
                    key={`${activeFaction}-${unit.name}`}
                    className="scroll-mt-36 flex flex-col justify-between border-b border-slate-800/80 pb-6"
                  >
                    <div>
                      {/* Portrait Header */}
                      <div className="relative h-44 bg-slate-900/60 rounded-xl overflow-hidden border border-slate-800/80 flex items-center justify-center mb-4">
                        <img
                          src={unit.portrait}
                          alt={unit.name}
                          loading="lazy"
                          decoding="async"
                          className="w-32 h-32 object-contain hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute top-2.5 left-2.5">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border uppercase tracking-wide ${
                            activeFaction === 'snow'
                              ? 'bg-cyan-950/70 text-cyan-300 border-cyan-500/30'
                              : 'bg-rose-950/70 text-rose-300 border-rose-500/30'
                          }`}>
                            {unit.role}
                          </span>
                        </div>
                      </div>

                      {/* Name & Title */}
                      <h2 className="text-lg font-semibold text-white tracking-wide">{unit.name}</h2>
                      <p className="text-xs text-slate-400 italic mt-0.5 mb-3">{unit.title}</p>

                      {/* Stats Inline Bar */}
                      <div className="grid grid-cols-5 gap-1 text-center py-2 border-y border-slate-800/80 mb-4">
                        {Object.entries(unit.stats).map(([stat, val]) => (
                          <div key={stat}>
                            <div className="text-[9px] text-slate-400 uppercase font-medium">{stat}</div>
                            <div className="text-xs font-bold text-white font-mono mt-0.5">{val}</div>
                          </div>
                        ))}
                      </div>

                      {/* Abilities */}
                      <div className="space-y-2">
                        {unit.abilities.map((ability, abIdx) => (
                          <div key={abIdx} className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[9px] px-1 py-0.2 rounded font-semibold uppercase ${
                                ability.type === 'Active'
                                  ? 'text-amber-300'
                                  : ability.type === 'Veteran'
                                    ? 'text-blue-300'
                                    : 'text-emerald-300'
                              }`}>
                                [{ability.type}]
                              </span>
                              <span className="text-xs font-semibold text-slate-200">{ability.name}</span>
                            </div>
                            <p className="text-[11px] text-slate-300 leading-relaxed pl-1">{ability.desc}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </main>

        {/* Minimal Footer matching Settings & Notes */}
        <footer className="w-full border-t border-slate-800 py-6 text-xs text-slate-400 mt-auto">
          <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span>Mythic Territories</span>
            <div className="flex gap-6">
              <button
                onClick={() => handleNavigate('GUIDE')}
                className="text-amber-400 transition-colors cursor-pointer flex items-center gap-1.5 font-medium"
              >
                <BookOpen className="h-3.5 w-3.5" />
                <span>Rules</span>
              </button>
              <button
                onClick={() => handleNavigate('NOTES')}
                className="hover:text-slate-200 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <ScrollText className="h-3.5 w-3.5" />
                <span>Updates</span>
              </button>
              <button
                onClick={() => handleNavigate('SETTINGS')}
                className="hover:text-slate-200 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <SettingsIcon className="h-3.5 w-3.5" />
                <span>Settings</span>
              </button>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
