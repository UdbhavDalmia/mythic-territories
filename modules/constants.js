export function getPieceAt(r, c, boardMap) {
    return boardMap[r]?.[c] || null;
}

export const CANVAS_SIZE = 880;
export const ROWS = 10;
export const COLS = 10;
export const CELL_SIZE = CANVAS_SIZE / COLS;

export const Teams = {
    SNOW: 'snow',
    ASH: 'ash'
};

export const PIECE_VALUES = {
    snowFrostLord: 1000,
    ashAshTyrant: 1000,
    snowVoidChanter: 700,
    ashRiftWarden: 700,
    snowCryomancer: 500,
    ashMagmaSpitter: 500,
    snowSoulFreeze: 450,
    ashScorchPriest: 450,
    snowYeti: 300,
    ashHellHound: 300,
    snowIceWeaver: 250,
    ashRiftForger: 250,
    snowSnowWolf: 150,
    ashBlazeRunner: 150,
    snowIceWisp: 50
};

export const ABILITY_VALUES = {
    FlashFreeze: { cost: 1, range: 4, duration: 4 },
    GlacialStep: { cost: 2, range: 5 },
    Whiteout: { cost: 3, radius: 3, duration: 2, powerDebuff: 1 },
    StokeTheFlames: { cost: 1, range: 4, duration: 3, powerBoost: 2 },
    RiftAssault: { cost: 2, range: 3 },
    BurningGround: { cost: 3, duration: 2 },
    ChillingAura: { cooldown: 4, duration: 3, powerDebuff: 1 },
    MarkOfCinder: { cooldown: 4, range: 2, duration: 3, powerDebuff: 1 },
    GlacialWall: { cooldown: 6, duration: 3 },
    UnstableGround: { cooldown: 4, range: 4, duration: 3, damage: 1 },
    SummonIceWisp: { cooldown: 4, range: 4 },
    LavaGlob: { cooldown: 10, range: 4, damage: 1, maxTargetPower: 2 },
    Siphon: { maxCharges: 3 },
    Shrine: { powerBoost: 1, overloadCharges: 3 },
    PowerInfusion: { powerBoost: 4, duration: 5 },
    RiftAnchor: { powerBoost: 2 }
};

