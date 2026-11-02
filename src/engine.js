/**
 * 1996 Japanese P1 behavioral reconstruction (research build).
 * No original game ROM/firmware, sprites or recorded sounds are distributed.
 * Values not established by first-party hardware captures are tagged as approximations.
 *
 * Source notes: docs/ACCURACY.md
 */
export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
export const ICONS = Object.freeze(['feed', 'light', 'game', 'medicine', 'toilet', 'meter', 'discipline', 'attention']);
export const VERSION = 2;
export const PROFILE = Object.freeze({
  hatchMinutes: 5, babyMinutes: 65, childMinutes: 48 * 60,
  teenMinutes: { Tamatchi: 72 * 60, Kuchitamatchi: 48 * 60 },
  attentionMinutes: 15, babyNapStart: 40, babyNapEnd: 45,
  babyIllnessMinute: 33, babyPoopMinutes: [15, 45],
  // Rates are research estimates (adult rates change with age on hardware).
  rates: {
    Babytchi: [3, 4], Marutchi: [50, 60],
    Tamatchi: [55, 65], Kuchitamatchi: [50, 55],
    Mametchi: [65, 70], Ginjirotchi: [55, 60], Maskutchi: [50, 55],
    Kuchipatchi: [45, 50], Nyorotchi: [40, 45], Tarakotchi: [35, 40], Oyajitchi: [60, 65]
  },
  poopMinutes: { Babytchi: 30, Marutchi: 180, Tamatchi: 180, Kuchitamatchi: 180, default: 180 },
  adultLifeDays: { Mametchi: 16, Ginjirotchi: 12, Maskutchi: 16,
    Kuchipatchi: 6, Nyorotchi: 3, Tarakotchi: 4, Oyajitchi: 16 },
  minWeight: { Babytchi: 5, Marutchi: 10, Tamatchi: 20, Kuchitamatchi: 20,
    Mametchi: 30, Ginjirotchi: 30, Maskutchi: 30,
    Kuchipatchi: 20, Nyorotchi: 10, Tarakotchi: 20, Oyajitchi: 30 }
});
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const log = (s, time, type, info = '') => {
  s.events.push({ time, type, info });
  if (s.events.length > 100) s.events.shift();
};
const isPet = s => s.phase === 'alive';
const isFinished = s => s.phase === 'finished';
const mod = (x, y) => ((x % y) + y) % y;
const mintime = (s, time) => mod(s.clockMinuteOfDay + Math.floor((time - s.clockAnchor) / MINUTE), 1440);
export function virtualClock(s, now = s.updatedAt) {
  const total = mintime(s, now);
  return { hour: Math.floor(total / 60), minute: total % 60 };
}
export function minWeight(character) { return PROFILE.minWeight[character] ?? 5; }
export function createGame(now = Date.now()) {
  const d = new Date(now);
  return {
    version: VERSION, phase: 'setup', stage: 'egg', character: 'egg', teenType: null,
    clockHour: d.getHours(), clockMinute: d.getMinutes(),
    clockMinuteOfDay: d.getHours() * 60 + d.getMinutes(), clockAnchor: now,
    clockReturnPhase: null, pausedAt: null,
    startedAt: null, bornAt: null, stageAt: null, lastMinuteAt: now, updatedAt: now,
    age: 0, hunger: 0, happiness: 0, discipline: 0, weight: 5,
    careMistakes: 0, stageCareMistakes: 0, disciplineMisses: 0,
    awake: true, lightsOn: true, muted: false,
    waste: 0, sick: false, medicineRemaining: 0,
    babyIllnessSeen: false, babyPoopEvents: 0,
    nextWasteAt: null, stageMinute: 0, hungryMinute: 0, happyMinute: 0,
    heartDrops: 0, nextDisciplineDrop: 6,
    call: null, callExpiresAt: null, needsCallArmed: true,
    game: null, rng: 0x2a6e4d19, events: [], lastOutcome: 'Set the clock'
  };
}
function born(s, time) {
  s.phase = 'alive'; s.stage = 'baby'; s.character = 'Babytchi'; s.bornAt = time;
  s.stageAt = time; s.hunger = 0; s.happiness = 0; s.weight = 5;
  s.nextWasteAt = null;
  s.lastOutcome = 'Egg hatched';
  log(s, time, 'hatch');
  call(s, time, 'needs');
}
function call(s, time, reason) {
  if (s.call || !isPet(s)) return;
  s.call = reason; s.callExpiresAt = time + PROFILE.attentionMinutes * MINUTE;
  if (reason === 'needs') s.needsCallArmed = false;
  log(s, time, 'attention', reason);
}
function resolveCall(s) {
  if (s.call === 'needs' && s.hunger > 0 && s.happiness > 0) {
    s.call = null; s.callExpiresAt = null; s.needsCallArmed = true;
  }
  if (s.call === 'sleep' && !s.lightsOn) {
    s.call = null; s.callExpiresAt = null;
  }
}
function changeCharacter(s, time, character, stage) {
  s.stage = stage; s.character = character; s.stageAt = time;
  s.stageMinute = 0; s.hungryMinute = 0; s.happyMinute = 0;
  s.weight = Math.max(s.weight, minWeight(character));
  s.sick = false; s.medicineRemaining = 0;
  s.nextWasteAt = time + (PROFILE.poopMinutes[character] ?? PROFILE.poopMinutes.default) * MINUTE;
  s.lastOutcome = `Grew into ${character}`;
  log(s, time, 'evolution', character);
  if (stage === 'child') {
    // The original baby stage does not influence future growth.
    s.hunger = 4; s.happiness = 4; s.discipline = 0;
    s.careMistakes = 0; s.stageCareMistakes = 0;
    s.disciplineMisses = 0; s.heartDrops = 0; s.nextDisciplineDrop = 6;
    s.call = null; s.callExpiresAt = null; s.needsCallArmed = true;
  } else {
    s.stageCareMistakes = 0;
  }
}
/** Classic 1996 JAPAN discipline-percentage growth model, not rerelease missed-call model. */
export function chooseTeen(careMistakes, discipline) {
  return { character: careMistakes <= 2 ? 'Tamatchi' : 'Kuchitamatchi',
    teenType: discipline >= 3 ? 1 : 2 };
}
export function chooseAdult(teen, teenType, careMistakes, discipline) {
  if (teen === 'Tamatchi') {
    if (careMistakes <= 2) {
      if (teenType === 1 && discipline === 4) return 'Mametchi';
      if ((teenType === 1 && discipline === 3) || (teenType === 2 && discipline === 4)) return 'Ginjirotchi';
      return 'Maskutchi';
    }
    if (teenType === 1 && discipline === 4) return 'Kuchipatchi';
    if ((teenType === 1 && discipline === 3) || (teenType === 2 && discipline === 4)) return 'Nyorotchi';
    return 'Tarakotchi';
  }
  if (teenType === 1 && discipline === 4) return 'Kuchipatchi';
  if ((teenType === 1 && discipline === 3) || (teenType === 2 && discipline === 4)) return 'Nyorotchi';
  return 'Tarakotchi';
}
function evolve(s, time) {
  const elapsed = (time - s.stageAt) / MINUTE;
  if (s.stage === 'baby' && elapsed >= PROFILE.babyMinutes) {
    changeCharacter(s, time, 'Marutchi', 'child');
  } else if (s.stage === 'child' && elapsed >= PROFILE.childMinutes) {
    const teen = chooseTeen(s.careMistakes, s.discipline);
    s.teenType = teen.teenType;
    changeCharacter(s, time, teen.character, 'teen');
    // Discipline resets at evolution: provisional, for comparing stage discipline.
    s.discipline = 0; s.heartDrops = 0; s.nextDisciplineDrop = 6;
  } else if (s.stage === 'teen' && elapsed >= PROFILE.teenMinutes[s.character]) {
    const adult = chooseAdult(s.character, s.teenType, s.careMistakes, s.discipline);
    s.canBecomeOyajitchi = adult === 'Maskutchi' && s.teenType === 2 && s.discipline === 0;
    changeCharacter(s, time, adult, 'adult');
  } else if (s.stage === 'adult' && s.character === 'Maskutchi' && s.canBecomeOyajitchi && elapsed >= 4 * 1440) {
    changeCharacter(s, time, 'Oyajitchi', 'adult');
    s.canBecomeOyajitchi = false;
  }
}
function sleeping(s, time) {
  if (s.stage === 'baby') {
    const minutes = (time - s.bornAt) / MINUTE;
    return minutes >= PROFILE.babyNapStart && minutes < PROFILE.babyNapEnd;
  }
  const clock = mintime(s, time);
  const schedule = {
    Marutchi: [20, 9], Tamatchi: [21, 9], Kuchitamatchi: [21, 9],
    Maskutchi: [23, 11], Tarakotchi: [22, 10]
  };
  const [bed, rise] = schedule[s.character] ?? [22, 9];
  const hh = Math.floor(clock / 60);
  return hh >= bed || hh < rise;
}
function nextBit(s) {
  let x = s.rng >>> 0;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  s.rng = x >>> 0;
  return (s.rng & 1) === 0 ? 'left' : 'right';
}
function finish(s, time, reason) {
  s.phase = 'finished'; s.stage = 'finished'; s.call = null; s.callExpiresAt = null;
  s.lastOutcome = reason; s.game = null;
  log(s, time, 'finished', reason);
}
function step(s, time) {
  if (s.phase === 'egg') {
    if (time - s.startedAt >= PROFILE.hatchMinutes * MINUTE) born(s, time);
    return;
  }
  if (!isPet(s)) return;
  evolve(s, time);
  if (s.stage === 'adult') {
    const lifespan = PROFILE.adultLifeDays[s.character] ?? 10;
    if (time - s.stageAt >= lifespan * DAY) { finish(s, time, 'Life cycle completed'); return; }
  }
  if (s.call && time >= s.callExpiresAt) {
    if (s.call !== 'discipline') {
      s.careMistakes++; s.stageCareMistakes++;
    } else s.disciplineMisses++;
    log(s, time, 'missed-call', s.call);
    s.call = null; s.callExpiresAt = null;
  }
  const wasAwake = s.awake;
  s.awake = !sleeping(s, time);
  if (s.awake !== wasAwake) {
    if (s.awake) {
      s.age++; s.lightsOn = true;
      if (s.call === 'sleep') { s.call = null; s.callExpiresAt = null; }
      log(s, time, 'wake');
    } else {
      log(s, time, 'sleep');
      if (s.lightsOn) call(s, time, 'sleep');
    }
  }
  s.stageMinute++;
  if (s.stage === 'baby') {
    const ageMinutes = Math.floor((time - s.bornAt) / MINUTE);
    if (PROFILE.babyPoopMinutes.includes(ageMinutes)) { s.waste = clamp(s.waste + 1, 0, 4); log(s, time, 'waste'); }
    if (ageMinutes === PROFILE.babyIllnessMinute) {
      s.sick = true; s.medicineRemaining = 2; s.babyIllnessSeen = true;
      log(s, time, 'sickness');
    }
  } else if (s.nextWasteAt && time >= s.nextWasteAt) {
    s.waste = clamp(s.waste + 1, 0, 4);
    s.nextWasteAt = time + (PROFILE.poopMinutes[s.character] ?? PROFILE.poopMinutes.default) * MINUTE;
    log(s, time, 'waste');
  }
  if (s.waste >= 4 && !s.sick) {
    s.sick = true; s.medicineRemaining = 2;
    log(s, time, 'sickness');
  }
  if (s.awake) {
    const [hungryRate, happyRate] = PROFILE.rates[s.character] ?? [60, 60];
    s.hungryMinute++; s.happyMinute++;
    if (s.hungryMinute >= hungryRate) {
      s.hungryMinute = 0;
      if (s.hunger > 0) { s.hunger--; s.heartDrops++; }
    }
    if (s.happyMinute >= happyRate) {
      s.happyMinute = 0;
      if (s.happiness > 0) { s.happiness--; s.heartDrops++; }
    }
    if (s.stage !== 'baby' && s.heartDrops >= s.nextDisciplineDrop && s.discipline < 4 &&
        s.hunger > 0 && s.happiness > 0 && !s.call) {
      call(s, time, 'discipline');
      s.nextDisciplineDrop += 6; // timing needs original firmware comparison
    }
    if (s.needsCallArmed && !s.call && (s.hunger === 0 || s.happiness === 0)) call(s, time, 'needs');
  }
  // Approximate extended neglect consequences. Original thresholds unverified.
  if (s.stage !== 'baby' && s.stageCareMistakes >= 12) finish(s, time, 'Life cycle completed');
}
export function advanceGame(source, now = Date.now()) {
  const s = structuredClone(source);
  if (now < s.updatedAt || !Number.isFinite(now)) return s;
  if (s.phase === 'setup' || s.phase === 'clock-edit') {
    s.updatedAt = now; return s;
  }
  // A 35-day cap is safely longer than all configured provisional lifespans.
  const target = Math.min(now, s.lastMinuteAt + 35 * DAY);
  while (s.lastMinuteAt + MINUTE <= target) {
    s.lastMinuteAt += MINUTE;
    step(s, s.lastMinuteAt);
    if (isFinished(s)) break;
  }
  s.updatedAt = now;
  return s;
}
function offsetPausedTimers(s, delta) {
  for (const key of ['startedAt', 'bornAt', 'stageAt', 'nextWasteAt', 'callExpiresAt']) {
    if (s[key] != null) s[key] += delta;
  }
}
export function performAction(source, action, now = Date.now(), payload = null) {
  const s = advanceGame(source, now);
  if (s.phase === 'setup' || s.phase === 'clock-edit') {
    if (action === 'hour') s.clockHour = (s.clockHour + 1) % 24;
    if (action === 'minute') s.clockMinute = (s.clockMinute + 1) % 60;
    if (action === 'confirmClock') {
      const paused = s.phase === 'clock-edit';
      if (paused) offsetPausedTimers(s, Math.max(0, now - s.pausedAt));
      s.clockMinuteOfDay = s.clockHour * 60 + s.clockMinute;
      s.clockAnchor = now;
      s.lastMinuteAt = now;
      s.phase = paused ? s.clockReturnPhase : 'egg';
      s.clockReturnPhase = null; s.pausedAt = null;
      if (!paused) s.startedAt = now;
      s.lastOutcome = paused ? 'Clock set' : 'Egg is hatching';
      log(s, now, 'clock-set');
    }
    return s;
  }
  if (s.phase === 'finished') {
    if (action === 'restart') {
      const next = createGame(now);
      next.phase = 'egg'; next.startedAt = now; next.lastMinuteAt = now;
      const clock = virtualClock(s, now);
      next.clockHour = clock.hour; next.clockMinute = clock.minute;
      next.clockMinuteOfDay = clock.hour * 60 + clock.minute;
      next.muted = s.muted;
      return next;
    }
    return s;
  }
  if (action === 'beginClockEdit' && ['alive', 'egg'].includes(s.phase)) {
    const clk = virtualClock(s, now);
    s.clockHour = clk.hour; s.clockMinute = clk.minute;
    s.clockReturnPhase = s.phase; s.pausedAt = now; s.phase = 'clock-edit';
    return s;
  }
  if (action === 'mute' && isPet(s)) { s.muted = !s.muted; return s; }
  if (!isPet(s)) return s;
  if (action === 'lights') {
    s.lightsOn = !!payload;
    resolveCall(s);
    s.lastOutcome = s.lightsOn ? 'Lights ON' : 'Lights OFF';
    return s;
  }
  if (action === 'clean') {
    s.waste = 0; s.lastOutcome = 'Cleaned'; log(s, now, 'clean'); return s;
  }
  if (action === 'medicine') {
    if (!s.sick) { s.lastOutcome = 'Not sick'; return s; }
    s.medicineRemaining--;
    if (s.medicineRemaining <= 0) {
      s.sick = false; s.medicineRemaining = 0;
      s.lastOutcome = 'Recovered';
    } else s.lastOutcome = 'Medicine given';
    log(s, now, 'medicine'); return s;
  }
  if (action === 'discipline') {
    if (s.call === 'discipline') {
      s.discipline = clamp(s.discipline + 1, 0, 4);
      s.call = null; s.callExpiresAt = null;
      s.lastOutcome = 'Discipline +25%';
      log(s, now, 'discipline');
    } else s.lastOutcome = 'No scolding needed';
    return s;
  }
  if (!s.awake || !s.lightsOn || s.sick) {
    s.lastOutcome = s.sick ? 'Medicine needed' : 'Pet is resting';
    return s;
  }
  if (action === 'meal') {
    if (s.call === 'discipline') { s.lastOutcome = 'Refused meal'; return s; }
    if (s.hunger < 4) {
      s.hunger++; s.weight = clamp(s.weight + (s.stage === 'baby' ? 0 : 1), minWeight(s.character), 99);
      s.lastOutcome = 'Meal';
    } else s.lastOutcome = 'Full';
    resolveCall(s);
  } else if (action === 'snack') {
    if (s.happiness < 4) s.happiness++;
    s.weight = clamp(s.weight + (s.stage === 'baby' ? 0 : 2), minWeight(s.character), 99);
    s.lastOutcome = 'Snack'; resolveCall(s);
  } else if (action === 'gameStart') {
    if (s.call === 'discipline') { s.lastOutcome = 'Refused game'; return s; }
    s.game = { rounds: 0, correct: 0, lastGuess: null, lastDirection: null };
    s.lastOutcome = 'Guess direction';
  } else if (action === 'gameCancel') {
    s.game = null; s.lastOutcome = 'Game cancelled';
  } else if (action === 'guess' && s.game && (payload === 'left' || payload === 'right')) {
    if (s.game.rounds >= 5) return s;
    const direction = nextBit(s);
    s.game.rounds++;
    s.game.lastGuess = payload; s.game.lastDirection = direction;
    if (payload === direction) s.game.correct++;
    s.lastOutcome = payload === direction ? 'Correct!' : 'Miss!';
    if (s.game.rounds === 5) {
      if (s.game.correct >= 3) s.happiness = clamp(s.happiness + 1, 0, 4);
      s.weight = Math.max(minWeight(s.character), s.weight - 1);
      s.lastOutcome = `Game: ${s.game.correct}/5`;
      log(s, now, 'game', s.lastOutcome);
      resolveCall(s);
    }
  }
  return s;
}