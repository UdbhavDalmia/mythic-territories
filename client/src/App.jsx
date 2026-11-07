import React, { lazy, Suspense, useState, useEffect } from 'react';
import Lobby from './components/Lobby.jsx';

const loadGame = () => import('./components/Game.jsx');
const loadGuide = () => import('./components/Guide.jsx');
const loadNotes = () => import('./components/Notes.jsx');
const loadWheel = () => import('./components/Wheel.jsx');

const Game = lazy(loadGame);
const Guide = lazy(loadGuide);
const Notes = lazy(loadNotes);
const Wheel = lazy(loadWheel);

const warmGameAssets = () => {
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
    if (params.get('room') || params.get('mode') === 'local') return 'GAME';
    return 'LOBBY';
  };

  const [view, setView] = useState(parseCurrentView);

  useEffect(() => {
    const handlePopState = () => {
      setView(parseCurrentView());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (view !== 'LOBBY') return;

    const runWhenIdle = window.requestIdleCallback
      ? (callback) => window.requestIdleCallback(callback, { timeout: 2500 })
      : (callback) => window.setTimeout(callback, 1200);
    const cancelIdle = window.cancelIdleCallback
      ? (id) => window.cancelIdleCallback(id)
      : (id) => window.clearTimeout(id);

    let secondaryTask = null;
    const idleTask = runWhenIdle(() => {
      warmGameAssets();
      loadGame();
      secondaryTask = window.setTimeout(() => {
        Promise.allSettled([loadGuide(), loadNotes(), loadWheel()]);
      }, 1200);
    });

    return () => {
      cancelIdle(idleTask);
      if (secondaryTask !== null) window.clearTimeout(secondaryTask);
    };
  }, [view]);

  const navigateTo = (newView, params = {}) => {
    const url = new URL(window.location.origin + (newView === 'LOBBY' ? '/' : window.location.pathname));
    
    if (newView === 'GUIDE') {
      url.searchParams.set('page', 'rules');
    } else if (newView === 'NOTES') {
      url.searchParams.set('page', 'notes');
    } else if (newView === 'WHEEL') {
      url.searchParams.set('page', 'wheel');
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
        {view === 'LOBBY' && <Lobby navigateTo={navigateTo} />}
        {view === 'GAME' && <Game navigateTo={navigateTo} />}
        {view === 'GUIDE' && <Guide navigateTo={navigateTo} />}
        {view === 'NOTES' && <Notes navigateTo={navigateTo} />}
        {view === 'WHEEL' && <Wheel navigateTo={navigateTo} />}
      </Suspense>
    </div>
  );
}
