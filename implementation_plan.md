# Reduce Rendering Lag & Brainstorm Frost Lord Animations

This plan addresses two issues: optimizing existing visual routines that cause frame drops (lag), and designing new premium animations for the Frost Lord.

## 1. Territory Rendering Optimization
Currently, the territory renderer generates a cache key by converting two Sets (up to ~100 items each) into Arrays, sorting them, and joining them into strings on every single frame. This string manipulation generates heavy garbage collection overhead and cpu spiking.

**Proposed Change:**
We will replace the expensive `[...snowSet].sort().join('|')` with a simple checksum/hash approach. We can loop through the Sets to generate a numeric hash, or even simpler, combine the sizes of the sets with a simple XOR of their string values. A highly optimized way is:
```javascript
let hash = trailLen;
snowSet.forEach(v => hash += v.charCodeAt(0) * 10 + v.charCodeAt(2));
ashSet.forEach(v => hash -= v.charCodeAt(0) * 10 + v.charCodeAt(2));
const newKey = snowSet.size + '-' + ashSet.size + '-' + hash;
```
This reduces the operation from `O(N log N)` with massive string allocation to `O(N)` with zero allocations.

## 2. Movement Animation Lag Optimization
Currently, piece movement in `ui.js` uses frame-dependent exponential decay:
`vis.x += dx * 0.22;`
At 60 FPS, this moves the piece 22% of the way each frame. However, if the game lags and drops to 30 FPS, the piece will take twice as much *real time* to reach its destination, making the game feel extremely sluggish.

**Proposed Change:**
Implement a `dt` (delta time) based frame-independent decay.
We will track `lastVisualUpdateTime` and compute `dt`.
```javascript
const factor = 1.0 - Math.exp(-0.015 * dt); // Equivalent to 0.22 at 16.6ms
vis.x += dx * factor;
vis.y += dy * factor;
```
This ensures the pieces arrive at their destinations in the exact same amount of real-time, regardless of frame drops!

---

## 3. Frost Lord Animation Ideas

> [!TIP]
> The Frost Lord has two main abilities that could use premium animations: **Spike Rain** (Active) and **Help From Above** (Veteran Cheat-Death Passive). 

Here are the ideas we can implement:

### Idea A: Spike Rain (Active Ability)
Currently, Spike Rain just draws a glowing circle on the ground.
**Animation Idea:**
1. **The Cast:** The Frost Lord raises their weapon, emitting a bright blue pulse.
2. **The Projectiles:** 5-8 sharp icicle projectiles spawn off-screen (above the canvas) and streak diagonally downwards towards the target zone.
3. **The Impact:** When the icicles hit the target zone, we trigger a medium `screenshake`, and a burst of shattered ice particles spray outwards from the impact center. A lingering frost decal is left on the ground.

### Idea B: Help From Above (Veteran Cheat-Death Passive)
When the Frost Lord takes lethal damage, they survive at 1 HP. Currently, there is little to no visual feedback for this game-changing event.
**Animation Idea:**
1. **The Intervention:** Just as the lethal damage lands, time seems to freeze (we can slow down or pause other animations briefly).
2. **The Guardian:** A massive, ethereal "Spectral Valkyrie" or "Giant Ice Shield" briefly flashes above the Frost Lord.
3. **The Shatter:** The shield/valkyrie violently shatters the incoming attack, creating a blinding flash (`drawFlashEffects`) and an intense `screenshake`. The Frost Lord is enveloped in a restorative snowy aura for the next 2 seconds.

> [!IMPORTANT]
> Let me know if you approve of the rendering optimizations, and which of the Frost Lord animation ideas you'd like me to implement! I can implement both ideas for the Frost Lord if you like them.
