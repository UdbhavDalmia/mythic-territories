// Utility: safe getter for board map
export function getPieceAt(r, c, boardMap) {
    return boardMap?.[r]?.[c] || null;
}

// Small factory used for SHAPES.riftAreas
function generateRift(startRow, startCol, size) {
    const cells = [];
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) cells.push([startRow + r, startCol + c]);
    }
    const id = startRow === 0 ? 'topLeft' : 'bottomRight';
    return { id, cells, name: 'Power Rift', pulsePhase: 0, particles: [] };
}

// -------------------- Ability numeric/data values --------------------
export const ABILITY_VALUES = {
    BurningGround: { cost: 3, duration: 5 },
    ChillingAura: { cooldown: 4, duration: 3, powerDebuff: 1 },
    FlashFreeze: { cost: 1, range: 4, duration: 4 },
    FrenziedDash: { range: 2, cooldown: 3 },
    FrigidPath: { range: 4, cooldown: 5 },
    FrostArmor: { duration: 2, cooldown: 4, powerBoost: 2 },
    GlacialStep: { cost: 2, range: 5 },
    GlacialWall: { cooldown: 6, duration: 3 },
    Hamstring: { range: 1, duration: 2, cooldown: 3 },
    HoarfrostArmaments: { duration: 4, powerBoost: 1 },
    HuntersRage: { duration: 2, cooldown: 4, powerBoost: 1 },
    InnerFurnace: { duration: 4, powerBoost: 1 },
    KindleArmor: { range: 1, duration: 2, cooldown: 3, powerBoost: 1 },
    KingsEdict: { duration: 4, powerDebuff: 1 },
    LavaGlob: { cooldown: 10, range: 4, damage: 1, maxTargetPower: 2 },
    MagmaShield: { range: 2, duration: 2, cooldown: 5 },
    MarkOfCinder: { cooldown: 4, range: 2, duration: 3, powerDebuff: 1 },
    PowerInfusion: { powerBoost: 4, duration: 5 },
    Pummel: { range: 1, cooldown: 3 },
    RiftAnchor: { powerBoost: 2 },
    RiftAssault: { cost: 2, range: 3 },
    ScorchedRetreat: { range: 1, cooldown: 3 },
    SetSnare: { range: 1, cooldown: 4, duration: 2 },
    Shrine: { powerBoost: 1, overloadCharges: 2 },
    Siphon: { maxCharges: 3 },
    StokeTheFlames: { cost: 1, range: 4, duration: 3, powerBoost: 2 },
    SummonIceWisp: { cooldown: 4, range: 4 },
    TyrantsProclamation: { duration: 4, powerBoost: 1 },
    UnstableGround: { cooldown: 4, range: 4, duration: 3, damage: 1 },
    Whiteout: { cost: 3, radius: 3, duration: 2, powerDebuff: 1 },
    FrostStomp: { cooldown: 3, duration: 1 },
    HardenedIce: { cooldown: 5, duration: 4 },
    GlacialBeacon: { cooldown: 4, range: 3, duration: 2 },
    FrostbiteCurse: { cooldown: 4, range: 2, duration: 2, powerDebuff: 1 },
    DistractingRoar: { cooldown: 2, range: 1, duration: 2, powerDebuff: 1 },
    IcyShift: { cooldown: 5, range: 2, duration: 2 },
    SiphonCharge: { permDamageCost: 1, cooldownReset: 'FrenziedDash' },
    BlazeLunge: { cooldown: 4, range: 2 },
    EruptionLink: { cooldown: 5, range: 1, duration: 2, powerBoost: 2 },
    VolatileCinder: { cooldown: 4, range: 3, damage: 1 },
    SoulfireBurst: { cooldown: 6, range: 3, damage: 1 },
    TacticalSwapAsh: { cooldown: 4, range: 2, duration: 2 },
    CinderSurge: { cooldown: 4, range: 1 },
    WispEnhancement: { powerBoost: 1 },
    GlacialFortress: { cooldown: 8, duration: 3 },
    VolatileForge: { places: 2 },
    MagmaAnchor: { powerBoost: 1 },
};

// -------------------- Targeting helpers --------------------
const inBounds = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < COLS;

const glacialWallTargeting = (p, t, gs) => {
    const distance = Math.max(Math.abs(p.row - t.r), Math.abs(p.col - t.c));
    if (!inBounds(t.r, t.c)) return false;
    const targetPiece = getPieceAt(t.r, t.c, gs.boardMap);
    const isVoid = (gs.voidSquares || []).some(v => v.row === t.r && v.col === t.c);
    const hasWall = (gs.glacialWalls || []).some(w => w.row === t.r && w.col === t.c);
    return distance === 1 && !targetPiece && !isVoid && !hasWall;
};

// Effect for Unstable Ground placement (may place additional grounds if veteran upgrade present)
const unstableGroundEffect = (p, t, gs) => {
    gs.unstableGrounds.push({ row: t.r, col: t.c, duration: ABILITY_VALUES.UnstableGround.duration, creator: p });

    if (!p.ability?.isVeteranForge) return;

    const directions = [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]];
    let placedCount = 0;
    for (const [dr, dc] of directions) {
        if (placedCount >= ABILITY_VALUES.VolatileForge.places - 1) break;
        const r2 = t.r + dr;
        const c2 = t.c + dc;
        if (!inBounds(r2, c2)) continue;
        if (getPieceAt(r2, c2, gs.boardMap)) continue;
        if (gs.unstableGrounds.some(g => g.row === r2 && g.col === c2)) continue;
        if (gs.glacialWalls.some(w => w.row === r2 && w.col === c2)) continue;
        if ((gs.voidSquares || []).some(v => v.row === r2 && v.col === c2)) continue;

        gs.unstableGrounds.push({ row: r2, col: c2, duration: ABILITY_VALUES.UnstableGround.duration, creator: p });
        placedCount++;
    }
};

