/* ==========================================================================
   SECTION 1: ASCENSION UPGRADE APPLICATION
   Applies the chosen Ascension upgrade to the gamestate or specific pieces.
   ========================================================================== */
import * as C from "./constants.js";

function applyUpgrade(gameState, team, upgradeKey) {
  gameState.factionPassives[team].ascension[upgradeKey] = true;

  const isSnow = team === "snow";
  const pieces = gameState.pieces;
  const findKey = (role) =>
    pieces.find((p) => p.key === C.TEAM_PIECES[team][role]);

  const upgradeHandlers = {
    AcrobaticTactics: () => {
      const p = findKey("Striker");
      if (p) p.isAcrobat = true;
    },
    ElementalHarmony: () => {
      const p = findKey("Priest");
      if (p) p.isElementalHarmony = true;
    },
    LethalPrecision: () => {
      const p = findKey("Skirmisher");
      if (p) p.power = (p.power || 1) + 1;
    },
    UnstoppableForce: () => {
      const p = findKey("Warrior");
      if (p) p.isSteadfast = true;
    },
    LeadersWard: () => {
      const p = findKey("Tyrant");
      if (p) p.hasPriestsWard = true;
    },
    Rampage: () => {
      const p = findKey("Brawler");
      if (p) p.isRampaging = true;
    },
    PrimalPower: () =>
      isSnow
        ? (gameState.factionPassives.snow.ascension.wispPower = 1)
        : (gameState.factionPassives.ash.ascension.lavaGlobPower = 3),
    MasterOfCreation: () => {
      const p = findKey("Tyrant");
      if (p) {
        p.hasMasterOfCreation = true;
        p.isVeteran = true;
        p.secondaryAbilityKey = isSnow ? "GlacialWall" : "UnstableGround";
        p.secondaryAbilityCooldown = 0;
      }
    }
  };

  // Execute the handler if it exists; otherwise assume it's a pure passive handled elsewhere
  if (upgradeHandlers[upgradeKey]) upgradeHandlers[upgradeKey]();
  return true;
}

/* ==========================================================================
   SECTION 2: ASCENSION CHOICE EXECUTION
   Routes the player's choice (Path A or Path B) based on the sacrificed role.
   ========================================================================== */
export function executeAscensionChoice(gameState, choice) {
  if (
    !gameState.pendingAscension ||
    gameState.factionPassives[gameState.pendingAscension.team].ascension
      .isChosen
  )
    return false;

  const { team, role } = gameState.pendingAscension;
  const choiceMap = {
    Shaper: ["MasterOfCreation", "TerritorialClaim"],
    Brawler: ["Rampage", "Vengeance"],
    Skirmisher: ["AcrobaticTactics", "HitAndRun"],
    Mystic: ["ArcaneAttunement", "RiftReinforcement"],
    Siphoner: ["PrimalPower", "EnergySiphon"],
    Mage: ["ElementalHarmony", "MagicalSupremacy"],
    Striker: ["LethalPrecision", "TargetedWeakness"],
    Warrior: ["UnstoppableForce", "HomeFieldAdvantage"],
    Priest: ["LeadersWard", "Martyrdom"]
  };

  if (!choiceMap[role]) return false;
  const upgradeKey = choiceMap[role][choice === "PathA" ? 0 : 1];

  if (applyUpgrade(gameState, team, upgradeKey)) {
    gameState.factionPassives[team].ascension.isChosen = true;
    gameState.pendingAscension = null;
    return true;
  }
  return false;
}
