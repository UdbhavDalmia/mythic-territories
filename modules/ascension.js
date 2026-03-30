import * as C from './constants.js';

function applyUpgrade(gameState, team, upgradeKey) {
    gameState.factionPassives[team].ascension[upgradeKey] = true;

    const pieces = gameState.pieces;
    const isSnow = team === 'snow';
    const leaderKey = isSnow ? C.TEAM_PIECES.snow.Tyrant : C.TEAM_PIECES.ash.Tyrant;
    const strikerKey = isSnow ? C.TEAM_PIECES.snow.Striker : C.TEAM_PIECES.ash.Striker;
    const skirmisherKey = isSnow ? C.TEAM_PIECES.snow.Skirmisher : C.TEAM_PIECES.ash.Skirmisher;
    const warriorKey = isSnow ? C.TEAM_PIECES.snow.Warrior : C.TEAM_PIECES.ash.Warrior;
    const brawlerKey = isSnow ? C.TEAM_PIECES.snow.Brawler : C.TEAM_PIECES.ash.Brawler;
    const priestKey = isSnow ? C.TEAM_PIECES.snow.Priest : C.TEAM_PIECES.ash.Priest;

    switch (upgradeKey) {
        case 'AcrobaticTactics':
            const striker = pieces.find(p => p.key === strikerKey);
            if (striker) striker.isAcrobat = true;
            break;

        case 'ElementalHarmony':
            const priest = pieces.find(p => p.key === priestKey);
            if (priest) priest.isElementalHarmony = true;
            break;

        case 'MasterOfCreation':
            const leader = pieces.find(p => p.key === leaderKey);
            if (leader) {
                leader.hasMasterOfCreation = true;
                leader.isVeteran = true; // Flaggers leader to show UI button for Secondary
                leader.secondaryAbilityKey = isSnow ? 'GlacialWall' : 'UnstableGround';
                leader.secondaryAbilityCooldown = 0;
            }
            break;
            
        case 'LethalPrecision':
            const skirmisher = pieces.find(p => p.key === skirmisherKey);
            if (skirmisher) skirmisher.power = (skirmisher.power || 1) + 1;
            break;

        case 'UnstoppableForce':
            const brawler_uf = pieces.find(p => p.key === brawlerKey);
            if (brawler_uf) brawler_uf.isSteadfast = true;
            break;

        case 'LeadersWard':
            const leaderWard = pieces.find(p => p.key === leaderKey);
            if (leaderWard) leaderWard.hasPriestsWard = true;
            break;

        case 'PrimalPower':
            if (isSnow) {
                 gameState.factionPassives.snow.ascension.wispPower = 1;
            } else {
                gameState.factionPassives.ash.ascension.lavaGlobPower = 3;
            }
            break;

        case 'Rampage':
            const brawler_r = pieces.find(p => p.key === brawlerKey);
            if (brawler_r) brawler_r.isRampaging = true;
            break;

        case 'ArcaneAttunement':
        case 'TerritorialClaim':
        case 'Vengeance':
        case 'HitAndRun':
        case 'RiftReinforcement':
        case 'EnergySiphon':
        case 'MagicalSupremacy':
        case 'TargetedWeakness': 
        case 'HomeFieldAdvantage': 
        case 'Martyrdom': 
            break;

        default:
            console.error(`Ascension Error: Unknown upgrade key: ${upgradeKey}`);
            return false;
    }

    return true;
}

export function executeAscensionChoice(gameState, choice) {
    if (!gameState.pendingAscension || gameState.factionPassives[gameState.pendingAscension.team].ascension.isChosen) return false;

    const { team, role } = gameState.pendingAscension;
    let upgradeKey;

    switch (role) {
        case 'Shaper': upgradeKey = choice === 'PathA' ? 'MasterOfCreation' : 'TerritorialClaim'; break;
        case 'Brawler': upgradeKey = choice === 'PathA' ? 'Rampage' : 'Vengeance'; break;
        case 'Skirmisher': upgradeKey = choice === 'PathA' ? 'AcrobaticTactics' : 'HitAndRun'; break;
        case 'Mystic': upgradeKey = choice === 'PathA' ? 'ArcaneAttunement' : 'RiftReinforcement'; break;
        case 'Siphoner': upgradeKey = choice === 'PathA' ? 'PrimalPower' : 'EnergySiphon'; break;
        case 'Mage': upgradeKey = choice === 'PathA' ? 'ElementalHarmony' : 'MagicalSupremacy'; break;
        case 'Striker': upgradeKey = choice === 'PathA' ? 'LethalPrecision' : 'TargetedWeakness'; break;
        case 'Warrior': upgradeKey = choice === 'PathA' ? 'UnstoppableForce' : 'HomeFieldAdvantage'; break;
        case 'Priest': upgradeKey = choice === 'PathA' ? 'LeadersWard' : 'Martyrdom'; break;
        default:
            console.error(`Ascension Error: Invalid role '${role}'`);
            return false;
    }

    if (applyUpgrade(gameState, team, upgradeKey)) {
        gameState.factionPassives[team].ascension.isChosen = true;
        gameState.pendingAscension = null;

        return true;
    }

    return false;
}