import React, { useEffect, useRef } from 'react';
import * as C from '@shared/constants.js';
import * as E from '@shared/utils.js';

export function formatHp(v) {
  if (v == null || v === '') return '?';
  const num = typeof v === 'number' ? v : parseFloat(v);
  if (isNaN(num)) return v;
  const rounded = Math.round(num * 10) / 10;
  return Number.isInteger(rounded) ? Math.round(rounded) : parseFloat(rounded.toFixed(1));
}

export function generatePieceInfoHtml(piece, gameState) {
  if (!piece) return '';
  const typeInfo = C.PIECE_TYPES[piece.key] || {};
  const effectivePower = E.getEffectivePower(piece, gameState, null, null);
  let info = `<b>${typeInfo.name || 'Unit'}</b> (${piece.team?.charAt(0).toUpperCase() + piece.team?.slice(1)})<br>`;

  const rawHp = piece.currentHp != null ? piece.currentHp : (piece.maxHp || effectivePower);
  const hp = formatHp(rawHp);
  const rawMaxHp = piece.maxHp != null ? piece.maxHp : rawHp;
  const maxHp = formatHp(rawMaxHp);
  const numHp = typeof rawHp === 'number' ? rawHp : parseFloat(rawHp) || 0;
  const numMaxHp = typeof rawMaxHp === 'number' ? rawMaxHp : parseFloat(rawMaxHp) || numHp || 1;
  const hpPct = numMaxHp > 0 ? Math.max(0, Math.min(100, Math.round((numHp / numMaxHp) * 100))) : 100;
  const hpColor = hpPct > 60 ? '#44dd88' : hpPct > 30 ? '#ffcc44' : '#ff4444';

  info += `<div style="margin:3px 0 4px;">`;
  info += `<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px;"><span>HP</span><span style="color:${hpColor}">${hp}/${maxHp}</span></div>`;
  info += `<div style="height:5px;background:rgba(255,255,255,0.12);border-radius:3px;"><div style="width:${hpPct}%;height:100%;background:${hpColor};border-radius:3px;transition:width 0.3s;"></div></div>`;
  info += `</div>`;

  if (!piece.isVeteran && maxHp > 0) {
    const dmgDealt = formatHp(piece.damageDealt || 0);
    const numDmgDealt = typeof piece.damageDealt === 'number' ? piece.damageDealt : parseFloat(piece.damageDealt) || 0;
    const vetPct = Math.min(100, Math.round((numDmgDealt / numMaxHp) * 100));
    info += `<div style="margin:3px 0 4px;">`;
    info += `<div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:2px;color:#aaccff"><span>Veteran Progress</span><span>${dmgDealt}/${maxHp}</span></div>`;
    info += `<div style="height:4px;background:rgba(255,255,255,0.12);border-radius:2px;"><div style="width:${vetPct}%;height:100%;background:#00aaff;border-radius:2px;transition:width 0.3s;box-shadow:0 0 4px #00aaff;"></div></div>`;
    info += `</div>`;
  } else if (piece.isVeteran) {
    info += `<div style="font-size:11px;color:#00aaff;font-weight:bold;text-shadow:0 0 4px #00aaff;margin-bottom:4px;">★ VETERAN</div>`;
  }

  const s = piece.stats || C.PIECE_TYPES[piece.key]?.stats;
  if (s || typeof piece.strength === 'number') {
    const effStr = E.getEffectiveStrength ? E.getEffectiveStrength(piece, gameState) : (piece.strength ?? s?.strength ?? 2);
    const effDef = E.getEffectiveDefense ? E.getEffectiveDefense(piece, gameState) : (piece.def ?? s?.def ?? 0);
    const effAgi = E.getEffectiveAgility ? E.getEffectiveAgility(piece, gameState) : (piece.agility ?? s?.agility ?? 2);
    const effCtrl = E.getEffectiveControl ? E.getEffectiveControl(piece, gameState) : (piece.control ?? s?.control ?? 0.1);
    const rng = piece.range ?? s?.rng ?? 1;
    info += `<div style="font-size:11px;color:#aac;margin-bottom:4px;display:flex;gap:6px;flex-wrap:wrap;">`;
    info += `<span title="Strength">⚔${formatHp(effStr)}</span>`;
    info += `<span title="Defense">🛡${formatHp(effDef)}</span>`;
    info += `<span title="Range">🎯${formatHp(rng)}</span>`;
    info += `<span title="Agility">💨${formatHp(effAgi)}</span>`;
    info += `<span title="Control">🌐${formatHp(effCtrl)}</span>`;
    info += `</div>`;
  } else {
    info += `Power: ${formatHp(effectivePower)} (Base: ${typeInfo.power || 0})<br>`;
  }

  const boosts = [];
  if (piece.shrineBoost > 0) boosts.push(`Shrine (+${piece.shrineBoost})`);
  if (piece.anchorBoost > 0) boosts.push(`Anchor (+${piece.anchorBoost})`);
  if (piece.overloadBoost?.duration > 0) boosts.push(`Infusion (+${piece.overloadBoost.amount}, ${piece.overloadBoost.duration} turns)`);
  (gameState?.temporaryBoosts || []).filter(b => b.pieceId === piece.id).forEach(boost => {
    const boostName = C.ABILITIES[boost.name]?.name || boost.name;
    boosts.push(`${boostName} (+${boost.amount}, ${boost.duration} turns)`);
  });
  if (boosts.length > 0) info += `<span class="buff-text" style="color:#44ffaa;font-size:11px;">${boosts.join('<br>')}</span><br>`;

  const debuffs = [];
  if ((gameState?.markedPieces || []).some(m => m.targetId === piece.id)) debuffs.push(`Marked (-${C.ABILITY_VALUES.MarkOfCinder.powerDebuff})`);
  (gameState?.debuffs || []).filter(d => d.pieceId === piece.id).forEach(debuff => {
    if (debuff.amount < 0) debuffs.push(`${C.ABILITIES[debuff.name]?.name || debuff.name} (${debuff.amount}, ${debuff.duration} turns)`);
  });
  if (debuffs.length > 0) info += `<span class="debuff-text" style="color:#ff5555;font-size:11px;">${debuffs.join('<br>')}</span><br>`;

  const statuses = [];
  if (piece.stuck > 0) statuses.push(`Stuck (${piece.stuck} turns)`);
  if (piece.isDazed) statuses.push('Dazed');
  if (piece.hasDefensiveWard) statuses.push('Ward (Immune)');
  if (piece.canRiftPulse) statuses.push('Rift Pulse Ready');
  if (piece.isTrapped) statuses.push('Trapped by Shrine');
  if (piece.hasDeathMeteorInvincibility) {
    const tLeft = piece.deathMeteorInvincibilityTurns || 1;
    statuses.push(`Meteor Shield (Lethal damage negated - ${tLeft}t)`);
  } else if (piece.hasHelpFromAboveActive) {
    const tLeft = piece.helpFromAboveActiveTurns || 1;
    statuses.push(`Divine Shield (Lethal damage negated - ${tLeft}t)`);
  }

  const activeShield = (gameState?.shields || []).find(s => s.pieceId === piece.id);
  if (activeShield) {
    if (activeShield.name === 'ObsidianPillarShield') {
      const sHp = activeShield.hp !== undefined ? activeShield.hp : 2;
      statuses.push(`Obsidian Shield: ${sHp} HP (${activeShield.duration} turns)`);
    } else {
      statuses.push(`Frost Shield (${activeShield.duration} turns)`);
    }
  }
  if (statuses.length > 0) info += `<span style="color:#ffff55;font-size:11px;">Status: ${statuses.join(', ')}</span><br>`;
  
  if (piece.ability?.key && piece.ability.key !== 'Siphon') {
    const cdText = (piece.ability.cooldown || 0) > 0 ? `CD: ${piece.ability.cooldown}` : 'Ready';
    info += `<div style="margin-top:5px;font-size:11px;line-height:1.3;"><span style="color:#88ccff">Active:</span> <span style="color:#ffcc00">${piece.ability.name}</span> (${cdText})`;
    const desc = C.ABILITY_DESCRIPTIONS[piece.ability.key];
    if (desc) {
      info += `<br><span style="color:#ddd">${desc}</span>`;
    }
    info += `</div>`;
  }
  
  const handler = C.PASSIVE_DESCRIPTIONS[piece.key];
  if (handler) {
    const cd = piece.helpFromAboveCooldown || piece.deathMeteorCooldown || 0;
    let active = piece.hasHelpFromAboveActive ? ' [ACTIVE]' : '';
    if (piece.hasDeathMeteorInvincibility) {
      active = ` [SHIELD ACTIVE — Lethal Negated (${piece.deathMeteorInvincibilityTurns || 1}t)]`;
    } else if (piece.hasHelpFromAboveActive) {
      active = ` [SHIELD ACTIVE — Lethal Negated (${piece.helpFromAboveActiveTurns || 1}t)]`;
    }
    const name = piece.key === 'snowFrostLord' ? 'Help From Above' : piece.key === 'ashAshTyrant' ? 'Death Meteor' : '';
    let passiveText = handler;
    if (name) {
      passiveText = `${name} — ${cd > 0 ? `CD: ${cd} turns` : 'Ready'}${active}<br><span style="color:#ccc">${handler.split(' — ')[1] || handler}</span>`;
    } else if (piece.key === 'snowGlacialMage') {
      const wisps = (gameState?.pieces || []).filter(p => p.key === "snowIceWisp" && p.team === piece.team && p.currentHp > 0);
      const wCount = wisps.length;
      const strBonus = wCount >= 2 ? '+1 STR, ' : '';
      const agiBonus = `+${(0.2 * wCount).toFixed(1)} AGI`;
      const ctrlBonus = `+${(0.2 * wCount).toFixed(1)} CTRL`;
      const activeText = wCount > 0 
        ? ` <span style="color:#38bdf8;font-weight:bold;">[Active: ${wCount}/2 Wisps — ${strBonus}${agiBonus}, ${ctrlBonus}]</span>` 
        : ` <span style="color:#94a3b8;">[0/2 Wisps — Inactive]</span>`;
      passiveText = `Frost Duo${activeText}<br><span style="color:#ccc">${handler.split(' — ')[1] || handler}</span>`;
    }
    info += `<div style="margin-top:3px;font-size:11px;line-height:1.3;"><span style="color:#aaffaa">Passive:</span> ${passiveText}</div>`;
  }

  const sel = gameState?.selectedPiece;
  if (sel && sel.team !== piece.team) {
    try {
      const preview = E.previewDamage(sel, piece, gameState);
      const rawHpNow = piece.currentHp != null ? piece.currentHp : (piece.maxHp || '?');
      const hpNow = formatHp(rawHpNow);
      const rawHpMax = piece.maxHp != null ? piece.maxHp : rawHpNow;
      const hpMax = formatHp(rawHpMax);
      let predHtml = `<div id="tacticalPredictor">`;
      predHtml += `<div>⚔ ${C.PIECE_TYPES[sel.key]?.name || sel.key} → ${C.PIECE_TYPES[piece.key]?.name || piece.key}</div>`;
      predHtml += `<div>HP: ${hpNow}/${hpMax} &nbsp;|&nbsp; `;
      predHtml += `DMG: <span class="pred-dmg">-${formatHp(preview.dmg)}</span></div>`;
      if (piece.hasDeathMeteorInvincibility) {
        predHtml += `<div style="color:#facc15;font-weight:bold;margin-top:2px;">🛡 METEOR SHIELD — LETHAL NEGATED</div>`;
      } else if (piece.hasHelpFromAboveActive) {
        predHtml += `<div style="color:#38bdf8;font-weight:bold;margin-top:2px;">🛡 DIVINE SHIELD — LETHAL NEGATED</div>`;
      } else if (preview.isFatal) {
        predHtml += `<div class="pred-fatal" style="color:#EF4444;font-weight:bold;margin-top:2px;">☠ LETHAL STRIKE</div>`;
      } else {
        const numHpNow = typeof rawHpNow === 'number' ? rawHpNow : parseFloat(rawHpNow) || 0;
        const hpAfter = formatHp(Math.max(0, numHpNow - preview.dmg));
        predHtml += `<div>Remaining HP: <span class="pred-chip" style="color:#44ffaa;">${hpAfter}</span></div>`;
      }
      predHtml += `</div>`;
      info += predHtml;
    } catch (e) {
      console.error(e);
    }
  }

  return info;
}

