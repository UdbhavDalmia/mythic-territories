/**
 * Frost Lord Animation Metadata & Configuration
 * Preserves animation durations, sprite frame setups, and GSAP parameters.
 */

export const FROST_LORD_ANIMATION_CONFIG = {
  // Sprite configuration (for future sprite sheet animations)
  sprite: {
    portrait: "/units/frost-lord.webp",
    walkSheet: null, // Ready for future walk sprite strip
    frames: 1,
    frameRate: 140, // ms per frame
    canvasSize: { width: 350, height: 350 }
  },

  // In-engine movement timings
  movement: {
    baseDuration: 0.45,
    perCellDistanceMultiplier: 0.22,
    ease: "power1.inOut"
  },

  // Ability visual hooks
  visuals: {
    shieldTheme: "snow",
    shieldBreakColor: "rgba(0, 191, 255, 0.9)",
    fogColor: "rgba(180, 220, 255, 0.4)"
  }
};
