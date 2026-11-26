/**
 * Mythic Territories - Client Services Index
 * Unified barrel module aggregating client services, helpers, and utilities.
 */

// Firebase & Authentication
export * from './firebase.js';

// Territory & Voronoi Area calculations
export * from './gameTerritory.js';

// GSAP dynamic loader
export * from './gsap.js';

// Mobile Haptics feedback
export * from './haptics.js';

// Motion Accessibility Preferences
export * from './motionPreference.js';

// Patch Notes & Version Tracking
export * from './patchTracking.js';

// Room Codes & Session Management
export * from './roomCode.js';

// Procedural Sprite & Cast Animator
export * from './spriteAnimator.js';

// Multiplayer Service Dynamic Loader (preserves code splitting)
export const loadMultiplayer = () => import('./multiplayer.js');
