import test from "node:test";
import assert from "node:assert/strict";
import { createGame, advanceGame, performAction, MINUTE, PROVISIONAL } from "../src/engine.js";

const T = Date.UTC(2026, 0, 1, 12);
function hatch() {
  let s = createGame(T);
  s = performAction(s, "confirmClock", T);
  return advanceGame(s, T + PROVISIONAL.hatchMs);
}

test("clock must be confirmed before the egg begins its timer", () => {
  const s = createGame(T);
  assert.equal(advanceGame(s, T + 30 * MINUTE).phase, "setup");
  const e = performAction(s, "confirmClock", T);
  assert.equal(e.phase, "egg");
  assert.equal(advanceGame(e, T + 4 * MINUTE).phase, "egg");
  assert.equal(advanceGame(e, T + 5 * MINUTE).character, "Babytchi");
});

test("original-style A and B clock adjustments wrap", () => {
  const s = createGame(T);
  s.clockHour = 23; s.clockMinute = 59;
  assert.equal(performAction(s, "hour", T).clockHour, 0);
  assert.equal(performAction(s, "minute", T).clockMinute, 0);
});

test("meals and snacks increase distinct needs; four-heart limit", () => {
  let s = hatch();
  const baseWeight = s.weight;
  s = performAction(s, "meal", T + 5 * MINUTE);
  assert.equal(s.hunger, 1);
  assert.equal(s.happiness, 0);
  assert.equal(s.weight, baseWeight + 1);
  s = performAction(s, "snack", T + 5 * MINUTE);
  assert.equal(s.happiness, 1);
  assert.equal(s.weight, baseWeight + 3);
  for (let i = 0; i < 10; i++) s = performAction(s, "meal", T + 5 * MINUTE);
  assert.equal(s.hunger, 4);
});

test("hatching call is cleared after both needs have been addressed", () => {
  let s = hatch();
  assert.equal(s.call, "needs");
  s = performAction(s, "meal", T + 5 * MINUTE);
  assert.equal(s.call, "needs");
  s = performAction(s, "snack", T + 5 * MINUTE);
  assert.equal(s.call, null);
});

test("ignored needs create care mistake after attention window", () => {
  let s = hatch();
  s = advanceGame(s, T + 21 * MINUTE);
  assert.ok(s.careMistakes >= 1);
});

test("correct discipline calls raise discipline by a quarter", () => {
  let s = hatch();
  s.hunger = 3; s.happiness = 3;
  s.call = "discipline"; s.callExpiresAt = T + 30 * MINUTE;
  s = performAction(s, "discipline", T + 6 * MINUTE);
  assert.equal(s.discipline, 1);
  assert.equal(s.call, null);
});

test("five guesses end game, with bounded happiness and weight", () => {
  let s = hatch();
  s = performAction(s, "gameStart", T + 5 * MINUTE);
  for (let i = 0; i < 5; i++) s = performAction(s, "guess", T + 5 * MINUTE, "left");
  assert.equal(s.game.rounds, 5);
  assert.match(s.lastOutcome, /Game:/);
  assert.ok(s.happiness >= 0 && s.happiness <= 4);
  assert.ok(s.weight >= 5);
});

test("muting is reversible and terminal pets can restart as eggs", () => {
  let s = hatch();
  s = performAction(s, "mute", T + 5 * MINUTE);
  assert.equal(s.muted, true);
  s = performAction(s, "mute", T + 5 * MINUTE);
  assert.equal(s.muted, false);
  s.phase = "finished";
  s = performAction(s, "restart", T + 6 * MINUTE);
  assert.equal(s.phase, "egg");
  assert.equal(s.hatchAt, T + 6 * MINUTE + PROVISIONAL.hatchMs);
});

test("saved states are JSON portable and advance deterministically", () => {
  const s = hatch();
  const restored = JSON.parse(JSON.stringify(s));
  assert.deepEqual(advanceGame(restored, T + 11 * MINUTE), advanceGame(s, T + 11 * MINUTE));
});

test("zero dependency state transition does not mutate inputs", () => {
  const s = hatch();
  const copy = structuredClone(s);
  performAction(s, "meal", T + 5 * MINUTE);
  assert.deepEqual(s, copy);
});
