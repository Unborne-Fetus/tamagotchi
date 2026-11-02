# Tamagotchi P1 — Source-grounded behavior reference
Revision: 2026-11-02 · Target: **Japanese first-generation 1996 P1**, not P2 or modern rerelease.

## Source hierarchy and confidence
- **[O]** Official Bandai documentation, especially the current Gen1 web manual (official description of P1-like controls; manual is for contemporary Gen1 and is *not* proof that 1996 firmware behaves identically).
- **[H]** Transcribed historical 1996–97 instructions or dated material.
- **[C]** Community documentation, useful but must be verified against physical original hardware.
- **[?]** Unknown / provisional: requires capture, reverse engineering where lawful, or careful comparative testing.
- Never say “100% accurate” before the golden-trace suite exists.

Sources:
- O: https://tamagotchi-official.com/manual/toy/original/Original_webmanual.pdf
- O: https://www.bandai.com/original-tamagotchi-white-with-black
- H: https://manuals.plus/m/67158b3b998e35f933dc2f3c2cfd2591b730e585e086733f2caa99cf1e2875ca
- C: https://tamagotchi.fandom.com/wiki/Tamagotchi_(1996_Pet)
- C: https://tamagotchi.fandom.com/wiki/Tamagotchi_(1996_Pet)/Character_list
- C: https://tamaconnection.neocities.org/vintage/p1p2
- C (unverified hardware compilation): https://github.com/loociano/tamagotchi-tech-specs

## Version matrix
| Parameter | JP 1996 P1 target | 1997 English P1 | Gen1 rereleases |
|---|---|---|---|
| Debut | Japan November 23, 1996 [C] | Western 1997 [C] | 2017 onward [C] |
| Screen | Monochrome pixel matrix + eight indicator icons [C] | Similar | Similar appearance |
| Background pattern | P1 checkerboard [C] | P1 checkerboard [C] | P1 pattern replicated |
| Meal | Bowl of rice [C] | Slice of bread [C] | Region-dependent |
| Weight unit | g [C] | oz [C] | Varies |
| Game | Guess character direction, 5 rounds [O/C] | Same | Same |
| End screen | Japanese-style departing/ghost imagery [C] | Angel/stars [C] | Version-dependent |
| Power | Two LR44 button cells [C] | Two LR44 [C] | One CR2032 [O/C] |
| Old-age fastest heart loss | 6 min hungry, 7 min happy [C] | Similar [C] | ~16 min each [C] |
| Discipline | Calls only as needed to fill bar [C] | Similar [C] | Extra calls [C] |
| Care history | Historic original branching [C] | Historic original branching [C] | Changed rules [C] |

**Not to confuse:** P2 has different characters and a number-guessing game; it is NOT the P1 target.

## Hardware and display
- Three push buttons below display: **A=cycle/select**, **B=confirm**, **C=cancel/back** [O]. In the direction game A=left and B=right [O/C].
- Eight surrounding indicators, with *attention* illuminating automatically rather than operating as a normal menu item [O/C].
- Functional icons in UI traversal order (verify precise physical LED addressing from device):
  1. Feed; 2. Light; 3. Toilet; 4. Health; 5. Play; 6. Medicine; 7. Discipline; 8. Attention (non-selectable).
- Pixel-art screen appears roughly 32×16 active graphic cells in widely documented projects [C/?]. Verify exact active pixel dimensions, icon layer geometry, icon pixel patterns, scan timing, and background compositing against photographed hardware.
- 4-bit Epson E0C6S46 CMOS CPU, 32.768 kHz, quoted memory 640×4 RAM words and 160×4 display words [C/? hardware compilation]. Verify silicon revision before using for cycle accuracy.
- Need independent sprite redraws for publicly distributed build unless source art licensing is established.

## Startup, clock, and sound
- Pull battery insulation, reset device, set clock; the egg hatches **about five minutes after clock setup** [O/H].
- Prior to hatch, only clock and reset are available [O].
- While no icon is selected, B displays clock; B returns to pet. Clock editing: from clock press A+C, then A increments hour, B increments minute, C commits [O/H].
- Clock-adjust screen pauses simulation (aging, waste and depletion) [C].
- On main pet view press A+C to toggle sound on/off (after hatching) [O/H].
- On terminal screen C toggles last-age view, A+C restarts egg [O/H].
- RTC behavior during mobile sleep/offline should depend on elapsed wall time; storing only timer handles is incorrect.
- Time-zone and DST adjustment behavior is open [?] — make local clock separate from monotonic elapsed time and preserve per-pet timestamps.

