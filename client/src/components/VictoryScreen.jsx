import React, { useEffect, useState } from "react";
import RotateCcw from 'lucide-react/dist/esm/icons/rotate-ccw.js';
import ArrowLeft from 'lucide-react/dist/esm/icons/arrow-left.js';
import FactionBanner from "./FactionBanner.jsx";
import '@/styles/victory.css';

/**
 * VictoryScreen — Heraldic Animated Faction Banners, Living Ambient Particles,
 * and Dominion Presentation for Frost & Ash.
 */

/* ---------- Themes ---------- */

const themes = {
  frost: {
    name: "Frost",
    titleLine: "Ascendant!",
    subtitle: "The eternal winter claims the realm. Team Frost has conquered the battlefield.",
    loser: "ash",
    particle: "snow",
    vars: {
      "--bg-top": "#071b30",
      "--bg-bottom": "#02070e",
      "--bg-glow": "transparent",
      "--light": "#bfe9ff",
      "--accent": "#35d6f5",
      "--accent-rgb": "53,214,245",
      "--mid": "#1a7ab8",
      "--dark": "#0b3d68",
      "--sub": "#d9f1ff",
      "--muted": "#8fc6e6",
      "--line": "rgba(191,233,255,.3)",
      "--panel": "rgba(11,27,48,.7)",
      "--btn-text": "#04162b",
      "--pulse": "4s",
      "--speed": "1.2",
    },
  },

  ash: {
    name: "Ash",
    titleLine: "Ascendant!",
    subtitle: "The volcanic pyre incinerates all opposition. Team Ash reigns supreme.",
    loser: "frost",
    particle: "ember",
    vars: {
      "--bg-top": "#1c0d08",
      "--bg-bottom": "#060201",
      "--bg-glow": "transparent",
      "--light": "#ffe3c7",
      "--accent": "#ff8a3d",
      "--accent-rgb": "255,138,61",
      "--mid": "#c2461a",
      "--dark": "#5a2a22",
      "--sub": "#ffe9d6",
      "--muted": "#c9a48a",
      "--line": "rgba(255,227,199,.28)",
      "--panel": "rgba(30,16,12,.75)",
      "--btn-text": "#2a0f05",
      "--pulse": "2.2s",
      "--speed": "0.55",
    },
  },
};

/* ---------- Particles Generator ---------- */

const rnd = (i, k) => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const PARTICLES = Array.from({ length: 34 }, (_, i) => ({
  "--x": `${(rnd(i, 1) * 100).toFixed(1)}%`,
  "--s": `${(2 + rnd(i, 2) * 4).toFixed(1)}px`,
  "--d": (8 + rnd(i, 3) * 10).toFixed(1),
  "--f": rnd(i, 4).toFixed(2),
  "--drift": `${((rnd(i, 5) - 0.5) * 140).toFixed(0)}px`,
  "--o": (0.35 + rnd(i, 6) * 0.55).toFixed(2),
}));

/* ---------- Main Component ---------- */

export default function VictoryScreen({
  team = "frost",
  isLocal = true,
  myTeam = null,
  modalVisible = true,
  winnerShare = 68,
  stats = [],
  onPlayAgain = () => {},
  onMainMenu = () => {},
}) {
  const [barWidth, setBarWidth] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const [exitTarget, setExitTarget] = useState(null); // 'playAgain' | 'mainMenu'
  const key = team === "ash" ? "ash" : "frost";
  const theme = themes[key];
  const loser = themes[theme.loser];

  useEffect(() => {
    setBarWidth(0);
    setIsExiting(false);
    setExitTarget(null);
    const t = setTimeout(() => setBarWidth(winnerShare), 700);
    return () => clearTimeout(t);
  }, [winnerShare, key]);

  const handleExit = (fn, target) => {
    if (isExiting) return;
    setIsExiting(true);
    setExitTarget(target);
    setTimeout(() => {
      fn();
    }, 520);
  };

  return (
    <div 
      id="gameOverModal"
      className={`v-root v-theme-${key} ${modalVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'} ${isExiting ? 'v-exiting' : ''}`} 
      style={theme.vars}
    >
      {/* Radiant Exit Transition Veil */}
      <div className={`v-exit-veil ${isExiting ? 'active' : ''}`} aria-hidden="true" />
      
      {/* 1. Living Ambient Particle Engine (Snow falling / Embers rising) */}
      <div className="v-particles" aria-hidden="true" key={key}>
        {PARTICLES.map((p, i) => (
          <span key={i} className={`v-p v-p-${theme.particle}`} style={p} />
        ))}
      </div>

      {/* 2. Main Compact Single-Viewport Stage */}
      <section key={key} className="v-stage" aria-labelledby="v-title">
        {/* Animated Heraldic Faction Banner */}
        <FactionBanner faction={key} mode="storm" className="v-banner" />

        {/* Victory Content Presentation */}
        <div className="v-content">
          <div className="v-banner-wing">
            <span className="v-winged-line" />
            <span className="v-winged-label">✦ DOMINION DECIDED ✦</span>
            <span className="v-winged-line right" />
          </div>

          <h1 id="v-title" className="v-title">
            <span className="v-title-reveal">
              {isLocal
                ? `${theme.name} ${theme.titleLine}`
                : (key === myTeam ? 'Victory!' : 'Defeat')}
            </span>
          </h1>

          <p className="v-sub">{theme.subtitle}</p>

          {/* Title Kicker for Final Territory */}
          <div className="v-kicker-wrap">
            <span className="v-kicker-dot" />
            <span className="v-kicker">FINAL TERRITORY CONTROL</span>
            <span className="v-kicker-dot" />
          </div>

          {/* Territory Dominion Bar */}
          <div 
            className={`v-dominion v-lose-${theme.loser}`} 
            role="img"
            aria-label={`Final territory dominion: ${theme.name} ${winnerShare} percent, ${loser.name} ${100 - winnerShare} percent`}
          >
            <div className="v-dom-head">
              <span className="v-dom-win">{theme.name} {winnerShare}%</span>
              <span className="v-dom-lose" style={{ color: loser.vars["--accent"] }}>{loser.name} {100 - winnerShare}%</span>
            </div>
            <div className="v-bar" style={{ background: `linear-gradient(90deg, ${loser.vars["--dark"]}, ${loser.vars["--accent"]})` }}>
              <div className="v-bar-win" style={{ width: `${barWidth}%` }} />
            </div>
          </div>

          {/* Command Action Buttons */}
          <div className="v-actions">
            {isLocal && (
              <button 
                id="playAgainBtn" 
                className={`v-btn v-btn-primary ${isExiting && exitTarget === 'playAgain' ? 'v-btn-active-exit' : ''}`} 
                onClick={() => handleExit(onPlayAgain, 'playAgain')}
                disabled={isExiting}
              >
                <RotateCcw className={`h-5 w-5 ${isExiting && exitTarget === 'playAgain' ? 'animate-spin' : ''}`} />
                <span>Play again</span>
              </button>
            )}
            <button 
              id="gameOverExitBtn" 
              className={`v-btn v-btn-ghost ${isExiting && exitTarget === 'mainMenu' ? 'v-btn-active-exit' : ''}`} 
              onClick={() => handleExit(onMainMenu, 'mainMenu')}
              disabled={isExiting}
            >
              <ArrowLeft className={`h-5 w-5 ${isExiting && exitTarget === 'mainMenu' ? '-translate-x-1.5 transition-transform' : ''}`} />
              <span>Main menu</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
