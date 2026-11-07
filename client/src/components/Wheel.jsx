import React, { useRef, useEffect, useState } from 'react';
import gsap from 'gsap';
import '../../styles/wheel.css';
import { TEAM_PIECES, PIECE_TYPES, IMAGES } from '../../../shared/constants.js';

// Descriptions lookup for active abilities
const ACTIVE_DESCS = {
  'ScorchedRetreat': 'Retreats 1 square backwards, leaving a burning trail that turns the old square into Unstable Ground for 2 turns.',
  'ReignOfFire': 'AOE (Range 2.5, Radius 2) deals 2 damage to enemies, and 1 damage to allies caught in it while boosting allies\' Strength by +2 for 3 turns.',
  'HuntersRage': 'Roars in fury, boosting own power and combat damage (grants +1 Power for 3 turns).',
  'KindleArmor': 'Kindles the armor of an adjacent ally (Range 1), granting them +1 Power for 3 turns.',
  'LavaGlob': 'Hurls a glob of magma (Range 4), dealing 1 damage to an enemy with power <= 2 or that is marked.',
  'ObsidianPillar': 'Spawns an Obsidian Pillar: deals damage and pushback to enemies, works as cover, and forms an Obsidian Shield when targeting allies.',
  'MarkOfCinder': 'Marks an enemy (Range 2) for 3 turns, reducing their power by 1 and making them vulnerable to Lava Glob.',
  'Pummel': 'Pummels an adjacent enemy, dealing high impact and pushing them back up to 2 squares. Dazes them for 2 turns.',
  'UnstableGround': 'Sears a targeted empty tile (Range 4) for 3 turns, dealing 1 damage to units standing on it.',
  'TheReapersToll': 'Siphons stats from an enemy (Range 3) for 4 turns, stealing 1 Defense and 0.4 Agility.',
  'SetSnare': 'Places a trap snare (Range 2) on an empty tile. Traps and halts the next unit that enters it.',
  'GlacialFracture': 'Fractures the ground (Range 2.5, Radius 2), dealing 2 damage to enemies, creating ice terrain, and summoning up to 2 Ice Wisps.',
  'Hamstring': 'Hamstrings an adjacent enemy, locking their movement (0 Agility) for 2 turns.',
  'FrostArmor': 'Coats self in frost armor, gaining +1 Power for 3 turns.',
  'FrigidPath': 'Creates a path of ice (Range 4) for 4 turns. Moving on ice costs 0 Agility.',
  'GlacialWall': 'Erects a solid wall of ice (Range 1) on an adjacent empty tile for 3 turns, blocking all movement and projectiles.',
  'FateLink': 'Links the souls of two units (Range 3) for 4 turns; any damage taken by the first unit is mirrored to the second.',
  'FrostfallBlessing': 'Calls down an icy blessing (Range 2.5, Radius 2) that deals 2 damage to enemies and heals allies for 1 HP per turn for 5 turns.',
  'SummonIceWisp': 'Summons a helper Ice Wisp (Range 4) that can scout and explode on death.',
  'ChillingAura': 'Surrounds self with freezing cold, debuffing adjacent enemies\' Power by 1 for 3 turns.'
};

const VET_DESCS = {
  'TacticalSwapAsh': 'Tactical Swap: Swap places with a friendly unit (Range 2) for 2 turns.',
  'BlazeLunge': 'Blaze Lunge: Lunges up to 2 squares away adjacent to an enemy.',
  'CinderSurge': 'Cinder Surge: Cleanses all dazed, stuck, and frost effects from an adjacent ally.',
  'SiphonCharge': 'Siphon Charge: Permanently reduces power by 1 to reset the cooldown of Frenzied Dash.',
  'VolatileCinder': 'Volatile Cinder: Target a marked enemy (Range 3) to deal 1 damage.',
  'VolatileForge': 'Volatile Forge: Unstable Ground now places up to 2 burning hazards.',
  'SoulfireBurst': 'Soulfire Burst: Explodes an Unstable Ground tile (Range 3), dealing 1 damage to all adjacent units.',
  'DistractingRoar': 'Distracting Roar: Roars at an enemy (Range 1), debuffing their Power by 1 for 2 turns.',
  'WispEnhancement': 'Wisp Enhancement: Summoned Ice Wisps are spawned with +1 Power.',
  'IcyShift': 'Icy Shift: Teleports to a target square (Range 2) for 2 turns.',
  'FrostStomp': 'Frost Stomp: Stomps the ground, dazing adjacent enemies for 2 turns.',
  'GlacialBeacon': 'Glacial Beacon: Places a beacon (Range 3) that freezes the surrounding tiles.',
  'GlacialFortress': 'Glacial Fortress: Increases the duration of Glacial Wall and expands its radius.',
  'HardenedIce': 'Hardened Ice: Encases a friendly unit in hardened ice, granting steadfast status for 4 turns.',
  'FrostbiteCurse': 'Frostbite Curse: Removes temporary boosts from an enemy (Range 2) and debuffs their power by 1.'
};

