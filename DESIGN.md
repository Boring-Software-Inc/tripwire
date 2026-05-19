---
name: Tripwire
description: GitHub moderation platform that catches low-signal activity before it wastes maintainer time.
colors:
  blackout: "#0d0d0f"
  gunmetal: "#17171a"
  charcoal: "#202023"
  inner-wash: "#fafafa1a"
  border-line: "#27272a"
  hover-dim: "#18181b"
  hover-lift: "#25252a"
  text-primary: "#eeeeee"
  text-secondary: "#b4b4b4"
  text-muted: "#9f9fa9"
  text-tertiary: "#6e6e6e"
  button-muted: "#ffffff14"
  button-muted-hover: "#ffffff22"
  signal-blue: "#34a6ff"
  clear-green: "#67e19f"
  alert-red: "#f56d5d"
  warning-gold: "#d1bc00"
  chart-blue: "#118af3"
  chart-orange: "#df750c"
typography:
  display:
    fontFamily: "Playfair Display, Georgia, serif"
    fontSize: "clamp(2rem, 5vw, 3.5rem)"
    fontWeight: 500
    lineHeight: 1.1
  headline:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.25
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.46
  label:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 520
    lineHeight: 1.33
    letterSpacing: "-0.2px"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.signal-blue}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.signal-blue}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "36px"
  button-ghost-hover:
    backgroundColor: "{colors.charcoal}"
  button-muted:
    backgroundColor: "{colors.button-muted}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "32px"
  card-outer:
    backgroundColor: "{colors.charcoal}"
    rounded: "{rounded.xl}"
    padding: "4px"
  card-inner:
    backgroundColor: "{colors.inner-wash}"
    rounded: "10px"
    padding: "8px"
  input-default:
    backgroundColor: "{colors.charcoal}"
    textColor: "{colors.text-primary}"
    rounded: "10px"
    padding: "0 8px"
    height: "28px"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.md}"
    padding: "0 8px"
    height: "30px"
  nav-item-active:
    textColor: "{colors.text-primary}"
  chip-user:
    backgroundColor: "#212328"
    textColor: "#fafafa"
    rounded: "{rounded.sm}"
    padding: "2px 2px 2px 4px"
---

# Design System: Tripwire

## 1. Overview

**Creative North Star: "The Situation Room"**

A Pentagon operations center. Dark, serious, every screen showing only what demands a decision. The interface doesn't welcome you; it briefs you. Surfaces are flat and recessive. Color is rationed. When something lights up, it means something.

Tripwire's visual system is built on tonal layering, not decoration. Depth comes from stepping through four values of near-black (Blackout, Gunmetal, Charcoal, Inner Wash), not from shadows or gradients. The palette is restrained by doctrine: Signal Blue is the only saturated color in normal operation. Green, red, and gold appear only when the system has a verdict.

This is not Linear's polished calm. Not Better Auth's template energy. Not a monitoring wall with fifty metrics competing for attention. The Situation Room shows one thing at a time, clearly, and shuts up when there's nothing to report.

**Key Characteristics:**

- Dark-native. No light theme. Charcoal tonal layering for depth.
- Color is signal. Saturated hues appear only for actionable states.
- Tight, utilitarian spacing. No generous whitespace for its own sake.
- Serif display type (Playfair) for identity moments; Geist sans for everything functional.
- Flat by default. Shadows reserved for overlays that break the plane.

## 2. Colors

A restrained palette. Tinted near-blacks do the structural work. Saturated color is reserved for signal.

### Primary

