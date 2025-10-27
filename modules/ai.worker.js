/*
 * =========================================
 * AI WORKER (Module)
 * Runs all AI calculations on a separate thread.
 * Includes Alpha-Beta Pruning, Move Ordering, and Iterative Deepening.
 * =========================================
 */

// --- STEP 1: IMPORTS ---
import * as C from './constants.js';
import { getValidMoves, getEffectivePower, isCaptureSuccessful } from './utils.js';
import { createPiece } from './game.js';

// --- STEP 2: EVALUATION FUNCTIONS ---

/**
 * NEW: evaluateBoardHazards
 * Adds value for strategically placed walls and ground effects.
 */
function evaluateBoardHazards(gameState, aiTeam, opponentTeam) {
    let hazardScore = 0;
    const opponentLeader = gameState.pieces.find(p => p.team === opponentTeam && (p.key.includes('Lord') || p.key.includes('Tyrant')));
    const aiLeader = gameState.pieces.find(p => p.team === aiTeam && (p.key.includes('Lord') || p.key.includes('Tyrant')));

    for (const wall of gameState.glacialWalls) {
        // Simple bonus: Is the wall near the opponent's leader?
        if (opponentLeader && Math.max(Math.abs(wall.row - opponentLeader.row), Math.abs(wall.col - opponentLeader.col)) <= 2) {
            hazardScore += 150; // Good, it's blocking/trapping the leader
        }

        // Is it protecting *my* leader?
         if (aiLeader && Math.max(Math.abs(wall.row - aiLeader.row), Math.abs(wall.col - aiLeader.col)) <= 1) {
            hazardScore += 100; // Good, it's protecting
        }
    }

    for (const ground of gameState.unstableGrounds) {
        let nearbyEnemies = 0;
        for (const piece of gameState.pieces) {
            if (piece.team === opponentTeam && Math.max(Math.abs(ground.row - piece.row), Math.abs(ground.col - piece.col)) <= 1) {
                nearbyEnemies++;
            }
        }
        // Bonus for each enemy this hazard is threatening
        hazardScore += nearbyEnemies * 75;

        // Extra bonus if it's on the shrine
        if (C.SHAPES.shrineArea.some(([r,c]) => r === ground.row && c === ground.col)) {
            hazardScore += 100;
        }
    }

    // This evaluation is simple and assumes the AI created the hazards.
    // A more advanced simulation would track `creator` team.
    return hazardScore;
}


function evaluateBoardState(gameState, aiTeam) {
    let score = 0;
    const opponentTeam = aiTeam === 'snow' ? 'ash' : 'snow';

    const aiLeader = gameState.pieces.find(p => p.team === aiTeam && (p.key.includes('Lord') || p.key.includes('Tyrant')));
    const opponentLeader = gameState.pieces.find(p => p.team === opponentTeam && (p.key.includes('Lord') || p.key.includes('Tyrant')));
    if (!opponentLeader) return 1000000;
    if (!aiLeader) return -1000000; // Losing the leader is catastrophic

    // --- Weights for different evaluation components ---
    const W_LEADER_SAFETY = 5.0;
    const W_PIECE_SAFETY = 1.5;
    const W_LEADER_THREAT = 1.0;
    const W_NET_VALUE = 2.0;
    const W_NET_POWER = 150; // Power differences matter
    const W_SIPHON = 200;
    const W_CONDUIT = 1.0;
    const W_SHRINE = 1.0;
    const W_ABILITY = 1.0;
    const W_TERR_MOB = 1.0;
    const W_POSITIONAL = 1.0; // New weight for positional value
    const W_HAZARDS = 1.0; // --- ADDED THIS ---

    score += evaluateLeaderSafety(aiLeader, opponentTeam, gameState) * W_LEADER_SAFETY;
    score += evaluatePieceSafety(gameState, aiTeam, opponentTeam) * W_PIECE_SAFETY;
    score += evaluateOpponentLeaderThreat(opponentLeader, aiTeam, gameState) * W_LEADER_THREAT;
    score += evaluateNetPieceValue(gameState, aiTeam, opponentTeam) * W_NET_VALUE;
    score += evaluateNetEffectivePower(gameState, aiTeam, opponentTeam) * W_NET_POWER;
    score += evaluateSiphonCharges(gameState, aiTeam, opponentTeam) * W_SIPHON;
    score += evaluateConduitLink(gameState, aiTeam, opponentTeam) * W_CONDUIT;
    score += evaluateShrine(gameState, aiTeam, opponentTeam) * W_SHRINE;
    score += evaluateAbilityStatus(gameState, aiTeam, opponentTeam) * W_ABILITY;
    score += evaluateTerritoryAndMobility(gameState, aiTeam, opponentTeam) * W_TERR_MOB;
    score += evaluatePositionalValue(gameState, aiTeam, opponentTeam) * W_POSITIONAL; // Added positional evaluation
    score += evaluateBoardHazards(gameState, aiTeam, opponentTeam) * W_HAZARDS; // --- ADDED THIS ---

    return score;
}

