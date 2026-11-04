# Icon theme controls — 27 October 2026

Application source: bb89f612cf86f92fef95f57f0fa2a858b9930a8d, based on main f83a34c6a199f137569ffab1ab4b65c8ea94987c. Later changes contain verification evidence only.

The theme dropdown is replaced by a shared three-way icon control in the workspace header and Preferences. Sun selects Light, moon selects Dark, and monitor selects Auto. Auto follows device colour-scheme changes, remains visibly selected when the resolved appearance changes, and persists across reload. The existing `system` storage value and theme tokens are preserved. Manual Light/Dark remain fixed until Auto is selected.

The header uses compact icons with tooltips; Preferences includes text labels and the explanation that Auto follows the device. Native buttons expose radio selection, the group supports keyboard focus/selection, and an already selected choice cannot be cleared. Active styling follows aria-checked. The same control serves all workspace tabs, and its background transition respects the existing reduced-motion rules.

Verification:

- `pnpm exec tsc --noEmit`: passed without diagnostics.
- `pnpm test`: 39 unit/component plus 4 deployment tests passed; [log](unit.txt).
- `VITE_BASE_PATH=/ pnpm build`: passed; [log](build.txt).
- `pnpm exec playwright test --workers=1 --reporter=line`: [serial regression](browser.txt), 95 passed and one mobile lazy globe readiness assertion timed out locally. All theme-specific checks passed, including actual selected-icon colour in both palettes, automatic device changes, manual override, reload, keyboard interaction and Preferences/header synchronization.
- The unchanged timed-out case passed in isolation using `pnpm exec playwright test e2e/graphics.spec.ts --grep 'graphical overview keeps' --project=mobile-chromium --workers=1 --reporter=line`; [recheck](globe-recheck.txt). Actual WebGL rendered, orbited and zoomed in both themes, then fell back after context loss. Assertions and timeouts were not relaxed. Required remote CI remains the final full-suite gate before merge.
- Controls and account/data actions remain inside the viewport at 360, 390, 768, 820, 901, 1100 and 1280 pixels. Screenshots of Preferences/header were opened and inspected on desktop and mobile in both themes.

[Desktop light](preferences-chromium-light.png), [desktop dark](preferences-chromium-dark.png), [mobile light](preferences-mobile-chromium-light.png), [mobile dark](preferences-mobile-chromium-dark.png).
