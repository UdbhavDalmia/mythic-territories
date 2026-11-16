import React, { useState } from 'react';
import { ArrowLeft, Sparkles, Wind, Sliders, Eye, Check, Shield, Flame, Snowflake, RotateCcw } from 'lucide-react';
import FactionBanner from './FactionBanner.jsx';

/**
 * BannerPlayground — Live interactive studio for designing and perfecting
 * the heraldic rods, realistic fabric physics, textures, tassels, and crests.
 */
export default function BannerPlayground({ navigateTo }) {
  // Live customization controls
  const [rodStyle, setRodStyle] = useState('fantasy'); // 'fantasy' | 'ornate' | 'minimal'
  const [fabricFolds, setFabricFolds] = useState(true);
  const [fabricWave, setFabricWave] = useState(true);
  const [waveSpeed, setWaveSpeed] = useState('normal'); // 'calm' | 'normal' | 'storm'
  const [tassels, setTassels] = useState(true);
  const [detailedCrest, setDetailedCrest] = useState(true);
  const [particles, setParticles] = useState(true);
  const [previewMode, setPreviewMode] = useState('cards'); // 'cards' | 'large' | 'battlefield'
  const [appliedNotice, setAppliedNotice] = useState(false);

  const handleApplyToGame = () => {
    // Save to localStorage or state so FactionBanner can pick it up
    try {
      localStorage.setItem('mt_banner_options', JSON.stringify({
        rodStyle,
        fabricFolds,
        fabricWave,
        waveSpeed,
        tassels,
        detailedCrest,
        particles
      }));
      setAppliedNotice(true);
      setTimeout(() => setAppliedNotice(false), 2400);
    } catch (e) {
      console.warn('Could not save banner options', e);
    }
  };

  return (
    <div className="min-h-screen w-full bg-void-black text-on-surface flex flex-col select-none overflow-x-hidden">
      {/* Playground Header */}
      <header className="sticky top-0 z-50 bg-void-black/90 backdrop-blur-md border-b border-outline/20 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            onClick={() => navigateTo('LOBBY')}
            className="p-2 rounded-lg bg-surface/50 hover:bg-surface border border-outline/20 text-on-surface-variant hover:text-ember-gold transition-colors cursor-pointer flex items-center gap-2 font-label-caps text-xs tracking-wider"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Lobby</span>
          </button>
          <div>
            <h1 className="almendra-font text-lg sm:text-2xl text-ember-gold tracking-widest uppercase font-bold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-ember-gold" />
              <span>Banner Design Studio</span>
            </h1>
            <p className="text-[10px] sm:text-xs text-on-surface-variant/70 tracking-wider font-label-caps">
              Live Heraldry, Rod Forging &amp; Living Fabric Playground
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleApplyToGame}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600/30 via-emerald-500/40 to-emerald-600/30 border border-emerald-400/80 text-emerald-300 hover:text-pure-snow font-label-caps text-xs tracking-widest font-bold shadow-[0_0_15px_rgba(52,211,153,0.3)] transition-all flex items-center gap-2 cursor-pointer active:scale-95"
          >
            {appliedNotice ? <Check className="h-4 w-4 text-emerald-400" /> : <Shield className="h-4 w-4 text-emerald-400" />}
            <span>{appliedNotice ? 'Config Saved!' : 'Apply To Game'}</span>
          </button>
        </div>
      </header>

      {/* Main Studio Body: Controls + Viewport */}
      <div className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Panel: Control Dock */}
        <aside className="lg:col-span-4 bg-surface/40 border border-outline/20 rounded-2xl p-5 backdrop-blur-md space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-outline/10">
            <h2 className="font-label-caps text-xs sm:text-sm tracking-widest text-ember-gold font-bold flex items-center gap-2">
              <Sliders className="h-4 w-4" />
              <span>Heraldic Controls</span>
            </h2>
            <button
              onClick={() => {
                setRodStyle('fantasy');
                setFabricFolds(true);
                setFabricWave(true);
                setWaveSpeed('normal');
                setTassels(true);
                setDetailedCrest(true);
                setParticles(true);
              }}
              title="Reset to defaults"
              className="text-on-surface-variant hover:text-ember-gold transition-colors p-1"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* 1. Hanging Rod Forging */}
          <div className="space-y-2.5">
            <label className="font-label-caps text-[11px] text-ice-light tracking-widest uppercase block">
              1. Suspension Rod &amp; Finials
            </label>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-void-black/60 rounded-xl border border-outline/20">
              {[
                { id: 'fantasy', label: 'Forged Fantasy' },
                { id: 'ornate', label: 'Royal Scepter' },
                { id: 'minimal', label: 'Minimal Rod' }
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setRodStyle(opt.id)}
                  className={`py-2 px-1 text-center rounded-lg font-label-caps text-[10px] tracking-wider transition-all cursor-pointer ${
                    rodStyle === opt.id
                      ? 'bg-ember-gold/20 text-ember-gold border border-ember-gold/50 shadow-[0_0_10px_rgba(234,179,8,0.25)] font-bold'
                      : 'text-on-surface-variant hover:text-pure-snow'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-on-surface-variant/70 leading-relaxed">
              {rodStyle === 'fantasy' && 'Chiseled crystal spearheads for Frost; forged volcanic iron & horned finials for Ash.'}
              {rodStyle === 'ornate' && 'Polished silver/gold battle scepter with jewel-encrusted crown caps.'}
              {rodStyle === 'minimal' && 'Clean heraldic horizontal crossbar with rounded caps.'}
            </p>
          </div>

          {/* 2. Fabric Realism & Folds */}
          <div className="space-y-3 pt-2 border-t border-outline/10">
            <label className="font-label-caps text-[11px] text-ice-light tracking-widest uppercase block">
              2. Realistic Fabric Physics
            </label>

            {/* Toggle: Depth Folds */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-void-black/40 border border-outline/15">
              <div>
                <span className="font-label-caps text-xs text-pure-snow block">Cloth Folds &amp; Shading</span>
                <span className="text-[10px] text-on-surface-variant/70">Vertical drape crease lighting</span>
              </div>
              <input
                type="checkbox"
                checked={fabricFolds}
                onChange={e => setFabricFolds(e.target.checked)}
                className="w-4 h-4 accent-amber-500 cursor-pointer"
              />
            </div>

            {/* Toggle: Hanging Fringe Tassels */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-void-black/40 border border-outline/15">
              <div>
                <span className="font-label-caps text-xs text-pure-snow block">Fringe Tassels &amp; Trim</span>
                <span className="text-[10px] text-on-surface-variant/70">Metallic bottom hem fringes</span>
              </div>
              <input
                type="checkbox"
                checked={tassels}
                onChange={e => setTassels(e.target.checked)}
                className="w-4 h-4 accent-amber-500 cursor-pointer"
              />
            </div>

            {/* Toggle: Living Fabric Wave Billow */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-void-black/40 border border-outline/15">
              <div>
                <span className="font-label-caps text-xs text-pure-snow block">Living Fabric Wave</span>
                <span className="text-[10px] text-on-surface-variant/70">Organic SVG wind ripple physics</span>
              </div>
              <input
                type="checkbox"
                checked={fabricWave}
                onChange={e => setFabricWave(e.target.checked)}
                className="w-4 h-4 accent-amber-500 cursor-pointer"
              />
            </div>

            {fabricWave && (
              <div className="pl-2 pt-1 flex items-center justify-between">
                <span className="text-[10px] font-label-caps tracking-wider text-on-surface-variant flex items-center gap-1">
                  <Wind className="h-3 w-3" /> Wave Intensity:
                </span>
                <div className="flex gap-1">
                  {['calm', 'normal', 'storm'].map(s => (
                    <button
                      key={s}
                      onClick={() => setWaveSpeed(s)}
                      className={`px-2 py-0.5 rounded text-[9px] font-label-caps tracking-widest uppercase transition-all ${
                        waveSpeed === s
                          ? 'bg-ice-light/30 text-ice-light border border-ice-light/60 font-bold'
                          : 'bg-void-black/60 text-on-surface-variant hover:text-pure-snow'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 3. Crest Heraldry & FX */}
          <div className="space-y-3 pt-2 border-t border-outline/10">
            <label className="font-label-caps text-[11px] text-ice-light tracking-widest uppercase block">
              3. Crest Seal &amp; Atmosphere
            </label>

            {/* Toggle: Detailed Crest */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-void-black/40 border border-outline/15">
              <div>
                <span className="font-label-caps text-xs text-pure-snow block">Intricate Heraldic Seals</span>
                <span className="text-[10px] text-on-surface-variant/70">Multi-layered runic crest filigree</span>
              </div>
              <input
                type="checkbox"
                checked={detailedCrest}
                onChange={e => setDetailedCrest(e.target.checked)}
                className="w-4 h-4 accent-amber-500 cursor-pointer"
              />
            </div>

            {/* Toggle: Emitted Micro-particles */}
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-void-black/40 border border-outline/15">
              <div>
                <span className="font-label-caps text-xs text-pure-snow block">Emitted Elemental Particles</span>
                <span className="text-[10px] text-on-surface-variant/70">Glistening snow dust &amp; ash embers</span>
              </div>
              <input
                type="checkbox"
                checked={particles}
                onChange={e => setParticles(e.target.checked)}
                className="w-4 h-4 accent-amber-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Preview Modes */}
          <div className="space-y-2.5 pt-2 border-t border-outline/10">
            <label className="font-label-caps text-[11px] text-ice-light tracking-widest uppercase block flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5" />
              <span>Preview Environment</span>
            </label>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-void-black/60 rounded-xl border border-outline/20">
              {[
                { id: 'cards', label: 'Card Mockup' },
                { id: 'large', label: 'Full Heraldry' },
                { id: 'battlefield', label: 'Battlefield' }
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setPreviewMode(opt.id)}
                  className={`py-2 px-1 text-center rounded-lg font-label-caps text-[10px] tracking-wider transition-all cursor-pointer ${
                    previewMode === opt.id
                      ? 'bg-ember-gold/20 text-ember-gold border border-ember-gold/50 shadow-[0_0_10px_rgba(234,179,8,0.25)] font-bold'
                      : 'text-on-surface-variant hover:text-pure-snow'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Right Panel: Live Interactive Preview Stage */}
        <main className="lg:col-span-8 flex flex-col items-center">
          
          {/* Environment Backdrop Container */}
          <div 
            className={`w-full rounded-2xl border border-outline/20 p-4 sm:p-8 flex items-center justify-center transition-all min-h-[580px] relative overflow-hidden ${
              previewMode === 'battlefield'
                ? 'bg-[url("/images/bg-game.webp")] bg-cover bg-center shadow-[inset_0_0_80px_rgba(0,0,0,0.85)]'
                : previewMode === 'cards'
                ? 'bg-void-black/90'
                : 'bg-gradient-to-b from-void-black via-surface/40 to-void-black'
            }`}
          >
            {/* Ambient Background Aura */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_40%,_rgba(56,189,248,0.12)_0%,_transparent_60%)] pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_40%,_rgba(239,68,68,0.12)_0%,_transparent_60%)] pointer-events-none" />

            {/* PREVIEW MODE 1: Exact Card Mockup */}
            {previewMode === 'cards' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
                {/* Frost Domain Card */}
                <div className="card-frost card-no-tilt glass-obsidian border border-ice-light/30 rounded-xl overflow-hidden flex flex-col group shadow-xl">
                  <div className="relative h-56 sm:h-64 overflow-hidden bg-gradient-to-b from-void-black/95 via-sky-950/20 to-void-black flex items-center justify-center p-3">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(56,189,248,0.25)_0%,_transparent_75%)] pointer-events-none" />
                    
                    <div className="h-full w-full max-w-[195px] flex items-center justify-center py-1">
                      <FactionBanner 
                        faction="frost" 
                        idPrefix="pg-frost"
                        options={{ rodStyle, fabricFolds, fabricWave, waveSpeed, tassels, detailedCrest, particles }}
                      />
                    </div>
                  </div>

                  <div className="p-4 flex flex-col justify-between flex-grow gap-3">
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <h3 className="text-base md:text-xl text-ice-light tracking-widest uppercase almendra-font font-bold">
                          FROST DOMAIN
                        </h3>
                        <span className="text-[9px] font-label-caps tracking-widest text-ice-light/70">CONTROL / DEFENSE</span>
                      </div>
                      <p className="text-on-surface-variant text-xs leading-relaxed">
                        Absolute order and crystalline geometry. Freeze encroaching enemies, raise impassable glacial barriers, and claim eternal winter dominion.
                      </p>
                    </div>

                    <button type="button" className="py-2.5 px-4 rounded-xl tracking-widest rye-font text-xs font-bold flex items-center justify-center gap-2 bg-gradient-to-r from-ice-light/20 via-sky-400/30 to-ice-light/20 border border-ice-light/60 text-pure-snow shadow-[0_0_20px_rgba(56,189,248,0.25)] cursor-pointer">
                      <span>SELECT FACTION</span>
                    </button>
                  </div>
                </div>

                {/* Ash Domain Card */}
                <div className="card-fire card-no-tilt glass-obsidian border border-magma-core/30 rounded-xl overflow-hidden flex flex-col group shadow-xl">
                  <div className="relative h-56 sm:h-64 overflow-hidden bg-gradient-to-b from-void-black/95 via-rose-950/20 to-void-black flex items-center justify-center p-3">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(239,68,68,0.28)_0%,_transparent_75%)] pointer-events-none" />
                    
                    <div className="h-full w-full max-w-[195px] flex items-center justify-center py-1">
                      <FactionBanner 
                        faction="ash" 
                        idPrefix="pg-ash"
                        options={{ rodStyle, fabricFolds, fabricWave, waveSpeed, tassels, detailedCrest, particles }}
                      />
                    </div>
                  </div>

                  <div className="p-4 flex flex-col justify-between flex-grow gap-3">
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <h3 className="text-base md:text-xl text-magma-core tracking-widest uppercase almendra-font font-bold">
                          ASH DOMAIN
                        </h3>
                        <span className="text-[9px] font-label-caps tracking-widest text-magma-core/70">ASSAULT / BURST</span>
                      </div>
                      <p className="text-on-surface-variant text-xs leading-relaxed">
                        Explosive violence and volcanic power. Break enemy lines with raw lava bombardments, molten hazards, and scorched-earth dominance.
                      </p>
                    </div>

                    <button type="button" className="py-2.5 px-4 rounded-xl tracking-widest rye-font text-xs font-bold flex items-center justify-center gap-2 bg-gradient-to-r from-magma-core/25 via-rose-600/35 to-magma-core/25 border border-magma-core/60 text-pure-snow shadow-[0_0_20px_rgba(239,68,68,0.25)] cursor-pointer">
                      <span>SELECT FACTION</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* PREVIEW MODE 2 & 3: Large Heraldry & Battlefield Showcase */}
            {(previewMode === 'large' || previewMode === 'battlefield') && (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-10 sm:gap-16 w-full py-6">
                {/* Frost Large Banner */}
                <div className="flex flex-col items-center gap-3">
                  <div className="w-[190px] sm:w-[240px] md:w-[280px] aspect-[220/430] drop-shadow-[0_20px_45px_rgba(56,189,248,0.45)]">
                    <FactionBanner 
                      faction="frost" 
                      idPrefix="pg-frost-lg"
                      options={{ rodStyle, fabricFolds, fabricWave, waveSpeed, tassels, detailedCrest, particles }}
                    />
                  </div>
                  <span className="almendra-font tracking-widest text-ice-light text-base sm:text-lg font-bold flex items-center gap-1.5 drop-shadow-[0_0_10px_rgba(56,189,248,0.5)]">
                    <Snowflake className="h-4 w-4" /> FROST DOMAIN
                  </span>
                </div>

                {/* Ash Large Banner */}
                <div className="flex flex-col items-center gap-3">
                  <div className="w-[190px] sm:w-[240px] md:w-[280px] aspect-[220/430] drop-shadow-[0_20px_45px_rgba(239,68,68,0.45)]">
                    <FactionBanner 
                      faction="ash" 
                      idPrefix="pg-ash-lg"
                      options={{ rodStyle, fabricFolds, fabricWave, waveSpeed, tassels, detailedCrest, particles }}
                    />
                  </div>
                  <span className="almendra-font tracking-widest text-magma-core text-base sm:text-lg font-bold flex items-center gap-1.5 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]">
                    <Flame className="h-4 w-4" /> ASH DOMAIN
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Quick Tips footer */}
          <div className="mt-4 text-center text-xs text-on-surface-variant/60 font-label-caps tracking-widest">
            ✦ Adjust the toggles on the left to inspect forged finials, fabric creases, and wave physics in real-time.
          </div>
        </main>
      </div>
    </div>
  );
}
