import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import gsap from 'gsap';
import '@/styles/rules.css';
import {
  ArrowLeft,
  BookOpen,
  Clock3,
  Flame,
  Flag,
  Footprints,
  Landmark,
  Map,
  Search,
  Settings as SettingsIcon,
  Shield,
  Snowflake,
  Sparkles,
  Swords,
  Target,
  Users,
  X,
  Zap,
} from 'lucide-react';

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
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(pageRef.current, { opacity: 1, y: 0 });
      return;
    }
    const entrance = gsap.fromTo(pageRef.current,
      { opacity: 0, y: 40 },
      { opacity: 1, y: 0, duration: 0.75, ease: 'expo.out' }
    );
    return () => entrance.kill();
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
    gsap.to(pageRef.current, {
      opacity: 0, y: 50, duration: 0.32, ease: 'power2.in',
      onComplete: () => navigateTo(dest)
    });
  };

  const handleSearchResult = (result) => {
    setPendingSearchTarget(result.target);
    setActiveTab(result.tab);
    if (result.faction) setActiveFaction(result.faction);
    setSearchQuery('');
  };

  return (
    <div ref={pageRef} className="relative min-h-screen flex flex-col bg-void-black text-on-surface select-text font-body-md overflow-y-auto" style={{ opacity: 0 }}>
      {/* Background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="sticky top-0 w-full h-screen">
          <div
            className="absolute inset-0 opacity-40 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: "url('/images/menu-bg.webp')" }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-void-black/40 via-transparent to-void-black/90" />
        </div>
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-void-black/70 backdrop-blur-md border-b border-outline/20 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
        <div className="flex justify-between items-center w-full px-4 md:px-12 py-4 max-w-7xl mx-auto">
          <button
            className="font-almendra text-lg sm:text-2xl tracking-wider text-ember-gold cursor-pointer"
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

      {/* Main Content */}
      <main className="relative z-10 flex-grow pt-32 pb-20 px-4 md:px-12 max-w-6xl mx-auto w-full">
        <header className="text-center mb-10 space-y-4">
          <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-outline/20 bg-void-black/40 px-3 py-1.5 font-label-caps text-[9px] tracking-[0.24em] text-on-surface-variant">
            <BookOpen className="h-3.5 w-3.5 text-ember-gold" aria-hidden="true" />
            Ruleset 1.9
          </div>
          <h1 className="font-almendra text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-gradient-dual uppercase">
            Rulebook
          </h1>
          <p className="text-base sm:text-lg text-on-surface-variant max-w-2xl mx-auto leading-relaxed">
            Learn the battle in minutes, explore shared mechanics, then study the warriors unique to Frost and Ash.
          </p>
        </header>

        {/* Tab Selection */}
        <div ref={tabNavRef} className="relative mb-8 grid grid-cols-2 gap-2 rounded-2xl border border-outline/15 bg-void-black/45 p-2 backdrop-blur-xl md:grid-cols-4">
          {tabIndicator && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute rounded-xl bg-ember-gold shadow-[0_8px_25px_rgba(232,193,94,0.18)] transition-[transform,width,height] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
              style={{
                width: tabIndicator.width,
                height: tabIndicator.height,
                transform: `translate3d(${tabIndicator.x}px, ${tabIndicator.y}px, 0)`
              }}
            />
          )}
          {RULEBOOK_TABS.map((tab) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                ref={(element) => { tabRefs.current[tab.id] = element; }}
                className={`relative z-10 flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 py-3 text-center font-label-caps text-[10px] sm:text-xs font-bold tracking-wider transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-gold ${
                  selected
                    ? 'text-void-black'
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-white'
                }`}
                onClick={() => setActiveTab(tab.id)}
                aria-pressed={selected}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <section className="relative z-30 mb-8" aria-label="Search the rulebook">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search rules, statuses, units, or abilities…"
              className="h-12 w-full rounded-xl border border-outline/20 bg-void-black/65 py-3 pl-11 pr-24 text-sm text-on-surface outline-none backdrop-blur-xl transition-colors placeholder:text-on-surface-variant/50 focus:border-ember-gold/60 focus:ring-2 focus:ring-ember-gold/15"
              aria-label="Search rules, statuses, units, or abilities"
            />
            {searchQuery && (
              <button
                className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1.5 rounded-lg px-2 py-1.5 font-label-caps text-[9px] tracking-wider text-on-surface-variant transition-colors hover:bg-surface-container hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-gold"
                onClick={() => setSearchQuery('')}
                aria-label="Clear rulebook search"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                Clear
              </button>
            )}
          </div>

          {searchQuery.trim() && (
            <div className="mt-2 overflow-hidden rounded-xl border border-outline/20 bg-void-black/95 shadow-[0_24px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl">
              <div className="flex items-center justify-between border-b border-outline/15 px-4 py-3">
                <p className="font-label-caps text-[9px] tracking-[0.18em] text-on-surface-variant">
                  {searchResults.length ? `${searchResults.length} matching entries` : 'No matching entries'}
                </p>
                <p className="hidden text-[10px] text-on-surface-variant/55 sm:block">Search remains active when changing sections</p>
              </div>
              {searchResults.length > 0 ? (
                <div className="max-h-80 overflow-y-auto p-2">
                  {searchResults.map((result, index) => (
                    <button
                      key={`${result.tab}-${result.title}-${index}`}
                      className="group flex w-full items-start justify-between gap-4 rounded-lg px-3 py-3 text-left transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-gold"
                      onClick={() => handleSearchResult(result)}
                    >
                      <div className="min-w-0">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="font-label-caps text-[8px] tracking-widest text-ember-gold">{result.section}</span>
                          {result.faction && (
                            <span className={`font-label-caps text-[8px] tracking-widest ${result.faction === 'snow' ? 'text-ice-light' : 'text-magma-core'}`}>
                              {result.faction}
                            </span>
                          )}
                        </div>
                        <h3 className="text-sm font-semibold text-on-surface">{result.title}</h3>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-on-surface-variant">{result.description}</p>
                      </div>
                      <ArrowLeft className="mt-1 h-4 w-4 shrink-0 rotate-180 text-on-surface-variant transition-transform group-hover:translate-x-1 group-hover:text-ember-gold" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm text-on-surface-variant">Try a unit name, “Conduit,” “Dazed,” or an ability.</p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* ═══════════════════════════ QUICK READ TAB ═══════════════════════════ */}
        {activeTab === 'QUICK' && (
          <div className="space-y-7 animate-[fadeIn_0.3s_ease-out]">
            <section className="overflow-hidden rounded-2xl border border-ember-gold/20 bg-gradient-to-br from-ember-gold/10 via-surface-container/80 to-void-black/95 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.3)] sm:p-9">
              <div className="grid items-center gap-8 lg:grid-cols-[1fr_auto]">
                <div>
                  <div className="mb-3 flex items-center gap-2 font-label-caps text-[10px] tracking-[0.22em] text-ember-gold">
                    <Clock3 className="h-4 w-4" aria-hidden="true" />
                    Three-minute briefing
                  </div>
                  <h2 className="font-almendra text-3xl font-bold text-on-surface sm:text-4xl">The battle at a glance</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-on-surface-variant sm:text-base">
                    Mythic Territories is a turn-based contest of positioning and power. Claim ground, use faction abilities,
                    control ancient landmarks, and create the opening that brings down the enemy leader.
                  </p>
                </div>
                <div className="flex shrink-0 items-center justify-center gap-3">
                  <div className="h-20 w-20 overflow-hidden rounded-xl border border-ice-light/40 bg-ice-light/5 sm:h-24 sm:w-24">
                    <img src="/units/frost-lord.webp" alt="Frost Lord" className="h-full w-full object-cover" />
                  </div>
                  <Swords className="h-6 w-6 text-ember-gold" aria-hidden="true" />
                  <div className="h-20 w-20 overflow-hidden rounded-xl border border-magma-core/40 bg-magma-core/5 sm:h-24 sm:w-24">
                    <img src="/units/ash-tyrant.webp" alt="Ash Tyrant" className="h-full w-full object-cover" />
                  </div>
                </div>
              </div>
            </section>

            <section aria-labelledby="quick-steps-heading">
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <p className="font-label-caps text-[9px] tracking-[0.22em] text-ice-light">How a match works</p>
                  <h2 id="quick-steps-heading" className="mt-1 font-almendra text-2xl font-bold text-on-surface sm:text-3xl">Five rules to start playing</h2>
                </div>
                <button
                  className="hidden font-label-caps text-[10px] tracking-wider text-ember-gold hover:text-white sm:block"
                  onClick={() => setActiveTab('RULES')}
                >
                  Read common rules →
                </button>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                {QUICK_STEPS.map((step) => {
                  const Icon = step.icon;
                  return (
                    <article id={`quick-${toRulebookId(step.title)}`} key={step.number} className="scroll-mt-36 rounded-2xl border border-outline/15 bg-surface-container/65 p-5 backdrop-blur-md">
                      <div className="mb-5 flex items-center justify-between">
                        <span className={`flex h-9 w-9 items-center justify-center rounded-xl border ${step.accent}`}>
                          <Icon className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <span className="font-mono text-[10px] text-on-surface-variant/50">{step.number}</span>
                      </div>
                      <h3 className="font-label-caps text-xs font-bold tracking-wider text-on-surface">{step.title}</h3>
                      <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">{step.description}</p>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-2xl border border-ice-light/20 bg-gradient-to-br from-ice-light/10 to-surface-container/70 p-6">
                <div className="mb-4 flex items-center gap-3">
                  <Snowflake className="h-5 w-5 text-ice-light" aria-hidden="true" />
                  <h2 className="font-almendra text-2xl font-bold text-ice-light">Frost</h2>
                </div>
                <p className="text-sm leading-relaxed text-on-surface-variant">
                  Control space with glacial terrain, defensive effects, healing, and precise disruption.
                </p>
                <button className="mt-5 font-label-caps text-[10px] tracking-wider text-ice-light hover:text-white" onClick={() => { setActiveFaction('snow'); setActiveTab('UNITS'); }}>
                  Explore Frost units →
                </button>
              </div>
              <div className="rounded-2xl border border-magma-core/20 bg-gradient-to-br from-magma-core/10 to-surface-container/70 p-6">
                <div className="mb-4 flex items-center gap-3">
                  <Flame className="h-5 w-5 text-magma-core" aria-hidden="true" />
                  <h2 className="font-almendra text-2xl font-bold text-magma-core">Ash</h2>
                </div>
                <p className="text-sm leading-relaxed text-on-surface-variant">
                  Break formations with direct damage, volatile terrain, forced movement, and aggressive pressure.
                </p>
                <button className="mt-5 font-label-caps text-[10px] tracking-wider text-magma-core hover:text-white" onClick={() => { setActiveFaction('ash'); setActiveTab('UNITS'); }}>
                  Explore Ash units →
                </button>
              </div>
            </section>

            <section className="rounded-2xl border border-outline/15 bg-void-black/40 p-5 sm:p-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { term: 'Agility', definition: 'How far a unit can move.', icon: Footprints },
                  { term: 'Effective Power', definition: 'Strength plus boosts minus debuffs.', icon: Zap },
                  { term: 'Territory', definition: 'Claimed squares used to break combat ties.', icon: Map },
                  { term: 'Dazed', definition: 'The unit cannot act this turn.', icon: Shield }
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.term} className="flex gap-3">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ember-gold" aria-hidden="true" />
                      <div>
                        <h3 className="font-label-caps text-[10px] tracking-wider text-on-surface">{item.term}</h3>
                        <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">{item.definition}</p>
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
          <div className="space-y-7 animate-[fadeIn_0.3s_ease-out]">
            <section className="overflow-hidden rounded-2xl border border-ember-gold/20 bg-gradient-to-br from-ember-gold/10 via-surface-container/80 to-void-black/95 p-6 sm:p-9">
              <div className="grid items-center gap-8 lg:grid-cols-[1fr_auto]">
                <div>
                  <div className="mb-3 flex items-center gap-2 font-label-caps text-[10px] tracking-[0.22em] text-ember-gold">
                    <Flag className="h-4 w-4" aria-hidden="true" />
                    Shared victory condition
                  </div>
                  <h2 className="font-almendra text-3xl font-bold text-on-surface sm:text-4xl">Vanquish the enemy leader</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-on-surface-variant sm:text-base">
                    Frost and Ash follow the same battlefield rules. Defeat the opposing Frost Lord or Ash Tyrant to end
                    the match and claim dominion over the realm.
                  </p>
                </div>
                <div className="flex shrink-0 items-center justify-center gap-3">
                  <div className="h-20 w-20 overflow-hidden rounded-xl border border-ice-light/40 sm:h-24 sm:w-24">
                    <img alt="Frost Lord" className="h-full w-full object-cover" src="/units/frost-lord.webp" />
                  </div>
                  <Swords className="h-6 w-6 text-ember-gold" aria-hidden="true" />
                  <div className="h-20 w-20 overflow-hidden rounded-xl border border-magma-core/40 sm:h-24 sm:w-24">
                    <img alt="Ash Tyrant" className="h-full w-full object-cover" src="/units/ash-tyrant.webp" />
                  </div>
                </div>
              </div>
            </section>

            <section aria-labelledby="foundation-heading">
              <div className="mb-4">
                <p className="font-label-caps text-[9px] tracking-[0.22em] text-ice-light">Battlefield foundation</p>
                <h2 id="foundation-heading" className="mt-1 font-almendra text-2xl font-bold text-on-surface sm:text-3xl">The rules every faction shares</h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {COMMON_RULES.map((rule) => {
                  const Icon = rule.icon;
                  return (
                    <article id={`rule-${toRulebookId(rule.title)}`} key={rule.title} className="scroll-mt-36 rounded-2xl border border-outline/15 bg-surface-container/65 p-5 backdrop-blur-md">
                      <span className={`mb-5 flex h-10 w-10 items-center justify-center rounded-xl border ${rule.accent}`}>
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <h3 className="font-label-caps text-xs font-bold tracking-wider text-on-surface">{rule.title}</h3>
                      <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">{rule.description}</p>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
              <div id="rule-effective-power" className="scroll-mt-36 rounded-2xl border border-magma-core/20 bg-gradient-to-br from-magma-core/10 to-surface-container/70 p-6 sm:p-8">
                <div className="mb-5 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-magma-core/25 bg-magma-core/10 text-magma-core">
                    <Swords className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="font-label-caps text-[9px] tracking-[0.2em] text-magma-core">Combat resolution</p>
                    <h2 className="font-almendra text-2xl font-bold text-on-surface">Compare Effective Power</h2>
                  </div>
                </div>
                <div className="rounded-xl border border-outline/15 bg-void-black/45 p-5 text-center">
                  <p className="font-label-caps text-[9px] tracking-[0.18em] text-on-surface-variant">Effective Power</p>
                  <p className="mt-2 font-mono text-sm font-bold text-on-surface sm:text-lg">
                    Strength <span className="text-ice-light">+</span> boosts <span className="text-magma-core">−</span> debuffs
                  </p>
                </div>
                <ol className="mt-5 space-y-3 text-sm leading-relaxed text-on-surface-variant">
                  <li className="flex gap-3"><span className="font-mono text-ember-gold">01</span><span>Move onto an enemy unit’s square to begin combat.</span></li>
                  <li className="flex gap-3"><span className="font-mono text-ember-gold">02</span><span>Calculate both units’ Effective Power at that moment.</span></li>
                  <li className="flex gap-3"><span className="font-mono text-ember-gold">03</span><span>Higher Power wins. Territory control breaks a standard tie.</span></li>
                </ol>
              </div>

              <div className="rounded-2xl border border-ember-gold/20 bg-gradient-to-br from-ember-gold/10 to-surface-container/70 p-6 sm:p-8">
                <div className="mb-5 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-ember-gold/25 bg-ember-gold/10 text-ember-gold">
                    <Map className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="font-label-caps text-[9px] tracking-[0.2em] text-ember-gold">Map control</p>
                    <h2 className="font-almendra text-2xl font-bold text-on-surface">Territory matters</h2>
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-on-surface-variant">
                  Entering an empty square converts it to your faction. Territory is both positioning and leverage: the
                  faction controlling more squares wins standard tied combat unless another effect overrides the result.
                </p>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-ice-light/20 bg-ice-light/5 p-3 text-center">
                    <Snowflake className="mx-auto h-4 w-4 text-ice-light" aria-hidden="true" />
                    <p className="mt-2 font-label-caps text-[9px] tracking-wider text-ice-light">Frost territory</p>
                  </div>
                  <div className="rounded-xl border border-magma-core/20 bg-magma-core/5 p-3 text-center">
                    <Flame className="mx-auto h-4 w-4 text-magma-core" aria-hidden="true" />
                    <p className="mt-2 font-label-caps text-[9px] tracking-wider text-magma-core">Ash territory</p>
                  </div>
                </div>
              </div>
            </section>

            <section aria-labelledby="landmarks-heading">
              <div className="mb-4">
                <p className="font-label-caps text-[9px] tracking-[0.22em] text-ember-gold">Strategic landmarks</p>
                <h2 id="landmarks-heading" className="mt-1 font-almendra text-2xl font-bold text-on-surface sm:text-3xl">Shrine, Rifts, and Conduits</h2>
              </div>
              <div className="grid gap-5 lg:grid-cols-2">
                <article id="rule-sacred-shrine" className="scroll-mt-36 rounded-2xl border border-ember-gold/20 bg-surface-container/65 p-6 sm:p-7">
                  <div className="mb-4 flex items-center gap-3">
                    <Landmark className="h-5 w-5 text-ember-gold" aria-hidden="true" />
                    <h3 className="font-almendra text-2xl font-bold text-ember-gold">The Sacred Shrine</h3>
                  </div>
                  <p className="text-sm leading-relaxed text-on-surface-variant">
                    The Shrine occupies a 2×2 zone at the centre. Capturing an enemy there grants permanent
                    <span className="font-bold text-ember-gold"> +1 Power</span> and adds 1 Shrine charge.
                  </p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
                      <p className="font-label-caps text-[9px] tracking-wider text-amber-400">At 2 charges</p>
                      <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">The Shrine Overloads and any occupying unit becomes Trapped.</p>
                    </div>
                    <div className="rounded-xl border border-red-400/20 bg-red-400/5 p-4">
                      <p className="font-label-caps text-[9px] tracking-wider text-red-400">Release</p>
                      <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">Escape with −1 Power and Dazed for 3 turns, without Ascension.</p>
                    </div>
                  </div>
                  <button className="mt-5 font-label-caps text-[10px] tracking-wider text-ember-gold hover:text-white" onClick={() => setActiveTab('ASCENSION')}>
                    Explore Ascension paths →
                  </button>
                </article>

                <article id="rule-power-rifts-and-conduit" className="scroll-mt-36 rounded-2xl border border-purple-400/20 bg-surface-container/65 p-6 sm:p-7">
                  <div className="mb-4 flex items-center gap-3">
                    <Zap className="h-5 w-5 text-purple-400" aria-hidden="true" />
                    <h3 className="font-almendra text-2xl font-bold text-purple-300">Power Rifts and Conduit</h3>
                  </div>
                  <p className="text-sm leading-relaxed text-on-surface-variant">
                    Two 3×3 Power Rifts occupy opposite corners. A faction with at least one unit on each Rift activates
                    its Conduit Link.
                  </p>
                  <div className="mt-5 space-y-3">
                    <div className="flex gap-3 rounded-xl border border-green-400/20 bg-green-400/5 p-4">
                      <Shield className="mt-0.5 h-4 w-4 shrink-0 text-green-400" aria-hidden="true" />
                      <p className="text-xs leading-relaxed text-on-surface-variant"><span className="font-bold text-green-400">Uncontested:</span> both Anchor units gain +2 Power and a defensive ward.</p>
                    </div>
                    <div className="flex gap-3 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
                      <Swords className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
                      <p className="text-xs leading-relaxed text-on-surface-variant"><span className="font-bold text-amber-400">Contested:</span> an enemy occupies a Rift and the Anchor bonus falls to +1.</p>
                    </div>
                  </div>
                </article>
              </div>
            </section>

            <section className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-2xl border border-outline/15 bg-surface-container/65 p-6 sm:p-7">
                <div className="mb-5 flex items-center gap-3">
                  <Map className="h-5 w-5 text-ice-light" aria-hidden="true" />
                  <h2 className="font-almendra text-2xl font-bold text-on-surface">Special terrain</h2>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {TERRAIN_RULES.map((terrain) => (
                    <div id={`terrain-${toRulebookId(terrain.name)}`} key={terrain.name} className="scroll-mt-36 rounded-xl border border-outline/10 bg-void-black/35 p-4">
                      <h3 className={`font-label-caps text-[10px] font-bold tracking-wider ${terrain.color}`}>{terrain.name}</h3>
                      <p className="mt-2 text-xs leading-relaxed text-on-surface-variant">{terrain.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-outline/15 bg-surface-container/65 p-6 sm:p-7">
                <div className="mb-5 flex items-center gap-3">
                  <Shield className="h-5 w-5 text-ember-gold" aria-hidden="true" />
                  <h2 className="font-almendra text-2xl font-bold text-on-surface">Status reference</h2>
                </div>
                <div className="space-y-3">
                  {STATUS_RULES.map((status) => (
                    <div id={`status-${toRulebookId(status.name)}`} key={status.name} className="scroll-mt-36 flex items-start justify-between gap-4 rounded-xl border border-outline/10 bg-void-black/35 p-4">
                      <h3 className={`font-label-caps text-[10px] font-bold tracking-wider ${status.color}`}>{status.name}</h3>
                      <p className="max-w-52 text-right text-xs leading-relaxed text-on-surface-variant">{status.description}</p>
                    </div>
                  ))}
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
                <Sparkles className="h-6 w-6" aria-hidden="true" />
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
                >Frost</button>
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
                  <div id={`ascension-${toRulebookId(r.role)}`} key={r.role} className="scroll-mt-36 bg-void-black/50 border border-outline/10 rounded-xl overflow-hidden">
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
            <section className={`overflow-hidden rounded-2xl border p-6 sm:p-8 ${
              activeFaction === 'snow'
                ? 'border-ice-light/25 bg-gradient-to-r from-ice-light/12 via-surface-container/80 to-void-black/95'
                : 'border-magma-core/25 bg-gradient-to-r from-magma-core/12 via-surface-container/80 to-void-black/95'
            }`}>
              <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
                <div>
                  <div className={`mb-2 flex items-center gap-2 font-label-caps text-[9px] tracking-[0.22em] ${
                    activeFaction === 'snow' ? 'text-ice-light' : 'text-magma-core'
                  }`}>
                    {activeFaction === 'snow'
                      ? <Snowflake className="h-4 w-4" aria-hidden="true" />
                      : <Flame className="h-4 w-4" aria-hidden="true" />}
                    Faction unit catalog
                  </div>
                  <h2 className={`font-almendra text-3xl font-bold sm:text-4xl ${
                    activeFaction === 'snow' ? 'text-ice-light' : 'text-magma-core'
                  }`}>
                    {activeFaction === 'snow' ? 'The Frost Host' : 'The Ash Legion'}
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-on-surface-variant">
                    {activeFaction === 'snow'
                      ? 'A disciplined force built around control, protection, healing, and glacial terrain.'
                      : 'An aggressive force built around direct damage, disruption, hazards, and relentless pressure.'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-3xl font-bold text-on-surface">{UNIT_PROFILES[activeFaction].length}</span>
                  <span className="font-label-caps text-[9px] leading-relaxed tracking-wider text-on-surface-variant">documented<br />units</span>
                </div>
              </div>
            </section>

            {/* Faction Selector */}
            <div className="grid grid-cols-2 gap-3 rounded-2xl border border-outline/15 bg-void-black/45 p-2 sm:mx-auto sm:max-w-xl">
              <button
                className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-label-caps text-xs font-semibold tracking-wider transition-all duration-300 ${activeFaction === 'snow'
                    ? 'bg-ice-light text-void-black shadow-[0_8px_25px_rgba(165,243,252,0.18)]'
                    : 'text-on-surface-variant hover:bg-ice-light/10 hover:text-ice-light'
                  }`}
                onClick={() => setActiveFaction('snow')}
              >
                <Snowflake className="h-4 w-4" aria-hidden="true" />
                Frost Faction
              </button>
              <button
                className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-label-caps text-xs font-semibold tracking-wider transition-all duration-300 ${activeFaction === 'ash'
                    ? 'bg-magma-core text-white shadow-[0_8px_25px_rgba(239,68,68,0.18)]'
                    : 'text-on-surface-variant hover:bg-magma-core/10 hover:text-magma-core'
                  }`}
                onClick={() => setActiveFaction('ash')}
              >
                <Flame className="h-4 w-4" aria-hidden="true" />
                Ash Faction
              </button>
            </div>

            {/* Units Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {UNIT_PROFILES[activeFaction].map((unit, idx) => (
                <div
                  id={`unit-${activeFaction}-${toRulebookId(unit.name)}`}
                  key={`${activeFaction}-${unit.name}`}
                  className="scroll-mt-36 bg-surface-container/60 backdrop-blur-md rounded-xl border border-outline/10 overflow-hidden flex flex-col hover:border-outline/30 transition-all duration-300 shadow-lg"
                >
                  {/* Portrait */}
                  <div className="relative h-56 bg-void-black/80 flex items-center justify-center overflow-hidden border-b border-outline/10">
                    <img
                      src={unit.portrait}
                      alt={unit.name}
                      loading="lazy"
                      decoding="async"
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
            <button
              className="text-xs text-on-surface-variant hover:text-ember-gold transition-colors duration-200 cursor-pointer bg-transparent border-none"
              onClick={() => handleNavigate('SETTINGS')}
            >
              Settings
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
