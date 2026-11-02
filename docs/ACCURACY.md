# Accuracy ledger — Japanese 1996 P1

**Target:** original Japanese first-generation handheld released November 23, 1996. Not the 1997 international P1, later P2, or 2017/2018 Gen1 rerelease.

**Status as of 2026-11-02:** independently programmed *behavioral reconstruction in progress*, **not** full hardware/firmware emulation. Recreated controls and mechanics are testable; most art/audio and some timings remain approximations.

## Confidence labels

- **Verified from published instructions:** documented by official manufacturer or historical instructions (not necessarily independently measured on a 1996 unit).
- **Cross-referenced:** consistent in multiple historical enthusiast guides.
- **Community detail:** published in one specialist guide, unconfirmed against a unit owned/tested by this project.
- **Approximation:** choice made to keep simulation playable pending capture data.

## Implemented now

| Feature | Current behavior | Evidence status |
|---|---|---|
| Icon order | Top: feed/light/game/medicine; bottom: toilet/meter/discipline/attention | Cross-referenced |
| Three buttons | A cycles, B selects, C cancels | Official + guides |
| Unselectable attention | Automatic attention icon | Official + guides |
| Clock | A advances hour, B minute, C confirms; B opens clock; A+C edits clock or toggles mute | Official + guides; physical display art not exact |
| Pause while editing | Time and state halted during clock-set | Community detail |
| Egg | Hatch 5 minutes after setting clock | Official |
| Baby | 65-minute stage, 15 and 45 min waste, illness 33 min, nap 40–45 min | Community detail |
| Baby weight | Fixed 5g; minimum weight by later character | Community detail |
| Sleep | Child 20:00–09:00, teen 21:00–09:00, adult character-specific | Cross-referenced |
| Age | Increases on waking, including baby nap | Community detail |
| Hunger/happy | Four hearts, meal +1 hungry, snack +1 happy | Official + guides |
| Discipline | Proper false-attention scolding adds 25%; ignored false calls are not care mistakes in original 1996 release | Specialist guide |
| Mistakes | 15-min care call timeout, affects growth | Official + guides |
| Game | Five left/right guesses with A/B, C cancel; at least three correct for +1 happy; -1g even if lost | Cross-referenced |
| Growth | Baby → Marutchi → Tamatchi/Kuchitamatchi → six adults and Japanese Oyajitchi | Cross-referenced |
| Growth selection | Care mistakes plus 0/25/50/75/100% discipline and teen type, not rerelease discipline-mistake table | Specialist guide |
| Weight | Meals +1g, snack +2g after baby, bounded by species minimum and 99 | Cross-referenced |
| Medicine | Scheduled baby sickness, 2 doses; illness from accumulated waste | Community detail / approximation |
| Restart | A+C new egg after terminal screen | Official + guides |
| Offline passage | Iterate minute-by-minute on reopening; JSON/localStorage save | Technical feature, not a hardware claim |
| Sound | User-interaction synthesized square-wave beeps | Approximation, not original audio |
| LCD | 32x16 canvas with independently drawn placeholder shapes | Approximation, not original bitmap recreation |

## Known disagreements requiring measurement

1. **Teen threshold:** published sources disagree whether Tamatchi requires <=1 or <=2 care mistakes in the vintage firmware. Current implementation uses <=2; compare original 1996 units and ROM-derived traces.
2. **Growth values:** specialist vintage guides and pages covering the 2017 rerelease provide different evolution conditions. The implementation uses original discipline percentage rather than counting unpunished calls as rerelease-style discipline mistakes. Confirm the exact P1 character/teen type matrix on actual first-release hardware.
3. **Adult ending:** per-character lifespans and neglect thresholds vary with care and aging. The current table is approximate, and adult heart-loss rates do not yet increase with age.
4. **Baby status after growth:** the code resets stage health, hunger/happiness and accumulated care mistakes to a deterministic baseline. Exact Marutchi arrival state requires recording.
5. **Discipline call scheduling:** the true calls depend on hidden hardware counters. The current six-heart-drop trigger is an estimate.
6. **Sickness:** fixed baby sickness and medicine are documented; later-stage sickness interval and doses remain approximate.
7. **Visuals/audio:** no licensed/ripped assets and no measured original beep pitch/sequence. Current shells, pixels and icons are *not* pixel-exact.
8. **Aging/sleep timers:** exact transition minute and paused-clock hardware effects require capture. When adjusting clock we suspend the simulation, consistent with specialist reporting.
9. **Game outcome:** one older fan guide claims five correct guesses could give two happy hearts, while detailed specialist reporting describes one; current implementation awards one.
10. **UI:** the original Japanese device has different egg coloration and a distinct terminal presentation. The current independent designs are placeholders.

## Source hierarchy

**Manufacturer (applies to newer Original line; use cautiously for 1996):**
- [Official Japanese Original FAQ](https://tamagotchi-official.com/jp/series/original/faq/) — button combinations, 5-minute hatch, rerelease distinction, special character difference.
- [Official original instruction manual index](https://tamagotchi-official.com/manual/toy/original/).

**Vintage specialist sources (not manufacturer verification):**
- [Thaao's Tamas P1 Care Guide](https://thaao.net/tama/p1/) — specific care windows, baby stages, role of discipline.
- [Thaao's Tamas P1 Character Guide](https://www.thaao.net/tama/p1/?p=chara) — original vs rerelease growth conditions and minimum weights.
- [TamaConnection P1 / P2](https://tamaconnection.neocities.org/vintage/p1p2) — differences in screen and minigame.
- [TamaPlanet P1 guide](https://tamaplanet.com/guides/tamagotchi-guides/p1-guide) — icons, care actions, game.
- [Tamagotchi Wiki original character list](https://tamagotchi.fandom.com/wiki/Tamagotchi_(1996_Pet)/Character_list) — original-vs-rerelease data, with some disagreements.

## Required for actual 1:1 certification

Collect recorded hardware traces (timestamped button inputs, clock display, event state, original capture frames and independent audio measurements) and compare them with this implementation. A perfect behavioral clone cannot be claimed from encyclopedic notes or aesthetic similarity alone. Do not commit copyrighted firmware dumps, protected sprites or recorded commercial sounds to this public repository. If reproducing licensed assets for public release, obtain explicit rights; otherwise author original replacements.

## Testing

Run `npm test` for deterministic simulations. Compare physical-device minute-by-minute traces before marking the following as faithful: character-specific hunger/happiness rates, evolution matrix, scheduled sickness, nighttime waste, attention repeat/miss logic, animation durations, audible beep sequences and final-screen handling.

This project is an independent educational fan recreation, not affiliated with or endorsed by Bandai.