export const ABILITIES = {
    FlashFreeze: {
        name: "Flash Freeze",
        cost: ABILITY_VALUES.FlashFreeze.cost,
        range: ABILITY_VALUES.FlashFreeze.range,
        targetType: 'enemy',
        canBeBlocked: true,
        requiresTargeting: true,
        effect: (p, t, gs) => {
            const targetPiece = getPieceAt(t.r, t.c, gs.boardMap);
            if (targetPiece) targetPiece.stuck = ABILITY_VALUES.FlashFreeze.duration;
        }
    },

    GlacialStep: {
        name: "Glacial Step",
        cost: ABILITY_VALUES.GlacialStep.cost,
        range: ABILITY_VALUES.GlacialStep.range,
        targetType: 'special',
        requiresTargeting: true,
        specialTargeting: (p, t, gs) => {
            const distance = Math.max(Math.abs(p.row - t.r), Math.abs(p.col - t.c));
            return distance <= ABILITY_VALUES.GlacialStep.range &&
                !getPieceAt(t.r, t.c, gs.boardMap) &&
                gs.snowTerritory.has(`${t.r},${t.c}`);
        },
        effect: (p, t, gs) => {
            p.row = t.r;
            p.col = t.c;
        }
    },

    Whiteout: {
        name: "Whiteout",
        cost: ABILITY_VALUES.Whiteout.cost,
        requiresTargeting: false,
        effect: (p, t, gs) => {
            gs.pieces.forEach(op => {
                if (
                    op.team !== p.team &&
                    !op.hasDefensiveWard &&
                    Math.max(Math.abs(p.row - op.row), Math.abs(p.col - op.col)) <= ABILITY_VALUES.Whiteout.radius
                ) {
                    gs.debuffs.push({
                        piece: op,
                        amount: ABILITY_VALUES.Whiteout.powerDebuff,
                        duration: ABILITY_VALUES.Whiteout.duration,
                        name: "Whiteout"
                    });
                }
            });
        }
    },

    StokeTheFlames: {
        name: "Stoke the Flames",
        cost: ABILITY_VALUES.StokeTheFlames.cost,
        range: ABILITY_VALUES.StokeTheFlames.range,
        targetType: 'friendly',
        canBeBlocked: false,
        requiresTargeting: true,
        effect: (p, t, gs) => {
            const targetPiece = getPieceAt(t.r, t.c, gs.boardMap);
            if (targetPiece) {
                gs.temporaryBoosts.push({
                    piece: targetPiece,
                    amount: ABILITY_VALUES.StokeTheFlames.powerBoost,
                    duration: ABILITY_VALUES.StokeTheFlames.duration
                });
            }
        }
    },

    RiftAssault: {
        name: "Rift Assault",
        cost: ABILITY_VALUES.RiftAssault.cost,
        range: ABILITY_VALUES.RiftAssault.range,
        targetType: 'special',
        requiresTargeting: true,
        specialTargeting: (p, t, gs) => {
            if (getPieceAt(t.r, t.c, gs.boardMap)) return false;
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    if (dr === 0 && dc === 0) continue;
                    const adjPiece = getPieceAt(t.r + dr, t.c + dc, gs.boardMap);
                    if (adjPiece && adjPiece.team !== p.team) return true;
                }
            }
            return false;
        },
        effect: (p, t, gs) => {
            p.row = t.r;
            p.col = t.c;
            p.isDazed = true;
        }
    },

    BurningGround: {
        name: "Burning Ground",
        cost: ABILITY_VALUES.BurningGround.cost,
        requiresTargeting: false,
        effect: (p, t, gs) => {
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    const r = p.row + dr;
                    const c = p.col + dc;
                    if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
                        gs.unstableGrounds.push({
                            row: r,
                            col: c,
                            duration: ABILITY_VALUES.BurningGround.duration,
                            creator: p,
                            isBurningGround: true
                        });
                    }
                }
            }
        }
    },

    ChillingAura: {
        name: "Chilling Aura",
        cooldown: ABILITY_VALUES.ChillingAura.cooldown,
        requiresTargeting: false,
        effect: (p, t, gs) => {
            p.ability.active = true;
            p.ability.duration = ABILITY_VALUES.ChillingAura.duration;
        }
    },

    MarkOfCinder: {
        name: "Mark of Cinder",
        cooldown: ABILITY_VALUES.MarkOfCinder.cooldown,
        range: ABILITY_VALUES.MarkOfCinder.range,
        targetType: 'enemy',
        canBeBlocked: true,
        requiresTargeting: true,
        effect: (p, t, gs) => {
            const targetPiece = getPieceAt(t.r, t.c, gs.boardMap);
            if (targetPiece) {
                gs.markedPieces.push({
                    target: targetPiece,
                    duration: ABILITY_VALUES.MarkOfCinder.duration
                });
            }
        }
    },

    GlacialWall: {
        name: "Glacial Wall",
        cooldown: ABILITY_VALUES.GlacialWall.cooldown,
        requiresTargeting: true,
        range: 1,
        targetType: 'special',
        specialTargeting: (p, t, gs) => {
            const distance = Math.max(Math.abs(p.row - t.r), Math.abs(p.col - t.c));
            const targetPiece = getPieceAt(t.r, t.c, gs.boardMap);
            return distance === 1 && !targetPiece;
        }
    },

    UnstableGround: {
        name: "Unstable Ground",
        cooldown: ABILITY_VALUES.UnstableGround.cooldown,
        range: ABILITY_VALUES.UnstableGround.range,
        targetType: 'empty',
        canBeBlocked: false,
        requiresTargeting: true,
        effect: (p, t, gs) => {
            gs.unstableGrounds.push({
                row: t.r,
                col: t.c,
                duration: ABILITY_VALUES.UnstableGround.duration,
                creator: p
            });
        }
    },

    SummonIceWisp: {
        name: "Summon Ice Wisp",
        cooldown: ABILITY_VALUES.SummonIceWisp.cooldown,
        range: ABILITY_VALUES.SummonIceWisp.range,
        targetType: 'empty',
        canBeBlocked: false,
        requiresTargeting: true,
        effect: (p, t, gs, createPiece) => {
            gs.pieces.push(createPiece(t.r, t.c, "snowIceWisp", "snow"));
            gs.snowTerritory.add(`${t.r},${t.c}`);
        }
    },

    LavaGlob: {
        name: "Lava Glob",
        cooldown: ABILITY_VALUES.LavaGlob.cooldown,
        range: ABILITY_VALUES.LavaGlob.range,
        targetType: 'special',
        canBeBlocked: true,
        requiresTargeting: true,
        specialTargeting: (p, t, gs) => {
            const targetPiece = getPieceAt(t.r, t.c, gs.boardMap);
            if (!targetPiece || targetPiece.team === p.team) return false;
            const baseStats = PIECE_TYPES[targetPiece.key];
            return baseStats && typeof baseStats.power === 'number' && baseStats.power <= ABILITY_VALUES.LavaGlob.maxTargetPower;
        },
        effect: (p, t, gs) => {
            const targetPiece = getPieceAt(t.r, t.c, gs.boardMap);
            if (targetPiece) {
                targetPiece.power = Math.max(0, targetPiece.power - ABILITY_VALUES.LavaGlob.damage);
            }
        }
    }
};

