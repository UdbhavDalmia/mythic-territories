import React, { useState, useLayoutEffect, useRef } from 'react';
import { loadGsap } from '../services/gsap.js';
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left.js';
import BookOpen from 'lucide-react/dist/esm/icons/book-open.js';
import Check from 'lucide-react/dist/esm/icons/check.js';
import ScrollText from 'lucide-react/dist/esm/icons/scroll-text.js';
import SettingsIcon from 'lucide-react/dist/esm/icons/settings.js';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles.js';
import Zap from 'lucide-react/dist/esm/icons/zap.js';
import Smartphone from 'lucide-react/dist/esm/icons/smartphone.js';
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
        { opacity: 0, y: 40 },
        { opacity: 1, y: 0, duration: 0.75, ease: 'expo.out' }
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
          y: 50,
          duration: 0.32,
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
  };

  const handleToggleHaptics = () => {
    const next = !hapticsEnabled;
    setHapticsEnabledState(next);
    setHapticsEnabled(next);
    if (next) triggerHaptic('light');
  };

  return (
    <div
      ref={pageRef}
      className="relative min-h-screen flex flex-col justify-between bg-void-black text-on-surface font-body-md select-none"
      style={{ opacity: 0 }}
    >
      {/* Background Ambience (Matching Notes & Guide) */}
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

      {/* Navigation Header */}
      <nav className="fixed top-0 w-full z-50 bg-void-black/80 backdrop-blur-xl border-b border-outline/15 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
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

      {/* Main Content Area */}
      <main className="relative z-10 flex-grow pt-32 pb-20 px-4 md:px-8 max-w-2xl mx-auto w-full flex flex-col justify-center">
        {/* Page Heading */}
        <header className="text-center mb-8 space-y-2">
          <h1 className="font-almendra text-4xl sm:text-5xl font-bold tracking-tight text-gradient-dual uppercase">
            SETTINGS
          </h1>
          <p className="text-sm text-on-surface-variant max-w-md mx-auto leading-relaxed">
            Customize visual effects and motion dynamics across the realm.
          </p>
        </header>

        {/* Unified Settings Menu */}
        <div className="rounded-2xl border border-ember-gold/25 bg-surface-container/70 backdrop-blur-xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_30px_rgba(245,158,11,0.08)] divide-y divide-outline/15">
          {/* Section 1: Motion */}
          <div className="pb-8">
            <div className="pb-4">
              <h2 className="font-almendra text-lg sm:text-xl font-bold text-on-surface tracking-wide">
                Motion & Visual Intensity
              </h2>
              <p className="font-label-caps text-[10px] tracking-wider text-on-surface-variant uppercase">
                Display & Accessibility
              </p>
            </div>

            <p className="mt-1 text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              Choose between full atmospheric animations or reduced motion for optimized performance.
            </p>

            {/* Vertically Stacked Horizontal Choice Cards */}
            <div className="flex flex-col gap-3 mt-5">
              {/* Full Motion Option */}
              <button
                type="button"
                onClick={() => handleSelectMotion('full')}
                className={`relative flex items-center justify-between p-4 sm:p-4.5 rounded-xl border text-left transition-all duration-300 cursor-pointer ${
                  motionMode === 'full'
                    ? 'border-ember-gold bg-gradient-to-r from-ember-gold/15 via-ember-gold/5 to-transparent shadow-[0_0_20px_rgba(245,158,11,0.2)]'
                    : 'border-outline/15 bg-void-black/40 hover:border-outline/30 hover:bg-void-black/60'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`p-2 rounded-lg border shrink-0 transition-colors ${
                      motionMode === 'full'
                        ? 'bg-ember-gold/20 border-ember-gold/50 text-ember-gold'
                        : 'bg-void-black/50 border-outline/15 text-on-surface-variant'
                    }`}
                  >
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-almendra text-base font-bold text-on-surface tracking-wide">
                      Full Motion
                    </div>
                    <p className="text-xs text-on-surface-variant truncate sm:text-clip">
                      Dynamic particles, banner physics, and combat camera shakes
                    </p>
                  </div>
                </div>

                <div
                  className={`h-5 w-5 rounded-full border flex items-center justify-center shrink-0 ml-4 transition-all ${
                    motionMode === 'full'
                      ? 'border-ember-gold bg-ember-gold text-void-black shadow-[0_0_10px_rgba(245,158,11,0.5)]'
                      : 'border-outline/30 bg-void-black/50 text-transparent'
                  }`}
                >
                  <Check className="h-3 w-3 stroke-[3]" />
                </div>
              </button>

              {/* Reduced Motion Option */}
              <button
                type="button"
                onClick={() => handleSelectMotion('reduced')}
                className={`relative flex items-center justify-between p-4 sm:p-4.5 rounded-xl border text-left transition-all duration-300 cursor-pointer ${
                  motionMode === 'reduced'
                    ? 'border-cyan-400 bg-gradient-to-r from-cyan-500/15 via-cyan-500/5 to-transparent shadow-[0_0_20px_rgba(56,189,248,0.2)]'
                    : 'border-outline/15 bg-void-black/40 hover:border-outline/30 hover:bg-void-black/60'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className={`p-2 rounded-lg border shrink-0 transition-colors ${
                      motionMode === 'reduced'
                        ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-300'
                        : 'bg-void-black/50 border-outline/15 text-on-surface-variant'
                    }`}
                  >
                    <Zap className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-almendra text-base font-bold text-on-surface tracking-wide">
                      Reduced Motion
                    </div>
                    <p className="text-xs text-on-surface-variant truncate sm:text-clip">
                      Disables screen shakes, ambient particles, and background sways
                    </p>
                  </div>
                </div>

                <div
                  className={`h-5 w-5 rounded-full border flex items-center justify-center shrink-0 ml-4 transition-all ${
                    motionMode === 'reduced'
                      ? 'border-cyan-400 bg-cyan-400 text-void-black shadow-[0_0_10px_rgba(56,189,248,0.5)]'
                      : 'border-outline/30 bg-void-black/50 text-transparent'
                  }`}
                >
                  <Check className="h-3 w-3 stroke-[3]" />
                </div>
              </button>
            </div>
          </div>

          {/* Section 2: Mobile Haptic Feedback */}
          <div className="pt-8">
            <div className="pb-4 flex items-center justify-between">
              <div>
                <h2 className="font-almendra text-lg sm:text-xl font-bold text-on-surface tracking-wide">
                  Mobile Haptic Feedback
                </h2>
                <p className="font-label-caps text-[10px] tracking-wider text-on-surface-variant uppercase">
                  Physical Vibration Response
                </p>
              </div>
              <button
                type="button"
                onClick={handleToggleHaptics}
                className={`px-3 py-1.5 rounded-lg border flex items-center gap-2 font-label-caps text-xs tracking-wider transition-all cursor-pointer ${
                  hapticsEnabled
                    ? 'border-emerald-400 bg-emerald-500/20 text-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.3)]'
                    : 'border-outline/20 bg-void-black/50 text-on-surface-variant'
                }`}
              >
                <Smartphone className="h-4 w-4" />
                <span>{hapticsEnabled ? 'ENABLED' : 'DISABLED'}</span>
              </button>
            </div>

            <p className="mt-1 text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              Tactile vibration pulses on piece movement, tactical abilities, unit captures, and turn notifications for supported mobile devices.
            </p>
          </div>
        </div>
      </main>

      {/* Standard Footer Matching Guide and Notes */}
      <footer className="bg-void-black border-t border-outline/10 w-full py-8 mt-auto relative z-10 select-none font-label-caps">
        <div className="flex flex-col md:flex-row justify-between items-center px-6 md:px-12 max-w-7xl mx-auto w-full gap-4 text-center md:text-left">
          <button
            className="text-sm tracking-wider text-on-surface-variant cursor-pointer hover:text-ember-gold transition-colors bg-transparent border-none"
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
              className="inline-flex items-center gap-2 text-xs text-on-surface-variant hover:text-ember-gold transition-colors duration-200 cursor-pointer bg-transparent border-none"
              onClick={() => handleNavigate('NOTES')}
            >
              <ScrollText className="h-3.5 w-3.5" aria-hidden="true" />
              Patch Notes
            </button>
            <button
              className="inline-flex items-center gap-2 text-xs text-ember-gold font-bold transition-colors duration-200 cursor-pointer bg-transparent border-none"
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