/**
 * REVISED: evaluatePieceSafety
 * Increased penalty for threatened pieces.
 */
function evaluatePieceSafety(gameState, aiTeam, opponentTeam) {
    let safetyScore = 0;
    const aiPieces = gameState.pieces.filter(p => p.team === aiTeam);
    const opponentPieces = gameState.pieces.filter(p => p.team === opponentTeam);

    for (const myPiece of aiPieces) {
        // Skip leader here, handled separately
        if (myPiece.key.includes('Lord') || myPiece.key.includes('Tyrant')) continue;

        let isThreatened = false;
        for (const enemyPiece of opponentPieces) {
            // Check if any enemy move can capture this piece
            if (getValidMoves(enemyPiece, gameState).some(move => move.row === myPiece.row && move.col === myPiece.col)) {
                // PENALTY INCREASED: Use piece value * 1.5 instead of 0.75
                safetyScore -= (C.PIECE_VALUES[myPiece.key] || 50) * 1.5;
                isThreatened = true;
                break; // One threat is enough to penalize
            }
        }
        // Small bonus for pieces that are NOT threatened
        if (!isThreatened) {
             safetyScore += (C.PIECE_VALUES[myPiece.key] || 50) * 0.1;
        }
    }
    return safetyScore;
}


/**
 * REVISED: evaluateLeaderSafety
 * Significantly harsher penalties and considers potential moves (1 step ahead).
 */
function evaluateLeaderSafety(leader, opponentTeam, gameState) {
    if (!leader) return -1000000; // Leader already lost

    let safetyScore = 0;
    const dangerZone = new Set();
    const immediateThreats = [];

    // Define a 2-square radius around the leader as the danger zone
    for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
            if (dr === 0 && dc === 0) continue;
            dangerZone.add(`${leader.row + dr},${leader.col + dc}`);
        }
    }

    const opponentPieces = gameState.pieces.filter(p => p.team === opponentTeam);

    for (const enemy of opponentPieces) {
        const enemyMoves = getValidMoves(enemy, gameState);

        // Check 1: Is enemy directly adjacent? (Highest threat)
        if (Math.max(Math.abs(leader.row - enemy.row), Math.abs(leader.col - enemy.col)) <= 1) {
             safetyScore -= 10000 + getEffectivePower(enemy, gameState) * 100; // MASSIVE penalty
             immediateThreats.push(enemy);
        }
        // Check 2: Can the enemy move to capture the leader NEXT turn?
        else if (enemyMoves.some(move => move.row === leader.row && move.col === leader.col)) {
             safetyScore -= 5000 + getEffectivePower(enemy, gameState) * 50; // Very large penalty
             immediateThreats.push(enemy);
        }
        // Check 3: Can the enemy move into the danger zone?
        else if (enemyMoves.some(move => dangerZone.has(`${move.row},${move.col}`))) {
             safetyScore -= 500 + getEffectivePower(enemy, gameState) * 10; // Medium penalty
        }
        // Check 4: Ranged ability threat (simple check for now)
        // Add checks here later if specific ranged abilities become a problem
        // e.g., if (enemy.key === 'ashMagmaSpitter' && distance <= C.ABILITIES.LavaGlob.range) safetyScore -= 200;
    }

    // Bonus if leader is safe (no immediate threats nearby)
    if (immediateThreats.length === 0) {
        safetyScore += 1000;
    }
    // Penalty scales with number of immediate threats
    if (immediateThreats.length > 1) {
        safetyScore -= immediateThreats.length * 2000;
    }


    return safetyScore;
}


/**
 * REVISED: evaluateLeaderThreat (Minor adjustment for clarity)
 * Renamed from evaluateLeaderThreat for consistency. Focuses on AI threatening the *opponent* leader.
 */
