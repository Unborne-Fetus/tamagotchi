# Path to actual 1:1 authenticity: optional hardware emulation

The current repository implements *independent behavioral reconstruction*. An identical original game requires matching **CPU, program ROM, display controller, button logic and clock/audio behavior**, not just a similar skin.

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

## Implementation interfaces (not built yet)

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

Implementation can live in `src/emulator/` with independent test fixtures. Do not put a non-functional firmware upload button in the public UI before it is ready.

## Boundaries

- No original proprietary ROM or original sprites/sounds included or linked.
- Program names, real-world screen dimensions and observed mechanical rules can be documented for interoperability; do not copy protected graphics.
- *One-to-one behavioral reproduction* and *one-to-one physical/art appearance* are separate milestones. A precise CPU emulator may still need permission-safe artwork, shell texture, audio and device-clock verification.

**Current status:** architecture identified; WASM adapter is NOT installed, compiled, functional, or deployed. The GitHub Pages site currently runs the independent research build.
