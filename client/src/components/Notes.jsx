import React, { useState, useEffect, useRef } from 'react';
import { loadGsap } from '../services/gsap.js';
import '@/styles/notes.css';
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left.js';
import BookOpen from 'lucide-react/dist/esm/icons/book-open.js';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down.js';
import ScrollText from 'lucide-react/dist/esm/icons/scroll-text.js';
import SettingsIcon from 'lucide-react/dist/esm/icons/settings.js';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles.js';

import {
  PATCHES,
  HISTORICAL_PATCHES,
  versionId,
  ChangeRow,
  ReleaseCard
} from '../data/patchNotes.jsx';
import { markPatchNotesAsViewed } from '../services/patchTracking.js';

const resolveTargetPatch = () => {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const rawQuery = params.get('version') || params.get('v') || params.get('patch');
  const rawHash = window.location.hash.replace(/^#/, '');
  const candidate = rawQuery || rawHash;
  if (!candidate) return null;

  const allPatches = [...PATCHES, ...HISTORICAL_PATCHES];
  const clean = candidate.trim().toLowerCase().replace(/^v/, '').replace(/^version-/, '');
  
  // 1. Direct match on version
  const exact = allPatches.find(p => p.version.toLowerCase() === candidate.toLowerCase() || p.version.toLowerCase() === clean);
  if (exact) return exact;

  // 2. Normalized numerical match
  const cleanNum = clean.replace(/[^0-9.]+/g, '');
  if (cleanNum) {
    const numMatch = allPatches.find(p => {
      const pClean = p.version.toLowerCase().replace(/[^0-9.]+/g, '');
      return pClean === cleanNum || pClean.startsWith(cleanNum) || cleanNum.startsWith(pClean);
    });
    if (numMatch) return numMatch;
  }

  // 3. ID match
  const idMatch = allPatches.find(p => versionId(p.version) === candidate.toLowerCase() || versionId(p.version) === `version-${clean}`);
  return idMatch || null;
};

export default function Notes({ navigateTo }) {
  const initialTarget = resolveTargetPatch();
  const archivedVersionRequested = initialTarget ? HISTORICAL_PATCHES.some((patch) => patch.version === initialTarget.version) : false;
  const initialVersion = initialTarget ? initialTarget.version : PATCHES[1]?.version;
  const [showArchive, setShowArchive] = useState(archivedVersionRequested);
  const [expandedVersions, setExpandedVersions] = useState(() => new Set(initialVersion ? [initialVersion] : []));
  const [targetedVersion, setTargetedVersion] = useState(initialTarget ? initialTarget.version : null);
  const pageRef = useRef(null);
  const upcomingPatch = PATCHES[0];
  const releasedPatches = PATCHES.slice(1);

  const scrollToVersion = (version) => {
    if (!version) return () => {};
    const targetId = versionId(version);
    const scroll = () => {
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          block: 'start'
        });
      }
    };
    const f1 = window.requestAnimationFrame(scroll);
    const t1 = setTimeout(scroll, 120);
    const t2 = setTimeout(scroll, 420);
    return () => {
      window.cancelAnimationFrame(f1);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  };

  useEffect(() => {
    markPatchNotesAsViewed();
  }, []);

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

  useEffect(() => {
    if (targetedVersion) {
      return scrollToVersion(targetedVersion);
    }
  }, [targetedVersion]);

  useEffect(() => {
    const handleUrlChange = () => {
      const patch = resolveTargetPatch();
      if (patch) {
        if (HISTORICAL_PATCHES.some(p => p.version === patch.version)) {
          setShowArchive(true);
        }
        setExpandedVersions(prev => new Set([...prev, patch.version]));
        setTargetedVersion(patch.version);
      }
    };

    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, []);

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

  const openVersion = (version, archived = false) => {
    if (archived) setShowArchive(true);
    const isCurrentlyOpen = expandedVersions.has(version);

    if (isCurrentlyOpen) {
      setExpandedVersions(new Set());
      setTargetedVersion(null);
      const url = new URL(window.location.href);
      url.searchParams.set('page', 'notes');
      url.searchParams.delete('version');
      url.searchParams.delete('v');
      url.searchParams.delete('patch');
      url.hash = '';
      window.history.replaceState({}, '', url);
    } else {
      setExpandedVersions(new Set([version]));
      setTargetedVersion(version);
      const url = new URL(window.location.href);
      url.searchParams.set('page', 'notes');
      url.searchParams.set('version', version);
      window.history.replaceState({}, '', url);

      setTimeout(() => {
        document.getElementById(versionId(version))?.scrollIntoView({
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          block: 'start'
        });
      }, 50);
    }
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

      <div
        ref={pageRef}
        className="relative z-10 min-h-screen flex flex-col justify-between text-slate-100 select-text overflow-x-hidden font-sans"
        style={{ opacity: 0 }}
      >
        {/* Top Header matching Settings */}
        <header className="w-full border-b border-slate-700/60 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40">
          <div className="max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
            <button
              onClick={() => handleNavigate('LOBBY')}
              className="group flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-1" />
              <span>Back</span>
            </button>
            <span className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Changelog</span>
          </div>
        </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 max-w-2xl lg:max-w-4xl xl:max-w-5xl w-full mx-auto px-6 py-12 flex flex-col justify-center">
        {/* Cinematic Page Heading */}
        <div className="mb-10 relative">
          <div className="flex items-center gap-2 mb-2">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[10px] uppercase font-bold tracking-[0.25em] text-amber-400">Chronicles of the Realm</span>
          </div>
          <h1 className="font-almendra text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-wide">
            Patch Notes & Updates
          </h1>
          <p className="text-sm text-slate-300 mt-2 max-w-2xl leading-relaxed">
            Trace the evolution of the battlefield — engine rewrites, tactical balances, faction overhauls, and upcoming sagas.
          </p>
        </div>

        {/* Roadmap Preview - Cinematic Featured Banner */}
        {upcomingPatch && (
          <div
            id={versionId(upcomingPatch.version)}
            className={`mb-10 pb-8 border-b border-slate-800/80 relative scroll-mt-24 transition-all duration-300 ${
              targetedVersion === upcomingPatch.version ? 'ring-1 ring-amber-400/50 rounded-xl px-4 -mx-4 bg-amber-400/5 shadow-[0_0_20px_rgba(245,158,11,0.1)]' : ''
            }`}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] px-2 py-0.5 rounded bg-amber-400/10 text-amber-300 border border-amber-400/30">
                    Roadmap
                  </span>
                  <span className="text-xs text-slate-400 font-mono">v{upcomingPatch.version}</span>
                </div>
                <h2 className="font-almendra text-2xl font-bold text-white mt-1.5 tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-300 to-amber-500">
                  {upcomingPatch.title}
                </h2>
              </div>
              <button
                className="text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer shrink-0"
                onClick={() => openVersion(upcomingPatch.version)}
              >
                {expandedVersions.has(upcomingPatch.version) ? 'Hide details' : 'View details'}
              </button>
            </div>
            <div className={`note-accordion-wrapper ${expandedVersions.has(upcomingPatch.version) ? 'open' : ''}`}>
              <div className="note-accordion-inner">
                <div className="note-accordion-content pt-5">
                  <ul className="space-y-3 border-l-2 border-amber-400/50 pl-4 ml-1 text-xs text-slate-200">
                    {upcomingPatch.highlights.map((change, index) => <ChangeRow key={`roadmap-${index}`} text={change.text} />)}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Released Updates List: Minimal Line-Separated Entries */}
        <section aria-labelledby="released-heading">
          <div className="divide-y divide-slate-800">
            {releasedPatches.map((patch, index) => (
              <ReleaseCard
                key={patch.version}
                patch={patch}
                featured={index === 0}
                targeted={targetedVersion === patch.version}
                expanded={expandedVersions.has(patch.version)}
                onToggle={() => openVersion(patch.version)}
                onViewRules={() => handleNavigate('GUIDE')}
              />
            ))}
          </div>
        </section>

        {/* Historical Archive */}
        <section className="mt-10 pt-8 border-t border-slate-800" aria-labelledby="archive-heading">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-300">Earlier releases</span>
            <button
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
              onClick={() => setShowArchive((current) => !current)}
              aria-expanded={showArchive}
            >
              <span>{showArchive ? 'Hide archive' : `View ${HISTORICAL_PATCHES.length} older updates`}</span>
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showArchive ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
          </div>

          <div className={`note-accordion-wrapper ${showArchive ? 'open' : ''}`}>
            <div className="note-accordion-inner">
              <div className="note-accordion-content pt-4">
                <div className="divide-y divide-slate-800">
                  {HISTORICAL_PATCHES.map((patch) => (
                    <ReleaseCard
                      key={patch.version}
                      patch={patch}
                      archived
                      targeted={targetedVersion === patch.version}
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

      {/* Minimal Footer matching Settings */}
      <footer className="relative z-10 w-full border-t border-slate-800/80 bg-slate-900/60 backdrop-blur-sm py-6 text-xs text-slate-400">
        <div className="max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span>Mythic Territories</span>
          <div className="flex gap-6">
            <button
              onClick={() => handleNavigate('GUIDE')}
              className="hover:text-slate-200 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Rules</span>
            </button>
            <button
              onClick={() => handleNavigate('NOTES')}
              className="text-amber-400 transition-colors cursor-pointer flex items-center gap-1.5 font-medium"
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