function evaluateOpponentLeaderThreat(opponentLeader, aiTeam, gameState) {
    let threatScore = 0;
    if (!opponentLeader) return 1000000; // Opponent leader already gone!

    const aiPieces = gameState.pieces.filter(p => p.team === aiTeam);

    for (const piece of aiPieces) {
        const moves = getValidMoves(piece, gameState);
        // Can AI capture leader next turn? HIGH bonus
        if (moves.some(move => move.row === opponentLeader.row && move.col === opponentLeader.col)) {
             threatScore += 20000 + (C.PIECE_VALUES[piece.key] || 0) * 5;
        }
        // Can AI move adjacent to leader next turn? Good bonus
        else if (moves.some(move => Math.max(Math.abs(move.row - opponentLeader.row), Math.abs(move.col - opponentLeader.col)) <= 1)) {
             threatScore += 500 + (C.PIECE_VALUES[piece.key] || 0);
        }
    }
    return threatScore;
}

// (evaluateNetPieceValue remains the same)
function evaluateNetPieceValue(gameState, aiTeam, opponentTeam) {
    let aiValue = 0, opponentValue = 0;
    gameState.pieces.forEach(p => {
        const value = C.PIECE_VALUES[p.key] || 0;
        if (p.team === aiTeam) aiValue += value;
        else if (p.team === opponentTeam) opponentValue += value;
    });
    // Multiplier remains 2.0 - relative value is important
    return (aiValue - opponentValue) * 2.0;
}

// (evaluateNetEffectivePower remains the same)
function evaluateNetEffectivePower(gameState, aiTeam, opponentTeam) {
    let aiPower = 0, opponentPower = 0;
    gameState.pieces.forEach(p => {
        const power = getEffectivePower(p, gameState);
        if (p.team === aiTeam) aiPower += power;
        else if (p.team === opponentTeam) opponentPower += power;
    });
    // Keep this high - winning fights is key
    return (aiPower - opponentPower) * 150;
}

// (evaluateSiphonCharges remains the same)
function evaluateSiphonCharges(gameState, aiTeam, opponentTeam) {
    let aiCharges = 0, opponentCharges = 0;
    gameState.pieces.forEach(p => {
        if (p.charges) {
            if (p.team === aiTeam) aiCharges += p.charges;
            else if (p.team === opponentTeam) opponentCharges += p.charges;
        }
    });
    // Increased weight slightly
    return (aiCharges - opponentCharges) * 250;
}


/**
 * REVISED: evaluateConduitLink
 * Increased value slightly.
 */
function evaluateConduitLink(gameState, aiTeam, opponentTeam) {
    if (gameState.conduitLinkActive) {
        // Increased reward/penalty for active link
        return gameState.conduitTeam === aiTeam ? 3500 : -3500;
    }
    // Bonus for having pieces *on* rifts (potential to form link)
    const aiPiecesOnRifts = C.SHAPES.riftAreas.filter(rift =>
        rift.cells.some(([r, c]) => C.getPieceAt(r, c, gameState.boardMap)?.team === aiTeam)
    ).length;
     // Increased bonus per piece on rift
    return aiPiecesOnRifts * 1000;
}

// (evaluateShrine remains the same for now)
function evaluateShrine(gameState, aiTeam, opponentTeam) {
    let score = gameState.shrineChargeLevel * 300;
    if (gameState.shrineIsOverloaded) {
        const blastZone = new Set(C.SHAPES.shrineArea.flatMap(([sr, sc]) =>
            Array.from({length: 9}, (_, i) => `${sr - 1 + Math.floor(i/3)},${sc - 1 + i%3}`)
        ));
        let aiValueInBlast = 0, opponentValueInBlast = 0;
        gameState.pieces.forEach(p => {
            if (blastZone.has(`${p.row},${p.col}`)) {
                const value = C.PIECE_VALUES[p.key] || 0;
                if (p.team === aiTeam) aiValueInBlast += value;
                else opponentValueInBlast += value;
            }
        });
        // Encourage having fewer valuable pieces in blast zone when overloaded
        score += ((opponentValueInBlast - aiValueInBlast) * 1.5 + 800) / 2;
    }
     // Add bonus for controlling shrine squares
    const aiControl = C.SHAPES.shrineArea.filter(([r,c]) => C.getPieceAt(r,c,gameState.boardMap)?.team === aiTeam).length;
    const oppControl = C.SHAPES.shrineArea.filter(([r,c]) => C.getPieceAt(r,c,gameState.boardMap)?.team === opponentTeam).length;
    score += (aiControl - oppControl) * 200;

    return score;
}