// -------------------- Abilities --------------------
export const ABILITIES = {
    BurningGround: {
        name: 'Burning Ground',
        cost: ABILITY_VALUES.BurningGround.cost,
        requiresTargeting: false,
        effect: (p, t, gs) => {
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    const r = p.row + dr;
                    const c = p.col + dc;
                    if (inBounds(r, c)) {
                        gs.unstableGrounds.push({ row: r, col: c, duration: ABILITY_VALUES.BurningGround.duration, creator: p, isBurningGround: true });
                    }
                }
            }
        }
    },

    ChillingAura: {
        name: 'Chilling Aura',
        cooldown: ABILITY_VALUES.ChillingAura.cooldown,
        requiresTargeting: false,
        effect: (p, t, gs) => { p.ability.active = true; p.ability.duration = ABILITY_VALUES.ChillingAura.duration; }
    },

    FlashFreeze: {
        name: 'Flash Freeze',
        cost: ABILITY_VALUES.FlashFreeze.cost,
        range: ABILITY_VALUES.FlashFreeze.range,
        targetType: 'enemy',
        canBeBlocked: true,
        requiresTargeting: true,
        effect: (p, t, gs) => { const targetPiece = getPieceAt(t.r, t.c, gs.boardMap); if (targetPiece) targetPiece.stuck = ABILITY_VALUES.FlashFreeze.duration; }
    },

    FrenziedDash: {
        name: 'Frenzied Dash',
        cooldown: ABILITY_VALUES.FrenziedDash.cooldown,
        range: ABILITY_VALUES.FrenziedDash.range,
        targetType: 'special',
        requiresTargeting: true,
        specialTargeting: (p, t, gs) => {
            const dr = t.r - p.row;
            const dc = t.c - p.col;
            const isRampageUpgrade = p.key === TEAM_PIECES.ash.Warrior && gs.factionPassives.ash.ascension.Rampage;
            if (getPieceAt(t.r, t.c, gs.boardMap)) return false;

            if (Math.abs(dr) === 2 && dc === 0) {
                const intermediatePiece = getPieceAt(p.row + (dr/2), p.col, gs.boardMap);
                const pathClear = isRampageUpgrade ? (intermediatePiece?.team === p.team || !intermediatePiece) : !intermediatePiece;
                return pathClear && !gs.glacialWalls.some(w => w.row === p.row + (dr/2) && w.col === p.col);
            }

            if (Math.abs(dc) === 2 && dr === 0) {
                const intermediatePiece = getPieceAt(p.row, p.col + (dc/2), gs.boardMap);
                const pathClear = isRampageUpgrade ? (intermediatePiece?.team === p.team || !intermediatePiece) : !intermediatePiece;
                return pathClear && !gs.glacialWalls.some(w => w.row === p.row && w.col === p.col + (dc/2));
            }

            return false;
        },
        effect: (p, t, gs) => {
            p.row = t.r; p.col = t.c;
            const newPos = `${t.r},${t.c}`;
            const territory = p.team === 'snow' ? gs.snowTerritory : gs.ashTerritory;
            const opponentTerritory = p.team === 'snow' ? gs.ashTerritory : gs.snowTerritory;
            territory.add(newPos);
            opponentTerritory.delete(newPos);
            gs.territoryCaptureTurn[newPos] = gs.turnCount;
        }
    },

    FrigidPath: {
        name: 'Frigid Path',
        cooldown: ABILITY_VALUES.FrigidPath.cooldown,
        range: ABILITY_VALUES.FrigidPath.range,
        targetType: 'empty',
        canBeBlocked: false,
        requiresTargeting: true,
        effect: (p, t, gs) => {
            const targets = [ { r: t.r, c: t.c - 1 }, { r: t.r, c: t.c }, { r: t.r, c: t.c + 1 } ];
            for (const target of targets) {
                if (!inBounds(target.r, target.c)) continue;
                if (getPieceAt(target.r, target.c, gs.boardMap)) continue;
                if (gs.glacialWalls.some(w => w.row === target.r && w.col === target.c)) continue;
                if ((gs.voidSquares || []).some(v => v.row === target.r && v.col === target.c)) continue;

                gs.specialTerrains.push({ row: target.r, col: target.c, type: 'icyGround', duration: 99 });
                const newPos = `${target.r},${target.c}`;
                gs.snowTerritory.add(newPos);
                gs.ashTerritory.delete(newPos);
                gs.territoryCaptureTurn[newPos] = gs.turnCount;
            }
        }
    },

    FrostArmor: {
        name: 'Frost Armor',
        cooldown: ABILITY_VALUES.FrostArmor.cooldown,
        requiresTargeting: false,
        effect: (p, t, gs) => { gs.temporaryBoosts.push({ pieceId: p.id, amount: ABILITY_VALUES.FrostArmor.powerBoost, duration: ABILITY_VALUES.FrostArmor.duration, name: 'FrostArmor' }); }
    },

    GlacialStep: {
        name: 'Glacial Step',
        cost: ABILITY_VALUES.GlacialStep.cost,
        range: ABILITY_VALUES.GlacialStep.range,
        targetType: 'special',
        requiresTargeting: true,
        specialTargeting: (p, t, gs) => {
            const distance = Math.max(Math.abs(p.row - t.r), Math.abs(p.col - t.c));
            if (distance > ABILITY_VALUES.GlacialStep.range) return false;
            const targetPiece = getPieceAt(t.r, t.c, gs.boardMap);
            return !targetPiece && gs.snowTerritory.has(`${t.r},${t.c}`);
        },
        effect: (p, t, gs) => {
            p.row = t.r; p.col = t.c;
            const newPos = `${t.r},${t.c}`;
            gs.snowTerritory.add(newPos);
            gs.ashTerritory.delete(newPos);
            gs.territoryCaptureTurn[newPos] = gs.turnCount;
        }
    },

    GlacialWall: {
        name: 'Glacial Wall',
        cooldown: ABILITY_VALUES.GlacialWall.cooldown,
        requiresTargeting: true,
        range: 1,
        targetType: 'special',
        specialTargeting: glacialWallTargeting,
        effect: (p, t, gs) => { if (t) gs.glacialWalls.push({ row: t.r, col: t.c, duration: ABILITY_VALUES.GlacialWall.duration }); }
    },

    Hamstring: {
        name: 'Hamstring',
        cooldown: ABILITY_VALUES.Hamstring.cooldown,
        range: ABILITY_VALUES.Hamstring.range,
        targetType: 'enemy',
        canBeBlocked: true,
        requiresTargeting: true,
        effect: (p, t, gs) => { const targetPiece = getPieceAt(t.r, t.c, gs.boardMap); if (targetPiece) gs.debuffs.push({ pieceId: targetPiece.id, amount: 0, duration: ABILITY_VALUES.Hamstring.duration, name: 'Hamstrung' }); }
    },

    HuntersRage: {
        name: "Hunter's Rage",
        cooldown: ABILITY_VALUES.HuntersRage.cooldown,
        requiresTargeting: false,
        effect: (p, t, gs) => { gs.temporaryBoosts.push({ pieceId: p.id, amount: ABILITY_VALUES.HuntersRage.powerBoost, duration: ABILITY_VALUES.HuntersRage.duration, name: 'HuntersRage' }); }
    },

    KingsEdict: {
        name: "King's Edict",
        requiresTargeting: false,
        isUltimate: true,
        effect: (p, t, gs) => {
            gs.pieces.forEach(op => {
                if (op.team !== p.team && !op.hasDefensiveWard) gs.debuffs.push({ pieceId: op.id, amount: ABILITY_VALUES.KingsEdict.powerDebuff, duration: ABILITY_VALUES.KingsEdict.duration, name: 'Edict' });
            });
        }
    },

    KindleArmor: {
        name: 'Kindle Armor',
        cooldown: ABILITY_VALUES.KindleArmor.cooldown,
        range: ABILITY_VALUES.KindleArmor.range,
        targetType: 'friendly',
        canBeBlocked: false,
        requiresTargeting: true,
        effect: (p, t, gs) => { const targetPiece = getPieceAt(t.r, t.c, gs.boardMap); if (targetPiece) gs.temporaryBoosts.push({ pieceId: targetPiece.id, amount: ABILITY_VALUES.KindleArmor.powerBoost, duration: ABILITY_VALUES.KindleArmor.duration, name: 'KindleArmor' }); }
    },

    LavaGlob: {
        name: 'Lava Glob',
        cooldown: ABILITY_VALUES.LavaGlob.cooldown,
        range: ABILITY_VALUES.LavaGlob.range,
        targetType: 'special',
        canBeBlocked: true,
        requiresTargeting: true,
        specialTargeting: (p, t, gs) => {
            const targetPiece = getPieceAt(t.r, t.c, gs.boardMap);
            if (!targetPiece || targetPiece.team === p.team) return false;
            const isMarked = gs.markedPieces.some(m => m.targetId === targetPiece.id);
            if (isMarked) return true;
            const baseStats = PIECE_TYPES[targetPiece.key];
            const maxPower = gs.factionPassives.ash.ascension.lavaGlobPower || ABILITY_VALUES.LavaGlob.maxTargetPower;
            return baseStats && typeof baseStats.power === 'number' && baseStats.power <= maxPower;
        },
        effect: (p, t, gs) => { const targetPiece = getPieceAt(t.r, t.c, gs.boardMap); if (targetPiece) targetPiece.power = Math.max(0, targetPiece.power - ABILITY_VALUES.LavaGlob.damage); }
    },

    MagmaShield: {
        name: 'Magma Shield',
        cooldown: ABILITY_VALUES.MagmaShield.cooldown,
        range: ABILITY_VALUES.MagmaShield.range,
        targetType: 'friendly',
        canBeBlocked: false,
        requiresTargeting: true,
        effect: (p, t, gs) => { const targetPiece = getPieceAt(t.r, t.c, gs.boardMap); if (targetPiece && !gs.shields.some(s => s.pieceId === targetPiece.id)) gs.shields.push({ pieceId: targetPiece.id, duration: ABILITY_VALUES.MagmaShield.duration }); }
    },

    MarkOfCinder: {
        name: 'Mark of Cinder',
        cooldown: ABILITY_VALUES.MarkOfCinder.cooldown,
        range: ABILITY_VALUES.MarkOfCinder.range,
        targetType: 'enemy',
        canBeBlocked: true,
        requiresTargeting: true,
        effect: (p, t, gs) => {
            const targetPiece = getPieceAt(t.r, t.c, gs.boardMap);
            if (!targetPiece) return;
            if (p.isElementalHarmony) targetPiece.power = Math.max(0, targetPiece.power - ABILITY_VALUES.LavaGlob.damage);
            gs.markedPieces.push({ targetId: targetPiece.id, duration: ABILITY_VALUES.MarkOfCinder.duration });
        }
    },

    Pummel: {
        name: 'Pummel',
        cooldown: ABILITY_VALUES.Pummel.cooldown,
        range: ABILITY_VALUES.Pummel.range,
        targetType: 'enemy',
        canBeBlocked: true,
        requiresTargeting: true,
        effect: (p, t, gs) => {
            const targetPiece = getPieceAt(t.r, t.c, gs.boardMap);
            if (!targetPiece) return;
            const pushToR = t.r + (t.r - p.row);
            const pushToC = t.c + (t.c - p.col);

            if (inBounds(pushToR, pushToC) && !getPieceAt(pushToR, pushToC, gs.boardMap) && !gs.glacialWalls.some(w => w.row === pushToR && w.col === pushToC) && !(gs.voidSquares || []).some(v => v.row === pushToR && v.col === pushToC)) {
                targetPiece.row = pushToR; targetPiece.col = pushToC;
                const newPos = `${pushToR},${pushToC}`;
                const territory = targetPiece.team === 'snow' ? gs.snowTerritory : gs.ashTerritory;
                const opponentTerritory = targetPiece.team === 'snow' ? gs.ashTerritory : gs.snowTerritory;
                territory.add(newPos); opponentTerritory.delete(newPos); gs.territoryCaptureTurn[newPos] = gs.turnCount;
            }
        }
    },

    RiftAssault: {
        name: 'Rift Assault',
        cost: ABILITY_VALUES.RiftAssault.cost,
        range: ABILITY_VALUES.RiftAssault.range,
        targetType: 'special',
        requiresTargeting: true,
        specialTargeting: (p, t, gs) => {
            if (getPieceAt(t.r, t.c, gs.boardMap)) return false;
            for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const adjPiece = getPieceAt(t.r + dr, t.c + dc, gs.boardMap);
                if (adjPiece && adjPiece.team !== p.team) return true;
            }
            return false;
        },
        effect: (p, t, gs) => {
            p.row = t.r; p.col = t.c; p.isDazed = true; p.dazedFor = 2;
            const newPos = `${t.r},${t.c}`;
            const territory = p.team === 'snow' ? gs.snowTerritory : gs.ashTerritory;
            const opponentTerritory = p.team === 'snow' ? gs.ashTerritory : gs.snowTerritory;
            territory.add(newPos); opponentTerritory.delete(newPos); gs.territoryCaptureTurn[newPos] = gs.turnCount;
        }
    },

    ScorchedRetreat: {
        name: 'Scorched Retreat',
        cooldown: ABILITY_VALUES.ScorchedRetreat.cooldown,
        range: 1,
        targetType: 'special',
        requiresTargeting: true,
        specialTargeting: (p, t, gs) => {
            if (getPieceAt(t.r, t.c, gs.boardMap)) return false;
            const isBottomHome = (gs.playerTeam === p.team);
            const expectedRow = isBottomHome ? p.row + 1 : p.row - 1;
            return t.r === expectedRow && t.c === p.col;
        },
        effect: (p, t, gs) => {
            const oldRow = p.row; const oldCol = p.col;
            p.row = t.r; p.col = t.c;
            const newPos = `${t.r},${t.c}`;
            const territory = p.team === 'snow' ? gs.snowTerritory : gs.ashTerritory;
            const opponentTerritory = p.team === 'snow' ? gs.ashTerritory : gs.snowTerritory;
            territory.add(newPos); opponentTerritory.delete(newPos); gs.territoryCaptureTurn[newPos] = gs.turnCount;
            gs.unstableGrounds.push({ row: oldRow, col: oldCol, duration: ABILITY_VALUES.BurningGround.duration, creator: p, isBurningGround: true });
        }
    },

    SetSnare: { name: 'Set Snare', cooldown: ABILITY_VALUES.SetSnare.cooldown, range: ABILITY_VALUES.SetSnare.range, targetType: 'empty', canBeBlocked: false, requiresTargeting: true, effect: (p, t, gs) => { gs.specialTerrains.push({ row: t.r, col: t.c, type: 'snare', duration: 99 }); } },

    SummonIceWisp: {
        name: 'Summon Ice Wisp',
        cooldown: ABILITY_VALUES.SummonIceWisp.cooldown,
        range: ABILITY_VALUES.SummonIceWisp.range,
        targetType: 'empty',
        canBeBlocked: false,
        requiresTargeting: true,
        effect: (p, t, gs, createPiece) => {
            const wispPowerFromAscension = gs.factionPassives?.snow?.ascension?.wispPower || 0;
            const wispPowerFromVeteran = p.isVeteranWispEnhancement ? ABILITY_VALUES.WispEnhancement.powerBoost : 0;
            const power = Math.max(wispPowerFromAscension, wispPowerFromVeteran);
            const wisp = createPiece(t.r, t.c, 'snowIceWisp', 'snow');
            wisp.power = power; gs.pieces.push(wisp);
            const newPos = `${t.r},${t.c}`;
            gs.snowTerritory.add(newPos); gs.ashTerritory.delete(newPos); gs.territoryCaptureTurn[newPos] = gs.turnCount;
        }
    },

    StokeTheFlames: { name: 'Stoke the Flames', cost: ABILITY_VALUES.StokeTheFlames.cost, range: ABILITY_VALUES.StokeTheFlames.range, targetType: 'friendly', canBeBlocked: false, requiresTargeting: true, effect: (p, t, gs) => { const targetPiece = getPieceAt(t.r, t.c, gs.boardMap); if (targetPiece) gs.temporaryBoosts.push({ pieceId: targetPiece.id, amount: ABILITY_VALUES.StokeTheFlames.powerBoost, duration: ABILITY_VALUES.StokeTheFlames.duration, name: 'StokeTheFlames' }); } },

    TyrantsProclamation: { name: "Tyrant's Proclamation", requiresTargeting: false, isUltimate: true, effect: (p, t, gs) => { gs.pieces.forEach(fp => { if (fp.team === p.team) gs.temporaryBoosts.push({ pieceId: fp.id, amount: ABILITY_VALUES.TyrantsProclamation.powerBoost, duration: ABILITY_VALUES.TyrantsProclamation.duration, name: 'Proclamation' }); }); } },

    UnstableGround: { name: 'Unstable Ground', cooldown: ABILITY_VALUES.UnstableGround.cooldown, range: ABILITY_VALUES.UnstableGround.range, targetType: 'empty', canBeBlocked: false, requiresTargeting: true, effect: unstableGroundEffect },

    Whiteout: { name: 'Whiteout', cost: ABILITY_VALUES.Whiteout.cost, requiresTargeting: false, effect: (p, t, gs) => { gs.pieces.forEach(op => { if (op.team !== p.team && !op.hasDefensiveWard && Math.max(Math.abs(p.row - op.row), Math.abs(p.col - op.col)) <= ABILITY_VALUES.Whiteout.radius) { gs.debuffs.push({ pieceId: op.id, amount: ABILITY_VALUES.Whiteout.powerDebuff, duration: ABILITY_VALUES.Whiteout.duration, name: 'Whiteout' }); } }); } },

    FrostStomp: { name: 'Frost Stomp', cooldown: ABILITY_VALUES.FrostStomp.cooldown, requiresTargeting: true, range: 1, targetType: 'enemy', canBeBlocked: true, effect: (p, t, gs) => { const targetPiece = getPieceAt(t.r, t.c, gs.boardMap); if (targetPiece) { targetPiece.isDazed = true; targetPiece.dazedFor = ABILITY_VALUES.FrostStomp.duration * 2; } } },

    HardenedIce: { name: 'Hardened Ice', cooldown: ABILITY_VALUES.HardenedIce.cooldown, requiresTargeting: true, range: 1, targetType: 'friendly', effect: (p, t, gs) => { const targetPiece = getPieceAt(t.r, t.c, gs.boardMap); if (targetPiece) { targetPiece.isSteadfast = true; gs.debuffs.push({ pieceId: targetPiece.id, amount: 0, duration: ABILITY_VALUES.HardenedIce.duration, name: 'HardenedIce' }); } } },

    GlacialFortress: { name: 'Glacial Wall (Fortress)', cooldown: ABILITY_VALUES.GlacialFortress.cooldown, requiresTargeting: true, range: 1, targetType: 'special', specialTargeting: glacialWallTargeting, effect: () => {} },

    GlacialBeacon: { name: 'Glacial Beacon', cooldown: ABILITY_VALUES.GlacialBeacon.cooldown, requiresTargeting: true, range: ABILITY_VALUES.GlacialBeacon.range, targetType: 'empty', effect: (p, t, gs) => { gs.specialTerrains.push({ row: t.r, col: t.c, type: 'beacon', duration: ABILITY_VALUES.GlacialBeacon.duration * 2 }); } },

    FrostbiteCurse: {
        name: 'Frostbite Curse',
        cooldown: ABILITY_VALUES.FrostbiteCurse.cooldown,
        requiresTargeting: true,
        range: ABILITY_VALUES.FrostbiteCurse.range,
        targetType: 'any',
        canBeBlocked: true,
        effect: (p, t, gs) => {
            const targetPiece = getPieceAt(t.r, t.c, gs.boardMap);
            if (!targetPiece) return;
            const boostIndex = gs.temporaryBoosts.findIndex(b => b.pieceId === targetPiece.id && b.amount > 0);
            if (boostIndex !== -1) {
                gs.temporaryBoosts.splice(boostIndex, 1);
                gs.debuffs.push({ pieceId: targetPiece.id, amount: ABILITY_VALUES.FrostbiteCurse.powerDebuff, duration: ABILITY_VALUES.FrostbiteCurse.duration * 2, name: 'FrostbiteCurse' });
            }
        }
    },

    DistractingRoar: { name: 'Distracting Roar', cooldown: ABILITY_VALUES.DistractingRoar.cooldown, requiresTargeting: true, range: ABILITY_VALUES.DistractingRoar.range, targetType: 'enemy', canBeBlocked: true, effect: (p, t, gs) => { const targetPiece = getPieceAt(t.r, t.c, gs.boardMap); if (targetPiece) gs.debuffs.push({ pieceId: targetPiece.id, amount: ABILITY_VALUES.DistractingRoar.powerDebuff, duration: ABILITY_VALUES.DistractingRoar.duration, name: 'DistractingRoar' }); } },

    IcyShift: { name: 'Icy Shift', cooldown: ABILITY_VALUES.IcyShift.cooldown, requiresTargeting: true, range: ABILITY_VALUES.IcyShift.range, targetType: 'any', effect: () => {} },
    SiphonCharge: { name: 'Siphon Charge', requiresTargeting: false, effect: () => {} },

    BlazeLunge: {
        name: 'Blaze Lunge',
        cooldown: ABILITY_VALUES.BlazeLunge.cooldown,
        requiresTargeting: true,
        range: ABILITY_VALUES.BlazeLunge.range,
        targetType: 'special',
        specialTargeting: (p, t, gs) => {
            if (getPieceAt(t.r, t.c, gs.boardMap)) return false;
            for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const adjPiece = getPieceAt(t.r + dr, t.c + dc, gs.boardMap);
                if (adjPiece && adjPiece.team !== p.team) return true;
            }
            return false;
        },
        effect: (p, t, gs) => {
            p.row = t.r; p.col = t.c; const newPos = `${t.r},${t.c}`;
            const territory = p.team === 'snow' ? gs.snowTerritory : gs.ashTerritory;
            const opponentTerritory = p.team === 'snow' ? gs.ashTerritory : gs.snowTerritory;
            territory.add(newPos); opponentTerritory.delete(newPos); gs.territoryCaptureTurn[newPos] = gs.turnCount;
        }
    },

    EruptionLink: {
        name: 'Eruption Link',
        cooldown: ABILITY_VALUES.EruptionLink.cooldown,
        requiresTargeting: true,
        range: ABILITY_VALUES.EruptionLink.range,
        targetType: 'friendly',
        effect: (p, t, gs) => {
            const targetPiece = getPieceAt(t.r, t.c, gs.boardMap);
            if (!targetPiece) return;
            if (!gs.shields.some(s => s.pieceId === targetPiece.id)) gs.shields.push({ pieceId: targetPiece.id, duration: ABILITY_VALUES.EruptionLink.duration });
            gs.temporaryBoosts.push({ pieceId: targetPiece.id, amount: ABILITY_VALUES.EruptionLink.powerBoost, duration: ABILITY_VALUES.EruptionLink.duration, name: 'EruptionLink' });
        }
    },

    VolatileForge: { name: 'Unstable Ground (Volatile)', cooldown: ABILITY_VALUES.UnstableGround.cooldown, requiresTargeting: true, range: ABILITY_VALUES.UnstableGround.range, targetType: 'empty', effect: unstableGroundEffect },

    VolatileCinder: {
        name: 'Volatile Cinder',
        cooldown: ABILITY_VALUES.VolatileCinder.cooldown,
        requiresTargeting: true,
        range: ABILITY_VALUES.VolatileCinder.range,
        targetType: 'enemy',
        canBeBlocked: true,
        specialTargeting: (p, t, gs) => {
            const distance = Math.max(Math.abs(p.row - t.r), Math.abs(p.col - t.c));
            if (distance > ABILITY_VALUES.VolatileCinder.range) return false;
            const targetPiece = getPieceAt(t.r, t.c, gs.boardMap);
            return targetPiece && targetPiece.team !== p.team && gs.markedPieces.some(m => m.targetId === targetPiece.id);
        },
        effect: (p, t, gs) => { const targetPiece = getPieceAt(t.r, t.c, gs.boardMap); if (targetPiece) targetPiece.power = Math.max(0, targetPiece.power - ABILITY_VALUES.VolatileCinder.damage); }
    },

    SoulfireBurst: {
        name: 'Soulfire Burst',
        cooldown: ABILITY_VALUES.SoulfireBurst.cooldown,
        requiresTargeting: true,
        range: ABILITY_VALUES.SoulfireBurst.range,
        targetType: 'special',
        specialTargeting: (p, t, gs) => { return gs.unstableGrounds.some(g => g.row === t.r && g.col === t.c && (g.isBurningGround || g.creator?.team === p.team)); },
        effect: (p, t, gs) => {
            const ground = gs.unstableGrounds.find(g => g.row === t.r && g.col === t.c);
            if (!ground) return;
            for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
                const targetPiece = getPieceAt(t.r + dr, t.c + dc, gs.boardMap);
                if (targetPiece) targetPiece.power = Math.max(0, targetPiece.power - ABILITY_VALUES.SoulfireBurst.damage);
            }
            gs.unstableGrounds = gs.unstableGrounds.filter(g => g !== ground);
        }
    },

    TacticalSwapAsh: { name: 'Tactical Swap', cooldown: ABILITY_VALUES.TacticalSwapAsh.cooldown, requiresTargeting: true, range: ABILITY_VALUES.TacticalSwapAsh.range, targetType: 'friendly', effect: () => {} },

    CinderSurge: { name: 'Cinder Surge', cooldown: ABILITY_VALUES.CinderSurge.cooldown, requiresTargeting: true, range: 1, targetType: 'friendly', effect: (p, t, gs) => { const targetPiece = getPieceAt(t.r, t.c, gs.boardMap); if (targetPiece) { targetPiece.isDazed = false; targetPiece.dazedFor = 0; targetPiece.stuck = 0; gs.debuffs = gs.debuffs.filter(d => d.pieceId !== targetPiece.id || (d.name !== 'Hamstrung' && d.name !== 'FrostbiteCurse')); } } },
};

