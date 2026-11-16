import React, { useEffect, useState } from "react";
import { RotateCcw, ArrowLeft } from "lucide-react";

/**
 * VictoryScreen — Heraldic Animated Faction Banners, Living Ambient Particles,
 * and Dominion Presentation for Frost & Ash.
 */

/* ---------- Crest Components ---------- */

function SnowflakeCrest() {
  return (
    <>
      <g className="v-spin">
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <g key={a} transform={`rotate(${a} 110 176)`} stroke="#e6f7ff" strokeWidth="4" strokeLinecap="round" fill="none">
            <line x1="110" y1="176" x2="110" y2="108" />
            <polyline points="110,128 98,116" />
            <polyline points="110,128 122,116" />
            <polyline points="110,148 101,140" />
            <polyline points="110,148 119,140" />
          </g>
        ))}
      </g>
      <circle cx="110" cy="176" r="9" fill="#050d1a" stroke="#bfe9ff" strokeWidth="3" />
    </>
  );
}

function FlameCrest() {
  return (
    <>
      <defs>
        <linearGradient id="v-flame-outer" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe3c7" />
          <stop offset="0.45" stopColor="#ff8a3d" />
          <stop offset="1" stopColor="#b8360f" />
        </linearGradient>
        <linearGradient id="v-flame-inner" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff6e8" />
          <stop offset="1" stopColor="#ffb347" />
        </linearGradient>
      </defs>
      <g className="v-flame">
        <path
          d="M110 96 C128 124 152 142 150 182 C148 214 128 234 110 234 C92 234 72 214 70 182 C68 158 82 148 90 128 C94 140 100 146 105 146 C102 128 104 112 110 96 Z"
          fill="url(#v-flame-outer)" stroke="#ffe3c7" strokeWidth="2.5" strokeLinejoin="round"
        />
      </g>
      <g className="v-flame-in">
        <path
          d="M110 152 C122 170 132 178 130 198 C128 214 118 224 110 224 C102 224 92 214 90 198 C88 182 100 172 110 152 Z"
          fill="url(#v-flame-inner)"
        />
      </g>
    </>
  );
}

/* ---------- Ornaments under the crest ---------- */

const FrostOrnament = (
  <g className="v-orn" fill="#bfe9ff" fillOpacity="0.8">
    <circle cx="110" cy="300" r="3" />
    <circle cx="98" cy="306" r="2.2" />
    <circle cx="122" cy="306" r="2.2" />
  </g>
);

const AshOrnament = (
  <g className="v-orn" fill="#ff8a3d">
    <circle cx="62" cy="120" r="2.4" fillOpacity="0.9" />
    <circle cx="156" cy="96" r="1.8" fillOpacity="0.8" />
    <circle cx="170" cy="150" r="2.6" fillOpacity="0.7" />
    <circle cx="50" cy="188" r="1.6" fillOpacity="0.8" />
    <circle cx="168" cy="236" r="2" fillOpacity="0.7" />
    <circle cx="70" cy="262" r="2.2" fillOpacity="0.8" />
    <circle cx="110" cy="290" r="2.6" fillOpacity="0.9" />
    <circle cx="96" cy="304" r="1.6" fillOpacity="0.7" />
    <circle cx="126" cy="308" r="1.8" fillOpacity="0.7" />
  </g>
);

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
    banner: {
      cloth: ["#14639c", "#0b3d68", "#072543"],
      rim: ["#e6f7ff", "#35d6f5"],
      glow: "#35d6f5",
      rod: "#bfe9ff",
      inner: "#bfe9ff",
      crack: "#bfe9ff",
      crackOpacity: 0.35,
      clothPath: "M22 16 H198 V345 L110 415 L22 345 Z",
      innerPath: "M36 30 H184 V338 L110 396 L36 338 Z",
      cracks: ["22,250 52,262 60,290 84,300", "198,220 170,236 164,262 142,270", "110,415 112,380 100,356"],
    },
    Crest: SnowflakeCrest,
    ornament: FrostOrnament,
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
    banner: {
      cloth: ["#3a2a26", "#1f1512", "#120b09"],
      rim: ["#ffe3c7", "#ff8a3d"],
      glow: "#ff8a3d",
      rod: "#6b5a54",
      inner: "#ffb347",
      crack: "#ff8a3d",
      crackOpacity: 0.75,
      clothPath: "M22 16 H198 V352 L180 374 L162 354 L142 396 L122 362 L108 408 L90 364 L68 390 L50 356 L34 378 L22 356 Z",
      innerPath: "M36 30 H184 V330 H36 Z",
      cracks: ["22,230 50,246 58,276 82,290", "198,200 172,218 166,248 144,258", "60,340 72,316 66,300"],
    },
    Crest: FlameCrest,
    ornament: AshOrnament,
  },
};