const PASSIVE_DESCS = {
  'snowFrostLord': { name: 'Help From Above', desc: 'Lethal damage is negated; becomes invulnerable for 5 turns and grants nearby allies +1 Strength.' },
  'ashAshTyrant': { name: 'Death Meteor', desc: 'Lethal damage is negated; survives at 1 HP and triggers an explosion dealing 4 damage to enemies and 2 to allies.' },
  'snowSoulLinker': { name: 'Cold Snap', desc: 'If the bound enemy dies, the Soul Linker heals 2 HP; excess healing is converted into a 1-damage absorb shield.' },
  'ashAshReaper': { name: 'Ashes To Ashes', desc: 'When The Reaper\'s Toll expires, the stolen stats return and the enemy has a 50% chance to take 1 unavoidable damage.' },
  'snowGlacialMage': { name: 'Frost Duo', desc: 'Gains +0.2 Control and +0.2 Agility per active Ice Wisp; gains an additional +1 Strength if both Wisps are active.' }
};

const FACTION_SCHEMES = {
  ash: {
    bgStart: '#5C1502',
    bgEnd: '#C12C04',
    text: '#FFEBE0',
    factionName: 'Faction of Ash',
    themeColor: '#ff2e00',
    themeColorDark: '#7a1100'
  },
  snow: {
    bgStart: '#05234A',
    bgEnd: '#0077FF',
    text: '#E5F4FF',
    factionName: 'Faction of Snow',
    themeColor: '#0077ff',
    themeColorDark: '#003a80'
  }
};

