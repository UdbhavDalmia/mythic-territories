import React from 'react';
import ScrollText from 'lucide-react/dist/esm/icons/scroll-text.js';
import Users from 'lucide-react/dist/esm/icons/users.js';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down.js';
import ChevronUp from 'lucide-react/dist/esm/icons/chevron-up.js';
import * as C from '@shared/constants.js';

export default function GameActionDrawer({
  eventLog,
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
  setHoveredAbilityKey
}) {
  return (
    <>
      {/* Right Column: Battle Chronicle Event Log & Network Status */}
      <div id="right-column" className="ui-column primal-ash hidden xl:flex">
        <div id="messageLogContainer">
          <div className="event-log-heading">
            <div className="event-log-title">
              <ScrollText className="h-4 w-4 text-magma-core" aria-hidden="true" />
              <span>Battle Chronicle</span>
            </div>
          </div>
          <ul id="messageLog" aria-live="polite" aria-label="Battle chronicle event log">
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
      
      {/* Mobile Collapsible Unit Action Drawer */}
      <div id="mobileDrawer" className={`mobile-drawer ${drawerExpanded ? 'expanded' : 'peek'}`}>
        <button
          className="drawer-handle"
          onClick={() => setDrawerExpanded(!drawerExpanded)}
          aria-label={drawerExpanded ? 'Collapse unit actions' : 'Expand unit actions'}
          aria-expanded={drawerExpanded}
        >
          {drawerExpanded ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronUp className="h-4 w-4" aria-hidden="true" />}
        </button>
        <div className="drawer-content">
          {!selectedPiece ? (
            <div id="drawerPeek" className="drawer-peek-info" onClick={() => setDrawerExpanded(!drawerExpanded)}>
              <div className="peek-summary">
                <span id="peek-name" className="peek-name">Select a Unit</span>
                <span id="peek-desc" className="peek-desc">Tap any friendly unit to view stats & cast abilities</span>
              </div>
            </div>
          ) : (
            <>
              <div id="drawerPeek" className="drawer-peek-info" onClick={() => setDrawerExpanded(!drawerExpanded)}>
                <div className="peek-summary">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span id="peek-name" className="peek-name">{selectedPieceName}</span>
                    <span className="drawer-toggle-badge">{drawerExpanded ? '▼ Close' : '▲ Actions'}</span>
                  </div>
                  <span id="peek-desc" className="peek-desc">{`${typeof selectedPiece.currentHp === 'number' ? (Number.isInteger(Math.round(selectedPiece.currentHp * 10) / 10) ? Math.round(selectedPiece.currentHp) : parseFloat(selectedPiece.currentHp.toFixed(1))) : (selectedPiece.maxHp || '?')} HP | ${selectedPiece.strength} STR | ${selectedPiece.def} DEF | ${selectedPiece.agility} AGI`}</span>
                </div>
              </div>
              <div className="drawer-expanded">
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
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
