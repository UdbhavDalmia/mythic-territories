import React, { useState, useEffect, useRef } from 'react';
import gsap from 'gsap';
import '@/styles/notes.css';
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  ChevronDown,
  CircleAlert,
  Minus,
  Plus,
  ScrollText,
  Settings as SettingsIcon,
  SlidersHorizontal,
  Sparkles,
  Wrench,
} from 'lucide-react';

import {
  PATCHES,
  HISTORICAL_PATCHES,
  versionId,
  ChangeRow,
  ReleaseCard
} from '../data/patchNotes.jsx';

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
    const isCurrentlyOpen = expandedVersions.has(version);

    if (isCurrentlyOpen) {
      setExpandedVersions(new Set());
      const url = new URL(window.location.href);
      url.searchParams.set('page', 'notes');
      url.searchParams.delete('version');
      window.history.replaceState({}, '', url);
    } else {
      setExpandedVersions(new Set([version]));
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
    }
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
            Follow new features, balance changes, fixes, and every evolution of the battle between Frost and Ash.
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
              className="rounded-full border border-ember-gold/30 px-4 py-2.5 font-label-caps text-[10px] tracking-wider text-ember-gold transition-colors hover:bg-ember-gold hover:text-void-black cursor-pointer"
              onClick={() => openVersion(upcomingPatch.version)}
            >
              {expandedVersions.has(upcomingPatch.version) ? 'Close roadmap' : 'View roadmap'}
            </button>
          </div>
          <div className={`note-accordion-wrapper ${expandedVersions.has(upcomingPatch.version) ? 'open' : ''}`}>
            <div className="note-accordion-inner">
              <div className="note-accordion-content">
                <ul className="mt-6 grid gap-3 border-t border-ember-gold/15 pt-5 md:grid-cols-2">
                  {upcomingPatch.highlights.map((change, index) => <ChangeRow key={`roadmap-${index}`} text={change.text} />)}
                </ul>
              </div>
            </div>
          </div>
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

          <div className={`note-accordion-wrapper ${showArchive ? 'open' : ''}`}>
            <div className="note-accordion-inner">
              <div className="note-accordion-content">
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
              </div>
            </div>
          </div>
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
            <button
              className="inline-flex items-center gap-2 text-xs text-on-surface-variant hover:text-ember-gold transition-colors duration-200 cursor-pointer bg-transparent border-none"
              onClick={() => handleNavigate('SETTINGS')}
            >
              <SettingsIcon className="h-3.5 w-3.5" aria-hidden="true" />
              Settings
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
