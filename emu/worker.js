/*
 * Browser worker for genuine E0C6S46 execution with locally provided firmware.
 * This worker never sends the ROM or snapshots over a network.
 */
let core = null;
let timer = null;
let ready = false;
let wallTime = 0;
let pendingTicks = 0;
let frameCounter = 0;
let lastAutoSave = 0;
const TICKS_PER_MS = 32.768;
const DAY_MS = 86_400_000;
const MAX_CATCHUP_MS = 30 * DAY_MS;

function emitError(message) {
  self.postMessage({ type: 'error', message: String(message) });
}
function memView(pointer, length) {
  return core.HEAPU8.subarray(pointer, pointer + length);
}
function snapshot() {
  if (!ready) return null;
  const n = core._p1_snapshot_bytes();
  if (n < 64 || n > 16384) throw Error('Unexpected snapshot size');
  const ptr = core._malloc(n);
  if (!ptr) throw Error('Unable to allocate snapshot');
  try {
    if (!core._p1_save(ptr, n)) throw Error('Snapshot save failed');
    const bytes = Uint8Array.from(memView(ptr, n));
    // Subtract unprocessed wall time: on restart the saved game must still catch up.
    const savedAt = Date.now() - Math.floor(pendingTicks / TICKS_PER_MS);
    return { kind: 'p1-tamalib-state-v2', romHash: core._p1_rom_hash() >>> 0,
      savedAt, data: bytes.buffer };
  } finally {
    core._free(ptr);
  }
}
function restore(raw) {
  if (!raw || raw.kind !== 'p1-tamalib-state-v2') return false;
  if ((raw.romHash >>> 0) !== (core._p1_rom_hash() >>> 0)) return false;
  if (!Number.isFinite(raw.savedAt) || raw.savedAt > Date.now() + 60_000) return false;
  const bytes = new Uint8Array(raw.data);
  if (bytes.byteLength !== core._p1_snapshot_bytes()) return false;
  const ptr = core._malloc(bytes.byteLength);
  if (!ptr) return false;
  try {
    memView(ptr, bytes.byteLength).set(bytes);
    if (!core._p1_load(ptr, bytes.byteLength)) return false;
    pendingTicks = Math.max(0, Math.min(Date.now() - raw.savedAt, MAX_CATCHUP_MS)) *
      TICKS_PER_MS;
    wallTime = Date.now();
    return true;
  } finally {
    core._free(ptr);
  }
}
function saveToHost() {
  if (!ready) return;
  try {
    const data = snapshot();
    self.postMessage({ type: 'save', ...data }, [data.data]);
  } catch (e) {
    emitError('Unable to save: ' + e.message);
  }
}
function emitFrame() {
  if (!ready) return;
  const ptr = core._p1_lcd_ptr();
  const pixels = Uint8Array.from(memView(ptr, 512));
  self.postMessage({
    type: 'frame',
    pixels: pixels.buffer,
    icons: core._p1_icons(),
    frequency: core._p1_sound_deci_hz() / 10,
    backlogSeconds: Math.round(pendingTicks / 32768),
    ticks: core._p1_ticks() >>> 0
  }, [pixels.buffer]);
}
function advance() {
  if (!ready) return;
  const now = Date.now();
  const dt = Math.max(0, Math.min(now - wallTime, MAX_CATCHUP_MS));
  wallTime = now;
  pendingTicks += dt * TICKS_PER_MS;
  // Keep long catch-up responsive. Each timer invocation processes at most
  // 0.5 s of target emulated time, with an additional 80k instruction cap.
  const want = Math.min(16384, Math.floor(pendingTicks));
  if (want > 0) {
    const before = core._p1_ticks() >>> 0;
    const done = core._p1_run(want, 80000);
    const after = core._p1_ticks() >>> 0;
    const progress = (after - before) >>> 0;
    if (done < 0) {
      clearInterval(timer); timer = null; ready = false;
      emitError('The firmware reached an unsupported CPU instruction. Confirm a valid P1 program.');
      return;
    }
    pendingTicks = Math.max(0, pendingTicks - progress);
  }
  if (++frameCounter % 2 === 0) emitFrame();
  if (now - lastAutoSave >= 5000) {
    lastAutoSave = now;
    saveToHost();
  }
}
async function boot(data) {
  if (timer) { clearInterval(timer); timer = null; }
  ready = false; pendingTicks = 0;
  try {
    const bytes = new Uint8Array(data.rom);
    if (bytes.byteLength !== 16384) throw Error('P1 firmware must be exactly 16,384 bytes');
    // A new firmware boot must get fresh CPU statics, interrupts and clock.
    // TamaLIB's public cpu_reset() does not zero all of its internal globals.
    const imported = await import('./p1_wasm.mjs');
    core = await imported.default({
      locateFile: (file) => new URL(file, import.meta.url).href
    });
    const ptr = core._malloc(bytes.byteLength);
    if (!ptr) throw Error('Unable to allocate firmware memory');
    let ok;
    try {
      memView(ptr, bytes.byteLength).set(bytes);
      ok = core._p1_init(ptr, bytes.byteLength);
    } finally {
      core._free(ptr);
    }
    if (!ok) throw Error('Invalid or unsupported 12-bit big-endian P1 firmware');
    ready = true;
    wallTime = Date.now();
    const restored = data.snapshot ? restore(data.snapshot) : false;
    lastAutoSave = Date.now();
    self.postMessage({ type: 'ready', romHash: core._p1_rom_hash() >>> 0, restored });
    emitFrame();
    timer = setInterval(advance, 16);
  } catch (error) {
    ready = false;
    emitError(error?.message || error);
  }
}
self.onmessage = async ({ data }) => {
  if (!data || !data.type) return;
  switch (data.type) {
    case 'boot': await boot(data); break;
    case 'button':
      if (ready && Number.isInteger(data.button) && data.button >= 0 &&
        data.button <= 2) core._p1_button(data.button, data.down ? 1 : 0);
      break;
    case 'save':
      saveToHost(); break;
    case 'restore':
      if (!ready) return;
      if (restore(data.snapshot)) {
        self.postMessage({ type: 'restored' });
        emitFrame();
        saveToHost();
      } else emitError('Save was incompatible with the loaded firmware or emulator version');
      break;
    case 'reset':
      if (ready) {
        core._p1_button(0, 0); core._p1_button(1, 0); core._p1_button(2, 0);
        // Reset to a fresh program run by using the original firmware again, not
        // by manipulating the device clock or inventing a simulated reset action.
        self.postMessage({ type: 'needs-rom', message: 'Select firmware again to reset.' });
      }
      break;
  }
};
