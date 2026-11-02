// Prototype-only P1 simulation core. Non-verified timings are explicitly provisional.
// No proprietary sprites, ROMs, or audio assets are bundled.
export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
export const ICONS = Object.freeze(["feed", "light", "toilet", "meter", "game", "medicine", "discipline", "attention"]);

// Original-1996 values are not yet reverse-engineered. Replace by observed profiles.
export const PROVISIONAL = Object.freeze({
  hatchMs: 5 * MINUTE,
  babyMs: 65 * MINUTE,
  teenMs: 3 * DAY,
  adultMs: 6 * DAY,
  lifeMs: 15 * DAY,
  hungryDecayMinutes: { baby: 10, child: 45, teen: 50, adult: 45 },
  happyDecayMinutes: { baby: 12, child: 55, teen: 60, adult: 55 },
  wasteMinutes: 180,
  attentionMs: 15 * MINUTE
});

export function createGame(now = Date.now()) {
  const clock = new Date(now);
  return {
    version: 1, phase: "setup", stage: "egg", character: "egg",
    clockHour: clock.getHours(), clockMinute: clock.getMinutes(),
    startedAt: null, hatchAt: null, bornAt: null,
    updatedAt: now, lastMinuteAt: now, activeMinutes: 0, ageDays: 0,
    hunger: 0, happiness: 0, discipline: 0, weight: 5,
    careMistakes: 0, disciplineMisses: 0,
    awake: true, lightsOn: true, muted: false, sick: false, medicineDoses: 0,
    waste: 0, nextWasteAt: null, snackCount: 0,
    call: null, callExpiresAt: null, nextFalseCallAt: null,
    game: null, rng: 0x6d2b79f5,
    events: [], lastOutcome: "Ready to set clock"
  };
}
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const record = (s, t, kind, details = "") => {
  s.events.push({ t, kind, details });
  if (s.events.length > 120) s.events.splice(0, s.events.length - 120);
};
function randomBit(s) {
  // Portable reproducible xorshift32; original firmware RNG is still unknown.
  let x = s.rng >>> 0;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  s.rng = x >>> 0;
  return s.rng & 1;
}
function callFor(s, t, reason) {
  if (s.call || s.phase !== "alive") return;
  s.call = reason;
  s.callExpiresAt = t + PROVISIONAL.attentionMs;
  record(s, t, "attention", reason);
}
function maybeClearNeeds(s) {
  if (s.call === "needs" && s.hunger > 0 && s.happiness > 0) {
    s.call = null; s.callExpiresAt = null;
  }
  if (s.call === "sleep" && !s.lightsOn) {
    s.call = null; s.callExpiresAt = null;
  }
}
function evolution(s, t) {
  if (s.phase !== "alive") return;
  const age = t - s.bornAt;
  let stage = age >= PROVISIONAL.adultMs ? "adult" :
    age >= PROVISIONAL.teenMs ? "teen" :
    age >= PROVISIONAL.babyMs ? "child" : "baby";
  if (stage === s.stage) return;
  s.stage = stage;
  // APPROXIMATION, not historical evolution tree!
  if (stage === "child") s.character = "Marutchi";
  if (stage === "teen") s.character = s.careMistakes <= 2 ? "Tamatchi" : "Kuchitamatchi";
  if (stage === "adult") {
    const good = s.careMistakes <= 2 && s.disciplineMisses <= 1;
    s.character = good ? "Mametchi" : s.careMistakes <= 5 ? "Kuchipatchi" : "Tarakotchi";
  }
  record(s, t, "evolution", s.character);
  s.lastOutcome = "Evolved into " + s.character;
}
function minuteStep(s, t) {
  if (s.phase === "egg") {
    if (t >= s.hatchAt) {
      s.phase = "alive"; s.stage = "baby"; s.character = "Babytchi";
      s.bornAt = s.hatchAt; s.hunger = 0; s.happiness = 0;
      s.nextWasteAt = s.bornAt + 15 * MINUTE;
      s.nextFalseCallAt = s.bornAt + 6 * HOUR;
      record(s, t, "hatch");
      s.lastOutcome = "Egg hatched";
      callFor(s, t, "needs");
    }
    return;
  }
  if (s.phase !== "alive") return;
  if (t - s.bornAt >= PROVISIONAL.lifeMs || s.careMistakes >= 18) {
    s.phase = "finished"; s.stage = "finished"; s.call = null;
    s.lastOutcome = "This pet's lifecycle has ended";
    record(s, t, "lifecycle-complete");
    return;
  }
  evolution(s, t);
  // Simplified sleep schedule, subject to physical-device verification.
  const hour = (new Date(t).getHours() + s.clockHour - new Date(s.startedAt).getHours() + 24) % 24;
  const bedtime = s.stage === "child" ? 20 : s.stage === "teen" ? 21 : 22;
  const sleeping = s.stage !== "baby" && (hour >= bedtime || hour < 9);
  if (sleeping !== !s.awake) {
    s.awake = !sleeping;
    record(s, t, sleeping ? "sleep" : "wake");
    if (sleeping && s.lightsOn) callFor(s, t, "sleep");
    if (!sleeping) {
      s.ageDays = Math.floor((t - s.bornAt) / DAY);
      if (s.call === "sleep") { s.call = null; s.callExpiresAt = null; }
    }
  }
  if (s.call && t >= s.callExpiresAt) {
    if (s.call === "discipline") s.disciplineMisses += 1;
    else s.careMistakes += 1;
    record(s, t, "missed-call", s.call);
    s.call = null; s.callExpiresAt = null;
  }
  if (!s.awake) return;
  s.activeMinutes++;
  const hn = PROVISIONAL.hungryDecayMinutes[s.stage];
  const hp = PROVISIONAL.happyDecayMinutes[s.stage];
  if (s.activeMinutes % hn === 0) s.hunger = clamp(s.hunger - 1, 0, 4);
  if (s.activeMinutes % hp === 0) s.happiness = clamp(s.happiness - 1, 0, 4);
  if (t >= s.nextWasteAt) {
    s.waste = clamp(s.waste + 1, 0, 4);
    s.nextWasteAt = t + (s.stage === "baby" ? 25 : PROVISIONAL.wasteMinutes) * MINUTE;
    record(s, t, "waste");
    if (s.waste >= 3) s.sick = true;
  }
  if (t >= s.nextFalseCallAt && s.hunger > 0 && s.happiness > 0 && s.discipline < 4) {
    callFor(s, t, "discipline");
    s.nextFalseCallAt = t + 6 * HOUR;
  }
  if (!s.call && (s.hunger === 0 || s.happiness === 0)) callFor(s, t, "needs");
}
export function advanceGame(source, now = Date.now()) {
  const s = structuredClone(source);
  if (!Number.isFinite(now) || now < s.updatedAt) return s;
  if (s.phase === "setup" || s.phase === "clock-edit") { s.updatedAt = now; s.lastMinuteAt = now; return s; }
  // Long gaps are simulated at one-minute resolution for up to 30 days. A historical
  // pet should already reach terminal state in this period under provisional rules.
  const target = Math.min(now, s.lastMinuteAt + 30 * DAY);
  while (s.lastMinuteAt + MINUTE <= target) {
    s.lastMinuteAt += MINUTE;
    minuteStep(s, s.lastMinuteAt);
    if (s.phase === "finished") break;
  }
  s.updatedAt = now;
  return s;
}
export function performAction(source, action, now = Date.now(), payload = null) {
  const s = advanceGame(source, now);
  if (s.phase === "setup") {
    if (action === "hour") s.clockHour = (s.clockHour + 1) % 24;
    if (action === "minute") s.clockMinute = (s.clockMinute + 1) % 60;
    if (action === "confirmClock") {
      s.phase = "egg"; s.startedAt = now; s.hatchAt = now + PROVISIONAL.hatchMs;
      s.lastMinuteAt = now;
      record(s, now, "clock-set");
      s.lastOutcome = "Egg is waiting to hatch";
    }
    return s;
  }
  if (s.phase === "finished") {
    if (action === "restart") {
      const next = createGame(now);
      next.phase = "egg"; next.startedAt = now;
      next.hatchAt = now + PROVISIONAL.hatchMs;
      next.clockHour = s.clockHour; next.clockMinute = s.clockMinute;
      next.muted = s.muted;
      return next;
    }
    return s;
  }
  if (action === "mute" && s.phase === "alive") {
    s.muted = !s.muted; return s;
  }
  if (s.phase !== "alive") return s;
  if (action === "lights") {
    s.lightsOn = !!payload;
    maybeClearNeeds(s);
    s.lastOutcome = s.lightsOn ? "Lights on" : "Lights off";
    return s;
  }
  if (!s.awake || !s.lightsOn) { s.lastOutcome = "Unavailable while resting or dark"; return s; }
  if (action === "clean") {
    s.waste = 0; s.lastOutcome = "Cleaned"; record(s, now, "clean");
    return s;
  }
  if (action === "medicine") {
    if (s.sick) {
      s.medicineDoses++;
      // Physical original may require one or two doses, exact decision rule unverified.
      if (s.medicineDoses >= 2) { s.sick = false; s.medicineDoses = 0; }
      s.lastOutcome = s.sick ? "Medicine given" : "Recovered";
    } else s.lastOutcome = "No medicine needed";
    return s;
  }
  if (action === "discipline") {
    if (s.call === "discipline") {
      s.discipline = clamp(s.discipline + 1, 0, 4);
      s.call = null; s.callExpiresAt = null;
      s.lastOutcome = "Discipline increased";
      record(s, now, "discipline-success");
    } else s.lastOutcome = "No discipline needed";
    return s;
  }
  if (s.sick) { s.lastOutcome = "Pet needs medicine"; return s; }
  if (action === "meal") {
    if (s.hunger < 4) {
      s.hunger++; s.weight++; s.lastOutcome = "Meal eaten";
    } else s.lastOutcome = "Already full";
    maybeClearNeeds(s);
  } else if (action === "snack") {
    if (s.happiness < 4) {
      s.happiness++; s.weight += 2; s.snackCount++;
      if (s.snackCount >= 10) s.sick = true; // placeholder threshold
      s.lastOutcome = "Snack eaten";
    } else s.lastOutcome = "Already happy";
    maybeClearNeeds(s);
  } else if (action === "gameStart") {
    s.game = { rounds: 0, correct: 0, lastGuess: null, lastDirection: null };
    s.lastOutcome = "Guess left or right";
  } else if (action === "gameCancel") {
    s.game = null; s.lastOutcome = "Game stopped";
  } else if (action === "guess" && s.game) {
    if (s.game.rounds >= 5) return s;
    const direction = randomBit(s) ? "right" : "left";
    s.game.rounds++;
    s.game.lastGuess = payload; s.game.lastDirection = direction;
    if (payload === direction) s.game.correct++;
    s.lastOutcome = payload === direction ? "Correct!" : "Miss!";
    if (s.game.rounds === 5) {
      if (s.game.correct >= 3) s.happiness = clamp(s.happiness + 1, 0, 4);
      s.weight = Math.max(5, s.weight - 1);
      s.lastOutcome = `Game: ${s.game.correct}/5 correct`;
      record(s, now, "game", s.lastOutcome);
      maybeClearNeeds(s);
    }
  }
  return s;
}
