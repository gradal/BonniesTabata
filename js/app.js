import { IntervalTimer, normalize, buildSchedule } from './timer.js';
import * as Sound from './sounds.js';
import * as Store from './store.js';

const $app = document.getElementById('app');
const $modal = document.getElementById('modal-root');
const VERSION = '0.1.1';

let settings = Store.getSettings();
applyTheme();
Sound.setAudioSessionMode(settings.audioMode);
Sound.setVolume(settings.volume);

// ---------- hjälpfunktioner ----------
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = secs => {
  const s = Math.max(0, Math.ceil(secs - 1e-6));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}:${String(s % 60).padStart(2, '0')}` : String(s);
};
const fmtLong = secs => {
  const s = Math.max(0, Math.round(secs));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
};
const totalOf = cfg => buildSchedule(cfg).total;

function applyTheme() {
  const r = document.documentElement.style;
  r.setProperty('--work', settings.workColor);
  r.setProperty('--rest', settings.restColor);
}
function setThemeColor(c) {
  document.querySelector('meta[name="theme-color"]').setAttribute('content', c);
}

function navigate(hash) {
  if (location.hash === hash) render(); else location.hash = hash;
}

const ICON = {
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true" class="fill"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" aria-hidden="true" class="fill"><rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/></svg>',
  next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l7 6-7 6M17 6v12"/></svg>',
  prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6l-7 6 7 6M7 6v12"/></svg>',
  restart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4"/></svg>',
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l10-10-4-4L4 16v4zM13 7l4 4"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  speaker: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6L8 10H4zM16 9a4 4 0 0 1 0 6"/></svg>',
  heart: '<svg viewBox="0 0 24 24" aria-hidden="true" class="fill"><path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.2 3 4.5 6.6 4.5c2.1 0 3.6 1.2 5.4 3.2 1.8-2 3.3-3.2 5.4-3.2 3.6 0 5.7 3.7 4.2 7.2C19.5 16.4 12 21 12 21z"/></svg>',
};

// ---------- modal ----------
function confirmSheet({ title, message = '', ok = 'OK', cancel = 'Avbryt', danger = false }) {
  return new Promise(resolve => {
    $modal.innerHTML = `
      <div class="sheet-backdrop">
        <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
          <h2 id="sheet-title">${esc(title)}</h2>
          ${message ? `<p>${esc(message)}</p>` : ''}
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'} block" data-r="1">${esc(ok)}</button>
          <button class="btn btn-ghost block" data-r="0">${esc(cancel)}</button>
        </div>
      </div>`;
    const close = v => { $modal.firstElementChild?.classList.add('closing'); setTimeout(() => { $modal.innerHTML = ''; }, 180); resolve(v); };
    $modal.querySelector('.sheet-backdrop').addEventListener('click', e => {
      if (e.target.dataset.r !== undefined) close(e.target.dataset.r === '1');
      else if (e.target.classList.contains('sheet-backdrop')) close(false);
    });
  });
}

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('out'), 1600);
  setTimeout(() => el.remove(), 2000);
}

// ---------- router ----------
let cleanup = null;
function render() {
  if (cleanup) { cleanup(); cleanup = null; }
  $modal.innerHTML = '';
  const [, route, arg] = (location.hash || '#/').split('/');
  document.body.className = '';
  setThemeColor('#ffffff');
  switch (route) {
    case 'workouts': return viewWorkouts();
    case 'new': return viewEditor(null);
    case 'edit': return viewEditor(arg);
    case 'quick': return viewEditor('quick');
    case 'settings': return viewSettings();
    case 'run': return viewRun(arg);
    default: return viewHome();
  }
}
window.addEventListener('hashchange', render);

function mount(html, cls = '') {
  $app.innerHTML = `<div class="view ${cls}">${html}</div>`;
  window.scrollTo(0, 0);
  return $app.firstElementChild;
}

function header(title, { back = '#/', action = '' } = {}) {
  return `<header class="topbar">
    <a class="icon-btn" href="${back}" aria-label="Tillbaka">${ICON.back}</a>
    <h1>${esc(title)}</h1>
    <div class="topbar-action">${action}</div>
  </header>`;
}

// ---------- Hem ----------
function viewHome() {
  const count = Store.listWorkouts().length;
  mount(`
    <div class="home">
      <div class="brand">
        <div class="logo">${ICON.heart}</div>
        <h1><span>Tabata</span></h1>
      </div>
      <nav class="home-actions">
        <a class="btn btn-primary btn-xl" href="#/quick">Starta träningspass</a>
        <a class="card-link" href="#/workouts">
          <span><strong>Mina träningspass</strong><small>${count} ${count === 1 ? 'sparat pass' : 'sparade pass'}</small></span>${ICON.chevron}
        </a>
        <a class="card-link" href="#/settings">
          <span><strong>Inställningar</strong><small>Ljud, färger, musik</small></span>${ICON.chevron}
        </a>
      </nav>
      <p class="install-hint" id="install-hint" hidden>Tips: tryck på <b>Dela</b> och välj <b>Lägg till på hemskärmen</b> för att installera appen.</p>
    </div>`, 'view-home');
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOS && !standalone) document.getElementById('install-hint').hidden = false;
}

// ---------- Mina träningspass ----------
function viewWorkouts() {
  const list = Store.listWorkouts().slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const el = mount(`
    ${header('Mina träningspass', { action: `<a class="icon-btn accent" href="#/new" aria-label="Nytt pass">${ICON.plus}</a>` })}
    <div class="content">
      ${list.length === 0 ? `
        <div class="empty">
          <p>Du har inga sparade pass ännu.</p>
          <a class="btn btn-primary" href="#/new">Skapa ditt första pass</a>
        </div>` : `
        <ul class="workout-list">
          ${list.map(w => {
            const c = normalize(w);
            return `<li class="workout" data-id="${esc(w.id)}">
              <button class="workout-main" data-act="start" aria-label="Starta ${esc(w.name)}">
                <span class="workout-name">${esc(w.name)}</span>
                <span class="workout-meta">
                  <span class="chip work">${c.work}s</span><span class="chip rest">${c.rest}s</span>
                  <span>${c.rounds} rundor${c.sets > 1 ? ` × ${c.sets} set` : ''}</span>
                  <span class="dot">·</span><span>${fmtLong(totalOf(c))}</span>
                </span>
              </button>
              <div class="workout-actions">
                <button class="icon-btn" data-act="edit" aria-label="Redigera">${ICON.edit}</button>
                <button class="icon-btn" data-act="delete" aria-label="Radera">${ICON.trash}</button>
                <button class="play-btn" data-act="start" aria-label="Starta">${ICON.play}</button>
              </div>
            </li>`;
          }).join('')}
        </ul>
        <a class="btn btn-secondary block" href="#/new">${ICON.plus} Nytt träningspass</a>`}
    </div>`);
  el.addEventListener('click', async e => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const id = btn.closest('.workout').dataset.id;
    const w = Store.getWorkout(id);
    if (!w) return;
    if (btn.dataset.act === 'start') { Sound.unlock(); navigate(`#/run/${id}`); }
    if (btn.dataset.act === 'edit') navigate(`#/edit/${id}`);
    if (btn.dataset.act === 'delete') {
      const ok = await confirmSheet({ title: `Radera "${w.name}"?`, message: 'Passet tas bort permanent.', ok: 'Radera', danger: true });
      if (ok) { Store.deleteWorkout(id); viewWorkouts(); toast('Passet raderades'); }
    }
  });
}

