# Implementation plan and fidelity gates

## Milestone 0 — facts before assumptions (in progress)
- [x] Identify target: 1996 Japanese P1 rather than the P2 or new Gen1.
- [x] Record controls, icon inventory, basic needs and clock behaviors.
- [x] Record region/reissue differences.
- [ ] Reconcile primary 1996 printed manual against current Gen1 manual.
- [ ] Collect permission-safe reference photos/audio traces from a physical P1.
- [ ] Transcribe exact transition criteria and per-character timers with confidence scores.

## Milestone 1 — interaction prototype (in progress)
- [ ] Static monochrome 32×16 rendering area with independently-drawn provisional character.
- [ ] A/B/C screen controller with keyboard and touch-compatible buttons.
- [ ] Setup clock, hatch, 8 indicators, health pages, food and light submenus, left/right game, medicine, discipline, cleaning.
- [ ] Deterministic time stepping with offline catch-up and save/load.
- [ ] Automated tests for controls, hatch, food, heart caps, discipline, minigame and evolution.
- [ ] UI accessibility labels and reduced-motion options.

## Milestone 2 — historical P1 correctness
- [ ] Implement exact original P1 data tables: all characters, evolution tree, sleep and heart loss rates, optimal/poor care outcomes.
- [ ] Replace provisional lifecycle and care intervals with measured rules.
- [ ] Recreate all interaction state machine screens and confirmation/cancel behavior.
- [ ] Verify attention expiry vs false discipline calls; minute-level replay.
- [ ] Verify original Japanese vs international changes; avoid rerelease rules.

## Milestone 3 — audiovisual fidelity
- [ ] Research resolution and all frame bitmaps; build *independently-drawn / rights-cleared* sprite atlas.
- [ ] Verify LCD pixel aspect, icon art, background printing, physical shell measurements.
- [ ] Implement beep envelope/pitch/duration using independently recreated tones.
- [ ] Side-by-side visual tests and captured audio comparisons.

## Milestone 4 — robust packaging
- [ ] Browser offline PWA (service worker, versioned assets).
- [ ] Windows, Linux, Android, iOS packaging (platform-independent simulation core).
- [ ] Native background notification scheduling subject to OS limitations; the pet always catches up deterministically on resume.
- [ ] Local backups, save import/export, migration tests.
- [ ] Optional relaxed mode separate from strict classic mode.

## Event model
All domain logic goes through `createGame`, `advanceGame` and `performAction`. UI must not mutate hunger, happiness, character, or time. Use timestamp-based saved state and seedable RNG for replay. Real time can jump on mobile; test delayed resume, daylight-saving transitions and clock changes.

## Golden test suite (to create against original hardware)
| ID | Setup | Inputs | Expected observation |
|---|---|---|---|
| P1-001 | Fresh reset | Set clock | Pulsing egg, hatch at ~5 minutes |
| P1-002 | Active pet | Select Feed Meal | Hungry increases by 1, weight +1 |
| P1-003 | Active pet | Select Feed Snack | Happy increases by 1, weight +2 |
| P1-004 | Active pet | B with no selected icon | Clock page |
| P1-005 | Active pet | A+C on main view | Mute toggles |
| P1-006 | Active pet | Play five rounds | 3+ correct yields happiness |
| P1-007 | False attention call | Discipline | Discipline +25% |
| P1-008 | Hunger empty | Ignore 15 minutes | Care mistake |
| P1-009 | Asleep | Lights OFF | Attention resolved |
| P1-010 | Retired pet | A+C | New egg |
| P1-011 | Original 1996 vs rerelease | Compare adult aging | Must not borrow reissue decay cap |
| P1-012 | End of evolution | Compare care histories | Expected character branch |

**Important:** These are target expected behaviors; implementation tests against provisional mechanics are not hardware confirmation.

## Release boundaries
- Scope licensed original *style*, not protected brand assets. No copied ROM / firmware / ripped sprite atlas / sound files.
- Historical documentation includes character names for reference; shipping title/assets should be independently created or licensed.
- No ads inside Classic P1; disruptive timed elements would destroy authentic real-time behavior.
