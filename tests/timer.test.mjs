import { buildSchedule, phaseAt, IntervalTimer } from '../js/timer.js';
import assert from 'node:assert/strict';
import test from 'node:test';

test('klassisk tabata: 8x20/10, ingen vila efter sista', () => {
  const s = buildSchedule({ prep: 10, work: 20, rest: 10, rounds: 8, sets: 1 });
  assert.equal(s.total, 10 + 8 * 20 + 7 * 10);
  assert.equal(s.phases.at(-1).type, 'work');
});
test('set med setvila', () => {
  const s = buildSchedule({ prep: 0, work: 20, rest: 10, rounds: 2, sets: 3, setRest: 60 });
  const types = s.phases.map(p => p.type).join(',');
  assert.equal(types, 'work,rest,work,setrest,work,rest,work,setrest,work,rest,work');
  assert.equal(s.total, 6 * 20 + 3 * 10 + 2 * 60);
});
test('vila 0 och prep 0 hoppas över', () => {
  const s = buildSchedule({ prep: 0, work: 5, rest: 0, rounds: 3, sets: 1 });
  assert.deepEqual(s.phases.map(p => p.type), ['work', 'work', 'work']);
});
test('phaseAt gränser', () => {
  const s = buildSchedule({ prep: 10, work: 20, rest: 10, rounds: 2, sets: 1 });
  assert.equal(phaseAt(s, 0).phase.type, 'prep');
  assert.equal(phaseAt(s, 9.99).phase.type, 'prep');
  assert.equal(phaseAt(s, 10).phase.type, 'work');
  assert.equal(phaseAt(s, 30).phase.type, 'rest');
  assert.equal(phaseAt(s, 40).phase.round, 2);
  assert.ok(phaseAt(s, 60).done);
});
test('paus/fortsätt/skip med fejkad klocka', () => {
  let t = 0;
  const tm = new IntervalTimer({ prep: 0, work: 20, rest: 10, rounds: 2, sets: 1 }, () => t);
  tm.start(); t = 5000;
  assert.equal(tm.state().remaining, 15);
  tm.pause(); t = 60000;
  assert.equal(tm.elapsed(), 5);
  tm.start(); t = 66000;
  assert.equal(tm.elapsed(), 11);
  tm.skip();
  assert.equal(tm.state().phase.type, 'rest');
  tm.back(); // <2s in i fasen -> föregående
  assert.equal(tm.state().phase.type, 'work');
  assert.equal(tm.elapsed(), 0);
});
test('ogiltig input normaliseras', () => {
  const s = buildSchedule({ prep: -5, work: 'abc', rest: 3.6, rounds: 0, sets: 999 });
  assert.equal(s.config.prep, 0); assert.equal(s.config.work, 20);
  assert.equal(s.config.rest, 4); assert.equal(s.config.rounds, 1); assert.equal(s.config.sets, 50);
});
