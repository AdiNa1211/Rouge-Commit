// Synthesised sound effects; no audio files to ship.
let ctx = null;
let muted = false;

function tone(freq, t0, dur, type = 'sine', vol = 0.12, slide = 0) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, ctx.currentTime + t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), ctx.currentTime + t0 + dur);
  g.gain.setValueAtTime(0.0001, ctx.currentTime + t0);
  g.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t0 + dur);
  o.connect(g).connect(ctx.destination);
  o.start(ctx.currentTime + t0);
  o.stop(ctx.currentTime + t0 + dur + 0.05);
}

const SOUNDS = {
  click: () => tone(620, 0, 0.05, 'triangle', 0.06),
  good: () => { tone(660, 0, 0.1, 'triangle'); tone(990, 0.09, 0.16, 'triangle'); },
  bad: () => tone(160, 0, 0.16, 'sawtooth', 0.08, -60),
  task: () => { tone(523, 0, 0.09, 'triangle'); tone(659, 0.08, 0.09, 'triangle'); tone(784, 0.16, 0.2, 'triangle'); },
  alarm: () => { for (let i = 0; i < 3; i++) { tone(880, i * 0.34, 0.15, 'square', 0.07); tone(660, i * 0.34 + 0.17, 0.15, 'square', 0.07); } },
  fixed: () => { tone(440, 0, 0.1, 'sine'); tone(660, 0.1, 0.1, 'sine'); tone(880, 0.2, 0.25, 'sine'); },
  meeting: () => { tone(196, 0, 0.9, 'triangle', 0.16); tone(392, 0, 0.7, 'sine', 0.1); tone(294, 0.35, 0.8, 'triangle', 0.12); },
  kill: () => { tone(900, 0, 0.22, 'sawtooth', 0.1, -820); tone(90, 0.05, 0.3, 'square', 0.08); },
  vote: () => tone(480, 0, 0.07, 'triangle', 0.07),
  myvote: () => { tone(392, 0, 0.09, 'square', 0.08); tone(587, 0.09, 0.18, 'square', 0.08); },
  join: () => [392, 523, 659, 784].forEach((f, i) => tone(f, i * 0.09, 0.22, 'triangle', 0.11)),
  eject: () => { tone(300, 0, 0.5, 'sawtooth', 0.07, -180); tone(150, 0.2, 0.5, 'triangle', 0.1); },
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.13, 0.3, 'triangle')),
  lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, i * 0.18, 0.4, 'sawtooth', 0.07)),
};

export function sfx(name) {
  if (muted) return;
  try {
    ctx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    SOUNDS[name]?.();
  } catch { /* audio is optional */ }
}
export const toggleMute = () => (muted = !muted);
export const isMuted = () => muted;