## Pet lifecycle
- Stages: Egg → Baby → Child → Teen → Adult (+ one special outcome) [O/C].
- Egg ~5 min [O]; baby stage ~65 minutes [C]; teen around age 3 and adult around age 6 [C]. These are reference *milestones*, not precise firmware scheduler deadlines.
- Source character names for P1: baby **Babytchi**; child **Marutchi**; teens **Tamatchi** and **Kuchitamatchi**; adults **Mametchi, Ginjirotchi, Maskutchi, Kuchipatchi, Nyorotchi, Tarakotchi**; special **Oyajitchi** [C; confirm exact regional roster/special designation before finishing].
- Care mistakes, discipline mistakes, and historical growth branches must be tracked separately. Precise thresholds, inheritance, special trigger and resets remain [?].
- Screen should animate egg pulsing, hatch, idle poses, reactions, evolution transitions, sleep, sickness, excrement, departure, and game outcome [? sprite/timing].
- Aging is counted as years/days on a meter; character care rate changes with age [C].

## Needs and activities
1. **Feed**: choose Meal or Snack using A and confirm using B [O]. Meal raises one of four Hungry hearts and weight +1 unit [C]. Snack raises one of four Happy hearts and weight +2 units [C]. Excess snack intake affects illness/health [C], but exact threshold/time window [?].
2. **Light**: choose ON/OFF [O]. Pet sleeps according to stage/character hour range [C]; lights left on after bedtime attention window count as a care mistake [C]. Turning off lights while awake hides display contents but does not alone harm the pet [C].
3. **Toilet**: clears accumulated waste [O]. Babies produce waste at ~15 and ~40–45 min after hatching; child shortly after evolving and roughly every 3h thereafter [C]; dynamic schedules need measurement [?].
4. **Health meter**: successive pages age/weight, discipline, Hungry, Happy; four hearts per need [O/C]. Discipline fills in quarters (25% per successful response) [C].
5. **Play**: five left/right guesses using A and B; >=3 correct raises one Happy heart, complete game reduces weight one unit (not below minimum) [O/C]. C exits game [O]. RNG and animation delays [?].
6. **Medicine**: sickness indicated by skull; may require 1–2 doses [C]. Distinguish medicine reaction and recovery animation [?].
7. **Discipline**: false attention / refusal when not genuinely needy; successful discipline raises bar 25%; outside misbehavior it has no effect [O/C]. The original has a finite number of discipline calls per stage [C].
8. **Attention**: automatic, NOT a selectable command [O/C]. Trigger if hunger/happiness completely empty, sleep requires lights off, or false discipline call. Most unmet need attention windows last ~15 min and cause a care mistake on expiry [C]; false discipline calls are handled distinctly [C]. Neither ordinary poop nor ordinary sickness alone activates attention [C].

## Terminal state and fresh egg
- Pet eventually reaches a terminal outcome from aging or prolonged neglect [C]. No automatic reset: keep terminal display and final age; A+C starts new egg [O/H].
- Do not silently erase older play history when starting new pet: store optional record separately, **not as a fake 1996 feature**.

## Original vs exact-clone acceptance criteria
For every verified scenario capture:
- Model / region / manufacture year and battery state;
- Initial time, real elapsed time, control sequence, pet age/stage, heart counts, discipline, weight;
- On-screen pixel bitmap/indicator mask, audio sequence and durations;
- Evolution path and all care/discipline mistakes;
- Output of same sequence on clone (golden trace).
**Pass:** state and exact frame/audio comparisons within measured tolerances. **Fail:** any unexplained mismatch.

## Open research tasks (do not substitute guesses)
- Full sprite bitmaps, hit-frame animation timing, icon pixel geometry and backdrop;
- P1 JP 1996 growth decision tree and age calculations;
- Per-character/age decrement intervals, sleep/wake times, weight minima/maxima;
- Poop schedules, sickness medicine dose RNG, illness/decline parameters;
- Misbehavior timing, discipline rules, attention timeouts and care penalties;
- Button repeat/cancel interactions, mute/beep tones and exact sequences;
- RTC and time-set side effects, wraparound/DST/battery behavior;
- Hardware electrical/display timings only if later pursuing cycle-level emulation.