function PieceTooltip({ hoveredPiece, gameState, initialMousePos }) {
  const popupRef = useRef(null);
  const targetMousePosRef = useRef(initialMousePos || { x: 0, y: 0 });
  const currentMousePosRef = useRef(initialMousePos || { x: 0, y: 0 });
  const popupRafRef = useRef(null);
  const sizeRef = useRef({ w: 400, h: 280, measured: false });

  useEffect(() => {
    sizeRef.current.measured = false;
  }, [hoveredPiece?.id]);

  useEffect(() => {
    if (initialMousePos && initialMousePos.x > 0 && initialMousePos.y > 0) {
      targetMousePosRef.current = { x: initialMousePos.x, y: initialMousePos.y };
      currentMousePosRef.current = { x: initialMousePos.x, y: initialMousePos.y };
    }
  }, [initialMousePos]);

  // Smooth mouse-trailing physics for hovered piece popup
  useEffect(() => {
    if (!hoveredPiece) {
      if (popupRafRef.current) {
        cancelAnimationFrame(popupRafRef.current);
        popupRafRef.current = null;
      }
      return;
    }

    const applyTransform = (x, y) => {
      if (!popupRef.current) return;
      if (!sizeRef.current.measured && popupRef.current.offsetWidth) {
        sizeRef.current.w = popupRef.current.offsetWidth;
        sizeRef.current.h = popupRef.current.offsetHeight;
        sizeRef.current.measured = true;
      }

      const tooltipWidth = sizeRef.current.w;
      const tooltipHeight = sizeRef.current.h;

      let left = x + 18;
      let top = y + 18;

      if (left + tooltipWidth > window.innerWidth - 15) {
        left = x - tooltipWidth - 18;
      }
      if (top + tooltipHeight > window.innerHeight - 15) {
        top = window.innerHeight - tooltipHeight - 15;
      }
      left = Math.max(10, left);
      top = Math.max(10, top);

      popupRef.current.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0)`;
    };

    const updatePosition = () => {
      const target = targetMousePosRef.current;
      const current = currentMousePosRef.current;

      const dx = target.x - current.x;
      const dy = target.y - current.y;

      // When settled within 0.2px, snap and sleep animation loop to prevent continuous CPU usage & layout thrash
      if (Math.abs(dx) < 0.2 && Math.abs(dy) < 0.2) {
        current.x = target.x;
        current.y = target.y;
        applyTransform(current.x, current.y);
        popupRafRef.current = null;
        return;
      }

      // Organic fluid trailing lerp (factor: 0.22)
      current.x += dx * 0.22;
      current.y += dy * 0.22;

      applyTransform(current.x, current.y);
      popupRafRef.current = requestAnimationFrame(updatePosition);
    };

    const handlePointerMove = (e) => {
      targetMousePosRef.current = { x: e.clientX, y: e.clientY };
      if (!popupRafRef.current) {
        popupRafRef.current = requestAnimationFrame(updatePosition);
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });

    if (!popupRafRef.current) {
      popupRafRef.current = requestAnimationFrame(updatePosition);
    }

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      if (popupRafRef.current) {
        cancelAnimationFrame(popupRafRef.current);
        popupRafRef.current = null;
      }
    };
  }, [hoveredPiece]);

  if (!hoveredPiece || gameState?.gameOver) return null;

  const html = generatePieceInfoHtml(hoveredPiece, gameState);

  return (
    <div
      ref={popupRef}
      id="piecePopup"
      className="piece-Popup pointer-events-none"
      style={{
        display: 'block',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 10000,
        willChange: 'transform',
        transform: `translate3d(${Math.round((currentMousePosRef.current.x || 100) + 18)}px, ${Math.round((currentMousePosRef.current.y || 100) + 18)}px, 0)`,
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default React.memo(PieceTooltip);