// (evaluateAbilityStatus remains largely the same, minor tweak)
function evaluateAbilityStatus(gameState, aiTeam, opponentTeam) {
    let score = 0;
    gameState.pieces.forEach(p => {
        const valueModifier = (C.PIECE_VALUES[p.key] || 200) / 1000; // Base value influences ability importance
        if (p.team === aiTeam) {
            // Penalty for cooldowns
            if (p.ability?.cooldown > 0) score -= p.ability.cooldown * 50 * valueModifier;
            // Bonus for active buffs
            if (gameState.temporaryBoosts.some(b => b.piece === p)) score += 300 * valueModifier;
            // Penalty for debuffs/marks
            if (gameState.debuffs.some(d => d.piece === p) || gameState.markedPieces.some(m => m.target === p)) score -= 400 * valueModifier;
            // Small bonus if an ability is READY
            if (p.ability && !p.ability.cooldown) score += 50 * valueModifier;

        } else { // Opponent's pieces
            if (p.ability?.cooldown > 0) score += p.ability.cooldown * 30 * valueModifier; // Smaller bonus for opponent cooldown
            if (gameState.temporaryBoosts.some(b => b.piece === p)) score -= 300 * valueModifier;
            if (gameState.debuffs.some(d => d.piece === p) || gameState.markedPieces.some(m => m.target === p)) score += 400 * valueModifier;
             if (p.ability && !p.ability.cooldown) score -= 50 * valueModifier;
        }
    });
    return score;
}

/**
 * REVISED: evaluateTerritoryAndMobility
 * Increased weights significantly.
 */
function evaluateTerritoryAndMobility(gameState, aiTeam, opponentTeam) {
    // WEIGHT INCREASED for territory difference
    const territoryScore = (gameState.snowTerritory.size - gameState.ashTerritory.size) * 50 * (aiTeam === 'snow' ? 1 : -1);

    let aiMoves = 0, opponentMoves = 0;
    gameState.pieces.forEach(p => {
         // Only count moves for non-leader pieces for mobility score, leader handled separately
        if (!(p.key.includes('Lord') || p.key.includes('Tyrant'))) {
             if (p.team === aiTeam) aiMoves += getValidMoves(p, gameState).length;
             else if (p.team === opponentTeam) opponentMoves += getValidMoves(p, gameState).length;
        }
    });
    // WEIGHT INCREASED for mobility difference
    const mobilityScore = (aiMoves - opponentMoves) * 25;

    return territoryScore + mobilityScore;
}


/**
 * NEW: evaluatePositionalValue
 * Adds value for controlling key areas of the board.
 */
function evaluatePositionalValue(gameState, aiTeam, opponentTeam) {
    let score = 0;
    const centerSquares = [ [4,4],[4,5],[5,4],[5,5], [3,4],[3,5],[6,4],[6,5], [4,3],[5,3],[4,6],[5,6] ]; // Shrine + adjacent
    const riftCells = C.SHAPES.riftAreas.flatMap(r => r.cells);

    gameState.pieces.forEach(p => {
        const valueModifier = (C.PIECE_VALUES[p.key] || 100) / 500; // More valuable pieces contribute more
        let positionBonus = 0;

        // Bonus for being near the center/shrine
        if (centerSquares.some(([r,c]) => r === p.row && c === p.col)) {
            positionBonus += 150;
        } else if (centerSquares.some(([r,c]) => Math.max(Math.abs(r-p.row), Math.abs(c-p.col)) <= 1)) {
            positionBonus += 50; // Adjacent bonus
        }

        // Bonus for being on a rift
        if (riftCells.some(([r,c]) => r === p.row && c === p.col)) {
            positionBonus += 100;
        }

        // Adjust score based on team
        if (p.team === aiTeam) {
            score += positionBonus * valueModifier;
        } else {
            score -= positionBonus * valueModifier;
        }

         // Penalty for being stuck on back rows (simple version)
         if ((p.team === 'snow' && p.row >= 8) || (p.team === 'ash' && p.row <= 1)) {
             if (!(p.key.includes('Lord') || p.key.includes('Tyrant'))) { // Don't penalize leader too much early on
                 if (p.team === aiTeam) score -= 30 * valueModifier;
                 else score += 30 * valueModifier;
             }
         }
    });

    return score;
}

