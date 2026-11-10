// Lokal lagring (localStorage). Allt ligger kvar efter att appen stängts.

const KEY_WORKOUTS = 'bt.workouts.v1';
const KEY_SETTINGS = 'bt.settings.v1';
const KEY_LAST = 'bt.last.v1';

export const DEFAULT_SETTINGS = {
  soundsOn: true,
  workSound: 'rise',
  restSound: 'fall',
  doneSound: 'bell',
  countdown: true,       // pip de sista 3 sekunderna
  volume: 0.8,
  audioMode: 'ambient',  // 'ambient' | 'transient'
  keepAwake: true,
  workColor: '#FF4FA3',
  restColor: '#E0242F',
};

export const DEFAULT_CONFIG = { prep: 10, work: 20, rest: 10, rounds: 8, sets: 1, setRest: 60 };

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* full/privat läge */ }
}

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

export function getSettings() { return { ...DEFAULT_SETTINGS, ...read(KEY_SETTINGS, {}) }; }
export function saveSettings(s) { write(KEY_SETTINGS, s); }

export function getLastConfig() { return { ...DEFAULT_CONFIG, ...read(KEY_LAST, {}) }; }
export function saveLastConfig(c) { write(KEY_LAST, c); }

export function listWorkouts() {
  const list = read(KEY_WORKOUTS, null);
  if (list === null) {
    // Första start: ett exempelpass så listan inte är tom.
    const seed = [{ id: uid(), name: 'Klassisk Tabata', ...DEFAULT_CONFIG, createdAt: Date.now(), updatedAt: Date.now() }];
    write(KEY_WORKOUTS, seed);
    return seed;
  }
  return list;
}
export function getWorkout(id) { return listWorkouts().find(w => w.id === id) || null; }
export function upsertWorkout(w) {
  const list = listWorkouts();
  const now = Date.now();
  if (w.id) {
    const i = list.findIndex(x => x.id === w.id);
    if (i >= 0) { list[i] = { ...list[i], ...w, updatedAt: now }; write(KEY_WORKOUTS, list); return list[i]; }
  }
  const created = { ...w, id: uid(), createdAt: now, updatedAt: now };
  list.push(created);
  write(KEY_WORKOUTS, list);
  return created;
}
export function deleteWorkout(id) { write(KEY_WORKOUTS, listWorkouts().filter(w => w.id !== id)); }