/* ---------- Banner Component ---------- */

function Banner({ theme }) {
  const b = theme.banner;
  const Crest = theme.Crest;
  return (
    <div className="v-banner" aria-hidden="true">
      <svg viewBox="0 0 220 430" width="100%" height="100%">
        <defs>
          <linearGradient id="v-cloth" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={b.cloth[0]} />
            <stop offset="0.6" stopColor={b.cloth[1]} />
            <stop offset="1" stopColor={b.cloth[2]} />
          </linearGradient>
          <linearGradient id="v-rim" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={b.rim[0]} />
            <stop offset="1" stopColor={b.rim[1]} />
          </linearGradient>
          <radialGradient id="v-glow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor={b.glow} stopOpacity="0.55" />
            <stop offset="1" stopColor={b.glow} stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect x="2" y="2" width="216" height="14" rx="7" fill="url(#v-rim)" />
        <circle cx="4" cy="9" r="9" fill={b.rod} />
        <circle cx="216" cy="9" r="9" fill={b.rod} />

        <path d={b.clothPath} fill="url(#v-cloth)" stroke="url(#v-rim)" strokeWidth="3" strokeLinejoin="round" />
        <path d={b.innerPath} fill="none" stroke={b.inner} strokeOpacity="0.4" strokeWidth="1.5" strokeDasharray="2 5" />

        <circle className="v-glow" cx="110" cy="176" r="88" fill="url(#v-glow)" />
        <Crest />

        <g className="v-cracks" stroke={b.crack} strokeOpacity={b.crackOpacity} strokeWidth="1.4" fill="none" strokeLinejoin="round">
          {b.cracks.map((p) => <polyline key={p} points={p} />)}
        </g>
        {theme.ornament}
      </svg>
    </div>
  );
}

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
  const key = team === "ash" ? "ash" : "frost";
  const theme = themes[key];
  const loser = themes[theme.loser];

  useEffect(() => {
    setBarWidth(0);
    const t = setTimeout(() => setBarWidth(winnerShare), 700);
    return () => clearTimeout(t);
  }, [winnerShare, key]);

  return (
    <div 
      id="gameOverModal"
      className={`v-root v-theme-${key} ${modalVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
      style={theme.vars}
    >
      <style>{css}</style>
      
      {/* 1. Living Ambient Particle Engine (Snow falling / Embers rising) */}
      <div className="v-particles" aria-hidden="true" key={key}>
        {PARTICLES.map((p, i) => (
          <span key={i} className={`v-p v-p-${theme.particle}`} style={p} />
        ))}
      </div>

      {/* 2. Main Compact Single-Viewport Stage */}
      <section key={key} className="v-stage" aria-labelledby="v-title">
        {/* Animated Heraldic Faction Banner */}
        <Banner theme={theme} />

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
              <button id="playAgainBtn" className="v-btn v-btn-primary" onClick={onPlayAgain}>
                <RotateCcw className="h-5 w-5" />
                <span>Play again</span>
              </button>
            )}
            <button id="gameOverExitBtn" className="v-btn v-btn-ghost" onClick={onMainMenu}>
              <ArrowLeft className="h-5 w-5" />
              <span>Main menu</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ---------- Scoped Victory Screen Stylesheet ---------- */

const css = `
.v-root {
  position: fixed; inset: 0; width: 100vw; height: 100vh; max-height: 100vh; max-height: 100dvh;
  z-index: 10000; display: flex; align-items: center; justify-content: center;
  padding: clamp(16px, 3vh, 36px) clamp(16px, 4vw, 40px); overflow: hidden;
  color: var(--light);
  font-family: 'Fira Sans', system-ui, sans-serif;
  background: radial-gradient(circle at 50% 45%, var(--bg-top) 0%, var(--bg-bottom) 100%);
  box-sizing: border-box;
  transition: opacity 0.5s ease-out;
  user-select: none;
}
.v-root *, .v-root *::before, .v-root *::after { box-sizing: border-box; }

.v-stage {
  position: relative; z-index: 1; display: grid;
  grid-template-columns: minmax(140px, 210px) minmax(0, 560px);
  gap: clamp(24px, 4.5vw, 64px); align-items: center; justify-content: center;
  max-width: 920px; width: 100%; max-height: 92vh;
}

.v-banner {
  width: 100%; aspect-ratio: 220 / 430; max-height: min(420px, 68vh); transform-origin: top center;
  filter: drop-shadow(0 16px 36px rgba(var(--accent-rgb), .32));
  will-change: transform;
  transform: translateZ(0);
  backface-visibility: hidden;
  animation: v-drop 1.1s cubic-bezier(.2,.9,.25,1.05) both, v-sway 7s 1.3s ease-in-out infinite;
}
@keyframes v-drop {
  0%   { transform: translate3d(0, -120%, 0) rotate(-2deg); opacity: 0; }
  60%  { transform: translate3d(0, 2%, 0) rotate(.6deg); opacity: 1; }
  100% { transform: translate3d(0, 0, 0) rotate(0); }
}
@keyframes v-sway { 
  0%,100% { transform: translate3d(0, 0, 0) rotate(0); } 
  25% { transform: translate3d(0, 0, 0) rotate(.8deg); } 
  75% { transform: translate3d(0, 0, 0) rotate(-.8deg); } 
}

.v-content {
  display: flex; flex-direction: column; align-items: flex-start; text-align: left;
  will-change: transform;
  transform: translateZ(0);
}

.v-banner-wing {
  display: flex; align-items: center; gap: 10px; margin-bottom: 8px;
}
.v-winged-line {
  height: 1px; width: 36px;
  background: linear-gradient(90deg, transparent, var(--accent));
}
.v-winged-line.right {
  background: linear-gradient(90deg, var(--accent), transparent);
}
.v-winged-label {
  font-size: 0.75rem; letter-spacing: 0.38em; font-weight: 800; text-transform: uppercase;
  color: var(--accent); text-shadow: 0 0 10px rgba(var(--accent-rgb), 0.7);
}

.v-title { margin: 0 0 10px; font-weight: 900; line-height: 1.05; }
.v-title-reveal {
  display: inline-block; font-family: 'Metamorphous', 'Almendra', Georgia, serif;
  font-size: clamp(2.4rem, 5.5vw, 4.4rem); letter-spacing: .02em; text-transform: uppercase;
  background: linear-gradient(180deg, #ffffff 10%, var(--light) 50%, var(--accent) 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
  filter: drop-shadow(0 4px 20px rgba(var(--accent-rgb), .65));
  will-change: transform, opacity;
  transform: translateZ(0);
  animation: v-reveal 1.2s .4s cubic-bezier(.5,0,.2,1) both, v-titleglow var(--pulse) 1.8s ease-in-out infinite;
}
@keyframes v-reveal { from { clip-path: inset(0 100% 0 0); } to { clip-path: inset(0 0 0 0); } }

.v-sub { margin: 0 0 18px; max-width: 48ch; font-size: 1rem; line-height: 1.5; color: var(--sub); text-shadow: 0 2px 6px rgba(0,0,0,0.7); }

.v-kicker-wrap {
  display: flex; align-items: center; gap: 8px; margin-bottom: 8px;
}
.v-kicker-dot {
  width: 4px; height: 4px; border-radius: 50%;
  background: var(--accent); box-shadow: 0 0 6px rgba(var(--accent-rgb), 0.8);
}
.v-kicker {
  font-family: 'Fira Sans', system-ui, sans-serif;
  font-size: 0.72rem; letter-spacing: 0.22em; font-weight: 800; text-transform: uppercase;
  color: var(--muted); opacity: 0.9;
}

.v-dominion { margin-bottom: 28px; width: 100%; max-width: 440px; }
.v-dom-head { display: flex; justify-content: space-between; margin-bottom: 6px; font-weight: 700; font-size: .88rem; }
.v-dom-win { color: var(--accent); }
.v-dom-lose { opacity: .85; }
.v-bar { height: 10px; border-radius: 4px; overflow: hidden; box-shadow: inset 0 0 0 1px var(--line); }
.v-bar-win {
  height: 100%;
  background: linear-gradient(90deg, var(--mid), var(--accent));
  box-shadow: 3px 0 12px rgba(var(--accent-rgb), .85);
  transition: width 1.4s cubic-bezier(.2,.8,.2,1);
}

.v-actions { display: flex; flex-wrap: wrap; gap: 14px; }
.v-btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 10px;
  padding: 12px 26px; border-radius: 12px; cursor: pointer;
  font: 700 0.95rem 'Fira Sans', sans-serif; text-transform: uppercase; letter-spacing: 0.06em;
  transition: transform .18s ease, box-shadow .2s ease, background .2s ease;
}
.v-btn:hover { transform: translateY(-2px) scale(1.03); }
.v-btn:active { transform: translateY(0) scale(0.97); }
.v-btn-primary {
  border: 0; color: var(--btn-text);
  background: linear-gradient(180deg, var(--light), var(--accent));
  box-shadow: 0 6px 24px rgba(var(--accent-rgb), .55);
}
.v-btn-ghost { color: var(--light); background: var(--panel); border: 1.5px solid var(--line); }
.v-btn-ghost:hover { background: rgba(var(--accent-rgb), .22); }

@media (max-width: 760px) {
  .v-stage { grid-template-columns: 1fr; text-align: center; justify-items: center; gap: 14px; }
  .v-banner { max-width: 105px; max-height: 20vh; }
  .v-content { align-items: center; text-align: center; }
  .v-title-reveal { font-size: 2.2rem; }
  .v-sub { font-size: 0.85rem; margin-bottom: 12px; max-width: 36ch; }
  .v-kicker-wrap { justify-content: center; }
  .v-dominion { margin-bottom: 20px; max-width: 320px; }
  .v-actions { justify-content: center; width: 100%; gap: 10px; }
  .v-btn { padding: 10px 18px; font-size: 0.85rem; }
}

/* ---------- Ambient Animation Keyframes ---------- */

@keyframes v-titleglow {
  0%,100% { opacity: 0.94; transform: translate3d(0, 0, 0); }
  50%     { opacity: 1; transform: translate3d(0, -1px, 0); }
}
@keyframes v-titleheat {
  0%,100% { opacity: 0.94; }
  50% { opacity: 1; }
}
.v-theme-ash .v-title-reveal { animation-name: v-reveal, v-titleheat; }

/* Particles */
.v-particles { position: absolute; inset: 0; z-index: 0; overflow: hidden; pointer-events: none; }
.v-p {
  position: absolute; left: var(--x); width: var(--s); height: var(--s);
  border-radius: 50%; opacity: 0;
  will-change: transform, opacity;
  animation-duration: calc(var(--d) * var(--speed, 1) * 1s);
  animation-delay: calc(var(--f) * var(--d) * var(--speed, 1) * -1s);
  animation-iteration-count: infinite; animation-timing-function: linear;
}
.v-p-snow { top: 0; background: #fff; box-shadow: 0 0 6px rgba(191,233,255,.9); animation-name: v-fall; }
.v-p-ember {
  bottom: 0; animation-name: v-rise;
  background: radial-gradient(circle, #fff1dc, var(--accent));
  box-shadow: 0 0 8px 2px rgba(var(--accent-rgb), .75);
}
@keyframes v-fall {
  0%   { transform: translate3d(0,-8vh,0); opacity: 0; }
  10%, 90% { opacity: var(--o); }
  100% { transform: translate3d(var(--drift),108vh,0); opacity: 0; }
}
@keyframes v-rise {
  0%   { transform: translate3d(0,0,0) scale(1); opacity: 0; }
  12%  { opacity: var(--o); }
  100% { transform: translate3d(var(--drift),-105vh,0) scale(.3); opacity: 0; }
}

/* Banner Artwork Keyframes */
.v-spin, .v-glow, .v-flame, .v-flame-in {
  transform-box: view-box;
  will-change: transform;
}
.v-spin { transform-origin: 110px 176px; animation: v-spin 60s linear infinite; }
@keyframes v-spin { to { transform: rotate(360deg); } }

.v-glow { transform-origin: 110px 176px; animation: v-breathe var(--pulse, 3s) ease-in-out infinite; }
@keyframes v-breathe {
  0%,100% { transform: scale(.92); opacity: .75; }
  50%     { transform: scale(1.08); opacity: 1; }
}
.v-theme-ash .v-glow { animation-name: v-heat; animation-timing-function: ease-in-out; }
@keyframes v-heat {
  0%,100% { transform: scale(.95); opacity: .8; }
  15% { transform: scale(1.1); opacity: 1; }
  30% { transform: scale(1); opacity: .85; }
  55% { transform: scale(1.12); opacity: 1; }
  75% { transform: scale(.97); opacity: .8; }
}

.v-flame { transform-origin: 110px 234px; animation: v-flicker 1.8s ease-in-out infinite; }
.v-flame-in { transform-origin: 110px 224px; animation: v-flicker 1.1s ease-in-out infinite reverse; }
@keyframes v-flicker {
  0%,100% { transform: scale(1,1) skewX(0); }
  20% { transform: scale(.97,1.05) skewX(1.5deg); }
  40% { transform: scale(1.03,.96) skewX(-1deg); }
  60% { transform: scale(.98,1.04) skewX(1deg); }
  80% { transform: scale(1.02,.98) skewX(-1.5deg); }
}

.v-theme-ash .v-cracks { animation: v-crackglow 2.6s ease-in-out infinite; }
@keyframes v-crackglow { 0%,100% { opacity: .45; } 50% { opacity: 1; } }

.v-orn circle { animation: v-twinkle calc(var(--pulse, 3s) * .8) ease-in-out infinite; }
.v-orn circle:nth-child(3n+2) { animation-delay: -.9s; }
.v-orn circle:nth-child(3n) { animation-delay: -1.8s; }
@keyframes v-twinkle { 0%,100% { opacity: .25; } 50% { opacity: 1; } }

.reduced-motion .v-banner,
.reduced-motion .v-title-reveal { animation: none !important; }
.reduced-motion .v-particles { display: none !important; }
.reduced-motion .v-spin, .reduced-motion .v-glow, .reduced-motion .v-flame, .reduced-motion .v-flame-in, .reduced-motion .v-cracks, .reduced-motion .v-orn circle { animation: none !important; }
.reduced-motion .v-bar-win { transition: none !important; }

@media (prefers-reduced-motion: reduce) {
  .v-banner, .v-title-reveal { animation: none !important; }
  .v-particles { display: none !important; }
  .v-spin, .v-glow, .v-flame, .v-flame-in, .v-cracks, .v-orn circle { animation: none !important; }
  .v-bar-win { transition: none !important; }
}
`;