// --- STEP 3: SIMULATION LOGIC ---
// (No changes here)
function deepClone(obj) {
    const replacer = (key, value) => (value instanceof Set) ? Array.from(value) : value;
    const reviver = (key, value) => (key === 'snowTerritory' || key === 'ashTerritory') ? new Set(value) : value;
    return JSON.parse(JSON.stringify(obj, replacer), reviver);
}
function findPieceInState(state, originalPiece) {
    return originalPiece ? state.pieces.find(p => p.row === originalPiece.row && p.col === originalPiece.col && p.key === originalPiece.key) : null;
}
function simulateMove(gameState, piece, target) {
    const tempState = deepClone(gameState);
    const simPiece = findPieceInState(tempState, piece);
    if (!simPiece) return tempState;

    const defender = C.getPieceAt(target.row, target.col, tempState.boardMap);
    if (defender) tempState.pieces = tempState.pieces.filter(p => p !== defender);

    simPiece.row = target.row;
    simPiece.col = target.col;

    tempState.boardMap = Array.from({ length: C.ROWS }, () => Array(C.COLS).fill(null));
    tempState.pieces.forEach(p => { tempState.boardMap[p.row][p.col] = p; });
    return tempState;
}

/**
 * MODIFIED: simulateAbility
 * Now checks for 'Siphon' and 'canBeBlocked' to properly simulate.
 */
function simulateAbility(gameState, piece, abilityKey, target = null) {
    const tempState = deepClone(gameState);
    const simPiece = findPieceInState(tempState, piece);
    if (!simPiece) return tempState;

    // --- ADDED SIPHON SIMULATION ---
    if (abilityKey === 'Siphon') {
        if (simPiece.charges < simPiece.ability.maxCharges) {
            simPiece.charges = (simPiece.charges || 0) + 1;
        }
        return tempState;
    }
    // --- END ADDITION ---

    const ability = C.ABILITIES[abilityKey];
    if (ability?.effect) {
        
        // --- ADDED THIS CHECK ---
        let canApplyEffect = true;
        if (target && ability.canBeBlocked) {
            const targetPiece = C.getPieceAt(target.r, target.c, tempState.boardMap);
            if (targetPiece && targetPiece.hasDefensiveWard) {
                canApplyEffect = false; // Simulation matches reality: effect is blocked
            }
        }
        
        if (canApplyEffect) {
            ability.effect(simPiece, target, tempState, createPiece);
        }
        // --- END ADDITION ---

        // --- ADDED ABILITY COST SIMULATION ---
        if (typeof ability.cost === 'number') {
            simPiece.charges = Math.max(0, (simPiece.charges || 0) - ability.cost);
        }
        // --- END ADDITION ---

        tempState.boardMap = Array.from({ length: C.ROWS }, () => Array(C.COLS).fill(null));
        tempState.pieces.forEach(p => { tempState.boardMap[p.row][p.col] = p; });
    }
    return tempState;
}

function simulateAction(gameState, action) {
    if (action.type === 'move') {
        return simulateMove(gameState, action.piece, action.target);
    } else if (action.type === 'ability') {
        return simulateAbility(gameState, action.piece, action.abilityKey, action.target);
    }
    return gameState;
}

// --- STEP 4: ACTION GENERATION & ORDERING ---

/**
 * REPLACED: scoreActionHeuristically
 * This new version is much more detailed and scores abilities individually.
 */