// -------------------- Simple enums / constants --------------------
export const TILE_TYPES = { EMPTY: 'empty', RIFT: 'rift', VOID: 'void', ELEMENTAL_CORE: 'core' };

export const RIFT_COLORS = {
    VOID: '#11001C', // original purple
    SNOW: '#00BFFF',
    ASH: '#FF4500'
};

export const BOARD_IMAGE_KEYS = ['gameBackgroundSnow', 'gameBackgroundAsh'];
export const BOOST_NAMES = {};

export const CANVAS_SIZE = 920;
export const COLS = 10;
export const ROWS = 10;
export const CELL_SIZE = CANVAS_SIZE / COLS;

export const IMAGES = {
    ashAshStrider: 'units/blaze-runner.png',
    ashAshTyrant: 'units/ash-tyrant.png',
    ashBlazeboundBeast: 'units/hell-hound.png',
    ashCinderScout: 'units/cinder-scout.png',
    ashMagmaProwler: 'units/magma-prowler.png',
    ashMagmaSpitter: 'units/magma-spitter.png',
    ashObsidianShaper: 'units/obsidian-shaper.png',
    ashRiftForger: 'units/rift-forger.png',
    ashRiftWarden: 'units/rift-warden.png',
    ashScorchPriest: 'units/scorch-priest.png',
    gameBackgroundAsh: 'images/bg-game2.png',
    gameBackgroundSnow: 'images/bg-game.png',
    snowArcticTrapper: 'units/arctic-trapper.png',
    snowCryomancer: 'units/cryomancer.png',
    snowFrostLord: 'units/frost-lord.png',
    snowFrostbiteStalker: 'units/snow-wolf.png',
    snowGlacialBrute: 'units/glacial-brute.png',
    snowHoarfrostMystic: 'units/hoarfrost-mystic.png',
    snowIceWeaver: 'units/ice-weaver.png',
    snowIceWisp: 'units/wisp.png',
    snowRampagingYeti: 'units/yeti.png',
    snowSoulFreeze: 'units/soul-freeze.png',
    snowVoidChanter: 'units/void-chanter.png',
};

