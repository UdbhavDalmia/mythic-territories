import React, { useState, useEffect } from 'react';
import ScrollText from 'lucide-react/dist/esm/icons/scroll-text.js';
import BookOpen from 'lucide-react/dist/esm/icons/book-open.js';
import Settings from 'lucide-react/dist/esm/icons/settings.js';
import { hasUnreadPatchNotes } from '../../services/patchTracking.js';

function LobbyFooter({
  footerLinksRef,
  handleNavigate,
  onWarm
}) {
  const [unreadNotes, setUnreadNotes] = useState(false);

  useEffect(() => {
    setUnreadNotes(hasUnreadPatchNotes());
    const onPatchViewed = () => setUnreadNotes(false);
    window.addEventListener('mt_patch_viewed', onPatchViewed);
    return () => window.removeEventListener('mt_patch_viewed', onPatchViewed);
  }, []);

  return (
    <footer className="relative z-10 w-full flex flex-col items-center px-6 md:px-12 py-6 bg-gradient-to-t from-void-black via-void-black/80 to-transparent gap-5 font-label-caps">
      <nav ref={footerLinksRef} aria-label="Game resources" className="flex flex-wrap justify-center gap-2 sm:gap-3 items-center">
        <a
          href="/?page=notes"
          className="home-resource-link relative"
          onClick={(e) => { e.preventDefault(); handleNavigate('NOTES'); }}
          onMouseEnter={() => onWarm?.('NOTES')}
        >
          <ScrollText className="h-4 w-4" aria-hidden="true" />
          <span>Patch Notes</span>
          {unreadNotes && (
            <span
              className="absolute -top-1 -right-1 flex h-2.5 w-2.5"
              title="New update available"
            >
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
            </span>
          )}
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

export default React.memo(LobbyFooter);
