// AI worker: iterative deepening + alpha-beta pruning, action generation, and simulation.

import * as C from './constants.js';
import { getValidMoves, getEffectivePower, isCaptureSuccessful } from './utils.js';

// Worker-side piece counter for simulations
let workerPieceIdCounter = 1000;

// --- Evaluation Functions ---

// Performs a deep clone of the game state for safe simulation.
function deepClone(obj) {
    const replacer = (key, value) => {
        if (value instanceof Set) return Array.from(value);
        if (key === 'creator' && typeof value === 'object' && value !== null) return value.id;
        return value;
    };
    const reviver = (key, value) => {
        if (key === 'snowTerritory' || key === 'ashTerritory') return new Set(value);
        return value;
    };

    const jsonString = JSON.stringify(obj, replacer);
    const newState = JSON.parse(jsonString, reviver);

    // Re-link pieces by ID post-cloning
    if (newState.pieces && Array.isArray(newState.pieces)) {
        const pieceMap = new Map(newState.pieces.map(p => [p.id, p]));

        if (Array.isArray(newState.temporaryBoosts)) {
            newState.temporaryBoosts.forEach(b => {
                if (b.pieceId && pieceMap.has(b.pieceId)) b.piece = pieceMap.get(b.pieceId);
            });
        }
        if (Array.isArray(newState.debuffs)) {
            newState.debuffs.forEach(d => {
                if (d.pieceId && pieceMap.has(d.pieceId)) d.piece = pieceMap.get(d.pieceId);
            });
        }
        if (Array.isArray(newState.markedPieces)) {
            newState.markedPieces.forEach(m => {
                if (m.targetId && pieceMap.has(m.targetId)) m.target = pieceMap.get(m.targetId);
            });
        }
        if (Array.isArray(newState.shields)) {
            newState.shields.forEach(s => {
                if (s.pieceId && pieceMap.has(s.pieceId)) s.piece = pieceMap.get(s.pieceId);
            });
        }
        if (Array.isArray(newState.unstableGrounds)) {
            newState.unstableGrounds.forEach(g => {
                if (g.creator && typeof g.creator === 'number' && pieceMap.has(g.creator)) {
                    g.creator = pieceMap.get(g.creator);
                }
            });
        }
    }

    return newState;
}

// Evaluates piece abilities, cooldowns, and active effects.
function evaluateAbilityStatus(gameState, aiTeam, opponentTeam, aiConfig) {
    let score = 0;
    gameState.pieces.forEach(p => {
        const valueModifier = (C.PIECE_VALUES[p.key] || 200) / 1000;
        if (p.team === aiTeam) {
            if (p.ability?.cooldown > 0) score -= p.ability.cooldown * 50 * valueModifier;
            if ((gameState.temporaryBoosts || []).some(b => b.pieceId === p.id)) score += 300 * valueModifier;
            if ((gameState.debuffs || []).some(d => d.pieceId === p.id) || (gameState.markedPieces || []).some(m => m.targetId === p.id)) score -= 400 * valueModifier;
            if ((gameState.shields || []).some(s => s.pieceId === p.id)) score += 350 * valueModifier;
            if (p.ability && !p.ability.cooldown) score += 50 * valueModifier;
        } else {
            if (p.ability?.cooldown > 0) score += p.ability.cooldown * 30 * valueModifier;
            if ((gameState.temporaryBoosts || []).some(b => b.pieceId === p.id)) score -= 300 * valueModifier;
            if ((gameState.debuffs || []).some(d => d.pieceId === p.id) || (gameState.markedPieces || []).some(m => m.targetId === p.id)) score += 400 * valueModifier;
            if ((gameState.shields || []).some(s => s.pieceId === p.id)) score -= 350 * valueModifier;
            if (p.ability && !p.ability.cooldown) score -= 50 * valueModifier;
        }
    });
    return score;
}

