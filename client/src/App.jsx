import React, { lazy, Suspense, useState, useEffect } from 'react';
import Lobby from './components/Lobby.jsx';

const loadGame = () => import('./components/Game.jsx');
const loadGuide = () => import('./components/Guide.jsx');
const loadNotes = () => import('./components/Notes.jsx');
const loadWheel = () => import('./components/Wheel.jsx');
const loadSettings = () => import('./components/Settings.jsx');

const Game = lazy(loadGame);
const Guide = lazy(loadGuide);
const Notes = lazy(loadNotes);
const Wheel = lazy(loadWheel);
const Settings = lazy(loadSettings);

const loadSecondaryFonts = () => {
  if (typeof document === 'undefined') return;
  if (document.querySelector('link[data-secondary-fonts]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@700&family=Cinzel+Decorative:wght@700&family=Exo+2:wght@400;600;700&family=Rajdhani:wght@600;700&family=Fira+Sans:wght@400;600&family=Space+Grotesk:wght@400;600;700&display=swap';
  link.dataset.secondaryFonts = 'true';
  document.head.appendChild(link);
};

const warmGameAssets = () => {
  loadSecondaryFonts();
  ['/images/bg-game.webp', '/images/bg-game2.webp'].forEach((href) => {
    if (document.head.querySelector(`link[data-game-asset="${href}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.as = 'image';
    link.href = href;
    link.type = 'image/webp';
    link.dataset.gameAsset = href;
    document.head.appendChild(link);
  });
};

const ROUTE_METADATA = {
  LOBBY: {
    title: 'Mythic Territories — Elemental Turn-Based Strategy Game',
    description: 'Command elemental factions in Mythic Territories — free browser turn-based strategy. Deploy unique units, master abilities, and battle for dominion.',
    canonical: 'https://mythic-territories.xyz/'
  },
  GUIDE: {
    title: 'Rulebook & Unit Guide — Mythic Territories',
    description: 'Master Mythic Territories rules, unit combat stats, faction traits, movement ranges, and special abilities for Frost and Ash.',
    canonical: 'https://mythic-territories.xyz/?page=rules'
  },
  NOTES: {
    title: 'Patch Notes & Changelog — Mythic Territories',
    description: 'Official patch notes, balance adjustments, unit reworks, and feature updates for Mythic Territories.',
    canonical: 'https://mythic-territories.xyz/?page=notes'
  },
  WHEEL: {
    title: 'Destiny Wheel — Mythic Territories',
    description: 'Spin the Destiny Wheel to unlock randomized bonuses, blessings, and elemental unit buffs in Mythic Territories.',
    canonical: 'https://mythic-territories.xyz/?page=wheel'
  },
  SETTINGS: {
    title: 'Settings — Mythic Territories',
    description: 'Configure display, audio, animation, and accessibility settings for Mythic Territories.',
    canonical: 'https://mythic-territories.xyz/?page=settings'
  },
  GAME: {
    title: 'Battlefield — Mythic Territories',
    description: 'Active tactical match in Mythic Territories — command your elemental units and battle for dominion.',
    canonical: 'https://mythic-territories.xyz/'
  }
};

function ScreenLoader() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-void-black text-on-surface">
      <div className="flex flex-col items-center gap-4" role="status" aria-live="polite">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-outline/20 border-t-ember-gold motion-reduce:animate-none" />
        <span className="font-label-caps text-[10px] tracking-[0.25em] text-on-surface-variant">Entering the realm</span>
      </div>
    </div>
  );
}

export default function App() {
  const parseCurrentView = () => {
    const params = new URLSearchParams(window.location.search);
    const page = params.get('page')?.toLowerCase();
    const path = window.location.pathname.replace(/\/+$/, '').toLowerCase();

    if (page === 'rules' || path.endsWith('/rules') || path.endsWith('/guide')) return 'GUIDE';
    if (page === 'notes' || path.endsWith('/notes')) return 'NOTES';
    if (page === 'wheel' || page === 'destiny' || path.endsWith('/wheel') || path.endsWith('/destiny')) return 'WHEEL';
    if (page === 'settings' || path.endsWith('/settings')) return 'SETTINGS';
    if ((params.get('room') && params.get('team')) || params.get('mode') === 'local') return 'GAME';
    return 'LOBBY';
  };

  const [view, setView] = useState(parseCurrentView);

  useEffect(() => {
    const handlePopState = () => {
      const v = parseCurrentView();
      if (v !== 'LOBBY') loadSecondaryFonts();
      setView(v);
    };
    window.addEventListener('popstate', handlePopState);

    // Only load secondary fonts if the user landed directly on a game/guide/wheel subpage
    if (view !== 'LOBBY') {
      loadSecondaryFonts();
    }

    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const meta = ROUTE_METADATA[view] || ROUTE_METADATA.LOBBY;
    document.title = meta.title;

    const descEl = document.querySelector('meta[name="description"]');
    if (descEl) descEl.setAttribute('content', meta.description);

    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', meta.title);

    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', meta.description);

    const twTitle = document.querySelector('meta[name="twitter:title"]');
    if (twTitle) twTitle.setAttribute('content', meta.title);

    const twDesc = document.querySelector('meta[name="twitter:description"]');
    if (twDesc) twDesc.setAttribute('content', meta.description);

    const canonicalEl = document.querySelector('link[rel="canonical"]');
    if (canonicalEl) canonicalEl.setAttribute('href', meta.canonical);
  }, [view]);

  const warmRoute = (target) => {
    if (target === 'GAME') {
      loadSecondaryFonts();
      warmGameAssets();
      loadGame();
    } else if (target === 'NOTES') {
      loadNotes();
    } else if (target === 'GUIDE') {
      loadSecondaryFonts();
      loadGuide();
    } else if (target === 'WHEEL') {
      loadSecondaryFonts();
      loadWheel();
    } else if (target === 'SETTINGS') {
      loadSecondaryFonts();
      loadSettings();
    }
  };

  const navigateTo = (newView, params = {}) => {
    const url = new URL(window.location.origin + (newView === 'LOBBY' ? '/' : window.location.pathname));
    
    if (newView === 'GUIDE') {
      url.searchParams.set('page', 'rules');
    } else if (newView === 'NOTES') {
      url.searchParams.set('page', 'notes');
    } else if (newView === 'WHEEL') {
      url.searchParams.set('page', 'wheel');
    } else if (newView === 'SETTINGS') {
      url.searchParams.set('page', 'settings');
    } else if (newView === 'LOBBY') {
      url.search = '';
      Object.entries(params).forEach(([key, val]) => {
        url.searchParams.set(key, val);
      });
    } else {
      Object.entries(params).forEach(([key, val]) => {
        url.searchParams.set(key, val);
      });
    }

    window.history.pushState({}, '', url.toString());
    setView(newView);
  };

  return (
    <div className={`min-h-screen w-full flex flex-col ${view === 'GAME' ? 'bg-transparent' : 'bg-surface'} text-on-surface select-none font-body-md`}>
      <Suspense fallback={<ScreenLoader />}>
        {view === 'LOBBY' && <Lobby navigateTo={navigateTo} onWarm={warmRoute} />}
        {view === 'GAME' && <Game navigateTo={navigateTo} />}
        {view === 'GUIDE' && <Guide navigateTo={navigateTo} />}
        {view === 'NOTES' && <Notes navigateTo={navigateTo} />}
        {view === 'WHEEL' && <Wheel navigateTo={navigateTo} />}
        {view === 'SETTINGS' && <Settings navigateTo={navigateTo} />}
      </Suspense>
    </div>
  );
}
