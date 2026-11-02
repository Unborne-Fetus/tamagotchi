import { ICONS, VERSION, createGame, advanceGame, performAction, virtualClock } from './engine.js';

const SAVE_KEY = 'classic-pocket-p1-state-v2';
const $ = id => document.getElementById(id);
const ctx = $('lcd').getContext('2d', { alpha: false });
let state;
try {
  const loaded = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
  state = loaded?.version === VERSION ? loaded : createGame();
} catch { state = createGame(); }
let screen = 'main';
let selected = -1, option = 0, meterPage = 0, terminalPage = false;
let audio;

// Independently drawn icons for the reference interface; no ripped art.
const symbols = [
  '<path d="M5 3v9m3-9v9m3-9v9m-6-4h6m-3 4v9m9-18v18m0-18c-5 3-5 10 0 10"/>',
  '<path d="M10 17h5m-9-6a6 6 0 1 1 10 0l-2 3H8l-2-3m2 6h6m-5 3h4"/>',
  '<path d="M3 17l5-4 4 3 8-11m-4 1 4-1-1 4m-14 7 4 4"/>',
  '<path d="m4 18 12-12 3 3-12 12m5-15 3-3 6 6-3 3M5 21l-2-2m10-9 3 3"/>',
  '<path d="M3 11h17v3a8 8 0 0 1-16 0v-3Zm2 0V8l4-3 5 3m1 0h3m-9 8h6"/>',
  '<path d="M3 16a9 9 0 0 1 18 0H3Zm9-9v7m0 0 4-3m-11 9h14"/>',
  '<circle cx="12" cy="12" r="9"/><path d="M8 9h1m6 0h1m-9 5 5-2 5 2"/>',
  '<path d="M12 3c-3 0-7 3-7 7 0 6 6 11 7 11s7-5 7-11c0-4-4-7-7-7Zm0 4v6m0 4h.01"/>'
];
const label = ['Meal','Light','Play','Medicine','Toilet','Meter','Discipline','Attention'];
for (const [element, start] of [['top-icons', 0], ['bottom-icons', 4]]) {
  $(element).innerHTML = Array.from({ length: 4 }, (_, i) => {
    const idx = start + i;
    return `<span class="icon-cell" id="icon-${idx}" title="${label[idx]}" aria-label="${label[idx]}"><svg viewBox="0 0 24 24" aria-hidden="true">${symbols[idx]}</svg></span>`;
  }).join('');
}
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch {} }
function advance() { state = advanceGame(state); save(); }
function action(name, payload = null) { state = performAction(state, name, Date.now(), payload); save(); }
const glyphs = {
  '0':['111','101','101','101','111'], '1':['010','110','010','010','111'],
  '2':['111','001','111','100','111'], '3':['111','001','111','001','111'],
  '4':['101','101','111','001','001'], '5':['111','100','111','001','111'],
  '6':['111','100','111','101','111'], '7':['111','001','010','010','010'],
  '8':['111','101','111','101','111'], '9':['111','101','111','001','111'],
  ':':['0','1','0','1','0'], '-':['000','000','111','000','000'],
  'A':['010','101','111','101','101'], 'B':['110','101','110','101','110'],
  'C':['011','100','100','100','011'], 'D':['110','101','101','101','110'],
  'E':['111','100','110','100','111'], 'F':['111','100','110','100','100'],
  'G':['011','100','101','101','011'], 'H':['101','101','111','101','101'],
  'I':['111','010','010','010','111'], 'L':['100','100','100','100','111'],
  'M':['101','111','111','101','101'], 'N':['101','111','111','111','101'],
  'O':['111','101','101','101','111'], 'P':['110','101','110','100','100'],
  'R':['110','101','110','101','101'], 'S':['011','100','111','001','110'],
  'T':['111','010','010','010','010'], 'U':['101','101','101','101','111'],
  'W':['101','101','111','111','101'], 'Y':['101','101','010','010','010'],
  '/':['001','001','010','100','100'], ' ' :['000','000','000','000','000'], 'g':['000','011','101','011','001']
};
const sprites = {
  egg: ['..####..','.#....#.','#......#','#......#','#......#','.#....#.','..####..'],
  Babytchi: ['..####..','.######.','##.##.##','########','.##..##.','..####..'],
  Marutchi: ['..####..','.######.','##.##.##','########','##....##','.######.','..#..#..'],
  Tamatchi: ['..#..#..','.######.','########','##.##.##','########','.######.','..#..#..'],
  Kuchitamatchi: ['.###.###','########','##.##.##','########','##..####','.######.','..#..#..'],
  Mametchi: ['.##..##.','########','##.##.##','########','##....##','.######.','..#..#..'],
  Ginjirotchi: ['...##...','.######.','##.##.##','########','.##..##.','..####..','..#..#..'],
  Maskutchi: ['.######.','##.##.##','########','###..###','.######.','..#..#..'],
  Kuchipatchi: ['..####..','########','##.##.##','###..###','########','.######.','..#..#..'],
  Nyorotchi: ['...####.','..##..##','...####.','..##....','.##.....','..####..'],
  Tarakotchi: ['.######.','##.##.##','########','###..###','.######.','.#....#.'],
  Oyajitchi: ['..####..','.######.','##.##.##','########','..####..','.######.','..#..#..']
};
function print(text, y, align = 'center') {
  const chars = [...text];
  const width = chars.reduce((total, ch) => total + (glyphs[ch]?.[0]?.length ?? 3) + 1, -1);
  let x = align === 'center' ? Math.floor((32 - width) / 2) : 1;
  ctx.fillStyle = '#273c2c';
  for (const ch of chars) {
    const pattern = glyphs[ch] ?? glyphs[' '];
    pattern.forEach((row, yy) => [...row].forEach((b, xx) => { if (b === '1') ctx.fillRect(x + xx, y + yy, 1, 1); }));
    x += pattern[0].length + 1;
  }
}
function pixels(lines, ox, oy) {
  ctx.fillStyle = '#273c2c';
  lines.forEach((line, y) => [...line].forEach((v, x) => {
    if (v === '#') ctx.fillRect(ox + x, oy + y, 1, 1);
  }));
}
function heart(x, y, filled) {
  const rows = ['.#.#.','#####','#####','.###.','..#..'];
  if (!filled) {
    ctx.fillStyle = '#566e51';
    for (const [yy, line] of rows.entries()) for (const [xx, pixel] of [...line].entries()) {
      if (pixel === '#' && (yy === 0 || yy === 3 || yy === 4 || xx === 0 || xx === 4)) ctx.fillRect(x + xx, y + yy, 1, 1);
    }
  } else pixels(rows, x, y);
}
function lcd() {
  ctx.fillStyle = '#c9d5aa'; ctx.fillRect(0, 0, 32, 16);
  ctx.fillStyle = '#b0bea064';
  for (let y = 0; y < 16; y += 4) for (let x = 0; x < 32; x += 4) {
    if ((x + y) % 8 === 0) ctx.fillRect(x, y, 1, 1);
  }
  if (state.phase === 'setup' || state.phase === 'clock-edit' || screen === 'clock') {
    const clock = state.phase === 'setup' || state.phase === 'clock-edit'
      ? { hour: state.clockHour, minute: state.clockMinute } : virtualClock(state);
    const hour = clock.hour % 12 || 12;
    print(`${hour}:${String(clock.minute).padStart(2, '0')}`, 4);
    print(clock.hour >= 12 ? 'P' : 'A', 11);
    return;
  }
  if (state.phase === 'egg') {
    pixels(sprites.egg, 12 + (Math.floor(Date.now() / 850) % 2), 5);
    return;
  }
  if (state.phase === 'finished') {
    if (terminalPage) {
      print(`${state.age}Y`, 2); print(`${state.weight}g`, 9);
    } else {
      // Original JP end presentation to be reconstructed from permission-safe references.
      pixels(['...###...','..#####..','.##.#.##.','.#######.','...###...'], 11, 4);
      print('END', 12);
    }
    return;
  }
  if (screen === 'menu') {
    print(selected === 0 ? option === 0 ? 'MEAL' : 'SNACK' : option === 0 ? 'ON' : 'OFF', 6);
    return;
  }
  if (screen === 'meter') {
    if (meterPage === 0) {
      print(`${state.age}Y`, 2); print(`${state.weight}g`, 9);
    } else if (meterPage === 1) {
      print('D', 1);
      ctx.fillStyle = '#6c8266'; ctx.fillRect(2, 9, 28, 4);
      ctx.fillStyle = '#273c2c'; ctx.fillRect(2, 9, 7 * state.discipline, 4);
    } else {
      print(meterPage === 2 ? 'H' : 'P', 1);
      const current = meterPage === 2 ? state.hunger : state.happiness;
      for (let i = 0; i < 4; i++) heart(3 + i * 7, 9, i < current);
    }
    return;
  }
  if (screen === 'game') {
    if (state.game?.rounds === 5) {
      print(`${state.game.correct}/5`, 2); print(state.game.correct >= 3 ? 'WIN' : 'LOSE', 9);
    } else {
      const idx = state.game?.lastDirection === 'left' ? 3 : 21;
      pixels(sprites[state.character] ?? sprites.Marutchi, idx, 4);
      print(`${state.game?.rounds ?? 0}/5`, 11);
    }
    return;
  }
  if (!state.lightsOn) {
    ctx.fillStyle = '#819575'; ctx.fillRect(0, 0, 32, 16);
    return;
  }
  const frame = Math.floor(Date.now() / 800) % 2;
  pixels(sprites[state.character] ?? sprites.Babytchi, 11 + frame, 5);
  if (!state.awake) print('Z', 1);
  if (state.sick) pixels(['###','#.#','###'], 26, 1);
  for (let p = 0; p < state.waste; p++) pixels(['.##.','####','####'], 28 - p * 6, 12);
}
function render() {
  advance();
  for (const [index, icon] of ICONS.entries()) {
    const el = $(`icon-${index}`);
    el.classList.toggle('active', selected === index && screen === 'main' && state.phase === 'alive');
    el.classList.toggle('attention', index === 7 && !!state.call);
  }
  lcd();
  const clockEdit = state.phase === 'clock-edit' || state.phase === 'setup';
  const title = clockEdit ? 'Set the time' : state.phase === 'egg' ? 'Waiting for the egg' :
    state.phase === 'finished' ? 'Life cycle complete' : screen === 'clock' ? 'Clock' :
    screen === 'menu' ? selected === 0 ? 'Choose food' : 'Choose light' :
    screen === 'meter' ? ['Age & weight','Discipline','Hungry','Happy'][meterPage] :
    screen === 'game' ? 'Left or right?' : selected >= 0 ? label[selected] : state.character;
  const hint = clockEdit ? 'A = hour  ·  B = minute  ·  C = confirm' :
    state.phase === 'finished' ? 'B = final age  ·  A+C = another egg' :
    state.phase === 'egg' ? 'B = clock  ·  hatch after 5 minutes' :
    screen === 'clock' ? 'B = back  ·  A+C = set time' :
    screen === 'menu' ? 'A = change  ·  B = select  ·  C = back' :
    screen === 'game' ? 'A = left  ·  B = right  ·  C = exit' :
    screen === 'meter' ? 'A/B = next  ·  C = back' : 'A = icon  ·  B = confirm  ·  C = cancel';
  $('screen-label').textContent = title;
  $('outcome').textContent = hint;
  $('help').textContent = `${state.lastOutcome}. ${state.muted ? 'Sound muted.' : 'Sound enabled.'} Character animations, timings and sounds are reference approximations.`;
  const stats = [
    `Character: ${state.character}`, `Age: ${state.age} y`,
    `Weight: ${state.weight} g`, `Hunger: ${state.hunger}/4`,
    `Happiness: ${state.happiness}/4`, `Discipline: ${state.discipline * 25}%`,
    `Waste: ${state.waste}`, `Sick: ${state.sick ? 'yes' : 'no'}`,
    `Care mistakes: ${state.careMistakes}`, `Attention: ${state.call ?? 'none'}`
  ];
  $('stats').replaceChildren(...stats.map(t => {
    const el = document.createElement('span'); el.textContent = t; return el;
  }));
}
function beep(which) {
  if (state.muted) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') void audio.resume();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = 'square'; oscillator.frequency.value = which === 'C' ? 590 : which === 'B' ? 850 : 725;
    oscillator.connect(gain); gain.connect(audio.destination);
    const t = audio.currentTime;
    gain.gain.setValueAtTime(.025, t);
    gain.gain.exponentialRampToValueAtTime(.0001, t + .08);
    oscillator.start(t); oscillator.stop(t + .09);
  } catch { /* Web Audio may be unavailable. Gameplay continues silently. */ }
}
function press(which) {
  advance(); beep(which);
  if (state.phase === 'setup' || state.phase === 'clock-edit') {
    action(which === 'A' ? 'hour' : which === 'B' ? 'minute' : 'confirmClock');
    screen = 'main'; return render();
  }
  if (state.phase === 'finished') { if (which === 'B') terminalPage = !terminalPage; return render(); }
  if (screen === 'clock') { if (which === 'B' || which === 'C') screen = 'main'; return render(); }
  if (state.phase === 'egg') { if (which === 'B') screen = 'clock'; return render(); }
  if (screen === 'menu') {
    if (which === 'A') option = 1 - option;
    else if (which === 'C') { screen = 'main'; selected = -1; }
    else {
      if (selected === 0) action(option === 0 ? 'meal' : 'snack');
      else action('lights', option === 0);
      screen = 'main'; selected = -1;
    }
  } else if (screen === 'meter') {
    if (which === 'C') { screen = 'main'; selected = -1; }
    else meterPage = (meterPage + 1) % 4;
  } else if (screen === 'game') {
    if (which === 'C') { action('gameCancel'); screen = 'main'; selected = -1; }
    else if (state.game?.rounds === 5) action('gameStart');
    else action('guess', which === 'A' ? 'left' : 'right');
  } else {
    if (which === 'A') selected = (selected + 1) % 7;
    else if (which === 'C') selected = -1;
    else if (selected === -1) screen = 'clock';
    else if ([0, 1].includes(selected)) { option = 0; screen = 'menu'; }
    else if (selected === 2) { action('gameStart'); if (state.game) screen = 'game'; selected = -1; }
    else if (selected === 3) { action('medicine'); selected = -1; }
    else if (selected === 4) { action('clean'); selected = -1; }
    else if (selected === 5) { meterPage = 0; screen = 'meter'; selected = -1; }
    else if (selected === 6) { action('discipline'); selected = -1; }
  }
  render();
}
for (const id of ['a','b','c']) $(id).addEventListener('click', () => press(id.toUpperCase()));
function combo() {
  advance();
  if (state.phase === 'finished') { action('restart'); terminalPage = false; }
  else if (screen === 'clock') { action('beginClockEdit'); screen = 'main'; }
  else if (state.phase === 'alive' && screen === 'main') action('mute');
  selected = -1; render();
}
$('combo').addEventListener('click', combo);
document.addEventListener('keydown', e => {
  if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
  const key = e.key.toLowerCase();
  if (e.shiftKey && (key === 'a' || key === 'c')) { e.preventDefault(); combo(); return; }
  const map = { a:'A', b:'B', c:'C', '1':'A', '2':'B', '3':'C' };
  if (map[key]) { e.preventDefault(); press(map[key]); }
});
$('export').addEventListener('click', () => {
  advance();
  const data = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(data); const a = document.createElement('a');
  a.href = url; a.download = 'p1-save-v2.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$('import').addEventListener('change', async e => {
  const f = e.target.files?.[0]; if (!f) return;
  try {
    const parsed = JSON.parse(await f.text());
    if (parsed.version !== VERSION || !['setup','clock-edit','egg','alive','finished'].includes(parsed.phase) ||
        !Number.isFinite(parsed.updatedAt) || !Array.isArray(parsed.events) || !Number.isFinite(parsed.lastMinuteAt))
      throw new Error('This backup is not a valid P1 v2 save.');
    state = parsed; screen = 'main'; selected = -1; save(); render();
  } catch (err) { window.alert(`Unable to load backup: ${err.message}`); }
  e.target.value = '';
});
setInterval(render, 1000);
render();