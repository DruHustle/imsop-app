# IMSOP visual reference and implemented layouts

The two IMSOP board sheets supplied by the user on 27 October 2026 are the design reference. Layouts retain the navy sidebar, cyan active tab/accent, compact sans typography, light bordered panels, grouped navigation and consistent spacing. Sidebar route identity is exact; only the current tab is highlighted. Group disclosure buttons, mobile drawer, theme/mode selectors, profile/preferences and notifications are functional.

Eight shared-component workspaces:

1. Overview: compact calculated metrics, creation-time chart, shipment map/globe, status donut, actionable exception queue, query handoff and recorded recent activity.
2. Shipments: filters, list/map, stable record links and a closeable record preview; mobile cards retain visible actions.
3. Orders: source-precise amounts, filters/pagination and a selected-order preview. Unknown currencies remain explicit.
4. Analytics: three calculated metrics, carrier comparison bars and actual-arrival delivery chart; original-promise rate definition is expandable. No illustrative series is copied.
5. Recommendations: review queue beside a case workspace, ownership, notes, acknowledgement/resolution and audit. Live actions persist in PostgreSQL; labelled demo actions persist only on this device.
6. Assistant: reviewed queries, deterministic exact record retrieval, multi-record comparison table, source time and explicit missing context. No automatic send or operational execution.
7. Service health: observed readiness/check count/time, current service table and the bounded history of checks actually performed. Carrier health remains unknown.
8. Integrations: sanitized source cards, working requirement disclosures and recent stored observations. Configuration never becomes an unsupported connectivity claim.

Reusable components include PageHeader, Panel, Metric, StatusBadge, SourceNote/SourceState, Notice, RecordPreview, StatusDistribution, EvidenceTimeline, DeliveryTrend and IntegrationCard. All business figures derive from the selected authorized dataset or clearly labelled demo records. Schema/provenance explanations are contextual Source details.

Current screenshots and the visual-inspection record are in `verification/remediation/RESULTS.md`; historical screenshot files remain untouched. Desktop, narrow desktop and mobile are checked in both themes, including long-label fixtures kept in tests.

The existing colour tokens remain authoritative: light primary `#087d92`, dark primary `#5ed3e4`, light background `#f3f6fa`, dark background `#0d1725`, and theme-specific sidebar `#112338` / `#101c2c`. Chart/notice colours derive from existing theme/semantic tokens. Light, Dark and System selection/persistence are unchanged; system changes are observed. The boards do not replace IMSOP’s palette.


## Graphical workspaces — 27 October follow-up

Keep the existing palette and Light/Dark/System tokens. Visual structure is specific to the operational question: Overview creation-area chart, status donut and geographic command centre; Shipments location view and recorded-event chronology/replay; Orders current-state fulfilment stages and actual receiving quantities; Analytics carrier comparisons and actual-arrival performance; Recommendations exception evidence lanes and clearly proposed review ordering; Assistant linked record context; Service health a logical check topology; Integrations configuration/observation flow. Shared controls, maps and record links repeat only where their function is the same.

The Overview uses a UTC creation cohort, default last 30 days (fixed demonstration clock only in Demo mode). Date scope controls, status selection, map locations, charts, metrics and record links stay synchronized. Actual-arrival series requires explicit timestamps. Daily/weekly/monthly/yearly buckets adapt to the available range; missing creation evidence is disclosed. There are no invented percentage changes or historical status sparklines. Only the creation KPI uses a real creation-history sparkline. Proportional indicators describe the selected current records.

The keyless basemap bundles public-domain Natural Earth geography; provenance is in client/src/assets/NATURAL_EARTH.md. Lazy WebGL globe supports orbit, zoom, focus/selection and keyboard controls using valid source coordinates. Rendering or provider failure retains the flat map and records. Warehouse/container/asset models and dimensions are absent from the current contracts, so no spatial model is invented. Historical playback steps through explicit event observations in the current bounded page, offers pause/manual stepping and never interpolates routes or carries forward missing positions. Demo and Live remain explicit; live failure never selects fixtures.

Mobile keeps compact KPIs, a readable chart, expandable map and accessible exception actions. HTML legends, selectors, summaries and tables provide keyboard/text alternatives. Charts have themed tooltips. Motion is restrained, no globe auto-rotation runs, replay starts only by explicit action, and reduced-motion preferences are respected. Existing role/session/workspace constraints and 10,000 matching-record cap remain enforced.