// Evaluates score based on placed hazards (walls, unstable ground, snares).
function evaluateBoardHazards(gameState, aiTeam, opponentTeam, aiConfig) {
    let hazardScore = 0;
    const opponentLeader = gameState.pieces.find(p => p.team === opponentTeam && (p.key.includes('Lord') || p.key.includes('Tyrant')));
    const aiLeader = gameState.pieces.find(p => p.team === aiTeam && (p.key.includes('Lord') || p.key.includes('Tyrant')));

    for (const wall of (gameState.glacialWalls || [])) {
        if (opponentLeader && Math.max(Math.abs(wall.row - opponentLeader.row), Math.abs(wall.col - opponentLeader.col)) <= 2) {
            hazardScore += 150;
        }
        if (aiLeader && Math.max(Math.abs(wall.row - aiLeader.row), Math.abs(wall.col - aiLeader.col)) <= 1) {
            hazardScore += 100;
        }
    }

    for (const ground of (gameState.unstableGrounds || [])) {
        let nearbyEnemies = 0;
        for (const piece of gameState.pieces) {
            if (piece.team === opponentTeam && Math.max(Math.abs(ground.row - piece.row), Math.abs(ground.col - piece.col)) <= 1) {
                nearbyEnemies++;
            }
        }
        hazardScore += nearbyEnemies * 75;
        if (C.SHAPES.shrineArea.some(([r,c]) => r === ground.row && c === ground.col)) {
            hazardScore += 100;
        }
    }

    for (const trap of (gameState.specialTerrains || [])) {
        let nearbyEnemies = 0;
        for (const piece of gameState.pieces) {
            if (piece.team === opponentTeam && Math.max(Math.abs(trap.row - piece.row), Math.abs(trap.col - piece.col)) <= 1) {
                nearbyEnemies++;
            }
        }
        hazardScore += nearbyEnemies * 100;
        if (C.SHAPES.shrineArea.some(([r,c]) => r === trap.row && c === trap.col)) {
            hazardScore += 150;
        }
    }

    return hazardScore;
}

// Main function to calculate the board state's value.
function evaluateBoardState(gameState, aiTeam, aiConfig) {
    let score = 0;
    const opponentTeam = aiTeam === 'snow' ? 'ash' : 'snow';

    const aiLeader = gameState.pieces.find(p => p.team === aiTeam && (p.key.includes('Lord') || p.key.includes('Tyrant')));
    const opponentLeader = gameState.pieces.find(p => p.team === opponentTeam && (p.key.includes('Lord') || p.key.includes('Tyrant')));
    if (!opponentLeader) return 1000000;
    if (!aiLeader) return -1000000;

    for (const p of gameState.pieces) {
        if (p.team === aiTeam) {
            if (p.isDazed) {
                score += aiConfig.W_DAZED_PENALTY;
            }
            if ((p.stuck || 0) > 0) {
                score += aiConfig.W_STUCK_PENALTY;
            }
        }
    }

    const W_LEADER_SAFETY = aiConfig.W_LEADER_SAFETY;
    const W_PIECE_SAFETY = aiConfig.W_PIECE_SAFETY;
    const W_LEADER_THREAT = aiConfig.W_LEADER_THREAT;
    const W_NET_VALUE = aiConfig.W_NET_VALUE;
    const W_NET_POWER = aiConfig.W_NET_POWER;
    const W_SIPHON = aiConfig.W_SIPHON;
    const W_CONDUIT = aiConfig.W_CONDUIT;
    const W_SHRINE = aiConfig.W_SHRINE;
    const W_ABILITY = aiConfig.W_ABILITY;
    const W_TERR_MOB = aiConfig.W_TERR_MOB;
    const W_POSITIONAL = aiConfig.W_POSITIONAL;
    const W_HAZARDS = aiConfig.W_HAZARDS;

    score += evaluateLeaderSafety(aiLeader, opponentTeam, gameState, aiConfig) * W_LEADER_SAFETY;
    score += evaluatePieceSafety(gameState, aiTeam, opponentTeam, aiConfig) * W_PIECE_SAFETY;
    score += evaluateOpponentLeaderThreat(opponentLeader, aiTeam, gameState, aiConfig) * W_LEADER_THREAT;
    score += evaluateNetPieceValue(gameState, aiTeam, opponentTeam, aiConfig) * W_NET_VALUE;
    score += evaluateNetEffectivePower(gameState, aiTeam, opponentTeam, aiConfig) * W_NET_POWER;
    score += evaluateSiphonCharges(gameState, aiTeam, opponentTeam, aiConfig) * W_SIPHON;
    score += evaluateConduitLink(gameState, aiTeam, opponentTeam, aiConfig) * W_CONDUIT;
    score += evaluateShrine(gameState, aiTeam, opponentTeam, aiConfig) * W_SHRINE;
    score += evaluateAbilityStatus(gameState, aiTeam, opponentTeam, aiConfig) * W_ABILITY;
    score += evaluateTerritoryAndMobility(gameState, aiTeam, opponentTeam, aiConfig) * W_TERR_MOB;
    score += evaluatePositionalValue(gameState, aiTeam, opponentTeam, aiConfig) * W_POSITIONAL;
    score += evaluateBoardHazards(gameState, aiTeam, opponentTeam, aiConfig) * W_HAZARDS;

    return score;
}

