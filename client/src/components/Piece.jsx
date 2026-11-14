import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { IMAGES, PIECE_TYPES } from '../../../shared/constants.js';
import { getEffectivePower } from '../../../shared/utils.js';

export default function Piece({ 
  piece, 
  gameState, 
  isSelected, 
  isAsh,
  onClick, 
  onLungeComplete,
  onMouseEnter,
  onMouseLeave
}) {
  const pieceRef = useRef(null);
  const innerRef = useRef(null);
  const prevCoords = useRef({ row: piece.row, col: piece.col });
  const prevHp = useRef(piece.currentHp || 0);
  
  const [damageTexts, setDamageTexts] = useState([]);

  // Faction themes
  const isSnow = piece.team === 'snow';

  // 1. Initial pop-in summon animation on inner element
  useEffect(() => {
    if (innerRef.current) {
      gsap.fromTo(innerRef.current, 
        { scale: 0, opacity: 0 }, 
        { scale: 1, opacity: 1, duration: 0.3, ease: "back.out(1.5)" }
      );
    }
  }, []);

  // 2. Cell Glide Movement Animation strictly on pieceRef left/top
  useEffect(() => {
    const isLocalTeamAsh = isAsh !== undefined ? isAsh : gameState?.playerTeam === 'ash';
    
    // Target percentage calculations
    let targetLeft = piece.col * 10;
    let targetTop = piece.row * 10;

    // Flip board orientation if playing as Ash
    if (isLocalTeamAsh) {
      targetLeft = (9 - piece.col) * 10;
      targetTop = (9 - piece.row) * 10;
    }

    // Check if position actually changed
    const moved = prevCoords.current.row !== piece.row || prevCoords.current.col !== piece.col;
    
    if (moved) {
      // Animate movement from previous position
      gsap.to(pieceRef.current, {
        left: `${targetLeft}%`,
        top: `${targetTop}%`,
        duration: 0.35,
        ease: "power2.out"
      });
      prevCoords.current = { row: piece.row, col: piece.col };
    } else {
      // Position instantly
      gsap.set(pieceRef.current, {
        left: `${targetLeft}%`,
        top: `${targetTop}%`
      });
    }
  }, [piece.row, piece.col, gameState?.playerTeam]);

  // 3. Detect Damage & Launch Floating Damage Indicator + Hit Jolt on innerRef
  useEffect(() => {
    const currentHp = piece.currentHp || 0;
    if (currentHp < prevHp.current) {
      const diff = prevHp.current - currentHp;
      const id = Math.random();
      
      setDamageTexts(prev => [...prev, { id, val: `-${diff}` }]);

      // Hit jolt animation on innerRef without displacing cell position
      if (innerRef.current) {
        gsap.timeline()
          .to(innerRef.current, { x: -3, duration: 0.04, ease: "power1.inOut" })
          .to(innerRef.current, { x: 3, duration: 0.04, ease: "power1.inOut" })
          .to(innerRef.current, { x: -1, duration: 0.04, ease: "power1.inOut" })
          .to(innerRef.current, { x: 0, duration: 0.04, ease: "power1.out" });
      }
      
      // Clear damage text after animation
      setTimeout(() => {
        setDamageTexts(prev => prev.filter(t => t.id !== id));
      }, 950);
    }
    prevHp.current = currentHp;
  }, [piece.currentHp]);

  // 4. Lunge Attack Trigger on innerRef
  useEffect(() => {
    if (piece.isPhasing || piece.isAnimating) {
      if (innerRef.current) {
        const timeline = gsap.timeline();
        timeline.to(innerRef.current, {
          scale: 1.15,
          duration: 0.12,
          ease: "power1.in"
        }).to(innerRef.current, {
          scale: 1.0,
          duration: 0.2,
          ease: "power2.out",
          onComplete: () => {
            if (onLungeComplete) onLungeComplete(piece.id);
          }
        });
      }
    }
  }, [piece.isPhasing, piece.isAnimating]);

  // Floating damage text animation
  const handleDamageTextMount = (el) => {
    if (!el) return;
    gsap.fromTo(el,
      { y: 8, opacity: 1, scale: 0.75 },
      { y: -48, opacity: 0, scale: 1.25, duration: 0.9, ease: "power2.out" }
    );
  };

  const getImgSource = () => {
    const src = IMAGES[piece.key] || '/units/wisp.webp';
    return src.startsWith('/') ? src : `/${src}`;
  };

  // Determine if unit has a special status shield
  const activeShield = (gameState?.shields || []).find(s => s.pieceId === piece.id);

  // Compute power level badge source
  const teamBadgeKey = piece.team === 'snow' ? 'ice' : (piece.team === 'ash' ? 'ash' : null);
  let badgeSrc = null;
  if (teamBadgeKey) {
    const eff = Math.floor(getEffectivePower(piece, gameState) || 0);
    const idx = Math.max(0, Math.min(7, eff));
    badgeSrc = idx === 0 ? `/badges/${teamBadgeKey}-p0.svg` : `/badges/${teamBadgeKey}-p${idx}.webp`;
  }

  const maxHp = piece.maxHp || PIECE_TYPES[piece.key]?.stats?.hp || 5;
  const idleClass = isSelected ? '' : (isSnow ? 'piece-snow-idle' : 'piece-ash-idle');

  return (
    <div 
      ref={pieceRef}
      className="absolute w-[10%] h-[10%] z-20 flex items-center justify-center cursor-pointer select-none"
      onClick={(e) => {
        e.stopPropagation();
        onClick(piece);
      }}
      onMouseEnter={(e) => onMouseEnter && onMouseEnter(piece, e)}
      onMouseLeave={() => onMouseLeave && onMouseLeave()}
    >
      {/* Selection Rotating Rings & Aura */}
      {isSelected && (
        <>
          <div className="selection-ring-outer" />
          <div className="selection-ring-pulse" />
        </>
      )}

      {/* Floating Damage Text List */}
      {damageTexts.map(t => (
        <span 
          key={t.id}
          ref={handleDamageTextMount}
          className="absolute z-40 text-red-500 font-display-lg font-black text-lg sm:text-2xl drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] pointer-events-none"
        >
          {t.val}
        </span>
      ))}

      {/* Inner Visual Container for clean rendering and transformations */}
      <div 
        ref={innerRef}
        className={`relative w-full h-full flex items-center justify-center ${idleClass}`}
      >
        {/* Unit Face Portrait Image */}
        <img 
          src={getImgSource()} 
          alt={piece.name} 
          decoding="async"
          draggable="false"
          className={`w-full h-full object-contain pointer-events-none transition-all duration-150 ${
            isSelected 
              ? 'scale-110 drop-shadow-[0_0_14px_#ffcc00]' 
              : 'hover:scale-105 hover:drop-shadow-[0_0_10px_rgba(255,255,255,0.4)]'
          }`} 
        />

        {/* Shield Overlay Glow Ring */}
        {activeShield && (
          <div className={`absolute inset-0 rounded-full border-2 animate-pulse pointer-events-none ${
            activeShield.name === 'ObsidianPillarShield' 
              ? 'border-purple-600 shadow-[0_0_12px_rgba(147,51,234,0.8)]' 
              : 'border-yellow-200 shadow-[0_0_12px_rgba(253,224,71,0.8)]'
          }`} />
        )}

        {/* Power Level Badge (Top Right) */}
        {badgeSrc && (
          <img 
            src={badgeSrc} 
            alt="badge" 
            decoding="async"
            draggable="false"
            className="absolute top-0 right-0 z-30 w-5 h-5 sm:w-6 sm:h-6 object-contain pointer-events-none drop-shadow hover:scale-110 transition-transform" 
          />
        )}

        {/* HP Bar */}
        <div className="absolute bottom-1 left-[15%] right-[15%] h-[5px] bg-black/80 rounded-sm overflow-hidden z-30 border border-white/10 shadow-inner">
          <div 
            className="h-full transition-all duration-300 ease-out" 
            style={{ 
              width: `${Math.max(0, Math.min(100, ((piece.currentHp || 0) / maxHp) * 100))}%`,
              background: ((piece.currentHp || 0) / maxHp) > 0.6 
                ? 'linear-gradient(90deg, #22c55e, #4ade80)' 
                : ((piece.currentHp || 0) / maxHp) > 0.3 
                  ? 'linear-gradient(90deg, #eab308, #facc15)' 
                  : 'linear-gradient(90deg, #ef4444, #f87171)'
            }}
          />
        </div>

        {/* Stuck/Dazed Indicators */}
        {piece.isStuck && (
          <div className="absolute top-0 left-0 z-30 w-5 h-5 rounded-full bg-blue-500/80 border border-white/40 flex items-center justify-center text-[10px] text-white shadow-sm animate-bounce" title="Stuck">
            ⛓
          </div>
        )}
      </div>
    </div>
  );
}
