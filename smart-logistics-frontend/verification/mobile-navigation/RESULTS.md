# Mobile sidebar navigation verification

Application commit: `226764e1b36886bdb06aa144b7c6bd730ee435ee`.

The narrow Preferences theme row widened the document and moved Menu partly off-screen. Navigation also focused the page behind its sticky header. The initial reproduction failed both checks (`before.txt`).

The mobile header now has a labelled Menu button and a separate row for workspace controls. The drawer uses the dynamic viewport height, reserves space for its brand and footer, and scrolls its navigation independently on short screens. Its groups open expanded, so a collapsed desktop group cannot hide destinations. The Preferences theme row stacks on narrow screens. Navigation restores the top of the page and focuses main content without scrolling it behind the header.

Validation:

- TypeScript: `pnpm exec tsc --noEmit` passed (exit 0; `types.txt`).
- Unit/component tests: 39 passed; deployment tests: 4 passed (`unit.txt`).
- Targeted navigation browser tests: 6 passed across desktop Chromium and mobile Chromium projects (`targeted.txt`).
- Complete browser regression: 102 passed, no failures (`browser.txt`).
- Production root build and deployment verification passed, including 36 browser chunks (`build.txt`). The existing large-chunk advisory remains.
- All eight permitted administrator destinations were opened. Standard-user navigation still shows only permitted destinations. Escape and automatic drawer closing remain covered.
- Inspected light/dark drawer captures at 320×568 and 390×667, and landscape at 667×320. Tests additionally cover 360×640, hit testing, viewport containment and scrolling every destination into view. Portraits fit all links at these sizes; short landscape scrolls within the navigation while the footer remains reachable.
- Inspected the closed mobile header in both themes; included captures use intercepted authorized test records, not production data.

Existing grouped labels, routes, current-tab highlighting, access rules, brand tokens, Light/Dark/Auto behaviour and Live/Demo isolation remain in place. No production provisioning or membership assignment was performed.
