import React, { useState, useEffect } from 'react';
import ScrollText from 'lucide-react/dist/esm/icons/scroll-text.js';
import Users from 'lucide-react/dist/esm/icons/users.js';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down.js';
import ChevronUp from 'lucide-react/dist/esm/icons/chevron-up.js';
import Skull from 'lucide-react/dist/esm/icons/skull.js';
import Zap from 'lucide-react/dist/esm/icons/zap.js';
import * as C from '@shared/constants.js';

export default function GameActionDrawer({
  eventLog = [],
  isLocal,
  playerCount,
  isOpponentDisconnected,
  disconnectTimeout,
  drawerExpanded,
  setDrawerExpanded,
  selectedPiece,
  selectedPieceName,
  hasPrimaryAbility,
  hasSiphon,
  hasRiftPulse,
  canDespawn,
  isMyTurn,
  sendAction,
  setHoveredAbilityKey,
  fallenSnow = [],
  fallenAsh = []
}) {
  const [activeTab, setActiveTab] = useState('abilities');

  // Auto-switch to abilities tab whenever a piece is selected
  useEffect(() => {
    if (selectedPiece) {
      setActiveTab('abilities');
    }
  }, [selectedPiece?.id]);

  const fmtStat = (v) => {
    if (v == null || v === '') return '?';
    const n = typeof v === 'number' ? v : parseFloat(v);
    if (isNaN(n)) return v;
    const r = Math.round(n * 10) / 10;
    return Number.isInteger(r) ? Math.round(r) : parseFloat(r.toFixed(1));
  };

  return (
    <>
      {/* Right Column: Battle History Event Log & Network Status (Desktop >= 1180px) */}
      <div id="right-column" className="ui-column primal-ash">
        <div id="messageLogContainer">
          <div className="event-log-heading">
            <div className="event-log-title">
              <ScrollText className="h-4 w-4 text-magma-core" aria-hidden="true" />
              <span>Battle History</span>
            </div>
          </div>
          <ul id="messageLog" aria-live="polite" aria-label="Battle history event log">
            {eventLog.length === 0 ? (
              <li className="event-log-empty opacity-50 text-xs">Battle events will appear here after the first move.</li>
            ) : eventLog.map((log, i) => {
              const turnNum = typeof log === 'object' && log.turn ? log.turn : 1;
              const message = typeof log === 'object' && log.text ? log.text : log;
              const team = typeof log === 'object' && log.team ? log.team : 'neutral';
              const badgeColor = team === 'snow'
                ? 'border-sky-400/40 bg-sky-500/15 text-sky-300'
                : team === 'ash'
                ? 'border-rose-500/40 bg-rose-500/15 text-rose-300'
                : 'border-ember-gold/40 bg-ember-gold/15 text-amber-300';

              return (
                <li key={i} className="event-log-item">
                  <span className={`event-turn-badge ${badgeColor}`}>
                    T{turnNum}
                  </span>
                  <span className="event-text">{message}</span>
                </li>
              );
            })}
          </ul>
        </div>
        
        <div id="roomStatusOverlay">
          {!isLocal && (
            <div id="playerCountDisplay">
              <Users className="h-4 w-4" aria-hidden="true" />
              <span>Realm players</span>
              <strong>{playerCount}/2</strong>
            </div>
          )}
          {isOpponentDisconnected && (
            <div id="disconnectTimerDisplay" style={{ backgroundColor: '#ff4444', color: 'white', fontWeight: 'bold', padding: '10px', borderRadius: '5px', textAlign: 'center', margin: '10px 0', display: 'block' }}>
              Opponent disconnected. Closing in {disconnectTimeout}s
            </div>
          )}
        </div>
      </div>
      
      {/* Mobile/Compact Collapsible Action & Ability Drawer */}
      <div id="mobileDrawer" className={`mobile-drawer ${drawerExpanded ? 'expanded' : 'peek'}`}>
        <button
          className="drawer-handle"
          onClick={() => setDrawerExpanded(!drawerExpanded)}
          aria-label={drawerExpanded ? 'Collapse drawer' : 'Expand drawer'}
          aria-expanded={drawerExpanded}
        >
          {drawerExpanded ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronUp className="h-4 w-4" aria-hidden="true" />}
        </button>

        <div className="drawer-content">
          {/* Peek Bar: Quick summary and expand trigger */}
          <div id="drawerPeek" className="drawer-peek-info" onClick={() => setDrawerExpanded(!drawerExpanded)}>
            <div className="peek-summary">
              {!selectedPiece ? (
                <div>
                  <div className="peek-title-row">
                    <span id="peek-name" className="peek-name">Command Deck</span>
                  </div>
                  <div id="peek-desc" className="peek-desc">
                    <span>Tap unit for abilities</span>
                    <span className="peek-separator">✦</span>
                    <span>Open for history & fallen units</span>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="peek-title-row">
                    <span id="peek-name" className="peek-name">{selectedPieceName}</span>
                  </div>
                  <div id="peek-desc" className="peek-desc">
                    {(() => {
                      const hp = fmtStat(selectedPiece.currentHp != null ? selectedPiece.currentHp : selectedPiece.maxHp);
                      const maxHp = fmtStat(selectedPiece.maxHp);
                      return (
                        <div className="peek-stats-row">
                          <span className="peek-stat"><span className="stat-val stat-hp">{hp}/{maxHp}</span> HP</span>
                          <span className="peek-separator">✦</span>
                          <span className="peek-stat"><span className="stat-val">{fmtStat(selectedPiece.strength)}</span> STR</span>
                          <span className="peek-separator">✦</span>
                          <span className="peek-stat"><span className="stat-val">{fmtStat(selectedPiece.def)}</span> DEF</span>
                          <span className="peek-separator">✦</span>
                          <span className="peek-stat"><span className="stat-val">{fmtStat(selectedPiece.agility)}</span> AGI</span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Drawer Expanded Body with Navigation Tabs */}
          <div className="drawer-expanded">
            {/* Navigation Tabs */}
            <div className="drawer-nav-tabs">
              <button
                type="button"
                className={`drawer-tab-btn ${activeTab === 'abilities' ? 'active' : ''}`}
                onClick={() => setActiveTab('abilities')}
              >
                <Zap className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Abilities {selectedPiece ? `(${selectedPieceName})` : ''}</span>
              </button>
              <button
                type="button"
                className={`drawer-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                onClick={() => setActiveTab('history')}
              >
                <ScrollText className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Battle History {eventLog.length > 0 ? `(${eventLog.length})` : ''}</span>
              </button>
              <button
                type="button"
                className={`drawer-tab-btn ${activeTab === 'fallen' ? 'active' : ''}`}
                onClick={() => setActiveTab('fallen')}
              >
                <Skull className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Fallen Units ({fallenSnow.length + fallenAsh.length})</span>
              </button>
            </div>

            {/* TAB 1: Abilities & Unit Actions */}
            {activeTab === 'abilities' && (
              <div className="drawer-tab-pane">
                {!selectedPiece ? (
                  <div className="drawer-empty-state">
                    <span className="empty-title">No Unit Selected</span>
                    <span className="empty-desc">Tap any friendly or playable unit on the battlefield to inspect stats, active abilities, and special moves.</span>
                  </div>
                ) : (
                  <>
                    <div className="unit-header-mobile">
                      {selectedPiece.ability && (
                        <div className="mobile-ability-desc-card">
                          <div style={{ color: '#E8C15E', fontWeight: 'bold', fontSize: '12px', marginBottom: '2px' }}>
                            Active: {selectedPiece.ability.name} {(selectedPiece.ability.cooldown || 0) > 0 ? `(CD: ${selectedPiece.ability.cooldown})` : '(Ready)'}
                          </div>
                          <div style={{ color: '#cbd5e1', fontSize: '11px', lineHeight: '1.3' }}>
                            {C.ABILITY_DESCRIPTIONS[selectedPiece.ability.key]}
                          </div>
                        </div>
                      )}
                      {C.PASSIVE_DESCRIPTIONS[selectedPiece.key] && (
                        <div className="mobile-ability-desc-card" style={{ marginTop: '4px', borderColor: 'rgba(74, 222, 128, 0.3)' }}>
                          <div style={{ color: '#4ade80', fontWeight: 'bold', fontSize: '12px', marginBottom: '2px' }}>
                            Passive
                          </div>
                          <div style={{ color: '#cbd5e1', fontSize: '11px', lineHeight: '1.3' }}>
                            {C.PASSIVE_DESCRIPTIONS[selectedPiece.key]}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mobile-action-container">
                      <div className="mobile-button-grid">
                        {hasPrimaryAbility && (
                          <button 
                            className="ability-btn-mobile primary-action" 
                            onClick={() => isMyTurn && (selectedPiece.ability.cooldown || 0) <= 0 && sendAction('ABILITY', { pieceId: selectedPiece.id, abilityKey: selectedPiece.ability.key })} 
                            onMouseEnter={() => setHoveredAbilityKey(selectedPiece.ability.key)}
                            onMouseLeave={() => setHoveredAbilityKey(null)}
                            disabled={!isMyTurn || (selectedPiece.ability.cooldown || 0) > 0}
                          >
                            {selectedPiece.ability.name || 'Use Ability'}
                            {(selectedPiece.ability.cooldown || 0) > 0 ? ` (CD: ${selectedPiece.ability.cooldown})` : ''}
                          </button>
                        )}
                        {hasSiphon && (
                          <button className="ability-btn-mobile primary-action" onClick={() => isMyTurn && sendAction('ABILITY', { pieceId: selectedPiece.id, abilityKey: 'Siphon' })} disabled={!isMyTurn}>Siphon</button>
                        )}
                        {hasRiftPulse && (
                          <button className="ability-btn-mobile" onClick={() => isMyTurn && sendAction('RIFT_PULSE', { pieceId: selectedPiece.id })} disabled={!isMyTurn}>Rift Pulse</button>
                        )}
                        {selectedPiece.tethers && selectedPiece.tethers.length > 0 && (
                          <button className="ability-btn-mobile unleash-btn" onClick={() => sendAction('RELEASE', { pieceId: selectedPiece.id })}>Release</button>
                        )}
                        {canDespawn && (
                          <button 
                            className="ability-btn-mobile" 
                            onClick={() => isMyTurn && sendAction('DESPAWN', { pieceId: selectedPiece.id })}
                            disabled={!isMyTurn}
                          >
                            Despawn
                          </button>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* TAB 2: Battle History */}
            {activeTab === 'history' && (
              <div className="drawer-tab-pane">
                <div className="drawer-chronicle-list">
                  {eventLog.length === 0 ? (
                    <div className="drawer-empty-state">
                      <span className="empty-title">History Quiet</span>
                      <span className="empty-desc">Battle actions and damage events will appear here once turns begin.</span>
                    </div>
                  ) : (
                    <ul className="drawer-event-items">
                      {eventLog.map((log, i) => {
                        const turnNum = typeof log === 'object' && log.turn ? log.turn : 1;
                        const message = typeof log === 'object' && log.text ? log.text : log;
                        const team = typeof log === 'object' && log.team ? log.team : 'neutral';
                        const badgeColor = team === 'snow'
                          ? 'border-sky-400/40 bg-sky-500/15 text-sky-300'
                          : team === 'ash'
                          ? 'border-rose-500/40 bg-rose-500/15 text-rose-300'
                          : 'border-ember-gold/40 bg-ember-gold/15 text-amber-300';

                        return (
                          <li key={i} className="event-log-item">
                            <span className={`event-turn-badge ${badgeColor}`}>
                              T{turnNum}
                            </span>
                            <span className="event-text">{message}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                {!isLocal && (
                  <div className="drawer-network-status">
                    <div id="playerCountDisplay-mobile" className="flex items-center gap-1.5 text-xs text-slate-300 py-1">
                      <Users className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Realm players: <strong>{playerCount}/2</strong></span>
                    </div>
                    {isOpponentDisconnected && (
                      <div className="bg-rose-700/80 text-white font-bold p-2 rounded text-center text-xs mt-1">
                        Opponent disconnected. Closing in {disconnectTimeout}s
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: Fallen Units */}
            {activeTab === 'fallen' && (
              <div className="drawer-tab-pane">
                <div className="fallen-units-columns drawer-fallen-columns">
                  {/* Frost Casualties */}
                  <div className="fallen-column snow-column">
                    <div className="fallen-column-label">Frost Vanguard ({10 - fallenSnow.length}/10 Active)</div>
                    <div className="fallen-list">
                      {fallenSnow.length === 0 ? (
                        <div className="fallen-empty-card">
                          <span className="empty-sub">Vanguard Intact</span>
                          <span className="empty-count">10 Active Units</span>
                        </div>
                      ) : (
                        fallenSnow.map(key => {
                          const info = C.PIECE_TYPES[key] || {};
                          const imgPath = C.IMAGES[key] ? `/${C.IMAGES[key]}` : null;
                          return (
                            <div key={key} className="fallen-unit-card snow" title={info.name || key}>
                              {imgPath && <img src={imgPath} alt={info.name || key} className="fallen-unit-avatar" />}
                              <span className="fallen-unit-name">{info.name || key}</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Ash Casualties */}
                  <div className="fallen-column ash-column">
                    <div className="fallen-column-label">Ash Vanguard ({10 - fallenAsh.length}/10 Active)</div>
                    <div className="fallen-list">
                      {fallenAsh.length === 0 ? (
                        <div className="fallen-empty-card">
                          <span className="empty-sub">Vanguard Intact</span>
                          <span className="empty-count">10 Active Units</span>
                        </div>
                      ) : (
                        fallenAsh.map(key => {
                          const info = C.PIECE_TYPES[key] || {};
                          const imgPath = C.IMAGES[key] ? `/${C.IMAGES[key]}` : null;
                          return (
                            <div key={key} className="fallen-unit-card ash" title={info.name || key}>
                              {imgPath && <img src={imgPath} alt={info.name || key} className="fallen-unit-avatar" />}
                              <span className="fallen-unit-name">{info.name || key}</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
