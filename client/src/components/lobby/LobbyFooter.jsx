import React from 'react';
import { ScrollText, BookOpen, Settings } from 'lucide-react';

export default function LobbyFooter({
  footerLinksRef,
  handleNavigate,
  onWarm
}) {
  return (
    <footer className="relative z-10 w-full flex flex-col items-center px-6 md:px-12 py-6 bg-gradient-to-t from-void-black via-void-black/80 to-transparent gap-5 font-label-caps">
      <nav ref={footerLinksRef} aria-label="Game resources" className="flex flex-wrap justify-center gap-2 sm:gap-3 items-center">
        <a
          href="/?page=notes"
          className="home-resource-link"
          onClick={(e) => { e.preventDefault(); handleNavigate('NOTES'); }}
          onMouseEnter={() => onWarm?.('NOTES')}
        >
          <ScrollText className="h-4 w-4" aria-hidden="true" />
          <span>Patch Notes</span>
        </a>
        <a
          href="/?page=rules"
          className="home-resource-link"
          onClick={(e) => { e.preventDefault(); handleNavigate('GUIDE'); }}
          onMouseEnter={() => onWarm?.('GUIDE')}
        >
          <BookOpen className="h-4 w-4" aria-hidden="true" />
          <span>Rulebook</span>
        </a>
        <button
          className="home-resource-link"
          onClick={() => handleNavigate('SETTINGS')}
          onMouseEnter={() => onWarm?.('SETTINGS')}
        >
          <Settings className="h-4 w-4" aria-hidden="true" />
          <span>Settings</span>
        </button>
      </nav>
      <div className="text-[10px] sm:text-xs tracking-wider text-on-surface-variant/60">
        © 2026 Mythic Territories
      </div>
    </footer>
  );
}
