# Personal OS Visual Redesign

## Design read

Reading this as: a redesign overhaul of a personal operating system for a design-conscious solo technical operator, with an Awwwards-influenced dark product language, leaning toward Radix Themes, bespoke CSS, and Motion.

## Dials

- `DESIGN_VARIANCE: 8`
- `MOTION_INTENSITY: 7`
- `VISUAL_DENSITY: 5`

The interface remains a daily product rather than a marketing site. Visual variance is concentrated in the shell, dashboard hero, page composition, and key state surfaces. Dense working data stays predictable and readable.

## Audit

### Preserved

- Existing routes, navigation labels, workflows, form fields, and accessibility semantics.
- Human approval as the final Codex gate.
- Light, dark, and system themes.
- Radix Themes and Phosphor icons as the only component and icon systems.

### Retired

- Tiny typography across almost every information level.
- A 248px text-heavy sidebar.
- Repeated rectangular cards with identical visual weight.
- Weak page openings and flat metric rails.
- Minimal hover-only feedback with no route or state motion.
- Sage and cyan styling that made the product look like a generic admin template.

## Reference extraction

- [Morrow Bento Grid](https://www.awwwards.com/inspiration/morrow-bento-grid-morrow-chat-with-your-todos): asymmetric grouping and strong product framing.
- [Siena product interface](https://www.awwwards.com/inspiration/web-product-interface-siena-empathic-ai-cx-agent): dark product depth and restrained warm accent.
- [Awwwards Interaction Design](https://www.awwwards.com/websites/interaction-design/): motion as navigation, state, and hierarchy feedback.
- [Raycast](https://www.raycast.com/): compact command-system character and keyboard-tool clarity.

These are inspiration sources, not copied systems or assets.

## Visual system

- Typography: self-hosted Geist Variable, with system Chinese and monospace fallbacks.
- Palette: cold graphite neutrals with one signal-orange accent. Status colors remain semantic rather than decorative.
- Shape rule: 18-26px product surfaces, 12-14px controls, full-pill status indicators.
- Navigation: compact command rail with an animated shared active plane and contextual hover labels.
- Dashboard: asymmetric split hero, animated focus orbit, count-up metrics, and 12-column Bento composition.
- Material: translucent panels only where hierarchy benefits, with solid fallbacks for reduced transparency.

## Motion rationale

- Route reveal communicates a change of working context.
- Shared navigation plane shows location continuity.
- Focus orbit communicates the live execution loop and current focus count.
- Count-up metrics call attention to refreshed data.
- Button and panel movement acknowledges pointer actions.
- Radar breathing and rotation communicate active research capability.

All continuous and transform-based motion is disabled or collapsed for `prefers-reduced-motion`.

## Responsive behavior

- Below 900px, the command rail becomes an opaque modal navigation surface.
- Below 680px, the dashboard hero becomes a strict single-column composition.
- Task columns retain intentional horizontal scroll with snap points.
- Wide data groups convert to stacked rows or explicit horizontal rails.
- The document itself has no horizontal overflow at 390px.