export const PIECE_TYPES = {
    ashAshStrider: { name: 'Ash Strider', power: 1, ability: { name: 'Scorched Retreat', key: 'ScorchedRetreat' }, veteranAbility: { key: 'TacticalSwapAsh', cooldown: ABILITY_VALUES.TacticalSwapAsh.cooldown } },
    ashAshTyrant: { name: 'Ash Tyrant', power: 4, ability: { name: "Tyrant's Proclamation", key: 'TyrantsProclamation' } },
    ashBlazeboundBeast: { name: 'Blazebound Beast', power: 2, ability: { name: "Hunter's Rage", key: 'HuntersRage' }, veteranAbility: { key: 'BlazeLunge', cooldown: ABILITY_VALUES.BlazeLunge.cooldown } },
    ashCinderScout: { name: 'Cinder Scout', power: 1, ability: { name: 'Kindle Armor', key: 'KindleArmor' }, veteranAbility: { key: 'CinderSurge', cooldown: ABILITY_VALUES.CinderSurge.cooldown } },
    ashMagmaProwler: { name: 'Magma Prowler', power: 2, ability: { name: 'Frenzied Dash', key: 'FrenziedDash' }, veteranAbility: { key: 'SiphonCharge', isPermanentUpgrade: true } },
    ashMagmaSpitter: { name: 'Magma Spitter', power: 3, ability: { name: 'Lava Glob', key: 'LavaGlob' }, veteranAbility: { key: 'VolatileCinder', cooldown: ABILITY_VALUES.VolatileCinder.cooldown } },
    ashObsidianShaper: { name: 'Obsidian Shaper', power: 1, ability: { name: 'Magma Shield', key: 'MagmaShield' }, veteranAbility: { key: 'EruptionLink', cooldown: ABILITY_VALUES.EruptionLink.cooldown } },
    ashRiftForger: { name: 'Rift Forger', power: 1, ability: { name: 'Unstable Ground', key: 'UnstableGround' }, veteranAbility: { key: 'VolatileForge', isPermanentUpgrade: true, isPassive: true } },
    ashRiftWarden: { name: 'Rift Warden', power: 3, ability: { name: 'Siphon', maxCharges: ABILITY_VALUES.Siphon.maxCharges, unleash: ['StokeTheFlames','RiftAssault','BurningGround'], key: 'Siphon' } },
    ashScorchPriest: { name: 'Scorch Priest', power: 2, ability: { name: 'Mark of Cinder', key: 'MarkOfCinder' }, veteranAbility: { key: 'SoulfireBurst', cooldown: ABILITY_VALUES.SoulfireBurst.cooldown } },
    snowArcticTrapper: { name: 'Arctic Trapper', power: 1, ability: { name: 'Set Snare', key: 'SetSnare' }, veteranAbility: { key: 'DistractingRoar', cooldown: ABILITY_VALUES.DistractingRoar.cooldown } },
    snowCryomancer: { name: 'Cryomancer', power: 3, ability: { name: 'Summon Ice Wisp', key: 'SummonIceWisp' }, veteranAbility: { key: 'WispEnhancement', isPermanentUpgrade: true, isPassive: true } },
    snowFrostbiteStalker: { name: 'Frostbite Stalker', power: 1, ability: { name: 'Hamstring', key: 'Hamstring' }, veteranAbility: { key: 'IcyShift', cooldown: ABILITY_VALUES.IcyShift.cooldown } },
    snowFrostLord: { name: 'Frost Lord', power: 4, ability: { name: "King's Edict", key: 'KingsEdict' } },
    snowGlacialBrute: { name: 'Glacial Brute', power: 2, ability: { name: 'Frost Armor', key: 'FrostArmor' }, veteranAbility: { key: 'FrostStomp', cooldown: ABILITY_VALUES.FrostStomp.cooldown } },
    snowHoarfrostMystic: { name: 'Hoarfrost Mystic', power: 1, ability: { name: 'Frigid Path', key: 'FrigidPath' }, veteranAbility: { key: 'GlacialBeacon', cooldown: ABILITY_VALUES.GlacialBeacon.cooldown } },
    snowIceWeaver: { name: 'Ice Weaver', power: 1, ability: { name: 'Glacial Wall', key: 'GlacialWall' }, veteranAbility: { key: 'GlacialFortress', isPermanentUpgrade: true, isPassive: true } },
    snowIceWisp: { name: 'Ice Wisp', power: 0 },
    snowRampagingYeti: { name: 'Rampaging Yeti', power: 2, ability: { name: 'Pummel', key: 'Pummel' }, veteranAbility: { key: 'HardenedIce', cooldown: ABILITY_VALUES.HardenedIce.cooldown } },
    snowSoulFreeze: { name: 'Soul Freeze', power: 2, ability: { name: 'Chilling Aura', key: 'ChillingAura' }, veteranAbility: { key: 'FrostbiteCurse', cooldown: ABILITY_VALUES.FrostbiteCurse.cooldown } },
    snowVoidChanter: { name: 'Void Chanter', power: 3, ability: { name: 'Siphon', maxCharges: ABILITY_VALUES.Siphon.maxCharges, unleash: ['FlashFreeze','GlacialStep','Whiteout'], key: 'Siphon' } },
};

