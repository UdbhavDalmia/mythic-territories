# Ash Tyrant Visual Overhaul & Proclamation Removal

## Part 1: Remove Tyrant's Proclamation (6 files)

### [MODIFY] constants.js
- Remove `TyrantsProclamation` from `ABILITY_VALUES` (line 104)
- Remove the entire `TyrantsProclamation` ability block from `ABILITIES` (lines 598–611)

### [MODIFY] script.js
- Remove `'TyrantsProclamation': '...'` entry from `getAbilityDescription` map (line 868)

### [MODIFY] ai.worker.js
- Change `abilityKey === 'TyrantsProclamation'` heuristic line 586 to only check `KingsEdict`

### [MODIFY] rules.html
- Remove the `<li>` for Tyrant's Proclamation (lines 215–216)

### [MODIFY] notes.html
- Remove mention of `Tyrant's Proclamation` (line 133 area)

---

## Part 2: Reign of Fire Animation

**Concept**: Fire streams shoot from the Ash Tyrant's mouth toward the target zone. Each enemy hit shows sparks + burning embers + scorched flash. Each ally hit shows a brief damage flash but then gets an inner red/orange glow (blood boiling).

### [MODIFY] effects/animations.js
Add two new exported functions:
- `spawnReignOfFireEffect(tyrant, targetR, targetC, gameState)` — Creates N=6 fire "projectile streams" that travel from the Tyrant toward the target, each slightly offset. On impact, spawns:
  - Orange shockwave
  - Ember scatter particles at target (enemy = red sparks, ally = orange glow dots)
- `drawReignOfFireAnimations(ctx, gameState)` — Per-frame draw of the projectile arcs and impact particles

### [MODIFY] effects.js
Export `spawnReignOfFireEffect` and `drawReignOfFireAnimations` forwarding to `Anim.*`

### [MODIFY] script.js
Add case `'ReignOfFire'` in `playAnimation()` to call `Effects.spawnReignOfFireEffect(...)`

### [MODIFY] shared/logic.js (if needed)
Emit `ANIMATION` event of type `'ReignOfFire'` with `tyrantId`, `targetR`, `targetC` after `ReignOfFire` ability effect

### [MODIFY] script.js `animationLoop`
Add `if (Effects.drawReignOfFireAnimations) Effects.drawReignOfFireAnimations(gameState);`

---

## Part 3: Death Meteor Animation

**Concept**: Eclipse darkens the canvas, a massive fireball plunges from off-screen onto the Tyrant, screen shakes, radial explosion. Permanent scorch scar already rendered in ui.js (existing). Tyrant gets a red phoenix-shield glow (Part 4).

### [MODIFY] effects/animations.js
Add:
- `spawnDeathMeteorEffect(piece, gameState)` — Sets up:
  - `gameState.deathMeteorAnim`: meteor position, life, eclipse phase, shockwave list
- `drawDeathMeteorAnimations(ctx, gameState)` — Renders:
  1. Eclipse: dark radial gradient overlay on full canvas
  2. Meteor projectile descending from top to piece
  3. On impact: `triggerScreenshake(15, 400)`, large multi-ring shockwave, ember burst
  4. Permanent scar (already handled by existing `deathMeteors` board overlay)

### [MODIFY] effects.js
Export `spawnDeathMeteorEffect`, `drawDeathMeteorAnimations`

### [MODIFY] script.js
- Add case `'DeathMeteor'` in `playAnimation()`
- Add `if (Effects.drawDeathMeteorAnimations) Effects.drawDeathMeteorAnimations(gameState);` in animationLoop

### [MODIFY] shared/logic.js / shared/utils.js
Emit `ANIMATION` event `'DeathMeteor'` with `pieceId` after Death Meteor triggers (in `applyAoeLethalPassives`)

---

## Part 4: Ash Tyrant Revival Shield

**Concept**: After Death Meteor triggers, the Ash Tyrant is surrounded by a reddish circular energy shield (like the reference image — a bright circular glow/halo without any character shown, in crimson/orange tones).

### [MODIFY] ui.js
In `drawPiece()`: When `piece.key === 'ashAshTyrant'` and `piece.deathMeteorCooldown > 0` and it was recently triggered (flag: `piece.hasDeathMeteorActive`), draw a multi-ring glowing red shield around the piece:
- Outer pulsing crimson ring (`rgba(220, 30, 0, ...)`)
- Inner amber fill halo
- Rotating energy orblets circling the ring
- Shield fades/shrinks as cooldown ticks down
