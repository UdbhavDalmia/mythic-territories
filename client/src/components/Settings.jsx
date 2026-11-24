import React, { useState, useLayoutEffect, useRef } from 'react';
import { loadGsap } from '../services/gsap.js';
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left.js';
import BookOpen from 'lucide-react/dist/esm/icons/book-open.js';
import ScrollText from 'lucide-react/dist/esm/icons/scroll-text.js';
import SettingsIcon from 'lucide-react/dist/esm/icons/settings.js';
import { getMotionPreference, applyMotionPreference } from '../services/motionPreference.js';
import { getHapticsEnabled, setHapticsEnabled, triggerHaptic } from '../services/haptics.js';

export { getMotionPreference, applyMotionPreference };

export default function Settings({ navigateTo }) {
  const pageRef = useRef(null);
  const [motionMode, setMotionMode] = useState(getMotionPreference);
  const [hapticsEnabled, setHapticsEnabledState] = useState(getHapticsEnabled);

  useLayoutEffect(() => {
    let active = true;
    let entrance = null;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      if (pageRef.current) pageRef.current.style.opacity = '1';
      return;
    }
    loadGsap().then(gsap => {
      if (!active || !pageRef.current) return;
      entrance = gsap.fromTo(
        pageRef.current,
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out', clearProps: 'transform' }
      );
    });
    return () => {
      active = false;
      if (entrance) entrance.kill();
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
          opacity: 0,
          y: -15,
          duration: 0.25,
          ease: 'power2.in',
          onComplete: () => navigateTo(dest),
        });
      } else {
        navigateTo(dest);
      }
    });
  };

  const handleSelectMotion = (mode) => {
    setMotionMode(mode);
    applyMotionPreference(mode);
    if (hapticsEnabled) triggerHaptic('light');
  };

  const handleToggleHaptics = () => {
    const next = !hapticsEnabled;
    setHapticsEnabledState(next);
    setHapticsEnabled(next);
    if (next) triggerHaptic('light');
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
        className="relative z-10 min-h-screen flex flex-col justify-between text-slate-100 select-none overflow-x-hidden font-sans"
        style={{ opacity: 0 }}
      >
        {/* Top Header */}
        <header className="w-full border-b border-slate-700/60 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40">
          <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
            <button
              onClick={() => handleNavigate('LOBBY')}
              className="group flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-1" />
              <span>Back</span>
            </button>
            <span className="text-xs uppercase tracking-widest text-slate-400 font-semibold">Preferences</span>
          </div>
        </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 max-w-2xl w-full mx-auto px-6 py-12 flex flex-col justify-center">
        {/* Cinematic Page Heading */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-2">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-[10px] uppercase font-bold tracking-[0.25em] text-amber-400">Battlefield Configuration</span>
          </div>
          <h1 className="font-almendra text-3xl sm:text-4xl font-bold text-white tracking-wide">Settings & Controls</h1>
          <p className="text-sm text-slate-300 mt-1 leading-relaxed">Customize sensory feedback, particle animations, and battlefield dynamics.</p>
        </div>

        {/* Clean, Line-Separated Options (No Heavy Boxes) */}
        <div className="divide-y divide-slate-800">
          {/* Row 1: Animations */}
          <div className="py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-base text-white font-medium">Animations</div>
              <div className="text-xs text-slate-300 mt-0.5">Control particle effects, screen shakes, and motion.</div>
            </div>

            {/* Segmented Control with animated sliding pill (On on left, Reduced on right) */}
            <div className="relative inline-flex rounded-lg bg-slate-800/80 p-1 border border-slate-700/60 self-start sm:self-auto shrink-0 select-none">
              {/* Sliding background indicator pill */}
              <div
                className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-md transition-all duration-300 ease-out pointer-events-none shadow-sm ${
                  motionMode === 'reduced'
                    ? 'left-[calc(50%)] bg-slate-200'
                    : 'left-1 bg-amber-400'
                }`}
              />

              <button
                type="button"
                onClick={() => handleSelectMotion('full')}
                className={`relative z-10 w-20 py-1.5 text-xs font-semibold rounded-md transition-colors duration-200 cursor-pointer text-center ${
                  motionMode === 'full' ? 'text-slate-950' : 'text-slate-300 hover:text-white'
                }`}
              >
                On
              </button>
              <button
                type="button"
                onClick={() => handleSelectMotion('reduced')}
                className={`relative z-10 w-20 py-1.5 text-xs font-semibold rounded-md transition-colors duration-200 cursor-pointer text-center ${
                  motionMode === 'reduced' ? 'text-slate-950' : 'text-slate-300 hover:text-white'
                }`}
              >
                Reduced
              </button>
            </div>
          </div>

          {/* Row 2: Vibration */}
          <div className="py-6 flex items-center justify-between gap-4">
            <div>
              <div className="text-base text-white font-medium">Vibration</div>
              <div className="text-xs text-slate-300 mt-0.5">Haptic feedback on moves and attacks on mobile.</div>
            </div>

            {/* Simple Minimal Switch */}
            <button
              type="button"
              role="switch"
              aria-checked={hapticsEnabled}
              onClick={handleToggleHaptics}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full p-0.5 transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                hapticsEnabled ? 'bg-amber-400' : 'bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out ${
                  hapticsEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="relative z-10 w-full border-t border-slate-800/80 bg-slate-900/60 backdrop-blur-sm py-6 text-xs text-slate-400">
        <div className="max-w-2xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
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
              className="hover:text-slate-200 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <ScrollText className="h-3.5 w-3.5" />
              <span>Updates</span>
            </button>
            <button
              onClick={() => handleNavigate('SETTINGS')}
              className="text-amber-400 transition-colors cursor-pointer flex items-center gap-1.5 font-medium"
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