export const PIECE_VALUES = {
    ashAshStrider: 150, ashAshTyrant: 1000, ashBlazeboundBeast: 300, ashCinderScout: 150,
    ashMagmaProwler: 300, ashMagmaSpitter: 500, ashObsidianShaper: 250, ashRiftForger: 250,
    ashRiftWarden: 700, ashScorchPriest: 450, snowArcticTrapper: 150, snowCryomancer: 500,
    snowFrostbiteStalker: 150, snowFrostLord: 1000, snowGlacialBrute: 300, snowHoarfrostMystic: 250,
    snowIceWeaver: 250, snowIceWisp: 50, snowRampagingYeti: 300, snowSoulFreeze: 450, snowVoidChanter: 700,
};

export const SHAPES = {
    bottomLayout: [
        [9, 0, 'Tyrant'], [9, 1, 'Siphoner'], [9, 2, 'Brawler'], [9, 3, 'Shaper'],
        [8, 0, 'Mage'], [8, 1, 'Priest'], [8, 2, 'Skirmisher'],
        [7, 0, 'Warrior'], [7, 1, 'Striker'], [6, 0, 'Mystic']
    ],
    riftAreas: [ generateRift(0, 0, 3), generateRift(ROWS - 3, COLS - 3, 3) ],
    shrineArea: [ [4, 4], [4, 5], [5, 4], [5, 5] ],
    topLayout: [
        [0, 9, 'Tyrant'], [0, 8, 'Siphoner'], [0, 7, 'Brawler'], [0, 6, 'Shaper'],
        [1, 9, 'Mage'], [1, 8, 'Priest'], [1, 7, 'Skirmisher'],
        [2, 9, 'Warrior'], [2, 8, 'Striker'], [3, 9, 'Mystic']
    ]
};