export default function Wheel({ navigateTo }) {
  const canvasRef = useRef(null);
  const pointerRef = useRef(null);
  const audioCtxRef = useRef(null);
  const wheelAngle = useRef(0);
  
  const [units, setUnits] = useState([]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [winner, setWinner] = useState(null);
  const [animatedStats, setAnimatedStats] = useState({ hp: 0, strength: 0, def: 0, range: 0, agility: 0, control: 0 });

  // Load units list from constants on mount
  useEffect(() => {
    const filteredAsh = Object.entries(TEAM_PIECES.ash).filter(([role, key]) => {
      return key !== 'ashAshTyrant' && key !== 'ashMagmaShaper';
    });
    const filteredSnow = Object.entries(TEAM_PIECES.snow).filter(([role, key]) => {
      return key !== 'snowFrostLord';
    });

    const list = [];
    const maxLen = Math.max(filteredAsh.length, filteredSnow.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < filteredAsh.length) {
        list.push({
          faction: 'ash',
          role: filteredAsh[i][0],
          key: filteredAsh[i][1],
          ...PIECE_TYPES[filteredAsh[i][1]]
        });
      }
      if (i < filteredSnow.length) {
        list.push({
          faction: 'snow',
          role: filteredSnow[i][0],
          key: filteredSnow[i][1],
          ...PIECE_TYPES[filteredSnow[i][1]]
        });
      }
    }
    setUnits(list);
  }, []);

  // Draw wheel helper
  const drawWheel = (angle) => {
    const canvas = canvasRef.current;
    if (!canvas || units.length === 0) return;
    const ctx = canvas.getContext('2d');
    const radius = canvas.width / 2;
    const totalSlices = units.length;
    const sliceAngle = (Math.PI * 2) / totalSlices;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(radius, radius);
    ctx.rotate(angle);

    for (let i = 0; i < totalSlices; i++) {
      const startAngle = i * sliceAngle;
      const u = units[i];
      const c = FACTION_SCHEMES[u.faction];

      // Slice sector path
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius - 15, startAngle, startAngle + sliceAngle);
      ctx.closePath();

      const grad = ctx.createRadialGradient(0, 0, 80, 0, 0, radius - 15);
      grad.addColorStop(0, c.bgStart);
      grad.addColorStop(1, c.bgEnd);
      ctx.fillStyle = grad;
      ctx.fill();

      // Border outline
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Draw Sector Text
      ctx.save();
      ctx.rotate(startAngle + sliceAngle / 2);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = c.text;
      ctx.font = 'bold 24px "Rajdhani", sans-serif';
      ctx.fillText(u.name.toUpperCase(), radius - 45, 0);
      ctx.restore();
    }

    // Draw inner gold ring
    ctx.beginPath();
    ctx.arc(0, 0, 95, 0, Math.PI * 2);
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#ffd700';
    ctx.fillStyle = '#080501';
    ctx.fill();
    ctx.stroke();

    // Draw outer gold ring rim
    ctx.beginPath();
    ctx.arc(0, 0, radius - 12, 0, Math.PI * 2);
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#ffd700';
    ctx.stroke();

    // Draw metal studs/pegs around the rim
    for (let i = 0; i < totalSlices; i++) {
      const studAngle = i * sliceAngle;
      const px = Math.cos(studAngle) * (radius - 12);
      const py = Math.sin(studAngle) * (radius - 12);
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#ffd700';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  };

  // Re-draw wheel on units update or load
  useEffect(() => {
    if (units.length > 0) {
      drawWheel(0);
    }
  }, [units]);

  // Audio ticker sound synthesizer
  const playTickSound = () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const audioCtx = audioCtxRef.current;
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(900, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.04);
      
      gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.04);
      
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.04);
    } catch (e) {
      console.warn("Audio Context blocked or unsupported:", e);
    }
  };

  const triggerSpin = () => {
    if (isSpinning || units.length === 0) return;

    setIsSpinning(true);
    setWinner(null);
    setAnimatedStats({ hp: 0, strength: 0, def: 0, range: 0, agility: 0, control: 0 });

    // Web Audio unlock on interaction
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }

    const totalSlices = units.length;
    const sliceAngle = (Math.PI * 2) / totalSlices;

    const randomIdx = Math.floor(Math.random() * totalSlices);
    const extraSpins = 5 + Math.floor(Math.random() * 4); // 5 to 8 full spins
    
    // Target angle calculation
    const startAngle = wheelAngle.current;
    const targetAngle = startAngle + (extraSpins * Math.PI * 2) + (randomIdx * sliceAngle) + (sliceAngle / 2);

    let lastClickIdx = 0;

    // Use GSAP to animate rotation value
    const animObject = { rotation: startAngle };
    gsap.to(animObject, {
      rotation: targetAngle,
      duration: 6,
      ease: "power4.out",
      onUpdate: () => {
        wheelAngle.current = animObject.rotation;
        drawWheel(animObject.rotation);

        // Sound ticker math
        let normAngle = (animObject.rotation % (Math.PI * 2));
        if (normAngle < 0) normAngle += Math.PI * 2;
        const targetPointerAngle = (Math.PI * 1.5 - normAngle + Math.PI * 4) % (Math.PI * 2);
        const currentSliceIdx = Math.floor(targetPointerAngle / sliceAngle) % totalSlices;
        
        if (currentSliceIdx !== lastClickIdx) {
          lastClickIdx = currentSliceIdx;
          playTickSound();
          if (pointerRef.current) {
            gsap.fromTo(pointerRef.current, 
              { rotate: -18 }, 
              { rotate: 0, duration: 0.1, ease: 'back.out(2)' }
            );
          }
        }
      },
      onComplete: () => {
        setIsSpinning(false);
        let finalAngle = (animObject.rotation % (Math.PI * 2));
        if (finalAngle < 0) finalAngle += Math.PI * 2;
        
        // Pointer points to top center (Math.PI * 1.5)
        const winnerIndex = Math.floor((Math.PI * 1.5 - finalAngle + Math.PI * 4) % (Math.PI * 2) / sliceAngle) % totalSlices;
        const winUnit = units[winnerIndex];
        setWinner(winUnit);

        // Animate stats bars
        const stats = winUnit.stats || { hp: 5, strength: 3, def: 1, range: 1, agility: 2, control: 0.1 };
        gsap.to({ val: 0 }, {
          val: 1,
          duration: 0.8,
          ease: "power2.out",
          onUpdate: function() {
            const progress = this.targets()[0].val;
            setAnimatedStats({
              hp: stats.hp * progress,
              strength: stats.strength * progress,
              def: stats.def * progress,
              range: stats.range * progress,
              agility: stats.agility * progress,
              control: stats.control * progress
            });
          }
        });
      }
    });
  };

  return (
    <div className="relative min-h-screen flex flex-col bg-void-black text-on-surface select-none font-body-md overflow-y-auto">
      {/* Back to Menu */}
      <button 
        className="fixed top-6 left-6 z-50 flex items-center gap-2 bg-void-black/70 backdrop-blur border border-outline/20 px-4 py-2 rounded-lg text-sm text-ember-gold hover:bg-ember-gold/10 transition-all font-label-caps"
        onClick={() => navigateTo('LOBBY')}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
        Return to Menu
      </button>

      {/* Header */}
      <div className="text-center pt-24 pb-8 space-y-2 relative z-10">
        <h1 className="font-almendra text-4xl sm:text-5xl text-ember-gold font-bold tracking-widest uppercase">Wheel of Destiny</h1>
        <div className="font-libre text-sm sm:text-base italic text-on-surface-variant">The Elemental Path of Unit Selection</div>
      </div>

      {/* Wheel Area & Results */}
      <div className="relative z-10 max-w-6xl mx-auto w-full flex-grow px-4 pb-20 flex flex-col lg:flex-row items-center justify-center gap-12">
        
        {/* Left: The Wheel */}
        <div className="relative flex flex-col items-center select-none">
          {/* Wheel Pointer Pin */}
          <div 
            ref={pointerRef}
            className="absolute top-[-10px] z-20 w-10 h-14 bg-ember-gold border-2 border-white rounded-t-full shadow-lg"
            style={{
              clipPath: 'polygon(50% 100%, 0 0, 100% 0)',
              transformOrigin: '50% 0%'
            }} 
          />
          
          <div className="rounded-full border-8 border-void-black bg-void-black shadow-[0_0_50px_rgba(232,193,94,0.15)] relative p-2.5 overflow-hidden bg-gradient-to-br from-surface to-surface-container-low">
            <canvas 
              ref={canvasRef} 
              width={540} 
              height={540} 
              className="w-[320px] h-[320px] sm:w-[480px] sm:h-[480px] object-contain transition-transform" 
            />
            <button 
              className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 w-16 h-16 sm:w-20 sm:h-20 rounded-full border-4 border-ember-gold bg-void-black text-ember-gold text-xs sm:text-sm font-bold shadow-md hover:bg-ember-gold hover:text-void-black transition-colors ${
                isSpinning ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              }`}
              onClick={triggerSpin}
              disabled={isSpinning}
            >
              SPIN
            </button>
          </div>
        </div>

        {/* Right: Winner Info Panel */}
        <div className="w-full max-w-md min-h-[450px] relative">
          
          {/* Placeholder Card */}
          {!winner && (
            <div className="absolute inset-0 bg-surface-container/60 backdrop-blur-md rounded-xl border border-outline/10 p-8 flex flex-col items-center justify-center text-center space-y-4 shadow-xl">
              <div className="text-4xl text-ember-gold animate-pulse">✦</div>
              <h3 className="font-almendra text-lg text-on-surface font-semibold uppercase">Destiny Awaits</h3>
              <p className="text-sm text-on-surface-variant max-w-xs leading-relaxed">
                Spin the Wheel of Destiny to draft your elemental combat unit for training or battle!
              </p>
            </div>
          )}

          {/* Winner Card */}
          {winner && (
            <div className={`bg-surface-container/60 backdrop-blur-md rounded-xl border border-outline/10 p-6 sm:p-8 flex flex-col justify-between space-y-6 shadow-xl border-l-4 ${
              winner.faction === 'snow' ? 'border-l-ice-light animate-[glowIce_1s_infinite]' : 'border-l-magma-core animate-[glowAsh_1s_infinite]'
            }`}>
              
              {/* Unit Card Header */}
              <div className="flex items-center gap-4 border-b border-outline/10 pb-4">
                <div className="w-16 h-16 rounded-lg bg-void-black/70 p-1.5 border border-outline/20 flex items-center justify-center overflow-hidden">
                  <img src={IMAGES[winner.key] ? (IMAGES[winner.key].startsWith('/') ? IMAGES[winner.key] : `/${IMAGES[winner.key]}`) : '/units/cryomancer.webp'} alt={winner.name} decoding="async" className="w-full h-full object-contain" />
                </div>
                <div>
                  <h2 className="font-almendra text-2xl font-bold text-white">{winner.name}</h2>
                  <div className={`text-xs font-label-caps font-semibold mt-0.5 ${
                    winner.faction === 'snow' ? 'text-ice-light' : 'text-magma-core'
                  }`}>
                    {winner.role.toUpperCase()} • {winner.faction === 'snow' ? 'Faction of Snow' : 'Faction of Ash'}
                  </div>
                </div>
              </div>

              {/* Stats Bar Gauges */}
              <div className="space-y-3 font-mono text-xs text-on-surface-variant">
                {[
                  { label: "Health", val: winner.stats?.hp || 5, max: 12, animVal: animatedStats.hp },
                  { label: "Strength", val: winner.stats?.strength || 3, max: 6, animVal: animatedStats.strength },
                  { label: "Defense", val: winner.stats?.def || 1, max: 4, animVal: animatedStats.def },
                  { label: "Range", val: winner.stats?.range || 1, max: 5, animVal: animatedStats.range },
                  { label: "Agility", val: winner.stats?.agility || 2, max: 5, animVal: animatedStats.agility },
                  { label: "Control", val: winner.stats?.control || 0.1, max: 1.5, animVal: animatedStats.control }
                ].map((stat, sIdx) => {
                  const percent = Math.min(100, Math.max(0, (stat.animVal / stat.max) * 100));
                  return (
                    <div key={sIdx} className="space-y-1">
                      <div className="flex justify-between items-center text-[10px] font-label-caps">
                        <span>{stat.label}</span>
                        <span className="text-white font-bold">{stat.val}</span>
                      </div>
                      <div className="h-2 w-full bg-void-black/80 rounded overflow-hidden">
                        <div 
                          className={`h-full transition-all duration-75 ${
                            winner.faction === 'snow' ? 'bg-gradient-to-r from-blue-700 to-ice-light' : 'bg-gradient-to-r from-red-800 to-magma-core'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Abilities details */}
              <div className="space-y-4 max-h-48 overflow-y-auto pr-1">
                {winner.ability?.key && (
                  <div className="bg-void-black/30 border border-outline/5 rounded-lg p-3 space-y-1">
                    <div className="text-[9px] font-label-caps px-1.5 py-0.25 bg-ember-gold/15 text-ember-gold border border-ember-gold/30 rounded inline-block uppercase font-bold">
                      Active Ability: {winner.ability.name}
                    </div>
                    <p className="text-[11px] leading-relaxed text-on-surface-variant">
                      {ACTIVE_DESCS[winner.ability.key] || 'Triggers special ability effect.'}
                    </p>
                  </div>
                )}
                
                {PASSIVE_DESCS[winner.key] && (
                  <div className="bg-void-black/30 border border-outline/5 rounded-lg p-3 space-y-1">
                    <div className="text-[9px] font-label-caps px-1.5 py-0.25 bg-outline/15 text-on-surface-variant border border-outline/25 rounded inline-block uppercase font-bold">
                      Passive Ability: {PASSIVE_DESCS[winner.key].name}
                    </div>
                    <p className="text-[11px] leading-relaxed text-on-surface-variant">
                      {PASSIVE_DESCS[winner.key].desc}
                    </p>
                  </div>
                )}

                {winner.veteranAbility?.key && (
                  <div className="bg-void-black/30 border border-outline/5 rounded-lg p-3 space-y-1">
                    <div className="text-[9px] font-label-caps px-1.5 py-0.25 bg-green-500/10 text-green-400 border border-green-500/20 rounded inline-block uppercase font-bold">
                      Veteran Ascension: {winner.veteranAbility.key.replace(/([A-Z])/g, ' $1').trim()}
                    </div>
                    <p className="text-[11px] leading-relaxed text-on-surface-variant">
                      {VET_DESCS[winner.veteranAbility.key] || 'Ascends the unit with special upgrades.'}
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4">
                <button 
                  className={`flex-1 py-3 text-center text-xs font-label-caps font-bold text-void-black rounded-lg transition-colors border shadow ${
                    winner.faction === 'snow'
                      ? 'bg-ice-light border-white/20 hover:bg-white'
                      : 'bg-magma-core border-white/20 hover:bg-red-400'
                  }`}
                  onClick={() => navigateTo('LOBBY')}
                >
                  Lock in Unit
                </button>
                <button 
                  className="flex-1 py-3 text-center text-xs font-label-caps font-bold border border-outline/20 rounded-lg hover:bg-white/5 transition-colors"
                  onClick={triggerSpin}
                  disabled={isSpinning}
                >
                  Spin Again
                </button>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
