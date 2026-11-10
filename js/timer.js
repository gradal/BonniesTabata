// Tidsbaserad intervallmotor. Räknar ut aktuell fas från klockan i stället för att
// räkna ned en variabel – då blir tiden exakt även om webbläsaren strypt JS
// (bakgrund, låst skärm) och "hoppar ikapp" direkt när appen vaknar.

/**
 * @typedef {{prep:number, work:number, rest:number, rounds:number, sets:number, setRest:number}} Config
 * @typedef {{type:'prep'|'work'|'rest'|'setrest', duration:number, start:number, round:number, set:number}} Phase
 */

/** Bygger hela passets schema. Ingen vila efter allra sista arbetsintervallen. */
export function buildSchedule(cfg) {
  const c = normalize(cfg);
  /** @type {Phase[]} */
  const phases = [];
  let t = 0;
  const push = (type, duration, round, set) => {
    if (duration <= 0) return;
    phases.push({ type, duration, start: t, round, set });
    t += duration;
  };
  push('prep', c.prep, 0, 1);
  for (let s = 1; s <= c.sets; s++) {
    for (let r = 1; r <= c.rounds; r++) {
      push('work', c.work, r, s);
      const lastRound = r === c.rounds;
      const lastSet = s === c.sets;
      if (!lastRound) push('rest', c.rest, r, s);
      else if (!lastSet) push('setrest', c.setRest > 0 ? c.setRest : c.rest, r, s);
    }
  }
  return { phases, total: t, config: c };
}

export function normalize(cfg) {
  const int = (v, min, max, def) => {
    const n = Math.round(Number(v));
    if (!Number.isFinite(n)) return def;
    return Math.min(max, Math.max(min, n));
  };
  return {
    prep: int(cfg.prep, 0, 600, 10),
    work: int(cfg.work, 1, 3600, 20),
    rest: int(cfg.rest, 0, 3600, 10),
    rounds: int(cfg.rounds, 1, 100, 8),
    sets: int(cfg.sets, 1, 50, 1),
    setRest: int(cfg.setRest, 0, 3600, 60),
  };
}

/** Hitta fas för given förfluten tid (sekunder). */
export function phaseAt(schedule, elapsed) {
  const { phases, total } = schedule;
  if (elapsed >= total) return { index: phases.length, phase: null, remaining: 0, done: true };
  let lo = 0, hi = phases.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (phases[mid].start <= elapsed) lo = mid; else hi = mid - 1;
  }
  const phase = phases[lo];
  return { index: lo, phase, remaining: phase.start + phase.duration - elapsed, done: false };
}

/** Stateful klocka runt schemat. `now` är injicerbar för test. */
export class IntervalTimer {
  constructor(cfg, now = () => performance.now()) {
    this.schedule = buildSchedule(cfg);
    this.now = now;
    this.reset();
  }
  reset() {
    this.offset = 0;        // ackumulerad tid (ms) före senaste start
    this.startedAt = null;  // ms när senaste körning startade
  }
  get running() { return this.startedAt !== null; }
  elapsedMs() {
    return this.offset + (this.startedAt !== null ? this.now() - this.startedAt : 0);
  }
  elapsed() { return this.elapsedMs() / 1000; }
  start() { if (!this.running) this.startedAt = this.now(); }
  pause() {
    if (!this.running) return;
    this.offset = this.elapsedMs();
    this.startedAt = null;
  }
  seek(seconds) {
    const s = Math.max(0, Math.min(this.schedule.total, seconds));
    this.offset = s * 1000;
    if (this.running) this.startedAt = this.now();
  }
  skip() {
    const st = this.state();
    if (st.done) return;
    this.seek(st.phase.start + st.phase.duration);
  }
  back() {
    const st = this.state();
    if (st.done) { const last = this.schedule.phases.at(-1); if (last) this.seek(last.start); return; }
    const into = this.elapsed() - st.phase.start;
    if (into > 2 || st.index === 0) this.seek(st.phase.start);
    else this.seek(this.schedule.phases[st.index - 1].start);
  }
  state() { return phaseAt(this.schedule, this.elapsed()); }
}