export const TEAM_PIECES = {
    ash: {
        Brawler: 'ashBlazeboundBeast', Mage: 'ashMagmaSpitter', Mystic: 'ashObsidianShaper', Priest: 'ashScorchPriest', Shaper: 'ashRiftForger', Siphoner: 'ashRiftWarden', Skirmisher: 'ashAshStrider', Striker: 'ashCinderScout', Tyrant: 'ashAshTyrant', Warrior: 'ashMagmaProwler'
    },
    snow: {
        Brawler: 'snowRampagingYeti', Mage: 'snowCryomancer', Mystic: 'snowHoarfrostMystic', Priest: 'snowSoulFreeze', Shaper: 'snowIceWeaver', Siphoner: 'snowVoidChanter', Skirmisher: 'snowArcticTrapper', Striker: 'snowFrostbiteStalker', Tyrant: 'snowFrostLord', Warrior: 'snowGlacialBrute'
    }
};

export const Teams = { ASH: 'ash', SNOW: 'snow' };

export const TERRITORY_UNLOCK_THRESHOLD = 30;
export const TERRITORY_PASSIVES = { ICY_HIGHWAYS: 'IcyHighways', VOLATILE_CLAIM: 'ScorchedEarth', DEBUFF_AMOUNT: 1 };

export const CONDUIT_OVERCHARGE_TIER1_TURNS = 4;
export const CONDUIT_OVERCHARGE_TIER2_TURNS = 7;
export const ANCHOR_AURA_POWER = 1;
export const CONDUIT_HIGHWAY_BUFF_DURATION = 2; // fixed duration to cover enemy turn

