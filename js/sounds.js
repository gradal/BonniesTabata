// Ljudsignaler syntetiseras med Web Audio – inga ljudfiler att ladda, funkar offline.
// iOS kräver att AudioContext låses upp i en användarinteraktion: anropa unlock() i en tap-handler.

let ctx = null;
let master = null;

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.connect(ctx.destination);
  }
  return ctx;
}

/** 'ambient' = blandas med Spotify/annan musik (tystas av ljudlös-knappen).
 *  'transient' = sänker annan musik kort medan signalen spelas. */
export function setAudioSessionMode(mode) {
  try {
    if (navigator.audioSession) navigator.audioSession.type = mode;
  } catch { /* stöds inte */ }
}

export function unlock() {
  const c = ensure();
  if (!c) return;
  if (c.state === 'suspended') c.resume();
  // Spela en tyst buffert – krävs på äldre iOS för att låsa upp.
  const b = c.createBuffer(1, 1, 22050);
  const s = c.createBufferSource();
  s.buffer = b; s.connect(c.destination); s.start(0);
}

export function setVolume(v) {
  ensure();
  if (master) master.gain.value = Math.max(0, Math.min(1, v));
}

function tone(freq, start, dur, { type = 'sine', gain = 0.6, attack = 0.005, endFreq = null } = {}) {
  const c = ctx;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, start + dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(gain, start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g); g.connect(master);
  o.start(start); o.stop(start + dur + 0.05);
}

export const SOUNDS = {
  beep:    { name: 'Pip',        play: t => tone(880, t, 0.25, { type: 'square', gain: 0.25 }) },
  double:  { name: 'Dubbelpip',  play: t => { tone(988, t, 0.12, { type: 'square', gain: 0.25 }); tone(988, t + 0.18, 0.12, { type: 'square', gain: 0.25 }); } },
  rise:    { name: 'Stigande',   play: t => { tone(660, t, 0.12); tone(880, t + 0.12, 0.12); tone(1320, t + 0.24, 0.3); } },
  fall:    { name: 'Fallande',   play: t => { tone(1320, t, 0.12); tone(880, t + 0.12, 0.12); tone(660, t + 0.24, 0.3); } },
  bell:    { name: 'Klocka',     play: t => { tone(1046, t, 1.2, { gain: 0.5 }); tone(2093, t, 0.8, { gain: 0.15 }); tone(1568, t, 1.0, { gain: 0.12 }); } },
  gong:    { name: 'Gong',       play: t => { tone(196, t, 1.8, { gain: 0.7, attack: 0.01 }); tone(392, t, 1.2, { gain: 0.2 }); tone(587, t, 0.9, { gain: 0.1 }); } },
  whistle: { name: 'Visselpipa', play: t => tone(2200, t, 0.45, { type: 'triangle', gain: 0.35, endFreq: 2600 }) },
  boxing:  { name: 'Boxningsring', play: t => { for (let i = 0; i < 3; i++) tone(1400, t + i * 0.22, 0.2, { type: 'triangle', gain: 0.4 }); } },
  none:    { name: 'Inget ljud', play: () => {} },
};

export function play(id) {
  const c = ensure();
  if (!c) return;
  if (c.state === 'suspended') c.resume();
  (SOUNDS[id] || SOUNDS.beep).play(c.currentTime + 0.01);
}

export function tick(final = false) {
  const c = ensure();
  if (!c) return;
  tone(final ? 1320 : 660, c.currentTime + 0.01, 0.09, { type: 'sine', gain: 0.4 });
}
