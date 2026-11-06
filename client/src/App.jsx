import React, { useState, useEffect } from 'react';
import Lobby from './components/Lobby.jsx';
import Game from './components/Game.jsx';
import Guide from './components/Guide.jsx';
import Notes from './components/Notes.jsx';
import Wheel from './components/Wheel.jsx';

export default function App() {
  const [view, setView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const page = params.get('page');
    if (page === 'rules') return 'GUIDE';
    if (page === 'notes') return 'NOTES';
    if (page === 'wheel') return 'WHEEL';
    if (params.get('room') || params.get('mode') === 'local') return 'GAME';
    return 'LOBBY';
  });

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const page = params.get('page');
      if (page === 'rules') setView('GUIDE');
      else if (page === 'notes') setView('NOTES');
      else if (page === 'wheel') setView('WHEEL');
      else if (params.get('room') || params.get('mode') === 'local') setView('GAME');
      else setView('LOBBY');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = (newView, params = {}) => {
    const url = new URL(window.location.origin + window.location.pathname);
    
    if (newView === 'GUIDE') {
      url.searchParams.set('page', 'rules');
    } else if (newView === 'NOTES') {
      url.searchParams.set('page', 'notes');
    } else if (newView === 'WHEEL') {
      url.searchParams.set('page', 'wheel');
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
      {view === 'LOBBY' && <Lobby navigateTo={navigateTo} />}
      {view === 'GAME' && <Game navigateTo={navigateTo} />}
      {view === 'GUIDE' && <Guide navigateTo={navigateTo} />}
      {view === 'NOTES' && <Notes navigateTo={navigateTo} />}
      {view === 'WHEEL' && <Wheel navigateTo={navigateTo} />}
    </div>
  );
}
