import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { IMAGES, PIECE_TYPES } from '../../../shared/constants.js';
import { getEffectivePower } from '../../../shared/utils.js';

function Piece({ 
  piece, 
  gameState, 
  isSelected, 
  isAsh,
  onClick, 
  onLungeComplete,
  onMouseEnter,
  onMouseLeave,
  onMouseMove
}) {
  const pieceRef = useRef(null);
  const innerRef = useRef(null);
  const getPieceInitialHp = (p) => typeof p.currentHp === 'number' ? p.currentHp : (p.maxHp || C.PIECE_TYPES[p.key]?.stats?.hp || 5);
  const prevCoords = useRef({ row: piece.row, col: piece.col });
  const prevHp = useRef(getPieceInitialHp(piece));
  
  const [damageTexts, setDamageTexts] = useState([]);

  // Shield state tracking for spawn-in and shatter-out break animations
  const isShieldActive = !!(piece.hasDeathMeteorInvincibility || piece.hasHelpFromAboveActive);
  const prevShieldActive = useRef(isShieldActive);
  const [shieldBreaking, setShieldBreaking] = useState(false);
  const [shieldBreakFaction, setShieldBreakFaction] = useState(null);

  useEffect(() => {
    if (prevShieldActive.current && !isShieldActive) {
      setShieldBreaking(true);
      setShieldBreakFaction(piece.key === 'snowFrostLord' ? 'snow' : 'ash');
      const timer = setTimeout(() => {
        setShieldBreaking(false);
      }, 650);
      return () => clearTimeout(timer);
    }
    prevShieldActive.current = isShieldActive;
  }, [isShieldActive, piece.key]);

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
    
    if (piece.deathMeteorOrigin) {
      const origR = piece.deathMeteorOrigin.row;
      const origC = piece.deathMeteorOrigin.col;
      let originLeft = origC * 10;
      let originTop = origR * 10;
      if (isLocalTeamAsh) {
        originLeft = (9 - origC) * 10;
        originTop = (9 - origR) * 10;
      }
      // Hold at original position while meteor plummets from space
      gsap.set(pieceRef.current, {
        left: `${originLeft}%`,
        top: `${originTop}%`
      });
      // Delay moving Tyrant until the meteor impacts (~0.75s)
      gsap.to(pieceRef.current, {
        left: `${targetLeft}%`,
        top: `${targetTop}%`,
        delay: 0.75,
        duration: 0.35,
        ease: "power2.out",
        onComplete: () => {
          delete piece.deathMeteorOrigin;
        }
      });
      prevCoords.current = { row: piece.row, col: piece.col };
    } else if (moved) {
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
    const currentHp = typeof piece.currentHp === 'number' ? piece.currentHp : (piece.maxHp || C.PIECE_TYPES[piece.key]?.stats?.hp || 5);
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
      onMouseMove={(e) => onMouseMove && onMouseMove(piece, e)}
      onMouseLeave={() => onMouseLeave && onMouseLeave()}
    >
      {/* Modern Faction Selection Reticle & Pedestal */}
      {isSelected && (
        <div className={`selection-container pointer-events-none ${isSnow ? 'selection-snow' : 'selection-ash'}`}>
          <div className="selection-glow" />
          <div className="selection-ring" />
          <div className="selection-brackets" />
        </div>
      )}

      {/* Meteor Shield (Invulnerability) 3D Glowing Spherical Energy Orb */}
      {piece.hasDeathMeteorInvincibility && (
        <div 
          className="absolute inset-[-12px] rounded-full pointer-events-none z-30 overflow-visible"
          style={{
            animation: 'shieldSpawnIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards'
          }}
        >
          {/* 1. Volumetric Shaded Glass Sphere Shell */}
          <div 
            className="absolute inset-0 rounded-full"
            style={{
              background: 'radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.45) 0%, rgba(254, 240, 138, 0.22) 22%, rgba(245, 158, 11, 0.08) 52%, rgba(217, 119, 6, 0.25) 78%, rgba(250, 204, 21, 0.85) 96%, rgba(255, 255, 240, 0.95) 100%)',
              boxShadow: 'inset -6px -8px 15px rgba(180, 83, 9, 0.65), inset 5px 6px 12px rgba(255, 255, 255, 0.75), inset 0 0 20px rgba(250, 204, 21, 0.35), 0 0 16px rgba(250, 204, 21, 0.75), 0 0 32px rgba(234, 179, 8, 0.3)',
              border: '1.5px solid rgba(255, 250, 190, 0.9)'
            }}
          />
          {/* 2. Distinct Top-Left Specular Highlight Glint */}
          <div 
            className="absolute rounded-full"
            style={{
              width: '44%',
              height: '24%',
              top: '12%',
              left: '14%',
              transform: 'rotate(-38deg)',
              background: 'radial-gradient(ellipse at center, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.4) 50%, rgba(255, 255, 255, 0) 100%)',
              filter: 'blur(0.5px)'
            }}
          />
          {/* 3. Bottom-Right Subtle Fresnel Rim Glow */}
          <div 
            className="absolute rounded-full"
            style={{
              width: '48%',
              height: '20%',
              bottom: '10%',
              right: '12%',
              transform: 'rotate(-28deg)',
              background: 'radial-gradient(ellipse at center, rgba(254, 240, 138, 0.7) 0%, rgba(245, 158, 11, 0.25) 55%, transparent 100%)',
              filter: 'blur(1.2px)'
            }}
          />
        </div>
      )}

      {/* Frost Lord Help From Above (Divine Shield) 3D Glowing Spherical Energy Orb */}
      {piece.hasHelpFromAboveActive && (
        <div 
          className="absolute inset-[-12px] rounded-full pointer-events-none z-30 overflow-visible"
          style={{
            animation: 'shieldSpawnIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards'
          }}
        >
          {/* 1. Volumetric Shaded Glacial Glass Sphere Shell */}
          <div 
            className="absolute inset-0 rounded-full"
            style={{
              background: 'radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.5) 0%, rgba(186, 230, 253, 0.25) 22%, rgba(56, 189, 248, 0.08) 52%, rgba(14, 116, 144, 0.25) 78%, rgba(56, 189, 248, 0.85) 96%, rgba(240, 249, 255, 0.95) 100%)',
              boxShadow: 'inset -6px -8px 15px rgba(12, 74, 110, 0.65), inset 5px 6px 12px rgba(255, 255, 255, 0.8), inset 0 0 20px rgba(56, 189, 248, 0.35), 0 0 16px rgba(56, 189, 248, 0.75), 0 0 32px rgba(14, 165, 233, 0.3)',
              border: '1.5px solid rgba(224, 242, 254, 0.9)'
            }}
          />
          {/* 2. Distinct Top-Left Specular Highlight Glint */}
          <div 
            className="absolute rounded-full"
            style={{
              width: '44%',
              height: '24%',
              top: '12%',
              left: '14%',
              transform: 'rotate(-38deg)',
              background: 'radial-gradient(ellipse at center, rgba(255, 255, 255, 0.98) 0%, rgba(224, 242, 254, 0.45) 50%, rgba(255, 255, 255, 0) 100%)',
              filter: 'blur(0.5px)'
            }}
          />
          {/* 3. Bottom-Right Subtle Fresnel Rim Glow */}
          <div 
            className="absolute rounded-full"
            style={{
              width: '48%',
              height: '20%',
              bottom: '10%',
              right: '12%',
              transform: 'rotate(-28deg)',
              background: 'radial-gradient(ellipse at center, rgba(186, 230, 253, 0.7) 0%, rgba(14, 165, 233, 0.25) 55%, transparent 100%)',
              filter: 'blur(1.2px)'
            }}
          />
        </div>
      )}

      {/* Shattering Shield Break Animation */}
      {shieldBreaking && (
        <div 
          className="absolute inset-[-10px] rounded-full pointer-events-none z-30 overflow-visible"
          style={{
            animation: 'shieldShatterOut 0.65s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards',
            background: shieldBreakFaction === 'snow'
              ? 'radial-gradient(circle at center, rgba(186, 230, 253, 0.3) 0%, rgba(56, 189, 248, 0.5) 80%, rgba(255, 255, 255, 0.85) 100%)'
              : 'radial-gradient(circle at center, rgba(254, 240, 138, 0.3) 0%, rgba(250, 204, 21, 0.5) 80%, rgba(255, 255, 255, 0.85) 100%)',
            border: `2px solid ${shieldBreakFaction === 'snow' ? '#38bdf8' : '#facc15'}`,
            boxShadow: `0 0 30px ${shieldBreakFaction === 'snow' ? 'rgba(56, 189, 248, 0.9)' : 'rgba(250, 204, 21, 0.9)'}`
          }}
        />
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

export default React.memo(Piece);