// Evaluates the current state of the Conduit Link.
function evaluateConduitLink(gameState, aiTeam, opponentTeam, aiConfig) {
    if (gameState.conduitLinkActive) {
        if (gameState.conduitTeam === aiTeam) {
            return gameState.conduitIsContested ? 1500 : 3500;
        } else {
            return gameState.conduitIsContested ? -1500 : -3500;
        }
    }
    const aiPiecesOnRifts = C.SHAPES.riftAreas.filter(rift =>
        rift.cells.some(([r, c]) => C.getPieceAt(r, c, gameState.boardMap)?.team === aiTeam)
    ).length;
    return aiPiecesOnRifts * 1000;
}

// Evaluates the safety of the AI's leader.
function evaluateLeaderSafety(leader, opponentTeam, gameState, aiConfig) {
    if (!leader) return -1000000;

    let safetyScore = 0;
    const dangerZone = new Set();
    const immediateThreats = [];

    for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
            if (dr === 0 && dc === 0) continue;
            dangerZone.add(`${leader.row + dr},${leader.col + dc}`);
        }
    }

    const opponentPieces = gameState.pieces.filter(p => p.team === opponentTeam);

    for (const enemy of opponentPieces) {
        const enemyMoves = getValidMoves(enemy, gameState);

        if (Math.max(Math.abs(leader.row - enemy.row), Math.abs(leader.col - enemy.col)) <= 1) {
            safetyScore -= 10000 + getEffectivePower(enemy, gameState) * 100;
            immediateThreats.push(enemy);
        } else if (enemyMoves.some(move => move.row === leader.row && move.col === leader.col)) {
            safetyScore -= 5000 + getEffectivePower(enemy, gameState) * 50;
            immediateThreats.push(enemy);
        } else if (enemyMoves.some(move => dangerZone.has(`${move.row},${move.col}`))) {
            safetyScore -= 500 + getEffectivePower(enemy, gameState) * 10;
        }
    }

    if ((gameState.debuffs || []).some(d => d.pieceId === leader.id && (d.name === 'Edict' || d.name === 'Hamstrung'))) {
        safetyScore -= 1000;
    }
    if ((leader.stuck || 0) > 0) {
        safetyScore -= 3000;
    }

    if (immediateThreats.length === 0) safetyScore += 1000;
    if (immediateThreats.length > 1) safetyScore -= immediateThreats.length * 2000;

    return safetyScore;
}

// Calculates the difference in total effective power.
function evaluateNetEffectivePower(gameState, aiTeam, opponentTeam, aiConfig) {
    let aiPower = 0, opponentPower = 0;
    gameState.pieces.forEach(p => {
        const power = getEffectivePower(p, gameState, null, null);
        if (p.team === aiTeam) aiPower += power;
        else if (p.team === opponentTeam) opponentPower += power;
    });
    return (aiPower - opponentPower) * 150;
}

// Calculates the difference in total piece value.
function evaluateNetPieceValue(gameState, aiTeam, opponentTeam, aiConfig) {
    let aiValue = 0, opponentValue = 0;
    gameState.pieces.forEach(p => {
        const value = C.PIECE_VALUES[p.key] || 0;
        if (p.team === aiTeam) aiValue += value;
        else if (p.team === opponentTeam) opponentValue += value;
    });
    return (aiValue - opponentValue) * 2.0;
}

// Evaluates the threat posed by the opponent's leader.
function evaluateOpponentLeaderThreat(opponentLeader, aiTeam, gameState, aiConfig) {
    let threatScore = 0;
    if (!opponentLeader) return 1000000;

    const aiPieces = gameState.pieces.filter(p => p.team === aiTeam);

    for (const piece of aiPieces) {
        const moves = getValidMoves(piece, gameState);
        if (moves.some(move => move.row === opponentLeader.row && move.col === opponentLeader.col)) {
            threatScore += 20000 + (C.PIECE_VALUES[piece.key] || 0) * 5;
        } else if (moves.some(move => Math.max(Math.abs(move.row - opponentLeader.row), Math.abs(move.col - opponentLeader.col)) <= 1)) {
            threatScore += 500 + (C.PIECE_VALUES[piece.key] || 0);
        }
    }
    return threatScore;
}

// Evaluates the safety of non-leader pieces.
function evaluatePieceSafety(gameState, aiTeam, opponentTeam, aiConfig) {
    let safetyScore = 0;
    const aiPieces = gameState.pieces.filter(p => p.team === aiTeam);
    const opponentPieces = gameState.pieces.filter(p => p.team === opponentTeam);

    for (const myPiece of aiPieces) {
        if (myPiece.key.includes('Lord') || myPiece.key.includes('Tyrant')) continue;

        if ((gameState.shields || []).some(s => s.pieceId === myPiece.id)) {
            safetyScore += 150;
        }

        let isThreatened = false;
        for (const enemyPiece of opponentPieces) {
            if (getValidMoves(enemyPiece, gameState).some(move => move.row === myPiece.row && move.col === myPiece.col)) {
                safetyScore -= (C.PIECE_VALUES[myPiece.key] || 50) * 1.5;
                isThreatened = true;
                break;
            }
        }
        if (!isThreatened) {
            safetyScore += (C.PIECE_VALUES[myPiece.key] || 50) * 0.1;
        }
    }
    return safetyScore;
}