function scoreActionHeuristically(action, gameState, aiTeam) {
    let score = 0;
    const opponentTeam = aiTeam === 'snow' ? 'ash' : 'snow';
    const piece = action.piece;
    const target = action.target;

    if (action.type === 'move') {
        const defender = target ? C.getPieceAt(target.row, target.col, gameState.boardMap) : null;
        if (defender) {
            // Prioritize capturing valuable pieces
            score += 1000 + (C.PIECE_VALUES[defender.key] || 0) * 10;
            // Slightly de-prioritize capturing with a less valuable piece if powers are close
            if ((C.PIECE_VALUES[piece.key] || 0) < (C.PIECE_VALUES[defender.key] || 0)) {
                score -= 50;
            }
        }
        // Prioritize moving towards the center/shrine
        const centerDist = Math.max(Math.abs(target.row - 4.5), Math.abs(target.col - 4.5));
        score += (5 - centerDist) * 5;

        // Prioritize moving towards the enemy leader if close
        const opponentLeader = gameState.pieces.find(p => p.team === opponentTeam && (p.key.includes('Lord') || p.key.includes('Tyrant')));
        if (opponentLeader) {
            const distToLeader = Math.max(Math.abs(target.row - opponentLeader.row), Math.abs(target.col - opponentLeader.col));
            if (distToLeader <= 3) {
                score += (4 - distToLeader) * 20;
            }
        }
    } else if (action.type === 'ability') {
        const abilityKey = action.abilityKey;
        
        if (abilityKey === 'Siphon') {
            score += 700; // Prioritize gaining charges
            // Bonus if siphoner is "safe" while siphoning
            const isThreatened = gameState.pieces.some(p => 
                p.team === opponentTeam && 
                getValidMoves(p, gameState).some(m => m.row === piece.row && m.col === piece.col)
            );
            if (!isThreatened) {
                score += 300;
            }
        }
        
        // --- Handle targeting abilities ---
        else if (action.target) {
            const targetPiece = C.getPieceAt(action.target.r, action.target.c, gameState.boardMap);
            
            switch (abilityKey) {
                // Debuffs / Direct Attacks
                case 'FlashFreeze':
                case 'MarkOfCinder':
                case 'LavaGlob':
                    if (targetPiece) {
                        score += 800 + (C.PIECE_VALUES[targetPiece.key] || 0) * 2; // Prioritize high-value targets
                        if (targetPiece.key.includes('Lord') || targetPiece.key.includes('Tyrant')) {
                            score += 5000; // Highly prioritize targeting the leader
                        }
                    }
                    break;
                
                // Buffs
                case 'StokeTheFlames':
                    if (targetPiece) {
                        score += 400 + (C.PIECE_VALUES[targetPiece.key] || 0); // Prioritize high-value friendlies
                    }
                    break;
                
                // Teleports
                case 'RiftAssault':
                case 'GlacialStep':
                    score += 600; // Teleporting is generally a good strategic move
                    break;

                // Summons / Placement
                case 'SummonIceWisp':
                    score += 300;
                    break;
                case 'UnstableGround':
                case 'GlacialWall':
                    score += 450; // Good strategic placement
                    break;
            }
        }
        
        // --- Handle non-targeting abilities ---
        else {
            switch (abilityKey) {
                case 'Whiteout':
                case 'BurningGround':
                    // Score based on nearby enemies
                    let enemiesHit = 0;
                    const radius = (abilityKey === 'Whiteout') ? C.ABILITY_VALUES.Whiteout.radius : 1;
                    gameState.pieces.forEach(p => {
                        if (p.team === opponentTeam && Math.max(Math.abs(p.row - piece.row), Math.abs(p.col - piece.col)) <= radius) {
                            enemiesHit++;
                        }
                    });
                    score += 500 + (enemiesHit * 300); // Highly value hitting multiple targets
                    break;
                
                case 'ChillingAura':
                    score += 350;
                    break;
            }
        }
    }
    return score;
}


/**
 * MODIFIED: Generates and sorts actions, now checks for Siphon
 * and for Defensive Wards on targets.
 */
