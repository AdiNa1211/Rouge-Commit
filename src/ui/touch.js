// On-screen controls for phones and tablets: a thumbstick plus a few extra buttons.
import { h } from './dom.js';

export const isTouch = () => matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0 && !matchMedia('(pointer: fine)').matches;

// returns { x, y, run } where y is forward; pushed past 85% of the ring means run
export function createStick(root) {
  const knob = h('i', { class: 'stick-knob' });
  const base = h('div', { class: 'stick', 'aria-label': 'Move' }, knob);
  root.append(base);
  const out = { x: 0, y: 0, run: false };
  let id = null, cx = 0, cy = 0, R = 1;
  const set = (dx, dy) => {
    const d = Math.hypot(dx, dy), k = d > R ? R / d : 1;
    dx *= k; dy *= k;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const m = Math.min(1, d / R);
    out.x = m > 0.18 ? dx / R : 0;
    out.y = m > 0.18 ? -dy / R : 0;
    out.run = m > 0.85;
    base.classList.toggle('run', out.run);
  };
  base.addEventListener('pointerdown', e => {
    id = e.pointerId;
    base.setPointerCapture(id);
    const r = base.getBoundingClientRect();
    cx = r.left + r.width / 2; cy = r.top + r.height / 2; R = r.width * 0.42;
    set(e.clientX - cx, e.clientY - cy);
    e.preventDefault();
  });
  base.addEventListener('pointermove', e => { if (e.pointerId === id) set(e.clientX - cx, e.clientY - cy); });
  const end = e => { if (e.pointerId !== id) return; id = null; set(0, 0); };
  base.addEventListener('pointerup', end);
  base.addEventListener('pointercancel', end);
  out.reset = () => { id = null; set(0, 0); };
  return out;
}

// small row of buttons for things a keyboard player reaches with Esc, M and T
export function createTouchBar(app) {
  const btn = (label, fn) => h('button', { class: 'tbtn', onclick: e => { e.stopPropagation(); fn(); } }, label);
  return h('div', { class: 'touch-bar' },
    btn('Pause', () => app.act.pause()),
    btn('Map', () => app.hud.toggleMap()),
    btn('Talk', () => app.hud.openSay()));
}
