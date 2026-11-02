# Virtual Pet — Original 1996 P1 Research & Recreation

> **Project status:** research and foundation phase. This is not yet a pixel-perfect or behavior-perfect recreation.
>
> **Reference:** original Japanese Tamagotchi P1 released November 23, 1996. Do not conflate its rules with the 1997 P2 or 2017+ rereleases.

## Objective

Reconstruct the experience of the first-generation three-button, monochrome, real-time virtual pet. The emulator-style **Classic P1** mode must separate historically verified behavior from educated approximations, while keeping gameplay deterministic and testable. The engine should operate offline, persist a session, and safely handle elapsed real time when re-opened.

## Starting point

- `docs/P1_REFERENCE.md` — primary feature and behavior reference, with sources and confidence notes.
- `docs/IMPLEMENTATION_PLAN.md` — modules, fidelity tests, research backlog, and milestones.
- `src/engine.js` — dependency-free provisional simulation engine.
- `src/main.js` and `index.html` — browser prototype with A/B/C controls and monochrome display.
- `tests/engine.test.mjs` — Node built-in test runner.

## Scope

**P1 only for the first milestone.** Features to reconstruct: clock and setup, 5-minute egg, button navigation, 8 care icons, meals and snacks, lights and sleep, toilet, health meter, character guessing game, medicine, discipline, calls and care mistakes, lifecycle, character branching, sounds, and reset/restart.

Explicitly out of scope for P1: connections, breeding, modern shops/currency, touchscreen controls, online play, P2 number game, modern characters, and forced ad interruptions.

## Play online (GitHub Pages)

**Expected website address (once Pages is enabled and the deployment succeeds):**
https://unborne-fetus.github.io/tamagotchi/

The site automatically redeploys after each push to `main`, via [Deploy Tamagotchi to GitHub Pages](https://github.com/Unborne-Fetus/tamagotchi/actions/workflows/deploy.yml). The deployment workflow runs simulation tests first and publishes only the browser assets. No external server, API key, or paid hosting is needed.

**One-time repository setting, if Pages is not already enabled:** Go to [Settings → Pages](https://github.com/Unborne-Fetus/tamagotchi/settings/pages), and set **Build and deployment → Source** to **GitHub Actions**. Then run the workflow from the [Actions tab](https://github.com/Unborne-Fetus/tamagotchi/actions/workflows/deploy.yml) using **Run workflow**, or push another commit to `main`. Wait for a successful `Publish GitHub Pages` step before using the expected website URL. (This connector cannot change GitHub Pages site settings or inspect push-triggered deployment runs.)

Local saves are stored in the browser's localStorage for this domain and cannot automatically migrate from a localhost copy. Use **Export save** and **Import save** when changing domains.

## Running

Open `index.html` in a modern browser. For a local server use `python -m http.server 8000` and visit http://localhost:8000. To run tests: `node --test` (Node 20+ recommended).

## Historical accuracy policy

1. **Official first:** document official Bandai manuals as the primary authority.
2. **Versioned evidence:** label 1996 Japan P1, 1997 international P1, and later rereleases separately.
3. **Unknown != true:** unverified heartbeat timings, evolution thresholds, random probabilities, sprite bitmaps, and sounds must stay explicitly provisional until validated.
4. **Golden traces:** compare recorded physical-device inputs, clock deltas, states, and visual frames to the simulation.
5. **Original assets for distribution:** don't check in copied copyrighted artwork, audio dumps, firmware/ROMs, or trademarked shell graphics without permission. Use independently drawn placeholders unless rights have been cleared.

## Sources

- Official Bandai manual: https://tamagotchi-official.com/manual/toy/original/Original_webmanual.pdf
- Original P1 mechanics: https://tamagotchi.fandom.com/wiki/Tamagotchi_(1996_Pet)
- First-generation overview: https://tamaconnection.neocities.org/vintage/p1p2
- Technical hardware collection (community, verify): https://github.com/loociano/tamagotchi-tech-specs
- Historic instruction transcription: https://manuals.plus/m/67158b3b998e35f933dc2f3c2cfd2591b730e585e086733f2caa99cf1e2875ca

Independent fan research project; not affiliated with or endorsed by Bandai.