function getOrderedActions(gameState, team) {
    const possibleActions = [];
    const opponentTeam = team === 'snow' ? 'ash' : 'snow';

    gameState.pieces.filter(p => p.team === team && !p.isDazed && (p.stuck || 0) <= 0).forEach(p => {
        // 1. Get all valid moves
        getValidMoves(p, gameState).forEach(move => {
            possibleActions.push({ type: 'move', piece: p, target: move });
        });

        // 2. Get all valid abilities
        const checkAndAddAbility = (abilityKey) => {
            const ability = C.ABILITIES[abilityKey];
            if (!ability) return;

            if (!ability.requiresTargeting) {
                 possibleActions.push({ type: 'ability', piece: p, abilityKey: abilityKey, target: null });
                 return;
            }

            for (let r = 0; r < C.ROWS; r++) {
                for (let c = 0; c < C.COLS; c++) {
                    const distance = Math.max(Math.abs(p.row - r), Math.abs(p.col - c));

                    if (ability.range >= 0 && distance <= ability.range) {
                        const targetPiece = C.getPieceAt(r, c, gameState.boardMap);
                        let isValid = false;

                        if (ability.specialTargeting) {
                            isValid = ability.specialTargeting(p, {r,c}, gameState);
                        } else {
                            switch (ability.targetType) {
                                case 'enemy':
                                    if (targetPiece && targetPiece.team === opponentTeam) isValid = true;
                                    break;
                                case 'friendly':
                                    if (targetPiece && targetPiece.team === team) isValid = true;
                                    break;
                                case 'empty':
                                    if (!targetPiece) isValid = true;
                                    break;
                            }
                        }

                        // --- MODIFIED: ADDED THIS CHECK ---
                        if (isValid && targetPiece && ability.canBeBlocked && targetPiece.hasDefensiveWard) {
                            isValid = false; // Target is warded, this is not a valid action.
                        }
                        // --- END MODIFICATION ---

                        if (isValid) {
                            possibleActions.push({ type: 'ability', piece: p, abilityKey: abilityKey, target: { r, c } });
                        }
                    }
                }
            }
        };

        // --- ADDED THIS BLOCK ---
        // 2a. Check for Siphon action
        if (p.ability?.name === 'Siphon' && (p.charges || 0) < p.ability.maxCharges) {
            const isOnRift = C.SHAPES.riftAreas.some(r => r.cells.some(([rr, cc]) => rr === p.row && cc === p.col));
            const isOnShrine = C.SHAPES.shrineArea.some(([r, c]) => r === p.row && c === p.col);
            
            if (isOnRift || isOnShrine) {
                possibleActions.push({ type: 'ability', piece: p, abilityKey: 'Siphon', target: null });
            }
        }
        // --- END OF NEW BLOCK ---

        // 2b. Check for other piece abilities
        if (p.ability?.key && p.ability.key !== 'Siphon' && p.ability.cooldown <= 0) {
            checkAndAddAbility(p.ability.key);
        }

        // 2c. Check for unleash abilities
        if (p.ability?.name === 'Siphon' && (p.charges || 0) > 0) {
            p.ability.unleash.forEach((abilityKey, i) => {
                if ((p.charges || 0) >= i + 1) checkAndAddAbility(abilityKey);
            });
        }
    });

    // --- MOVE ORDERING ---
    // Score each action heuristically and sort descending (best first)
    possibleActions.sort((a, b) => {
        const scoreA = scoreActionHeuristically(a, gameState, team);
        const scoreB = scoreActionHeuristically(b, gameState, team);
        return scoreB - scoreA;
    });

    return possibleActions;
}


// --- STEP 5: MINIMAX (ALPHA-BETA, ITERATIVE DEEPENING AWARE) ---

/**
 * MODIFIED: MIN Node (Opponent's Turn)
 * Includes depth check and uses ordered moves.
 */
function minimaxMin(simulatedState, aiTeam, opponentTeam, alpha, beta, depth, maxDepth, startTime, timeLimit) {
    // Check if time limit exceeded
    if (performance.now() - startTime > timeLimit) {
        return -Infinity; // Indicate timeout
    }
    // Check if max depth reached
    if (depth >= maxDepth) {
        return evaluateBoardState(simulatedState, aiTeam);
    }

    // Use ordered actions
    const opponentActions = getOrderedActions(simulatedState, opponentTeam);

    if (opponentActions.length === 0) {
        return 1000000; // Opponent has no moves, AI wins
    }

    let minScore = Infinity;

    for (const opponentAction of opponentActions) {
        const finalState = simulateAction(simulatedState, opponentAction);
        // Recursive call to MAX node for the next level
        const score = minimaxMax(finalState, aiTeam, opponentTeam, alpha, beta, depth + 1, maxDepth, startTime, timeLimit);

        // Check for timeout signal from deeper calls
        if (score === -Infinity) return -Infinity;

        minScore = Math.min(minScore, score);
        beta = Math.min(beta, minScore);

        if (beta <= alpha) {
            break; // Prune
        }
    }

    return minScore;
}

/**
 * MODIFIED: MAX Node (AI's Turn)
 * Includes depth check and uses ordered moves.
 */
function minimaxMax(simulatedState, aiTeam, opponentTeam, alpha, beta, depth, maxDepth, startTime, timeLimit) {
    // Check if time limit exceeded
    if (performance.now() - startTime > timeLimit) {
        return -Infinity; // Indicate timeout
    }
    // Check if max depth reached
    if (depth >= maxDepth) {
        return evaluateBoardState(simulatedState, aiTeam);
    }

    // Use ordered actions
    const aiActions = getOrderedActions(simulatedState, aiTeam);

    if (aiActions.length === 0) {
        return -1000000; // AI has no moves, opponent wins
    }

    let maxScore = -Infinity;

    for (const aiAction of aiActions) {
        const nextState = simulateAction(simulatedState, aiAction);
        // Recursive call to MIN node for the next level
        const score = minimaxMin(nextState, aiTeam, opponentTeam, alpha, beta, depth + 1, maxDepth, startTime, timeLimit);

        // Check for timeout signal from deeper calls
        if (score === -Infinity) return -Infinity;

        maxScore = Math.max(maxScore, score);
        alpha = Math.max(alpha, maxScore);

        if (beta <= alpha) {
            break; // Prune
        }
    }

    return maxScore;
}