// ---------- Skapa / redigera ----------
const FIELDS = [
  { key: 'work', label: 'Arbetstid', unit: 's', min: 1, max: 3600, step: 5, cls: 'work' },
  { key: 'rest', label: 'Vilotid', unit: 's', min: 0, max: 3600, step: 5, cls: 'rest' },
  { key: 'rounds', label: 'Antal rundor', unit: '', min: 1, max: 100, step: 1 },
  { key: 'sets', label: 'Antal repetitioner (set)', unit: '', min: 1, max: 50, step: 1, hint: 'Hur många gånger alla rundor körs' },
  { key: 'setRest', label: 'Vila mellan set', unit: 's', min: 0, max: 3600, step: 5, cls: 'rest', showIf: c => c.sets > 1 },
  { key: 'prep', label: 'Nedräkning innan start', unit: 's', min: 0, max: 600, step: 5 },
];

function viewEditor(id) {
  const quick = id === 'quick';
  const existing = id && !quick ? Store.getWorkout(id) : null;
  if (id && !quick && !existing) return navigate('#/workouts');
  const cfg = normalize(existing || Store.getLastConfig());
  let name = existing?.name || '';
  const title = quick ? 'Nytt träningspass' : existing ? 'Redigera pass' : 'Skapa träningspass';

  const el = mount(`
    ${header(title, { back: quick ? '#/' : '#/workouts' })}
    <form class="content editor" novalidate>
      <label class="field-name">
        <span>Namn på passet</span>
        <input name="name" type="text" maxlength="40" placeholder="${quick ? 'Valfritt – fyll i för att spara' : 't.ex. Morgonpass'}" value="${esc(name)}" autocomplete="off" enterkeyhint="done">
      </label>
      <div class="fields">
        ${FIELDS.map(f => `
          <div class="stepper ${f.cls || ''}" data-key="${f.key}">
            <div class="stepper-label"><span>${f.label}</span>${f.hint ? `<small>${f.hint}</small>` : ''}</div>
            <div class="stepper-ctrl">
              <button type="button" class="step" data-d="-1" aria-label="Minska ${f.label}">−</button>
              <input type="number" inputmode="numeric" pattern="[0-9]*" min="${f.min}" max="${f.max}" value="${cfg[f.key]}" aria-label="${f.label}">
              <span class="unit">${f.unit}</span>
              <button type="button" class="step" data-d="1" aria-label="Öka ${f.label}">+</button>
            </div>
          </div>`).join('')}
      </div>
      <p class="summary" id="summary"></p>
      <div class="editor-actions">
        <button type="button" class="btn btn-primary btn-xl" data-act="start">${ICON.play} Starta</button>
        <button type="button" class="btn btn-secondary btn-xl" data-act="save">${existing ? 'Spara ändringar' : 'Spara pass'}</button>
      </div>
    </form>`);

  const form = el.querySelector('form');
  const update = () => {
    for (const f of FIELDS) {
      const row = form.querySelector(`[data-key="${f.key}"]`);
      if (f.showIf) row.hidden = !f.showIf(cfg);
    }
    const total = totalOf(cfg);
    form.querySelector('#summary').textContent = `Total tid ${fmtLong(total)} · ${cfg.rounds * cfg.sets} arbetsintervaller`;
  };
  const setVal = (key, v) => {
    const f = FIELDS.find(x => x.key === key);
    const n = Math.min(f.max, Math.max(f.min, Math.round(Number(v) || 0)));
    cfg[key] = n;
    form.querySelector(`[data-key="${key}"] input`).value = n;
    update();
  };

  // Håll inne +/- för att snabbstega.
  let holdTimer = null;
  const stopHold = () => { clearTimeout(holdTimer); holdTimer = null; };
  form.addEventListener('pointerdown', e => {
    const b = e.target.closest('.step');
    if (!b) return;
    e.preventDefault();
    const key = b.closest('.stepper').dataset.key;
    const f = FIELDS.find(x => x.key === key);
    const d = Number(b.dataset.d);
    const stepOnce = () => {
      // Tid: steg om 1 under 10s, sedan 5. Antal: steg om 1.
      const step = f.unit === 's' ? (cfg[key] + d < 10 || (cfg[key] <= 10 && d < 0) ? 1 : f.step) : 1;
      let next = cfg[key] + d * step;
      if (f.unit === 's' && step === 5 && next % 5 !== 0) next = d > 0 ? Math.ceil(next / 5) * 5 : Math.floor(next / 5) * 5;
      setVal(key, next);
    };
    stepOnce();
    let delay = 400;
    const loop = () => { stepOnce(); delay = Math.max(60, delay * 0.8); holdTimer = setTimeout(loop, delay); };
    holdTimer = setTimeout(loop, delay);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => form.addEventListener(ev, stopHold));
  form.addEventListener('change', e => {
    const row = e.target.closest('.stepper');
    if (row) setVal(row.dataset.key, e.target.value);
  });
  form.addEventListener('input', e => {
    if (e.target.name === 'name') name = e.target.value;
  });
  form.addEventListener('focusin', e => { if (e.target.type === 'number') e.target.select(); });
  form.addEventListener('submit', e => e.preventDefault());

  const readAll = () => {
    form.querySelectorAll('.stepper').forEach(r => setVal(r.dataset.key, r.querySelector('input').value));
  };

  form.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    readAll();
    Store.saveLastConfig(cfg);
    if (b.dataset.act === 'save') {
      if (!name.trim()) {
        form.querySelector('[name=name]').focus();
        form.querySelector('.field-name').classList.add('invalid');
        toast('Ge passet ett namn');
        return;
      }
      const saved = Store.upsertWorkout({ id: existing?.id, name: name.trim(), ...cfg });
      toast(existing ? 'Ändringar sparade' : 'Passet sparades');
      navigate(quick ? `#/workouts` : '#/workouts');
      return saved;
    }
    if (b.dataset.act === 'start') {
      Sound.unlock();
      if (existing) {
        Store.upsertWorkout({ id: existing.id, name: name.trim() || existing.name, ...cfg });
        navigate(`#/run/${existing.id}`);
      } else {
        sessionStorage.setItem('bt.quick', JSON.stringify({ name: name.trim() || 'Snabbpass', ...cfg }));
        navigate('#/run/quick');
      }
    }
  });
  update();
}

