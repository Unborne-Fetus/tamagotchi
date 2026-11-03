# Path to actual 1:1 authenticity: optional hardware emulation

The repository implements both *independent behavioral reconstruction* and a ROM-free E0C6S46 TamaLIB WebAssembly bridge. An identical original game requires matching **CPU, program ROM, display controller, button logic and clock/audio behavior**, not just a similar skin.

## Candidate technology

- [TamaLIB](https://github.com/jcrona/tamalib/) is an emulator for the Epson E0C6S46 used by first-generation Tamagotchi, exposing button inputs and black/white LCD pixels.
- [Tamagotchi P1 for Web](https://github.com/tonypan2/tamagotchi-p1-web) demonstrates a TamaLIB/WebAssembly worker, browser persistence and buttons.
- [MAME handheld implementation](https://github.com/mamedev/mame) provides an alternative for cross-checking machine behavior.
- TamaLIB is **GPL-2.0**. Before vendoring, using or linking it, confirm compatibility with the repository's distribution/license plan; preserve license and source distribution obligations.

## Safe design

1. Keep existing independent JavaScript simulation usable immediately in the public GitHub Pages site.
2. Add an *optional* high-accuracy emulator adapter using a separately built GPL-compliant WebAssembly component (only after licensing review).
3. Read user-owned/authorized firmware **locally** via an explicit file picker. Do not fetch, bundle, auto-download, share, or publish proprietary program images; do not upload firmware to a server.
4. Validate hardware model and image format before booting; the 1996 Japanese target may differ from 1997 international and rerelease code.
5. Provide worker-isolated input buttons A/B/C and deterministic LCD/audio frame callbacks.
6. Implement save state with a versioned browser storage format; use import/export to back up data.
7. Compare identical test traces between the new emulator and independently reconstructed engine; do not claim exactness without verification.

## Implemented interfaces and remaining gaps

```ts
interface PocketPetRuntime {
  start(): Promise<void>;
  buttonDown(button: 'A' | 'B' | 'C'): void;
  buttonUp(button: 'A' | 'B' | 'C'): void;
  readLcd(): Uint8Array;   // 32x16 b/w display
  readIcons(): number;     // eight status bits
  save(): Promise<Uint8Array>;
  load(data: Uint8Array): Promise<void>;
  destroy(): void;
}
```

Implemented: `native/p1_bridge.c` (C hardware HAL), `emu/worker.js` (time progression and snapshots), `emu/hardware-ui.js` (LCD/sound/input), `hardware.html` (browser interface), and `scripts/build-wasm.sh` (pinned upstream TamaLIB build). The hardware view is behind a local firmware file selector and no firmware is bundled.

## Boundaries

- No original proprietary ROM or original sprites/sounds included or linked.
- Program names, real-world screen dimensions and observed mechanical rules can be documented for interoperability; do not copy protected graphics.
- *One-to-one behavioral reproduction* and *one-to-one physical/art appearance* are separate milestones. A precise CPU emulator may still need permission-safe artwork, shell texture, audio and device-clock verification.

**Current status (2026-11-02):** The ROM-free TamaLIB WebAssembly adapter was successfully compiled, tested, and published by [GitHub Actions run #41551965246](https://github.com/Unborne-Fetus/tamagotchi/actions/runs/41551965246). The WebAssembly artifact is created during Actions and published to GitHub Pages. Running the original Japanese firmware in a browser and comparing against a physical 1996 unit have **not** been verified. The research-mode game remains playable without firmware.

## Emulator v0.3 verification backlog

- CI must successfully clone pinned TamaLIB revision and compile Emscripten 4.0.15. Confirm run output rather than infer success from a Git commit.
- Use a legally authorized compatible original firmware image locally, verify boot/clock setting, A/B/C down/up, LCD pixels/icons, pitch/gates, and lifecycle over days.
- Capture and compare actual hardware frames/timestamps for the original 1996 Japanese P1; no shipped artwork has been copied.
- Test save/load at instruction boundaries and during active sound. TamaLIB does not export every internal CPU static, so the current snapshot format is not proof of cycle-perfect restoration.
- Run a 24-hour and 7-day catch-up benchmark; the emulator replays real CPU work and can take substantial time if offline for days.
- Verify P1 firmware hash/variant identification. Rejected invalid/non-P1 firmware must not alter saved states.