// Evaluates piece positioning on the board (center control, deep territory).
function evaluatePositionalValue(gameState, aiTeam, opponentTeam, aiConfig) {
    let score = 0;
    const centerSquares = [[4,4],[4,5],[5,4],[5,5],[3,4],[3,5],[6,4],[6,5],[4,3],[5,3],[4,6],[5,6]];
    const riftCells = C.SHAPES.riftAreas.flatMap(r => r.cells);

    gameState.pieces.forEach(p => {
        const valueModifier = (C.PIECE_VALUES[p.key] || 100) / 500;
        let positionBonus = 0;

        if (centerSquares.some(([r,c]) => r === p.row && c === p.col)) positionBonus += 150;
        else if (centerSquares.some(([r,c]) => Math.max(Math.abs(r-p.row), Math.abs(c-p.col)) <= 1)) positionBonus += 50;

        if (riftCells.some(([r,c]) => r === p.row && c === p.col)) positionBonus += 100;

        if (p.team === aiTeam) score += positionBonus * valueModifier;
        else score -= positionBonus * valueModifier;

        if ((p.team === 'snow' && p.row >= 8) || (p.team === 'ash' && p.row <= 1)) {
            if (!(p.key.includes('Lord') || p.key.includes('Tyrant'))) {
                if (p.team === aiTeam) score -= 30 * valueModifier;
                else score += 30 * valueModifier;
            }
        }
    });

    return score;
}

// Evaluates the current state of the Shrine.
function evaluateShrine(gameState, aiTeam, opponentTeam, aiConfig) {
    let score = gameState.shrineChargeLevel * 300;

    if (gameState.shrineIsOverloaded) {
        const trappedPiece = gameState.pieces.find(p => p.id === gameState.trappedPiece);
        if (trappedPiece) {
            if (trappedPiece.team === aiTeam) score -= 500;
            else score += 1000;
        } else {
            score += 200;
        }
    }

    const aiControl = C.SHAPES.shrineArea.filter(([r,c]) => C.getPieceAt(r,c,gameState.boardMap)?.team === aiTeam).length;
    const oppControl = C.SHAPES.shrineArea.filter(([r,c]) => C.getPieceAt(r,c,gameState.boardMap)?.team === opponentTeam).length;
    score += (aiControl - oppControl) * 200;

    return score;
}

// Calculates the difference in total siphon charges.
function evaluateSiphonCharges(gameState, aiTeam, opponentTeam, aiConfig) {
    let aiCharges = 0, opponentCharges = 0;
    gameState.pieces.forEach(p => {
        if (p.charges) {
            if (p.team === aiTeam) aiCharges += p.charges;
            else if (p.team === opponentTeam) opponentCharges += p.charges;
        }
    });
    return (aiCharges - opponentCharges) * 250;
}

// Evaluates the difference in territory control and piece mobility.
function evaluateTerritoryAndMobility(gameState, aiTeam, opponentTeam, aiConfig) {
    const territoryScore = (gameState.snowTerritory.size - gameState.ashTerritory.size) * 50 * (aiTeam === 'snow' ? 1 : -1);

    let aiMoves = 0, opponentMoves = 0;
    gameState.pieces.forEach(p => {
        if (!(p.key.includes('Lord') || p.key.includes('Tyrant'))) {
            if (p.team === aiTeam) aiMoves += getValidMoves(p, gameState).length;
            else if (p.team === opponentTeam) opponentMoves += getValidMoves(p, gameState).length;
        }
    });
    const mobilityScore = (aiMoves - opponentMoves) * 25;

    return territoryScore + mobilityScore;
}

// Finds the cloned piece object in the simulated state.
function findPieceInState(state, originalPiece) {
    return originalPiece ? state.pieces.find(p => p.id === originalPiece.id) : null;
}

