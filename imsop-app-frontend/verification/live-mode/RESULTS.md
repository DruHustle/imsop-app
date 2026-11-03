# Live data selection — 27 October 2026

Application source: 8ce145cc10761ca1b220a09840de89e9c4effdb3, based on merged main ecd3ef88a3517e094cd2027da049b8a3b4c38fd2. Subsequent changes are screenshot setup and verification only.

Live was disabled for a demo identity. Selecting Live now ends that local demo session and opens an explicit workspace sign-in, preserving the current route/filters. Real sessions switch directly. Live sign-in uses the API regardless of email domain, removes any mock credential, and explicitly selects Live for the returned account instead of reusing its previous Demo preference. Demo shortcuts remain deliberate and labelled.

Live removes the demo notice, fixed demo timestamp and fixture counts immediately, including while loading and on a workspace-required response. Live refresh/reload stays Live. Source read age clears when changing mode. Live source evidence remains visible. No workspace, ownership or membership is inferred or provisioned, and no fixture is substituted after a Live error. Production provisioning remains pending verified assignments under the existing owner instruction.

Validation:

- `pnpm exec tsc --noEmit`: passed without diagnostics.
- `pnpm test`: 39 unit/component plus 4 deployment tests passed; [log](unit.txt).
- `VITE_BASE_PATH=/ pnpm build`: passed; [log](build.txt).
- `pnpm exec playwright test --workers=2 --reporter=line`: 92 desktop/mobile checks passed; [log](browser.txt).
- Six targeted cases rechecked after clearing capture focus/scroll; [log](targeted-browser.txt). They cover demo-to-Live sign-in, API routing for a demo-associated email domain, prior Demo preference, filtered return, delayed source load, reload and missing membership. API responses in these checks are isolated browser fixtures, not production records.

Screenshots were opened and inspected: Live source and sign-in handoff on desktop/mobile in both themes. Existing tokens and the restored sign-in background remain. No backend or production data writes were needed.