export const PIECE_TYPES = {
    snowFrostLord: { name: "Frost Lord", power: 4 },
    snowVoidChanter: {
        name: "Void Chanter",
        power: 3,
        ability: { name: "Siphon", maxCharges: ABILITY_VALUES.Siphon.maxCharges, unleash: ["FlashFreeze", "GlacialStep", "Whiteout"] }
    },
    snowYeti: { name: "Yeti", power: 2, boosts: { territorySurge: true } },
    snowSnowWolf: { name: "Snow Wolf", power: 1, boosts: { territorySurge: true } },
    snowCryomancer: { name: "Cryomancer", power: 3, ability: { name: "SummonIceWisp" } },
    snowSoulFreeze: { name: "Soul Freeze", power: 2, ability: { name: "ChillingAura" } },
    snowIceWeaver: { name: "Ice Weaver", power: 1, ability: { name: "GlacialWall" } },
    snowIceWisp: { name: "Ice Wisp", power: 0 },
    ashAshTyrant: { name: "Ash Tyrant", power: 4 },
    ashRiftWarden: {
        name: "Rift Warden",
        power: 3,
        ability: { name: "Siphon", maxCharges: ABILITY_VALUES.Siphon.maxCharges, unleash: ["StokeTheFlames", "RiftAssault", "BurningGround"] }
    },
    ashHellHound: { name: "Hell Hound", power: 2, boosts: { territorySurge: true } },
    ashBlazeRunner: { name: "Blaze Runner", power: 1, boosts: { territorySurge: true } },
    ashMagmaSpitter: { name: "Magma Spitter", power: 3, ability: { name: "LavaGlob" } },
    ashScorchPriest: { name: "Scorch Priest", power: 2, ability: { name: "MarkOfCinder" } },
    ashRiftForger: { name: "Rift Forger", power: 1, ability: { name: "UnstableGround" } }
};

export const BOOST_NAMES = {
    territorySurge: "Territory Surge"
};

function generateRift(startRow, startCol, size) {
    const cells = [];
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            cells.push([startRow + r, startCol + c]);
        }
    }
    const id = startRow === 0 ? 'topLeft' : 'bottomRight';
    return { id, cells, name: "Power Rift", pulsePhase: 0, particles: [] };
}

export const SHAPES = {
    bottomLayout: [
        [9, 0, "Tyrant"], [9, 1, "Demon"], [9, 2, "Devil"], [9, 3, "Special"],
        [8, 0, "Mage"], [8, 1, "Priest"], [8, 2, "Beast"],
        [7, 0, "Devil"], [7, 1, "Beast"], [6, 0, "Special"]
    ],
    topLayout: [
        [0, 9, "Tyrant"], [0, 8, "Demon"], [0, 7, "Devil"], [0, 6, "Special"],
        [1, 9, "Mage"], [1, 8, "Priest"], [1, 7, "Beast"],
        [2, 9, "Devil"], [2, 8, "Beast"], [3, 9, "Special"]
    ],
    shrineArea: [[4, 4], [4, 5], [5, 4], [5, 5]],
    riftAreas: [generateRift(0, 0, 3), generateRift(ROWS - 3, COLS - 3, 3)]
};

export const TEAM_PIECES = {
    snow: {
        Tyrant: "snowFrostLord",
        Demon: "snowVoidChanter",
        Devil: "snowYeti",
        Beast: "snowSnowWolf",
        Mage: "snowCryomancer",
        Priest: "snowSoulFreeze",
        Special: "snowIceWeaver"
    },
    ash: {
        Tyrant: "ashAshTyrant",
        Demon: "ashRiftWarden",
        Devil: "ashHellHound",
        Beast: "ashBlazeRunner",
        Mage: "ashMagmaSpitter",
        Priest: "ashScorchPriest",
        Special: "ashRiftForger"
    }
};

export const IMAGES = {
    snowFrostLord: "images/frost-lord.png",
    snowVoidChanter: "images/void-chanter.png",
    snowYeti: "images/yeti.png",
    snowSnowWolf: "images/snow-wolf.png",
    snowSoulFreeze: "images/soul-freeze.png",
    snowIceWeaver: "images/ice-weaver.png",
    snowCryomancer: "images/cryomancer.png",
    ashAshTyrant: "images/ash-tyrant.png",
    ashRiftWarden: "images/rift-warden.png",
    ashHellHound: "images/hell-hound.png",
    ashBlazeRunner: "images/blaze-runner.png",
    ashScorchPriest: "images/scorch-priest.png",
    ashRiftForger: "images/rift-forger.png",
    ashMagmaSpitter: "images/magma-spitter.png",
    snowIceWisp: "images/wisp.png",
    gameBackgroundSnow: "images/bg-game.png",
    gameBackgroundAsh: "images/bg-game2.png"
};

export const BOARD_IMAGE_KEYS = ['gameBackgroundSnow', 'gameBackgroundAsh'];

export const ABILITY_DESCRIPTIONS = {
    Siphon: "On a Rift or Shrine, use a turn to gain 1 Charge (Max 3). Spend Charges to unleash powerful abilities.",
    "Rift Pulse": "Unleash a pulse of energy, pushing all adjacent pieces one square away.",
    ChillingAura: "Activates an aura that reduces the power of adjacent enemies by 1.",
    MarkOfCinder: "Marks an enemy within 2 squares, reducing its power by 1.",
    GlacialWall: "Creates two impassable walls on adjacent empty squares.",
    UnstableGround: "Makes an empty square within 4 squares hazardous.",
    SummonIceWisp: "Summons a Power 0 wisp to an empty square.",
    LavaGlob: "Deals 1 permanent damage to a weak enemy within 4 squares."
};