/**
 * NEW: Orchestrates the iterative deepening search.
 */
function iterativeDeepeningSearch(gameState, timeLimit) {
    const startTime = performance.now();
    const aiTeam = gameState.currentTurn;
    const opponentTeam = aiTeam === 'snow' ? 'ash' : 'snow';

    let bestActionOverall = null;
    let currentDepth = 1;
    const maxPossibleDepth = 10; // Practical limit

    while (currentDepth <= maxPossibleDepth) {
        // Check time before starting the next depth
        if (performance.now() - startTime > timeLimit) {
            console.log(`Worker: Time limit reached before starting depth ${currentDepth}. Using result from depth ${currentDepth - 1}.`);
            break; // Time's up, use the previous best move
        }

        console.log(`Worker: Starting search at depth ${currentDepth}...`);

        let bestActionAtThisDepth = null;
        let bestScoreAtThisDepth = -Infinity;
        let alpha = -Infinity;
        let beta = Infinity;
        let timedOutThisDepth = false;

        // Get ordered actions at the root
        const possibleActions = getOrderedActions(gameState, aiTeam);
        if (possibleActions.length === 0) {
            return null; // No moves available
        }
        
        // --- Root level search (similar to original findBestMove but calls minimaxMin) ---
        for (const aiAction of possibleActions) {
             // Check time *during* the root level iteration
            if (performance.now() - startTime > timeLimit) {
                console.log(`Worker: Time limit reached during depth ${currentDepth}.`);
                timedOutThisDepth = true;
                break; 
            }

            const tempState = simulateAction(gameState, aiAction);
            const score = minimaxMin(tempState, aiTeam, opponentTeam, alpha, beta, 1, currentDepth, startTime, timeLimit); // Start recursion at depth 1

            // Check if the recursive call timed out
             if (score === -Infinity && (performance.now() - startTime > timeLimit)) {
                console.log(`Worker: Time limit reached deep within depth ${currentDepth}.`);
                timedOutThisDepth = true;
                break;
            }

            if (score > bestScoreAtThisDepth) {
                bestScoreAtThisDepth = score;
                bestActionAtThisDepth = aiAction;
            }

            alpha = Math.max(alpha, bestScoreAtThisDepth);
            // No beta check needed at root
        }
        // --- End root level search ---

        // If the search at this depth timed out, discard its result and use the previous depth's best move.
        if (timedOutThisDepth) {
             console.log(`Worker: Discarding incomplete result from depth ${currentDepth}.`);
             break;
        }

        // If the search completed without timeout, update the overall best action.
        bestActionOverall = bestActionAtThisDepth;
        console.log(`Worker: Completed depth ${currentDepth}. Best score found: ${bestScoreAtThisDepth}`);

        currentDepth++; // Move to the next depth
    }

    // Return the best action found from the highest fully completed depth
    if (!bestActionOverall) {
        // Fallback if even depth 1 times out (should be rare)
        console.warn("Worker: AI timed out even at depth 1. Picking first available move.");
        const fallbackActions = getOrderedActions(gameState, aiTeam);
        return fallbackActions.length > 0 ? fallbackActions[0] : null;
    }
    
    return bestActionOverall;
}

// --- STEP 6: WORKER HANDLER ---

self.onmessage = (event) => {
    // console.log("Worker: Received state from main thread.");
    const { gameState } = event.data;
    const timeLimit = 3000; // 3 seconds in milliseconds

    // Re-hydrate Sets
    gameState.snowTerritory = new Set(gameState.snowTerritory);
    gameState.ashTerritory = new Set(gameState.ashTerritory);

    const startTime = performance.now();
    // --- CALL ITERATIVE DEEPENING ---
    const bestAction = iterativeDeepeningSearch(gameState, timeLimit);
    const endTime = performance.now();

    console.log(`Worker: Total AI decision took ${(endTime - startTime).toFixed(2)} ms.`);

    // Send the best action back
    self.postMessage({ bestAction: bestAction });
};