// ---------- Träning ----------
const PHASE_LABEL = { prep: 'GÖR DIG REDO', work: 'ARBETE', rest: 'VILA', setrest: 'VILA', done: 'KLART!' };

function viewRun(id) {
  let workout;
  if (id === 'quick') {
    try { workout = JSON.parse(sessionStorage.getItem('bt.quick')); } catch { workout = null; }
  } else workout = Store.getWorkout(id);
  if (!workout) return navigate('#/');

  const timer = new IntervalTimer(workout);
  const sched = timer.schedule;
  const c = sched.config;
  const R = 46, CIRC = 2 * Math.PI * R;

  const el = mount(`
    <div class="run">
      <header class="run-top">
        <button class="icon-btn" data-act="exit" aria-label="Avsluta passet">${ICON.close}</button>
        <div class="run-title">${esc(workout.name)}</div>
        <button class="icon-btn" data-act="sound" aria-label="Ljud av/på">${ICON.speaker}</button>
      </header>
      <section class="run-main">
        <div class="phase-label" id="phase">REDO</div>
        <div class="ring-wrap">
          <svg class="ring" viewBox="0 0 100 100" aria-hidden="true">
            <circle class="ring-bg" cx="50" cy="50" r="${R}"/>
            <circle class="ring-fg" id="ring" cx="50" cy="50" r="${R}" stroke-dasharray="${CIRC}" stroke-dashoffset="0"/>
          </svg>
          <div class="time" id="time">0</div>
        </div>
        <div class="run-info">
          <div class="info-block"><small>Runda</small><strong id="round">–</strong></div>
          ${c.sets > 1 ? `<div class="info-block"><small>Set</small><strong id="set">–</strong></div>` : ''}
          <div class="info-block"><small>Kvar totalt</small><strong id="left">–</strong></div>
        </div>
        <div class="next" id="next"></div>
      </section>
      <section class="run-controls">
        <button class="ctrl" data-act="back" aria-label="Föregående intervall">${ICON.prev}</button>
        <button class="ctrl ctrl-main" data-act="toggle" aria-label="Starta" id="toggle">${ICON.play}</button>
        <button class="ctrl" data-act="skip" aria-label="Nästa intervall">${ICON.next}</button>
      </section>
      <div class="run-secondary">
        <button class="btn btn-onphase" data-act="restart">${ICON.restart} Starta om</button>
      </div>
      <div class="done" id="done" hidden>
        <div class="done-inner">
          <div class="logo big">${ICON.heart}</div>
          <h2>Bra jobbat!</h2>
          <p>${esc(workout.name)} · ${fmtLong(sched.total)}</p>
          <button class="btn btn-primary btn-xl block" data-act="again">Kör igen</button>
          <button class="btn btn-ghost block" data-act="home">Till start</button>
        </div>
      </div>
    </div>`, 'view-run');

  const $ = s => el.querySelector(s);
  const ui = { phase: $('#phase'), time: $('#time'), ring: $('#ring'), round: $('#round'), set: $('#set'), left: $('#left'), next: $('#next'), toggle: $('#toggle'), done: $('#done') };

  let lastIndex = -1;
  let lastSecond = null;
  let raf = null;
  let wakeLock = null;
  let muted = !settings.soundsOn;

  const soundBtn = el.querySelector('[data-act="sound"]');
  const syncSoundBtn = () => soundBtn.classList.toggle('muted', muted);
  syncSoundBtn();

  async function lockScreen() {
    if (!settings.keepAwake || !('wakeLock' in navigator)) return;
    try { wakeLock = await navigator.wakeLock.request('screen'); } catch { /* nekad */ }
  }
  function releaseLock() { try { wakeLock?.release(); } catch {} wakeLock = null; }

  function phaseSound(type) {
    if (muted) return;
    if (type === 'work') Sound.play(settings.workSound);
    else if (type === 'rest' || type === 'setrest') Sound.play(settings.restSound);
    else if (type === 'done') Sound.play(settings.doneSound);
  }

  function paint() {
    const st = timer.state();
    const type = st.done ? 'done' : st.phase.type;

    if (st.index !== lastIndex) {
      const changed = lastIndex !== -1;
      lastIndex = st.index;
      lastSecond = null;
      document.body.dataset.phase = type;
      setThemeColor(getComputedStyle(document.body).getPropertyValue('--phase-bg').trim() || '#fff');
      ui.phase.textContent = PHASE_LABEL[type];
      ui.phase.classList.remove('pop'); void ui.phase.offsetWidth; ui.phase.classList.add('pop');
      if (changed && timer.running) phaseSound(type);
      const nxt = sched.phases[st.index + 1];
      ui.next.textContent = st.done ? '' : nxt ? `Nästa: ${PHASE_LABEL[nxt.type].toLowerCase()} ${fmtLong(nxt.duration)}` : 'Sista intervallen!';
      if (st.done) finish();
    }

    if (!st.done) {
      const p = st.phase;
      const secs = Math.ceil(st.remaining - 1e-6);
      ui.time.textContent = fmt(st.remaining);
      ui.time.classList.toggle('long', secs >= 60);
      const frac = 1 - st.remaining / p.duration;
      ui.ring.style.strokeDashoffset = String(CIRC * frac);
      ui.round.textContent = p.type === 'prep' ? `0/${c.rounds}` : `${p.round}/${c.rounds}`;
      if (ui.set) ui.set.textContent = `${p.set}/${c.sets}`;
      ui.left.textContent = fmtLong(sched.total - timer.elapsed());
      if (timer.running && settings.countdown && !muted && lastSecond !== null && secs !== lastSecond && secs <= 3 && secs >= 1 && p.duration > 3) {
        Sound.tick(false);
      }
      lastSecond = secs;
    }
  }

  function loop() {
    paint();
    if (timer.running) raf = requestAnimationFrame(loop);
  }

  function syncToggle() {
    ui.toggle.innerHTML = timer.running ? ICON.pause : ICON.play;
    ui.toggle.setAttribute('aria-label', timer.running ? 'Pausa' : (timer.elapsed() > 0 ? 'Fortsätt' : 'Starta'));
    el.querySelector('.run').classList.toggle('paused', !timer.running && timer.elapsed() > 0 && !timer.state().done);
  }

  function start() {
    Sound.unlock();
    if (timer.state().done) { timer.reset(); lastIndex = -1; ui.done.hidden = true; }
    const first = timer.elapsed() === 0;
    timer.start();
    if (first) {
      // Spela signal direkt om passet börjar med arbete (ingen nedräkning).
      const st = timer.state();
      if (st.phase?.type === 'work') phaseSound('work');
    }
    lockScreen();
    syncToggle();
    cancelAnimationFrame(raf);
    loop();
  }
  function pause() {
    timer.pause();
    cancelAnimationFrame(raf);
    syncToggle();
    paint();
  }
  function finish() {
    timer.pause();
    cancelAnimationFrame(raf);
    releaseLock();
    syncToggle();
    ui.done.hidden = false;
  }

  const onVisible = () => {
    if (document.visibilityState === 'visible' && timer.running) { lockScreen(); cancelAnimationFrame(raf); loop(); }
  };
  document.addEventListener('visibilitychange', onVisible);

  el.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    switch (b.dataset.act) {
      case 'toggle': timer.running ? pause() : start(); break;
      case 'skip': timer.skip(); paint(); break;
      case 'back': timer.back(); lastIndex = -2; paint(); break;
      case 'restart': {
        const wasRunning = timer.running;
        if (timer.elapsed() > 0) {
          if (wasRunning) pause();
          const ok = await confirmSheet({ title: 'Starta om passet?', ok: 'Starta om' });
          if (!ok) { if (wasRunning) start(); break; }
        }
        timer.reset(); lastIndex = -1; ui.done.hidden = true; paint(); start();
        break;
      }
      case 'sound':
        muted = !muted; syncSoundBtn();
        if (!muted) Sound.unlock();
        toast(muted ? 'Ljud av' : 'Ljud på');
        break;
      case 'exit': {
        if (timer.elapsed() > 0 && !timer.state().done) {
          const wasRunning = timer.running;
          if (wasRunning) pause();
          const ok = await confirmSheet({ title: 'Avsluta passet?', message: 'Ditt pass avbryts.', ok: 'Avsluta', danger: true });
          if (!ok) { if (wasRunning) start(); break; }
        }
        history.length > 1 ? history.back() : navigate('#/');
        break;
      }
      case 'again': timer.reset(); lastIndex = -1; ui.done.hidden = true; paint(); start(); break;
      case 'home': navigate('#/'); break;
    }
  });

  // Mellanslag = start/paus (iPad med tangentbord).
  const onKey = e => {
    if (e.code === 'Space') { e.preventDefault(); timer.running ? pause() : start(); }
    if (e.code === 'ArrowRight') { timer.skip(); paint(); }
    if (e.code === 'ArrowLeft') { timer.back(); paint(); }
  };
  document.addEventListener('keydown', onKey);

  paint();
  syncToggle();
  // Starta direkt – användaren kom hit via en tap, så ljudet är upplåst.
  start();

  cleanup = () => {
    cancelAnimationFrame(raf);
    timer.pause();
    releaseLock();
    document.removeEventListener('visibilitychange', onVisible);
    document.removeEventListener('keydown', onKey);
    delete document.body.dataset.phase;
  };
}