// Generates and orders all possible actions for a team.
function getOrderedActions(gameState, team) {
    const possibleActions = [];
    const opponentTeam = team === 'snow' ? 'ash' : 'snow';

    gameState.pieces
        .filter(p => p.team === team && !p.isDazed && (p.stuck || 0) <= 0)
        .forEach(p => {
            getValidMoves(p, gameState).forEach(move => {
                possibleActions.push({ type: 'move', piece: p, target: move });
            });

            const abilityTargetIsValid = (ability, p, r, c) => {
                if (!ability) return false;
                const distance = Math.max(Math.abs(p.row - r), Math.abs(p.col - c));
                if (ability.range >= 0 && distance > ability.range) return false;
                if (ability.specialTargeting) return ability.specialTargeting(p, { r, c }, gameState);
                const targetPiece = C.getPieceAt(r, c, gameState.boardMap);
                switch (ability.targetType) {
                    case 'enemy': return !!targetPiece && targetPiece.team === opponentTeam;
                    case 'friendly': return !!targetPiece && targetPiece.team === team;
                    case 'empty': return !targetPiece;
                    default: return false;
                }
            };

            if (p.ability) {
                const isUltimate = C.ABILITIES[p.ability.key]?.isUltimate;
                if (isUltimate && p.hasUsedUltimate) {
                    // skip used ultimate
                } else if (p.ability.key === 'Siphon') {
                    const onRift = C.SHAPES.riftAreas.some(rift => rift.cells.some(([rr,cc]) => rr === p.row && cc === p.col));
                    const onShrine = C.SHAPES.shrineArea.some(([rr,cc]) => rr === p.row && cc === p.col);
                    const canGain = (p.charges || 0) < (p.ability.maxCharges || 3);
                    if ((onRift || onShrine) && canGain) {
                        possibleActions.push({ type: 'ability', piece: p, abilityKey: 'Siphon', target: null });
                    }
                    if ((p.charges || 0) > 0 && Array.isArray(p.ability.unleash)) {
                        p.ability.unleash.forEach((unKey, idx) => {
                            const cost = idx + 1;
                            if ((p.charges || 0) >= cost) {
                                const ab = C.ABILITIES[unKey];
                                if (!ab) return;
                                if (!ab.requiresTargeting) possibleActions.push({ type: 'ability', piece: p, abilityKey: unKey, target: null });
                                else {
                                    for (let r = 0; r < C.ROWS; r++) {
                                        for (let c = 0; c < C.COLS; c++) {
                                            if (!abilityTargetIsValid(ab, p, r, c)) continue;
                                            const targetPiece = C.getPieceAt(r, c, gameState.boardMap);
                                            if (ab.canBeBlocked && targetPiece?.hasDefensiveWard) continue;
                                            possibleActions.push({ type: 'ability', piece: p, abilityKey: unKey, target: { r, c } });
                                        }
                                    }
                                }
                            }
                        });
                    }
                } else {
                    if ((p.ability.cooldown || 0) <= 0 || isUltimate) {
                        const ability = C.ABILITIES[p.ability.key];
                        if (ability) {
                            if (!ability.requiresTargeting) possibleActions.push({ type: 'ability', piece: p, abilityKey: p.ability.key, target: null });
                            else {
                                for (let r = 0; r < C.ROWS; r++) {
                                    for (let c = 0; c < C.COLS; c++) {
                                        if (!abilityTargetIsValid(ability, p, r, c)) continue;
                                        const targetPiece = C.getPieceAt(r, c, gameState.boardMap);
                                        if (ability.canBeBlocked && targetPiece?.hasDefensiveWard) continue;
                                        possibleActions.push({ type: 'ability', piece: p, abilityKey: p.ability.key, target: { r, c } });
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

    possibleActions.sort((a, b) => {
        const scoreA = scoreActionHeuristically(a, gameState, team);
        const scoreB = scoreActionHeuristically(b, gameState, team);
        return scoreB - scoreA;
    });

    return possibleActions;
}

// Main search function using iterative deepening.
function iterativeDeepeningSearch(gameState, timeLimit, aiConfig) {
    const startTime = performance.now();
    const aiTeam = gameState.currentTurn;
    const opponentTeam = aiTeam === 'snow' ? 'ash' : 'snow';

    let bestActionOverall = null;
    let currentDepth = 1;
    const maxPossibleDepth = 10;

    while (currentDepth <= maxPossibleDepth) {
        if (performance.now() - startTime > timeLimit) break;

        let bestActionAtThisDepth = null;
        let bestScoreAtThisDepth = -Infinity;
        let alpha = -Infinity;
        let timedOutThisDepth = false;

        const possibleActions = getOrderedActions(gameState, aiTeam);
        if (possibleActions.length === 0) return null;

        for (const aiAction of possibleActions) {
            if (performance.now() - startTime > timeLimit) {
                timedOutThisDepth = true;
                break;
            }

            const tempState = simulateAction(gameState, aiAction);
            const score = minimaxMin(tempState, aiTeam, opponentTeam, alpha, Infinity, 1, currentDepth, startTime, timeLimit, aiConfig);

            if (score === -Infinity && (performance.now() - startTime > timeLimit)) {
                timedOutThisDepth = true;
                break;
            }

            if (score > bestScoreAtThisDepth) {
                bestScoreAtThisDepth = score;
                bestActionAtThisDepth = aiAction;
            }

            alpha = Math.max(alpha, bestScoreAtThisDepth);
        }

        if (timedOutThisDepth) break;

        bestActionOverall = bestActionAtThisDepth;
        currentDepth++;
    }

    if (!bestActionOverall) {
        const fallbackActions = getOrderedActions(gameState, gameState.currentTurn);
        return fallbackActions.length > 0 ? fallbackActions[0] : null;
    }

    return bestActionOverall;
}

// Max node for minimax search.
function minimaxMax(simulatedState, aiTeam, opponentTeam, alpha, beta, depth, maxDepth, startTime, timeLimit, aiConfig) {
    if (performance.now() - startTime > timeLimit) return -Infinity;
    if (depth >= maxDepth) return evaluateBoardState(simulatedState, aiTeam, aiConfig);

    const aiActions = getOrderedActions(simulatedState, aiTeam);
    if (aiActions.length === 0) return -1000000;

    let maxScore = -Infinity;
    for (const aiAction of aiActions) {
        const nextState = simulateAction(simulatedState, aiAction);
        const score = minimaxMin(nextState, aiTeam, opponentTeam, alpha, beta, depth + 1, maxDepth, startTime, timeLimit, aiConfig);
        if (score === -Infinity) return -Infinity;
        maxScore = Math.max(maxScore, score);
        alpha = Math.max(alpha, maxScore);
        if (beta <= alpha) break;
    }
    return maxScore;
}

// Min node for minimax search.
function minimaxMin(simulatedState, aiTeam, opponentTeam, alpha, beta, depth, maxDepth, startTime, timeLimit, aiConfig) {
    if (performance.now() - startTime > timeLimit) return -Infinity;
    if (depth >= maxDepth) return evaluateBoardState(simulatedState, aiTeam, aiConfig);

    const opponentActions = getOrderedActions(simulatedState, opponentTeam);
    if (opponentActions.length === 0) return 1000000;

    let minScore = Infinity;
    for (const opponentAction of opponentActions) {
        const finalState = simulateAction(simulatedState, opponentAction);
        const score = minimaxMax(finalState, aiTeam, opponentTeam, alpha, beta, depth + 1, maxDepth, startTime, timeLimit, aiConfig);
        if (score === -Infinity) return -Infinity;
        minScore = Math.min(minScore, score);
        beta = Math.min(beta, minScore);
        if (beta <= alpha) break;
    }
    return minScore;
}

// Heuristically scores an action for priority ordering.
function scoreActionHeuristically(action, gameState, aiTeam) {
    let score = 0;
    const opponentTeam = aiTeam === 'snow' ? 'ash' : 'snow';
    const piece = action.piece;
    const target = action.target;
    const opponentLeader = gameState.pieces.find(p => p.team === opponentTeam && (p.key.includes('Lord') || p.key.includes('Tyrant')));

    if (action.type === 'move') {
        const defender = target ? C.getPieceAt(target.row, target.col, gameState.boardMap) : null;
        if (defender) {
            score += 1000 + (C.PIECE_VALUES[defender.key] || 0) * 10;
            if ((C.PIECE_VALUES[piece.key] || 0) < (C.PIECE_VALUES[defender.key] || 0)) score -= 50;
            if ((gameState.shields || []).some(s => s.pieceId === defender.id)) score -= 500;
        }
        const centerDist = Math.max(Math.abs(target.row - 4.5), Math.abs(target.col - 4.5));
        score += (5 - centerDist) * 5;

        if (opponentLeader) {
            const distToLeader = Math.max(Math.abs(target.row - opponentLeader.row), Math.abs(target.col - opponentLeader.col));
            if (distToLeader <= 3) score += (4 - distToLeader) * 20;
        }

        if ((gameState.specialTerrains || []).some(t => t.row === target.row && t.col === target.col)) {
            const trap = gameState.specialTerrains.find(t => t.row === target.row && t.col === target.col);
            if (trap.type !== 'icyGround' || piece.team !== 'snow') {
                score -= 1000;
            }
        }

    } else if (action.type === 'ability') {
        const abilityKey = action.abilityKey;
        const targetPiece = action.target ? C.getPieceAt(action.target.r, action.target.c, gameState.boardMap) : null;

        if (abilityKey === 'Siphon') {
            score += 700;
        } else if (abilityKey === 'KingsEdict' || abilityKey === 'TyrantsProclamation') {
            score += 1000;
        } else if (abilityKey === 'FlashFreeze' || abilityKey === 'MarkOfCinder' || abilityKey === 'LavaGlob') {
            if (targetPiece) {
                score += 800 + (C.PIECE_VALUES[targetPiece.key] || 0) * 2;
                if (targetPiece.key.includes('Lord') || targetPiece.key.includes('Tyrant')) score += 5000;
            }
        }
    }
    return score;
}

// Simulates the result of a single action.
function simulateAction(gameState, action) {
    if (action.type === 'move') return simulateMove(gameState, action.piece, action.target);
    if (action.type === 'ability') return simulateAbility(gameState, action.piece, action.abilityKey, action.target);
    return gameState;
}

// Simulates the use of an ability.
function simulateAbility(gameState, piece, abilityKey, target = null) {
    const tempState = deepClone(gameState);
    const simPiece = findPieceInState(tempState, piece);
    if (!simPiece) return tempState;

    if (abilityKey === 'Siphon') {
        if (simPiece.charges < simPiece.ability.maxCharges) {
            simPiece.charges = (simPiece.charges || 0) + 1;
        }
        simPiece.ability.cooldown = 1;
        return tempState;
    }

    const ability = C.ABILITIES[abilityKey];
    if (ability?.effect) {
        let canApplyEffect = true;
        if (target && ability.canBeBlocked) {
            const targetPiece = C.getPieceAt(target.r, target.c, tempState.boardMap);
            if (targetPiece && targetPiece.hasDefensiveWard) canApplyEffect = false;
        }

        if (canApplyEffect) {
            ability.effect(simPiece, target, tempState, workerCreatePiece);
        }

        if (typeof ability.cost === 'number') {
            simPiece.charges = Math.max(0, (simPiece.charges || 0) - ability.cost);
        }

        if (simPiece.ability?.key === abilityKey) {
            if (!ability.isUltimate) {
                simPiece.ability.cooldown = ability.cooldown || 1;
            }
        }

        tempState.boardMap = Array.from({ length: C.ROWS }, () => Array(C.COLS).fill(null));
        tempState.pieces.forEach(p => { tempState.boardMap[p.row][p.col] = p; });
        updateConduitLink(tempState);
    }
    return tempState;
}

// Simulates a piece movement and potential combat/ground effects.
function simulateMove(gameState, piece, target) {
    const tempState = deepClone(gameState);
    const simPiece = findPieceInState(tempState, piece);
    if (!simPiece) return tempState;

    const defender = C.getPieceAt(target.row, target.col, tempState.boardMap);
    if (defender) {
        tempState.pieces = tempState.pieces.filter(p => p.id !== defender.id);
    }

    simPiece.row = target.row;
    simPiece.col = target.col;

    const trapIndex = (tempState.specialTerrains || []).findIndex(t => t.row === target.row && t.col === target.col);
    if (trapIndex !== -1) {
        const trap = tempState.specialTerrains[trapIndex];
        if (trap.type === 'snare') {
            simPiece.stuck = C.ABILITY_VALUES.SetSnare.duration;
            tempState.specialTerrains.splice(trapIndex, 1);
        } else if (trap.type === 'icyGround') {
            if (simPiece.team !== 'snow') {
                simPiece.isDazed = true;
                simPiece.dazedFor = 2;
                tempState.specialTerrains.splice(trapIndex, 1);
            }
        }
    }

    tempState.boardMap = Array.from({ length: C.ROWS }, () => Array(C.COLS).fill(null));
    tempState.pieces.forEach(p => { tempState.boardMap[p.row][p.col] = p; });
    updateConduitLink(tempState);
    return tempState;
}

// Updates the Conduit Link state (copied from game.js/utils.js fix).
function updateConduitLink(gameState) {
    const [rift1, rift2] = gameState.dynamicRifts;

    gameState.pieces.forEach(p => {
        p.isAnchor = false;
        p.hasDefensiveWard = false;
        p.anchorBoost = 0;
    });

    gameState.conduitLinkActive = false;
    gameState.conduitTeam = null;
    gameState.riftAnchors = { topLeft: null, bottomRight: null };
    gameState.conduitIsContested = false;

    const piecesOnTL = gameState.pieces.filter(p => rift1.cells.some(([r, c]) => r === p.row && c === p.col));
    const piecesOnBR = gameState.pieces.filter(p => rift2.cells.some(([r, c]) => r === p.row && c === p.col));

    const snowAnchorTL = piecesOnTL.find(p => p.team === 'snow');
    const snowAnchorBR = piecesOnBR.find(p => p.team === 'snow');
    const ashAnchorTL = piecesOnTL.find(p => p.team === 'ash');
    const ashAnchorBR = piecesOnBR.find(p => p.team === 'ash');

    let linkTeam = null;
    let linkAnchors = null;
    let opponentTeam = null;

    if (snowAnchorTL && snowAnchorBR) {
        linkTeam = 'snow';
        opponentTeam = 'ash';
        linkAnchors = { TL: snowAnchorTL, BR: snowAnchorBR };
    } else if (ashAnchorTL && ashAnchorBR) {
        linkTeam = 'ash';
        opponentTeam = 'snow';
        linkAnchors = { TL: ashAnchorTL, BR: ashAnchorBR };
    }

    if (linkTeam && linkAnchors) {
        gameState.conduitLinkActive = true;
        gameState.conduitTeam = linkTeam;
        gameState.riftAnchors = { topLeft: linkAnchors.TL, bottomRight: linkAnchors.BR };

        const isContested = piecesOnTL.some(p => p.team === opponentTeam) || piecesOnBR.some(p => p.team === opponentTeam);
        let boostAmount = isContested ? 1 : 2;

        if (gameState.factionPassives[linkTeam].ascension.RiftReinforcement) boostAmount = 2;

        linkAnchors.TL.isAnchor = true;
        linkAnchors.TL.hasDefensiveWard = true;
        linkAnchors.TL.anchorBoost = boostAmount;

        linkAnchors.BR.isAnchor = true;
        if (linkAnchors.BR.canRiftPulse === undefined) {
            linkAnchors.BR.canRiftPulse = true;
        }
        linkAnchors.BR.anchorBoost = boostAmount;

        gameState.conduitIsContested = isContested;
    }
}

// Worker-side stub for createPiece (used only by SummonIceWisp in simulations).
function workerCreatePiece(r, c, key, team) {
    const properties = C.PIECE_TYPES[key] || {};
    return {
        id: workerPieceIdCounter++,
        row: r,
        col: c,
        key,
        team,
        power: properties.power,
        ability: {}
    };
}

// --- Worker Message Handler (Entry Point) ---

self.onmessage = (event) => {
    const { gameState, aiConfig: receivedConfig } = event.data;
    const timeLimit = 3000;

    const DEFAULT_AI_CONFIG = {
        W_LEADER_SAFETY: 5.0,
        W_PIECE_SAFETY: 1.5,
        W_LEADER_THREAT: 1.0,
        W_NET_VALUE: 2.0,
        W_NET_POWER: 150,
        W_SIPHON: 200,
        W_CONDUIT: 1.0,
        W_SHRINE: 1.0,
        W_ABILITY: 1.0,
        W_TERR_MOB: 1.0,
        W_POSITIONAL: 1.0,
        W_HAZARDS: 1.0,
        W_DAZED_PENALTY: -1000,
        W_STUCK_PENALTY: -800
    };
    const aiConfig = { ...DEFAULT_AI_CONFIG, ...receivedConfig };

    gameState.snowTerritory = new Set(gameState.snowTerritory);
    gameState.ashTerritory = new Set(gameState.ashTerritory);

    if (gameState.pieces && Array.isArray(gameState.pieces)) {
        const pieceMap = new Map(gameState.pieces.map(p => [p.id, p]));

        if (Array.isArray(gameState.temporaryBoosts)) {
            gameState.temporaryBoosts.forEach(b => {
                if (b.pieceId && pieceMap.has(b.pieceId)) b.piece = pieceMap.get(b.pieceId);
            });
        }
        if (Array.isArray(gameState.debuffs)) {
            gameState.debuffs.forEach(d => {
                if (d.pieceId && pieceMap.has(d.pieceId)) d.piece = pieceMap.get(d.pieceId);
            });
        }
        if (Array.isArray(gameState.markedPieces)) {
            gameState.markedPieces.forEach(m => {
                if (m.targetId && pieceMap.has(m.targetId)) m.target = pieceMap.get(m.targetId);
            });
        }
        if (Array.isArray(gameState.shields)) {
            gameState.shields.forEach(s => {
                if (s.pieceId && pieceMap.has(s.pieceId)) s.piece = pieceMap.get(s.pieceId);
            });
        }
        if (Array.isArray(gameState.unstableGrounds)) {
            gameState.unstableGrounds.forEach(g => {
                if (g.creator && typeof g.creator === 'number' && pieceMap.has(g.creator)) {
                    g.creator = pieceMap.get(g.creator);
                }
            });
        }
    }

    const startTime = performance.now();
    const bestAction = iterativeDeepeningSearch(gameState, timeLimit, aiConfig);
    const endTime = performance.now();

    console.log(`Worker: AI decision took ${(endTime - startTime).toFixed(2)} ms.`);
    self.postMessage({ bestAction });
};