export const ULTIMATE_MIN_TURN = 5;

export const CONDUIT_VALUES = { VENTING_TEMP_DAMAGE: 1, OVERCHARGE_RADIUS: 2, SCAR_DURATION: 99, GRAVITY_WELL_RANGE: 1, STABILIZE_COST: 1, PHASE_SPARKING: 1, PHASE_CRITICAL: 2, PHASE_COLLAPSE: 3 };

export function getVoidScarCells(rift1, rift2) {
    const cells = new Set();
    const rifts = [rift1, rift2];

    rifts.forEach(rift => {
        rift.cells.forEach(([r, c]) => {
            cells.add(`${r},${c}`);
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    const nr = r + dr, nc = c + dc;
                    if (!inBounds(nr, nc)) continue;
                    cells.add(`${nr},${nc}`);
                    if (Math.abs(dr) === 1 && Math.abs(dc) === 1) {
                        const cr = nr + dr, cc = nc + dc;
                        if (inBounds(cr, cc)) cells.add(`${cr},${cc}`);
                    }
                }
            }
        });
    });

    return Array.from(cells).map(pos => pos.split(',').map(Number));
}

export const ASCENSION_CHOICES = {
    Shaper: {
        A: { name: 'Master of Creation', team: { snow: 'Leader gains Mini-Glacial Wall.', ash: 'Leader gains Mini-Unstable Ground.' }, key: 'MasterOfCreation' },
        B: { name: 'Territorial Claim', passive: 'Faction Passive: Capture +2 adjacent squares on kill.', key: 'TerritorialClaim' }
    },
    Brawler: {
        A: { name: 'Rampage', team: { snow: 'Glacial Brute: Frost Armor reflects 1 permanent damage.', ash: 'Magma Prowler: Frenzied Dash jumps over allies.' }, key: 'Rampage' },
        B: { name: 'Vengeance', passive: 'Faction Passive: Enemy is Marked for 2 turns on vanquish.', key: 'Vengeance' }
    },
    Skirmisher: {
        A: { name: 'Acrobatic Tactics', team: { snow: 'Frostbite Stalker is Acrobat (jumps over ally).', ash: 'Cinder Scout: Acrobat (jumps over ally).' }, key: 'AcrobaticTactics' },
        B: { name: 'Hit and Run', passive: 'Faction Passive: New capture grants Entrenched (wins combat tie).', key: 'HitAndRun' }
    },
    Mystic: {
        A: { name: 'Arcane Attunement', team: { snow: 'Siphoners use Siphon on friendly territory.', ash: 'Siphoners use Siphon on friendly territory.' }, key: 'ArcaneAttunement' },
        B: { name: 'Rift Reinforcement', passive: 'Faction Passive: Conduit Contested state always gives full +2 Power.', key: 'RiftReinforcement' }
    },
    Siphoner: {
        A: { name: 'Primal Power', team: { snow: 'Cryomancer: Summoned Wisp is Power 1.', ash: 'Magma Spitter: Lava Glob targets up to Power 3.' }, key: 'PrimalPower' },
        B: { name: 'Energy Siphon', passive: 'Faction Passive: New capture adjacent to enemy Dazes enemy for 1 turn.', key: 'EnergySiphon' }
    },
    Mage: {
        A: { name: 'Elemental Harmony', team: { snow: 'Soul Freeze: Chilling Aura also Hamstrings.', ash: 'Scorch Priest: MarkOfCinder deals 1 permanent damage on application.' }, key: 'ElementalHarmony' },
        B: { name: 'Magical Supremacy', passive: 'Faction Passive: Lose combat tie: Banished, -1 Power, Dazed.', key: 'MagicalSupremacy' }
    },
    Striker: {
        A: { name: 'Lethal Precision', team: { snow: 'Arctic Trapper Base Power becomes 2.', ash: 'Ash Strider Base Power becomes 2.' }, key: 'LethalPrecision' },
        B: { name: 'Targeted Weakness', passive: 'Faction Passive: Attack debuffed enemy gains +1 Power (Attacking only).', key: 'TargetedWeakness' }
    },
    Warrior: {
        A: { name: 'Unstoppable Force', team: { snow: 'Rampaging Yeti gains Steadfast (Immune to Daze, Stuck, Push/Pull).', ash: 'Blazebound Beast gains Steadfast (Immune to Daze, Stuck, Push/Pull).' }, key: 'UnstoppableForce' },
        B: { name: 'Home-Field Advantage', passive: 'Faction Passive: Units defending on starting squares gain +1 Power.', key: 'HomeFieldAdvantage' }
    },
    Priest: {
        A: { name: "Leader's Ward", team: { snow: "Frost Lord gains Priest's Ward (blocks first enemy ability).", ash: "Ash Tyrant gains Priest's Ward (blocks first enemy ability)." }, key: 'LeadersWard' },
        B: { name: 'Martyrdom', passive: 'Faction Passive: Vanquished unit Dazes the attacker for 2 turns.', key: 'Martyrdom' }
    }
};
