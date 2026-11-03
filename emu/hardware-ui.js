/*
 * Hardware-mode UI: display is generated only by emulated LCD pins.
 * All firmware and saved data remain on the user's device.
 */
const $ = id => document.getElementById(id);
const buttons = [$('hw-a'), $('hw-b'), $('hw-c')];
const icons = Array.from({ length: 8 }, (_, i) => $('hw-icon-' + i));
const canvas = $('hw-lcd');
const ctx = canvas.getContext('2d', { alpha: false });
const framebuffer = ctx.createImageData(32, 16);
const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
let loaded = false;
let romHash = null;
let exporting = false;
let currentlyPressed = new Set();
let audio = null;
let oscillator = null;
let gain = null;
let muted = localStorage.getItem('p1-hw-mute') === 'yes';
let backupStatus = '';

function notice(text, error = false) {
  $('hw-status').textContent = text;
  $('hw-status').dataset.error = error ? 'true' : 'false';
}
function romHashOf(bytes) {
  let h = 2166136261 >>> 0;
  for (const b of bytes) { h ^= b; h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
function to64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 512)
    s += String.fromCharCode(...bytes.slice(i, i + 512));
  return btoa(s);
}
function from64(data) {
  if (typeof data !== 'string' || data.length > 50_000) throw Error('Invalid save data');
  const value = atob(data);
  return Uint8Array.from(value, c => c.charCodeAt(0)).buffer;
}
function storeSnapshot(payload) {
  if (!loaded || payload.romHash !== romHash || !payload.data) return;
  const state = {
    kind: 'p1-tamalib-state-v2', version: 1,
    romHash, savedAt: payload.savedAt,
    data: to64(new Uint8Array(payload.data))
  };
  try { localStorage.setItem('p1-hardware-' + romHash, JSON.stringify(state)); }
  catch { backupStatus = 'Browser save storage unavailable. Export a backup.'; }
  if (exporting) {
    exporting = false;
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'p1-hardware-save-' + romHash + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notice('Hardware state exported. Firmware is not included.');
  }
}
function paint(bytes) {
  if (bytes.length !== 512) return;
  const out = framebuffer.data;
  for (let i = 0; i < 512; i++) {
    const on = !!bytes[i], at = i * 4;
    out[at] = on ? 37 : 201;
    out[at+1] = on ? 55 : 214;
    out[at+2] = on ? 39 : 172;
    out[at+3] = 255;
  }
  ctx.putImageData(framebuffer, 0, 0);
}
function enableAudio() {
  if (audio) { if (audio.state === 'suspended') void audio.resume(); return; }
  try {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    audio = new Context();
    oscillator = audio.createOscillator();
    oscillator.type = 'square';
    oscillator.frequency.value = 1000;
    gain = audio.createGain();
    gain.gain.value = 0;
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start();
  } catch { /* no audio allowed; game still works */ }
}
function sound(freq) {
  if (!audio || !gain || !oscillator) return;
  const t = audio.currentTime;
  if (freq > 0 && !muted && document.visibilityState !== 'hidden') {
    oscillator.frequency.setTargetAtTime(freq, t, .002);
    gain.gain.setTargetAtTime(.025, t, .004);
  } else {
    gain.gain.setTargetAtTime(0, t, .004);
  }
}
function down(index) {
  if (!loaded || currentlyPressed.has(index)) return;
  enableAudio();
  currentlyPressed.add(index);
  buttons[index].classList.add('pressed');
  worker.postMessage({ type: 'button', button: index, down: true });
}
function up(index) {
  if (!currentlyPressed.has(index)) return;
  currentlyPressed.delete(index);
  buttons[index].classList.remove('pressed');
  worker.postMessage({ type: 'button', button: index, down: false });
}
for (let i = 0; i < 3; i++) {
  const btn = buttons[i];
  btn.addEventListener('pointerdown', e => {
    e.preventDefault();
    btn.setPointerCapture?.(e.pointerId);
    down(i);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
    btn.addEventListener(type, () => up(i));
}
const mapping = { a: 0, b: 1, c: 2, '1': 0, '2': 1, '3': 2,
  arrowleft: 0, arrowdown: 1, arrowright: 2 };
document.addEventListener('keydown', e => {
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
  const key = e.key.toLowerCase();
  if (!(key in mapping)) return;
  e.preventDefault();
  if (!e.repeat) down(mapping[key]);
});
document.addEventListener('keyup', e => {
  const key = e.key.toLowerCase();
  if (key in mapping) { e.preventDefault(); up(mapping[key]); }
});
window.addEventListener('blur', () => {
  for (const index of [...currentlyPressed]) up(index);
  sound(0);
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    for (const index of [...currentlyPressed]) up(index);
    sound(0);
    if (loaded) worker.postMessage({ type: 'save' });
  } else if (audio?.state === 'suspended') {
    // Browser audio resumes on next user gesture only.
  }
});
window.addEventListener('pagehide', () => {
  if (loaded) worker.postMessage({ type: 'save' });
});

$('hw-mute').textContent = muted ? 'Unmute' : 'Mute';
$('hw-mute').addEventListener('click', () => {
  muted = !muted;
  localStorage.setItem('p1-hw-mute', muted ? 'yes' : 'no');
  $('hw-mute').textContent = muted ? 'Unmute' : 'Mute';
  enableAudio();
  if (muted) sound(0);
});
$('hw-export').addEventListener('click', () => {
  if (!loaded) return notice('Import a compatible firmware file first.', true);
  exporting = true;
  worker.postMessage({ type: 'save' });
});
$('hw-import').addEventListener('change', async e => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    if (!loaded) throw Error('Load the matching firmware first');
    if (file.size > 100_000) throw Error('Backup is too large');
    const source = JSON.parse(await file.text());
    if (source.kind !== 'p1-tamalib-state-v2' || source.version !== 1 ||
      source.romHash !== romHash) throw Error('This backup belongs to another firmware');
    worker.postMessage({ type: 'restore', snapshot: {
      kind: source.kind, romHash: source.romHash, savedAt: source.savedAt,
      data: from64(source.data)
    } });
  } catch (err) { notice('Backup import failed: ' + err.message, true); }
  e.target.value = '';
});
$('hw-rom').addEventListener('change', async e => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    if (file.size !== 16384) throw Error('This mode requires a 16,384-byte P1 ROM (12-bit instructions in big-endian words).');
    notice('Initializing hardware core...');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const hash = romHashOf(bytes);
    let snapshot;
    try {
      const old = JSON.parse(localStorage.getItem('p1-hardware-' + hash) || 'null');
      if (old?.kind === 'p1-tamalib-state-v2' && old.version === 1) {
        snapshot = { kind: old.kind, savedAt: old.savedAt,
          romHash: hash, data: from64(old.data) };
      }
    } catch { /* a broken save must never prevent a fresh boot */ }
    loaded = false;
    romHash = hash;
    for (const index of [...currentlyPressed]) up(index);
    worker.postMessage({ type: 'boot', rom: bytes.buffer, snapshot },
      [bytes.buffer, ...(snapshot ? [snapshot.data] : [])]);
  } catch (err) { notice(err.message, true); }
  e.target.value = '';
});
worker.addEventListener('message', ({ data }) => {
  if (data.type === 'ready') {
    loaded = true;
    romHash = data.romHash >>> 0;
    $('hw-export').disabled = false;
    $('hw-import').disabled = false;
    notice(data.restored ? 'Original processor running · saved game restored' :
      'Original processor running · set the clock using A, B and C');
  } else if (data.type === 'frame') {
    paint(new Uint8Array(data.pixels));
    icons.forEach((el, i) => el.classList.toggle('lit', !!(data.icons & (1 << i))));
    sound(data.frequency);
    $('hw-catchup').textContent = data.backlogSeconds > 2 ?
      'Replaying elapsed time: ' + data.backlogSeconds + ' seconds remaining' :
      'Real-time 32,768 Hz hardware emulation';
  } else if (data.type === 'save') {
    storeSnapshot(data);
  } else if (data.type === 'restored') {
    notice('Hardware state restored. Catch-up running.');
  } else if (data.type === 'error') {
    notice(data.message, true);
  } else if (data.type === 'needs-rom') {
    notice(data.message);
  }
});
worker.addEventListener('error', e => notice('Emulator worker failed to load: ' + e.message, true));
paint(new Uint8Array(512));
notice('Select a locally held, authorized 1996 P1 firmware file to begin. No file is uploaded.');
