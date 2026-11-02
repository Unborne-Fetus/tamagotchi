import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, advanceGame, performAction, virtualClock, chooseTeen, chooseAdult, minWeight, ICONS, MINUTE, HOUR, DAY } from '../src/engine.js';
const T = Date.UTC(2026, 0, 1, 12);
const cmd = (s, name, minutes = 0, payload = null) => performAction(s, name, T + minutes * MINUTE, payload);
const begin = () => cmd(createGame(T), 'confirmClock');
const hatch = () => advanceGame(begin(), T + 5 * MINUTE);
const force = (patch, now = T + 6 * MINUTE) => ({ ...hatch(), ...patch, updatedAt: now, lastMinuteAt: now });

test('P1 original icon layout: top feed/light/game/medicine; bottom toilet/meter/discipline/attention', () => {
  assert.deepEqual(ICONS, ['feed','light','game','medicine','toilet','meter','discipline','attention']);
});
test('egg needs clock set and hatches after five minutes', () => {
  const s = createGame(T);
  assert.equal(advanceGame(s, T + HOUR).phase, 'setup');
  const b = begin();
  assert.equal(advanceGame(b, T + 4 * MINUTE).phase, 'egg');
  assert.equal(hatch().character, 'Babytchi');
  assert.equal(hatch().call, 'needs');
});
test('A and B set hours and minutes; clock tracks simulated wall elapsed minutes', () => {
  const s = createGame(T);
  s.clockHour = 23; s.clockMinute = 59;
  assert.equal(cmd(s, 'hour').clockHour, 0);
  assert.equal(cmd(s, 'minute').clockMinute, 0);
  const b = cmd(s, 'confirmClock');
  assert.deepEqual(virtualClock(b, T + 2 * MINUTE), { hour: 0, minute: 1 });
});
test('P1 baby scheduled waste and illness, 5min nap, waking advances age', () => {
  let s = advanceGame(begin(), T + 5 * MINUTE);
  s = advanceGame(s, T + 20 * MINUTE);
  assert.equal(s.waste, 1);
  s = advanceGame(s, T + 38 * MINUTE);
  assert.equal(s.sick, true);
  assert.equal(s.medicineRemaining, 2);
  s = advanceGame(s, T + 45 * MINUTE);
  assert.equal(s.awake, false);
  s = advanceGame(s, T + 50 * MINUTE);
  assert.equal(s.awake, true);
  assert.equal(s.age, 1);
});
test('baby is practice stage: weight fixed and evolution resets care statistics', () => {
  let s = hatch();
  s = cmd(s, 'meal', 5);
  assert.equal(s.weight, 5);
  s.careMistakes = 9;
  s.disciplineMisses = 3;
  s = advanceGame(s, T + 70 * MINUTE);
  assert.equal(s.character, 'Marutchi');
  assert.equal(s.weight, 10);
  assert.equal(s.careMistakes, 0);
  assert.equal(s.disciplineMisses, 0);
});
test('two medicine doses clear the baby stage illness', () => {
  let s = advanceGame(hatch(), T + 38 * MINUTE);
  s = cmd(s, 'medicine', 38);
  assert.equal(s.sick, true);
  s = cmd(s, 'medicine', 38);
  assert.equal(s.sick, false);
});
test('four hearts cap; meals +1g, snacks +2g outside baby', () => {
  let s = force({ stage:'child', character:'Marutchi', stageAt: T + 5 * MINUTE,
    hunger:0, happiness:0, weight:10, call:null });
  s = cmd(s, 'meal', 6);
  s = cmd(s, 'snack', 6);
  assert.equal(s.hunger, 1);
  assert.equal(s.happiness, 1);
  assert.equal(s.weight, 13);
  for(let i=0;i<10;i++) s=cmd(s,'meal',6);
  assert.equal(s.hunger, 4);
});
test('needs call resolved only when both needs above zero; attention window is 15 min', () => {
  let s = hatch();
  s = cmd(s, 'meal', 5);
  assert.equal(s.call,'needs');
  s = cmd(s, 'snack', 5);
  assert.equal(s.call, null);
  let forgotten = advanceGame(hatch(), T + 21 * MINUTE);
  assert.ok(forgotten.careMistakes >= 1);
});
test('missed false discipline call increases no 1996 care mistakes', () => {
  let s = force({ call:'discipline', callExpiresAt:T + 8*MINUTE,
    hunger:3, happiness:3, stage:'child', character:'Marutchi' });
  s = advanceGame(s, T + 9*MINUTE);
  assert.equal(s.careMistakes, 0);
  assert.equal(s.disciplineMisses, 1);
});
test('valid scolding gives one quarter, invalid does not', () => {
  let s = force({ call:'discipline', callExpiresAt:T+20*MINUTE, hunger:3,
    happiness:3, stage:'child', character:'Marutchi' });
  s = cmd(s, 'discipline', 6);
  assert.equal(s.discipline, 1);
  assert.equal(s.call, null);
  s = cmd(s, 'discipline', 6);
  assert.equal(s.discipline, 1);
});
test('original discipline-based P1 evolution chooses every regular adult', () => {
  assert.deepEqual(chooseTeen(2, 3), {character:'Tamatchi', teenType:1});
  assert.deepEqual(chooseTeen(3, 2), {character:'Kuchitamatchi', teenType:2});
  const cases = [
    ['Tamatchi',1,0,4,'Mametchi'],
    ['Tamatchi',1,0,3,'Ginjirotchi'],
    ['Tamatchi',1,0,2,'Maskutchi'],
    ['Tamatchi',1,3,4,'Kuchipatchi'],
    ['Tamatchi',1,3,3,'Nyorotchi'],
    ['Tamatchi',1,3,2,'Tarakotchi'],
    ['Kuchitamatchi',2,2,4,'Nyorotchi'],
    ['Kuchitamatchi',2,2,3,'Tarakotchi']
  ];
  for (const [teen,type,mistakes,discipline,want] of cases) {
    assert.equal(chooseAdult(teen,type,mistakes,discipline), want);
  }
});
test('game 3+ of 5 wins happiness, loses weight even on loss, floor respected', () => {
  let s = force({ stage:'child', character:'Marutchi', hunger:4,
    happiness:2, weight:15, call:null });
  s = cmd(s, 'gameStart', 6);
  for(let i=0;i<5;i++) s=cmd(s,'guess',6, 'left');
  assert.equal(s.game.rounds, 5);
  assert.equal(s.weight, 14);
  assert.ok(s.happiness === 2 || s.happiness === 3);
  s = { ...s, weight:minWeight('Marutchi') };
  s = cmd(s,'gameStart',6);
  for(let i=0;i<5;i++) s=cmd(s,'guess',6,'right');
  assert.equal(s.weight, minWeight('Marutchi'));
});
test('clock edit pauses simulation and resumes with new time, no resource depletion', () => {
  let s = hatch();
  s = cmd(s, 'meal', 5);
  s = cmd(s, 'snack', 5);
  s = cmd(s, 'beginClockEdit', 6);
  assert.equal(s.phase, 'clock-edit');
  const before = s.hunger;
  s = advanceGame(s, T + 100 * MINUTE);
  assert.equal(s.hunger, before);
  s = performAction(s, 'confirmClock', T + 100*MINUTE);
  assert.equal(s.phase, 'alive');
  assert.equal(s.hunger, before);
  assert.equal(s.stage, 'baby');
  assert.equal(s.bornAt, T + 5 * MINUTE + 94*MINUTE);
});
test('sleep light can be switched off while sleeping; morning restores lights and adds age', () => {
  let s = force({ stage:'child', character:'Marutchi', stageAt:T, hunger:3, happiness:3,
    clockAnchor:T, clockMinuteOfDay:19*60+58, lightsOn:true, awake:true, call:null, callExpiresAt:null });
  s = advanceGame(s, T + 8*MINUTE);
  assert.equal(s.awake, false);
  assert.equal(s.call, 'sleep');
  s = cmd(s, 'lights', 8, false);
  assert.equal(s.call, null);
  assert.equal(s.lightsOn, false);
  s = advanceGame(s, T + 13 * HOUR + 12 * MINUTE);
  assert.equal(s.awake, true);
  assert.equal(s.lightsOn, true);
  assert.ok(s.age >= 1);
});
test('restart, mutation isolation and JSON round trip', () => {
  let s = hatch();
  const copy = structuredClone(s);
  cmd(s, 'meal', 5);
  assert.deepEqual(s, copy);
  assert.deepEqual(advanceGame(JSON.parse(JSON.stringify(s)), T+7*MINUTE), advanceGame(s,T+7*MINUTE));
  s.phase = 'finished';
  s = cmd(s, 'restart', 6);
  assert.equal(s.phase, 'egg');
});