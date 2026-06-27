---
name: Mythic Obsidian
colors:
  surface: '#0e131d'
  surface-dim: '#0e131d'
  surface-bright: '#343944'
  surface-container-lowest: '#090e17'
  surface-container-low: '#171c25'
  surface-container: '#1b2029'
  surface-container-high: '#252a34'
  surface-container-highest: '#30353f'
  on-surface: '#dee2f0'
  on-surface-variant: '#c0c7cf'
  inverse-surface: '#dee2f0'
  inverse-on-surface: '#2c303b'
  outline: '#8a9299'
  outline-variant: '#40484e'
  surface-tint: '#89ceff'
  primary: '#c9e6ff'
  on-primary: '#00344d'
  primary-container: '#89ceff'
  on-primary-container: '#00587f'
  inverse-primary: '#056490'
  secondary: '#ffb3ad'
  on-secondary: '#68000a'
  secondary-container: '#a40217'
  on-secondary-container: '#ffaea8'
  tertiary: '#ffdf95'
  on-tertiary: '#3e2e00'
  tertiary-container: '#e9c25f'
  on-tertiary-container: '#684f00'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#c9e6ff'
  primary-fixed-dim: '#89ceff'
  on-primary-fixed: '#001e2f'
  on-primary-fixed-variant: '#004c6e'
  secondary-fixed: '#ffdad7'
  secondary-fixed-dim: '#ffb3ad'
  on-secondary-fixed: '#410004'
  on-secondary-fixed-variant: '#930013'
  tertiary-fixed: '#ffdf95'
  tertiary-fixed-dim: '#e9c25f'
  on-tertiary-fixed: '#251a00'
  on-tertiary-fixed-variant: '#594400'
  background: '#0e131d'
  on-background: '#dee2f0'
  surface-variant: '#30353f'
  ice-light: '#A5F3FC'
  magma-core: '#EF4444'
  ember-gold: '#E8C15E'
  void-black: '#0B1019'
  pure-snow: '#FFFFFF'
  glass-surface: rgba(11, 16, 25, 0.7)
typography:
  display-lg:
    fontFamily: Libre Caslon Text
    fontSize: 72px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: 0.2em
  display-lg-mobile:
    fontFamily: Libre Caslon Text
    fontSize: 40px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: 0.15em
  headline-md:
    fontFamily: Libre Caslon Text
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: 0.1em
  stat-value:
    fontFamily: Space Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Fira Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Fira Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-caps:
    fontFamily: Space Grotesk
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.15em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  margin-mobile: 16px
  margin-desktop: 48px
  gutter: 24px
  container-max: 1440px
---

## Brand & Style
Mythic Obsidian is a high-fantasy, cinematic design system that blends **Glassmorphism** with **high-contrast elemental accents**. The brand evokes a sense of ancient power, mystery, and tactical depth, targeting a gaming audience that appreciates immersive, atmospheric interfaces.

The aesthetic is defined by "Obsidian Glass"—dark, semi-transparent surfaces with heavy backdrop blurs—contrasted against vibrant "Mana" glows (Ice, Magma, and Gold). Visuals should feel weightless yet significant, utilizing floating animations and pulse effects to simulate a living, magical artifact.

## Colors
The palette is rooted in **Void Black** (#0B1019), serving as the canvas for three primary elemental currents:
- **Ice Light (#A5F3FC):** Used for tactical, calm, or "Pass & Play" interactions.
- **Magma Core (#EF4444):** Reserved for high-energy actions, multiplayer modes, and aggressive UI states.
- **Ember Gold (#E8C15E):** The primary interactive accent used for calls to action, legendary status, and navigation highlights.

Gradients should be used sparingly for text and borders to simulate light refracting through magical glass. Always use high-transparency overlays (30-60% opacity) for container backgrounds to maintain environmental immersion.

## Typography
The typography system uses a tri-font approach to balance theme and legibility:
- **Display & Headlines:** Use a serif with historical weight (e.g., Libre Caslon Text or Almendra SC). All-caps with wide letter spacing (0.1em - 0.2em) is mandatory for "Legendary" titles.
- **Data & Labels:** Use **Space Grotesk**. Its technical, geometric nature provides a "tactical overlay" feel for stats, buttons, and short labels.
- **Body Text:** **Fira Sans** ensures maximum readability for rulebooks and flavor text, maintaining an open, approachable feel amidst the dark theme.

## Layout & Spacing
The system utilizes a **fixed-width container model** (max 1440px) with fluid internal margins. 
- **Rhythm:** A 4px base unit is used for all internal padding.
- **Safe Zones:** Desktop layouts require a 48px horizontal margin to prevent UI elements from clashing with edge-of-screen environmental effects. 
- **Modals:** Modal content is centered both vertically and horizontally, utilizing a 1px border-box to define the interaction area against the blurred backdrop.

## Elevation & Depth
Depth is created through **Backdrop Filtering** and **Chromatic Shadows**:
1.  **Level 0 (Background):** Full-screen environmental art with a slow-zoom animation and a dark gradient overlay.
2.  **Level 1 (Surface):** "Glass Obsidian" layers with 24px blur and `rgba(11, 16, 25, 0.7)` background.
3.  **Level 2 (Interaction):** Hover states trigger colored "Glow" shadows (30px spread) matching the elemental theme of the component (e.g., a cyan glow for Ice cards).
4.  **Level 3 (Overlays):** Modals use an 80% opacity Void Black overlay with a 12px backdrop blur to isolate the user from the main game state.

## Shapes
Shapes are modern yet sturdy. While the base containers use a **rounded-xl (1.5rem)** corner for a premium, hardware-like feel, smaller buttons and interactive chips use **rounded-lg (1rem)**. Gradients on borders should be 1px thick to maintain a "sharp glass" edge.

## Components
- **Primary Buttons (Hero):** Large padding (20px-24px vertical), Ember Gold text, and a persistent `pulse-glow` animation. Borders are 30% opacity Ember Gold, increasing to 60% on hover.
- **Elemental Cards:** Glass Obsidian containers with a 1px `outline/20` border. On hover, the border color and a bottom accent bar (4px height) should transition to the card's specific elemental color (Ice, Magma, or Gold).
- **Icons:** Use Material Symbols (Outlined) contained within circular, low-opacity tinted backgrounds (10% opacity of the elemental color).
- **Modals:** Large-scale containers with a headline in Ember Gold and a bottom-aligned "Return" button with a slide-left transition effect on its icon.
- **Gradients:** Text gradients are reserved exclusively for `Display-LG` titles, moving from Primary (Ice) to Tertiary (Gold/Magma).