- **Signal Blue** (#34a6ff): The system's voice. Links, active states, primary actions, focus rings. The only saturated color that appears without an event triggering it. Used sparingly; its rarity is the point.

### Tertiary

- **Clear Green** (#67e19f): Positive verdicts. Success states, upward trends, passing checks. Never decorative.
- **Alert Red** (#f56d5d): Negative verdicts. Errors, flagged contributors, blocked actions.
- **Warning Gold** (#d1bc00): Ambiguous signal. Thresholds approached, requires review.
- **Chart Blue** (#118af3): Data visualization primary. Distinct from Signal Blue at small sizes.
- **Chart Orange** (#df750c): Data visualization secondary.

### Neutral

- **Blackout** (#0d0d0f): The void. Page background, the base layer everything sits on.
- **Gunmetal** (#17171a): First elevation. Sidebar backgrounds, inset containers, recessed surfaces.
- **Charcoal** (#202023): Second elevation. Cards, inputs, popovers. The primary interactive surface.
- **Inner Wash** (#fafafa1a): Third elevation. A 10% white wash over Charcoal for nested card interiors and subtle lifts.
- **Border Line** (#27272a): The only visible edge. Dividers, card borders, input strokes. Barely there.
- **Hover Dim** (#18181b): Background shift on hover for sidebar and nav items.
- **Hover Lift** (#25252a): Slightly brighter hover for interactive surfaces.
- **Button Muted** (#ffffff14): Ghost button fill. 8% white.
- **Button Muted Hover** (#ffffff22): Ghost button hover. 13% white.
- **Text Primary** (#eeeeee): Body text, headings, anything that demands reading.
- **Text Secondary** (#b4b4b4): Supporting labels, descriptions, secondary information.
- **Text Muted** (#9f9fa9): Inactive nav items, timestamps, metadata.
- **Text Tertiary** (#6e6e6e): Disabled states, placeholders, the quietest text that's still legible.

### Named Rules

**The Signal Rule.** Saturated color means something happened. Blue is the system's voice. Green is a pass. Red is a flag. Gold is a maybe. If a color appears without conveying a verdict or enabling an action, remove it.

## 3. Typography

**Display Font:** Playfair Display (with Georgia fallback)
**Body Font:** Geist (with system-ui fallback)

**Character:** A serif/sans split that mirrors the product's dual nature: Playfair brings the identity (the eye, the wire, the surveillance metaphor), Geist does the work (labels, data, controls). Playfair appears only where the brand speaks; Geist handles everything else without drawing attention.

### Hierarchy

- **Display** (500, clamp(2rem, 5vw, 3.5rem), 1.1): Landing page headlines, hero moments. Playfair Display only. Never in the dashboard.
- **Headline** (600, 1.25rem/20px, 1.2, -0.01em): Page titles, section headings inside the app. Geist.
- **Title** (500, 1rem/16px, 1.25): Card titles, dialog titles, secondary headings. Geist.
- **Body** (400, 0.8125rem/13px, 1.46): The workhorse. All readable content, descriptions, chat messages. Max line length 65ch.
- **Label** (520, 0.75rem/12px, 1.33, -0.2px): Stat labels, metadata, nav items, chips. Tight tracking for small sizes.

### Named Rules

**The 13px Rule.** Body text is 13px, not 14px or 16px. The dashboard is dense and utilitarian. Larger body text wastes vertical space and softens the tone. 13px with 19px line-height is the sweet spot: readable without being generous.

## 4. Elevation

Flat by default. Depth is expressed through tonal stepping, not shadows.

Four tonal layers define the z-axis: Blackout (base) → Gunmetal (recessed) → Charcoal (interactive) → Inner Wash (nested). Each step is a subtle lightness increase. The eye reads depth without any blur or offset.

Shadows appear only when an element physically breaks the plane: popovers, dropdown menus, dialogs, toasts. These are the only surfaces that cast shadows, and the shadows are tight and dark.

### Shadow Vocabulary

- **Overlay** (`shadow-lg` with 5% opacity): Dialogs, dropdown menus, popovers. Diffuse, low-opacity. The overlay exists; it doesn't announce itself.
- **Button Press** (`inset-shadow` with black/8%): Active/pressed state on primary buttons. Pushes the surface inward.
- **Button Ambient** (`shadow-xs` with primary/24%): Primary buttons at rest cast a faint colored glow. The only decorative shadow permitted.

### Named Rules

**The Flat-By-Default Rule.** Surfaces are flat at rest. If you're reaching for `box-shadow`, the element had better be floating above the page (popover, dialog, toast). Tonal layering handles everything else.

## 5. Components

Utilitarian and precise. Compact sizing, tight spacing, minimal state changes.

### Buttons

- **Shape:** Gently rounded (8px radius), consistent across all variants.
- **Primary:** Signal Blue background, white text, 36px height, 12px horizontal padding. Faint blue glow at rest (`shadow-xs shadow-primary/24`). Inset white highlight on top edge (`inset-shadow white/16%`).
- **Hover / Focus:** Slight darkening on press. Inset black shadow on active (`inset-shadow black/8%`). Focus ring: 2px Signal Blue ring with 1px offset.
- **Ghost:** Transparent background, primary text color. Charcoal background on hover. No border.
- **Muted:** 8% white fill, primary text. 13% white on hover. Used for secondary actions in toolbars.
- **Destructive:** Alert Red background. Same shape and sizing as primary.
- **Sizes:** xs (28px), sm (32px), default (36px), lg (40px), xl (44px). Icon-only variants at matching square sizes.
- **Loading:** Text goes transparent, centered spinner overlays. Pointer events disabled.

### Cards / Containers

- **Nesting pattern:** Outer shell (Charcoal, 16px radius, 4px padding) → Inner surface (Inner Wash, 10px radius, 8px padding). This two-layer card is the signature container pattern.
- **Flat cards:** Some cards skip the nesting. Single layer: Charcoal background, Border Line stroke, 12px radius, 12px padding.
- **Hover:** Inner wash brightens to ~15% white on group hover.
- **No shadows.** Cards sit in the tonal layer; they don't float.

### Chips / Pills

- **User chips:** Dark fill (#212328), 4px radius, tight padding (2px vertical, 4px left). Inline avatar (14px, circular) with a faint white ring. 12px text.
- **Issue chips:** Slightly lighter fill (#2A2A2A), 5px radius, minimal padding. Used inline in chat.
- **User pills:** Full-round (pill radius), dark neutral fill, 1px border. Small avatar + 12px label.
- **Rule:** Chips are informational, never interactive. No hover state, no click handler.

### Inputs / Fields

- **Style:** Charcoal background, 10px radius, 28px height, 8px horizontal padding. No visible border at rest on dark surfaces; faint white/8% border on landing page inputs.
- **Focus:** Border brightens to white/20%. No glow, no ring expansion. Subtle.
- **Placeholder:** #999999. Quiet but legible.
- **Error / Disabled:** Error state uses Alert Red border. Disabled at 50% opacity.

### Navigation

- **Sidebar:** Fixed 233px width. Gunmetal-adjacent background. 2px horizontal padding.
- **Nav items:** 30px height, 8px radius, 8px horizontal padding. Text Muted at rest, Text Primary when active. Hover Dim background on hover.
- **Top nav:** 32px height items, 8px radius, 12px horizontal padding. 13px medium-weight text. Text Muted inactive, #FAFAFA active.
- **Workspace switcher:** 32px height, 8px radius, Charcoal background with 1px #333333 border.

### Dialogs

- **Backdrop:** Black at 32% opacity with subtle backdrop blur.
- **Content:** Popover background, 16px radius, large shadow (5% opacity). Max width 512px.
- **Entry:** Scale from 98% + fade in, 200ms duration.
- **Footer:** Separated by border-top, muted background at 72% opacity.

### Toasts

- **Position:** Configurable (six positions). Stacked with z-index layering.
- **Shape:** 8px radius. Popover background mixed darker per stack depth.
- **Animation:** Custom cubic-bezier (.22, 1, .36, 1) for smooth slide-in. Direction-aware swipe dismiss.
- **Icons:** Color-coded by type. Spinning loader for async states.

## 6. Do's and Don'ts

### Do:

- **Do** use tonal layering (Blackout → Gunmetal → Charcoal → Inner Wash) for depth. Four steps maximum.
- **Do** keep body text at 13px/19px line-height. The dashboard is dense on purpose.
- **Do** use Signal Blue exclusively for interactive elements and system voice. It earns its presence.
- **Do** use the two-layer card pattern (Charcoal shell + Inner Wash surface) for primary content containers.
- **Do** respect `prefers-reduced-motion`. Disable landing page animations (3D terminal, Space Invaders, CRT effects) when the preference is set.
- **Do** use Playfair Display only on the landing page and brand moments. Never in the dashboard UI.
- **Do** keep shadows tight and dark on overlays. If the shadow is visible from across the room, it's too much.

### Don't:

- **Don't** introduce a light theme. Tripwire is dark-native. The tonal palette breaks in light mode.
- **Don't** use saturated color decoratively. Green, red, and gold are verdicts. Blue is the system's voice. No colored backgrounds for vibes.
- **Don't** look like Linear. No smooth gradients, no polished calm, no "designed for designers" energy. Tripwire is rougher and more utilitarian.
- **Don't** look like Better Auth. No template energy, no generic SaaS patterns, nothing that could be any product.
- **Don't** use border-left or border-right greater than 1px as colored accent stripes on cards, alerts, or list items.
- **Don't** use gradient text (background-clip: text with gradient backgrounds).
- **Don't** use glassmorphism as a default surface treatment. The landing page's inner-wash overlay is the limit.
- **Don't** build the hero-metric template (big number, small label, gradient accent). Stat cards exist but stay flat and quiet.
- **Don't** add generous whitespace between elements. The interface is compact. Padding is earned, not given.
- **Don't** use em dashes in UI copy. Use commas, colons, semicolons, periods, or parentheses.