// ---------- Inställningar ----------
function viewSettings() {
  const soundOpts = sel => Object.entries(Sound.SOUNDS).map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${v.name}</option>`).join('');
  const el = mount(`
    ${header('Inställningar')}
    <div class="content settings">
      <h2 class="section-title">Ljud</h2>
      <div class="group">
        <label class="row">
          <span>Ljudsignaler</span>
          <input type="checkbox" class="switch" name="soundsOn" ${settings.soundsOn ? 'checked' : ''}>
        </label>
        ${[['workSound', 'När arbete börjar'], ['restSound', 'När vila börjar'], ['doneSound', 'När passet är klart']].map(([k, label]) => `
        <div class="row">
          <span>${label}</span>
          <div class="row-ctrl">
            <select name="${k}">${soundOpts(settings[k])}</select>
            <button class="icon-btn small" data-preview="${k}" aria-label="Lyssna">${ICON.play}</button>
          </div>
        </div>`).join('')}
        <label class="row">
          <span>Nedräkningspip (3‑2‑1)</span>
          <input type="checkbox" class="switch" name="countdown" ${settings.countdown ? 'checked' : ''}>
        </label>
        <label class="row">
          <span>Volym</span>
          <input type="range" name="volume" min="0" max="1" step="0.05" value="${settings.volume}">
        </label>
        <label class="row">
          <span>Sänk musiken vid signal<small>Annars mixas signalen in i musiken. Utan sänkning tystas signalen av ljudlös-läget på iPhone.</small></span>
          <input type="checkbox" class="switch" name="duck" ${settings.audioMode === 'transient' ? 'checked' : ''}>
        </label>
      </div>

      <h2 class="section-title">Färger</h2>
      <div class="group">
        <label class="row"><span>Arbete</span><input type="color" name="workColor" value="${settings.workColor}"></label>
        <label class="row"><span>Vila</span><input type="color" name="restColor" value="${settings.restColor}"></label>
        <button class="row link" data-act="reset-colors">Återställ färger</button>
      </div>

      <h2 class="section-title">Musik</h2>
      <div class="group">
        <div class="row column">
          <span><strong>Spotify</strong><small>Starta musiken i Spotify innan passet – den fortsätter spela medan timern går, och styrs från låsskärmen eller kontrollcenter. Inbyggd Spotify-styrning kommer i en senare version.</small></span>
          <a class="btn btn-secondary" href="spotify:">Öppna Spotify</a>
        </div>
      </div>

      <h2 class="section-title">Övrigt</h2>
      <div class="group">
        <label class="row">
          <span>Håll skärmen tänd under pass</span>
          <input type="checkbox" class="switch" name="keepAwake" ${settings.keepAwake ? 'checked' : ''}>
        </label>
        <button class="row link danger" data-act="reset-all">Rensa all data</button>
      </div>
      <p class="version">Tabata v${VERSION}</p>
    </div>`);

  const save = () => { Store.saveSettings(settings); applyTheme(); Sound.setVolume(settings.volume); Sound.setAudioSessionMode(settings.audioMode); };

  el.addEventListener('change', e => {
    const t = e.target;
    if (!t.name) return;
    if (t.name === 'duck') settings.audioMode = t.checked ? 'transient' : 'ambient';
    else if (t.type === 'checkbox') settings[t.name] = t.checked;
    else if (t.type === 'range') settings[t.name] = Number(t.value);
    else settings[t.name] = t.value;
    save();
    if (t.tagName === 'SELECT') { Sound.unlock(); Sound.play(t.value); }
  });
  el.addEventListener('input', e => {
    if (e.target.type === 'range') { settings.volume = Number(e.target.value); Sound.setVolume(settings.volume); }
    if (e.target.type === 'color') { settings[e.target.name] = e.target.value; applyTheme(); }
  });
  el.addEventListener('click', async e => {
    const p = e.target.closest('[data-preview]');
    if (p) { Sound.unlock(); Sound.play(settings[p.dataset.preview]); return; }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    if (a.dataset.act === 'reset-colors') {
      settings.workColor = Store.DEFAULT_SETTINGS.workColor;
      settings.restColor = Store.DEFAULT_SETTINGS.restColor;
      save(); viewSettings();
    }
    if (a.dataset.act === 'reset-all') {
      const ok = await confirmSheet({ title: 'Rensa all data?', message: 'Alla sparade pass och inställningar tas bort.', ok: 'Rensa', danger: true });
      if (ok) { localStorage.clear(); settings = Store.getSettings(); applyTheme(); navigate('#/'); toast('All data rensad'); }
    }
  });
}

// ---------- start ----------
render();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
