// Client shell: owns the frame loop, turns keys into sim commands and sim events into UI.
import { Game } from './sim/game.js';
import { noteCameraSighting } from './sim/ai.js';
import { View } from './render/view.js';
import { TASKS, FIXES, taskById } from './data/tasks.js';
import { Rng, dist } from './core/util.js';
import { createHud, openNotebook, openLogs, openCams, openSabotage } from './ui/hud.js';
import { createMeetingUI } from './ui/meetingui.js';
import { openMinigame, closeMinigame, minigameOpen } from './ui/minigames.js';
import { showMenu, showReveal, showPause, showEnd, showLobby } from './ui/screens.js';
import { Net } from './net/client.js';
import { sfx, toggleMute, isMuted } from './ui/audio.js';
import { h } from './ui/dom.js';
import { isTouch } from './ui/touch.js';

if (isTouch()) document.body.classList.add('touch');

const ui = document.getElementById('ui');
const uiRng = new Rng(Date.now());
const keys = new Set();
let saved = {};
try { saved = JSON.parse(localStorage.getItem('rogue-commit') || '{}'); } catch { /* storage is optional */ }

const app = {
  game: null, view: new View(document.getElementById('scene')), hud: null, meetingUI: null, menu: null,
  modal: null, feed: null, notes: { logs: null }, markers: {}, interact: {}, paused: false, attract: true,
  pick: { char: saved.char || 'priya', role: saved.role || 'random' },
  sfx, toggleMute, muted: isMuted,
  net: null, remote: false,
  // one entry point for player actions: straight into the local sim, or over the wire
  cmd: c => (app.remote ? app.net.command(c) : app.game.command(app.game.human.id, c)),

  openModal(name, el, onClose, pause) {
    app.closeModal();
    ui.append(el);
    app.modal = { name, el, onClose, pause };
    if (pause) app.paused = true;
  },
  closeModal() {
    const m = app.modal;
    if (!m) return;
    app.modal = null;
    m.el.remove();
    if (m.pause) app.paused = false;
    m.onClose?.();
  },

  toMenu() {
    teardown();
    app.net?.close(); app.net = null; app.remote = false;
    app.attract = true;
    app.game = new Game({});
    app.view.bind(app.game, true);
    app.menu = showMenu(app);
  },

  start() {
    teardown();
    app.net?.close(); app.net = null; app.remote = false;
    try { localStorage.setItem('rogue-commit', JSON.stringify(app.pick)); } catch { /* optional */ }
    app.attract = false;
    app.notes = { logs: null };
    const g = (app.game = new Game({ humanId: app.pick.char, humanRole: app.pick.role }));
    app.view.bind(g, false);
    app.hud = createHud(app);
    wire(g);
    app.paused = true;
    showReveal(app, () => { app.paused = false; sfx('join'); });
  },

  // ---- online play ----
  online: {
    async open(msg) {
      try { app.net ??= new Net(app); await app.net.connect(); app.net.send(msg); }
      catch (e) { app.net = null; app.onNetError(e.message); }
    },
    create: () => app.online.open({ t: 'create', char: app.pick.char }),
    join: code => app.online.open({ t: 'join', code, char: app.pick.char }),
    backToLobby() { app.remote = false; app.net.game = null; app.onLobby(app.net.lobby); },
  },
  onLobby(state) {
    if (app.remote) return;           // still in a match or on its result screen
    teardown();
    if (!app.attract) { app.attract = true; app.game = new Game({}); app.view.bind(app.game, true); }
    app.menu = showLobby(app, state);
  },
  onNetError(text) { banner('Online play', text, 'alarm'); },
  onNetClosed() { if (!app.net) return; app.net = null; app.toMenu(); banner('Disconnected', 'The connection to the game server was lost.', 'alarm'); },
  startRemote(g) {
    teardown();
    app.attract = false; app.remote = true;
    app.notes = { logs: null };
    app.game = g;
    app.view.bind(g, false);
    app.hud = createHud(app);
    wire(g);
    sfx('join');
    showReveal(app, () => {});
  },

  act: {
    use() { const u = app.interact.use; if (u && !u.blocked) u.run(); },
    report() { const b = app.interact.report; if (b) app.cmd({ type: 'report', body: b.id }); },
    pager() { app.cmd({ type: 'pager' }); },
    kill() { const t = app.interact.kill; if (t) app.cmd({ type: 'kill', target: t.id }); },
    steal() { const s = app.interact.steal; if (s) app.cmd({ type: 'steal', station: s.id }); },
    sabotage() { if (app.game.human.role === 'mole' && app.game.human.alive) openSabotage(app); },
    notebook() { openNotebook(app); },
    pause() { if (!app.attract && app.game.phase === 'play' && !app.paused && !app.modal) showPause(app); },
  },

  sayNearby(text) {
    text = text.trim();
    const g = app.game, me = g.human;
    if (!text || !me.alive) return;
    if (app.remote) return app.net.send({ t: 'near', text });
    app.hud.bark(me, text);
    const ear = g.living().filter(a => a.brain && dist(a.pos, me.pos) < 8 && g.canSee(me, a)).sort((a, b) => dist(a.pos, me.pos) - dist(b.pos, me.pos))[0];
    if (!ear) return;
    const goal = ear.brain.goal;
    const reply = /where|going|doing|task|ticket|busy/i.test(text)
      ? (goal?.kind === 'task' ? `Heading to the ${g.stations[goal.station].label} in ${g.place(g.stations[goal.station].room)}.` : goal?.kind === 'fix' ? 'Going to fix the incident. Come help.' : 'Just stretching my legs.')
      : uiRng.pick(['Busy day.', 'Can it wait? I have tickets.', 'The build is red again, did you see?', 'Stay where people can see you.']);
    setTimeout(() => { if (app.game === g && g.phase === 'play' && ear.alive) app.hud.bark(ear, reply); }, 900);
  },
};

function teardown() {
  closeMinigame(true);
  app.closeModal();
  app.hud?.destroy(); app.hud = null;
  app.meetingUI?.destroy(); app.meetingUI = null;
  app.menu?.remove(); app.menu = null;
  ui.querySelectorAll('.overlay, .banner').forEach(e => e.remove());
  app.feed = null;
  app.paused = false;
  keys.clear();
}

function banner(title, sub, cls = '') {
  const el = h('div', { class: `banner ${cls}` }, h('b', {}, title), sub ? h('span', {}, sub) : null);
  ui.append(el);
  setTimeout(() => el.remove(), 4500);
}

function wire(g) {
  const me = g.human, hud = app.hud;
  const nearMe = a => me.alive && a !== me && dist(a.pos, me.pos) < 10 && g.canSee(me, a);
  g.bus.on('task:done', ({ agent }) => {
    if (agent === me) { sfx('task'); hud.toast('Ticket shipped.', 'good'); }
    else if (nearMe(agent) && uiRng.chance(0.3)) hud.bark(agent, uiRng.pick(['Ticket closed.', 'Shipped it.', 'One more off the board.']));
  });
  g.bus.on('sabotage:start', s => {
    sfx('alarm');
    banner(s.def.alert, s.def.hint, 'alarm');
    const helper = g.living().find(a => a.brain?.respond && nearMe(a));
    if (helper) hud.bark(helper, uiRng.pick(['On it. Who is coming with me?', 'Not again. Moving.', 'I will take a look.']));
  });
  g.bus.on('sabotage:end', e => { if (e.fixed) { sfx('fixed'); hud.toast(`${e.def.name} resolved.`, 'good'); } });
  g.bus.on('alert', a => { sfx('bad'); hud.toast(a.text, 'alert'); });
  g.bus.on('steal', ({ agent }) => { if (agent === me) hud.toast('Files copied. Security will trace this room in a few seconds.', 'alert'); });
  g.bus.on('forge', ({ by, entry }) => { if (by === me) hud.toast(`Door log now shows ${g.agent(entry.who).def.name} entering ${g.place(entry.room)}.`, 'alert'); });
  g.bus.on('cameras:jam', ({ by }) => { if (by === me) hud.toast('Cameras jammed.', 'alert'); });
  g.bus.on('kill', ({ killer, victim }) => {
    if (victim === me) {
      closeMinigame(true); app.closeModal();
      sfx('kill');
      banner('You were taken offline', `${killer.def.name} got you. Your tickets still count: finish them.`, 'alarm');
    } else if (killer === me || nearMe(victim)) sfx('kill');
  });
  g.bus.on('meeting:start', m => {
    closeMinigame(true); app.closeModal();
    keys.clear();
    sfx('meeting');
    app.meetingUI = createMeetingUI(app, m);
  });
  g.bus.on('meeting:end', () => { app.meetingUI?.destroy(); app.meetingUI = null; });
  g.bus.on('end', r => {
    closeMinigame(true); app.closeModal();
    setTimeout(() => { if (app.game !== g) return; sfx(r.side === me.role ? 'win' : 'lose'); app.meetingUI?.destroy(); app.meetingUI = null; showEnd(app); }, 1400);
  });
}

function startWork(st, task) {
  const g = app.game, me = g.human;
  if (!app.cmd({ type: 'beginTask', station: st.id })) return;
  const def = (task && taskById(task.id)) || TASKS.find(d => d.stations.includes(st.id)) || uiRng.pick(TASKS);
  openMinigame(def.minigame, def.gen(uiRng), { fake: me.role === 'mole', sfx,
    onDone: () => app.cmd({ type: 'completeTask' }), onCancel: () => app.cmd({ type: 'cancel' }) });
}

function startFix() {
  const s = app.game.sabotage;
  if (!s || !app.cmd({ type: 'beginFix' })) return;
  openMinigame(s.def.minigame, FIXES[s.def.id](uiRng), { sfx, onDone: () => app.cmd({ type: 'completeFix' }), onCancel: () => app.cmd({ type: 'cancel' }) });
}

// what the player can do right now, recomputed every frame
function computeInteract() {
  const g = app.game, me = g.human, S = g.S, it = {};
  app.markers = {};
  for (const t of me.tasks) if (!t.done && (me.alive || me.role === 'staff')) app.markers[t.station] = me.role === 'mole' ? 'cover' : 'task';
  if (g.sabotage && me.alive) app.markers[g.sabotage.def.station] = 'fix';
  // the floor arrow points at the incident if there is one, otherwise your nearest open ticket
  app.guide = null;
  for (const id in app.markers) {
    const st = g.stations[id], kind = app.markers[id], d = dist(me.pos, st);
    if (d < 2 && kind !== 'fix') continue;
    if (!app.guide || (kind === 'fix') > (app.guide.kind === 'fix') || ((kind === 'fix') === (app.guide.kind === 'fix') && d < app.guide.d)) app.guide = { x: st.x, z: st.z, kind, d };
  }
  if (g.phase !== 'play') app.guide = null;
  if (g.phase !== 'play' || me.activity || me.ejected) return it;
  let st = null, bd = S.interactRange;
  for (const s of Object.values(g.stations)) { const d = dist(me.pos, s); if (d < bd) { bd = d; st = s; } }
  if (st) {
    const task = me.tasks.find(t => t.station === st.id && !t.done);
    const off = g.terminalsDown() && st.workstation;
    const offline = { label: 'Workstation offline until the network is back', blocked: true };
    if (g.sabotage?.def.station === st.id && me.alive) it.use = { label: `Repair: ${g.sabotage.def.name}`, run: startFix };
    else if (me.alive && st.id === 'cams') it.use = { label: 'Watch the security cameras', run: () => openCams(app) };
    else if (me.alive && st.id === 'logs') it.use = { label: 'Read the audit logs', run: () => openLogs(app) };
    else if (me.role === 'staff' && task) it.use = off ? offline : { label: task.name, run: () => startWork(st, task) };
    else if (me.role === 'mole' && me.alive) it.use = off ? offline : { label: task ? `Fake it: ${task.name}` : 'Pretend to work here', run: () => startWork(st, task) };
    if (me.role === 'mole' && me.alive && st.workstation && me.cd.steal <= 0 && !g.terminalsDown()) it.steal = st;
  }
  if (!me.alive) return it;
  it.report = g.bodies.find(b => !b.reported && dist(me.pos, b.pos) <= S.reportRange && g.nav.los(me.pos, b.pos)) || null;
  if (me.role === 'mole') {
    it.kill = g.living('staff').filter(a => dist(a.pos, me.pos) <= S.killRange).sort((a, b) => dist(a.pos, me.pos) - dist(b.pos, me.pos))[0] || null;
  }
  return it;
}

const KEYMAP = { KeyE: 'use', KeyR: 'report', KeyC: 'pager', KeyQ: 'kill', KeyF: 'steal', KeyX: 'sabotage', KeyN: 'notebook' };
window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Escape') {
    if (minigameOpen()) return closeMinigame();
    if (app.modal) return app.closeModal();
    if (!app.attract && app.game.phase === 'play' && !app.paused) return showPause(app);
    return;
  }
  if (app.attract || app.paused || app.game.phase !== 'play' || minigameOpen()) return;
  if (app.modal) { if (e.code === 'KeyE' && app.modal.name === 'cams') app.closeModal(); return; }
  if (e.code === 'KeyM') return app.hud.toggleMap();
  if (e.code === 'KeyL') return app.hud.toggleTickets();
  if (e.code === 'KeyT') { e.preventDefault(); return app.hud.openSay(); }
  if (KEYMAP[e.code] && !e.repeat) return app.act[KEYMAP[e.code]]();
  keys.add(e.code);
});
window.addEventListener('keyup', e => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

let last = performance.now(), clock = 0, camT = 0;
function frame(now) {
  // slow frames are split into fixed sim steps so game time never falls behind the clock
  const dt = Math.min(0.25, (now - last) / 1000);
  const steps = Math.max(1, Math.ceil(dt / 0.034)), step = dt / steps;
  last = now;
  clock += dt;
  const g = app.game;
  if (app.attract) {
    for (let i = 0; i < steps; i++) g.update(step);
    if (g.phase === 'ended') { app.game = new Game({}); app.view.bind(app.game, true); }
    app.view.update(dt);
  } else {
    const me = g.human;
    if (!app.paused || app.remote) {
      const free = g.phase === 'play' && !app.modal && !minigameOpen();
      const st = app.hud.stick;
      if (st && !free) st.reset();
      let f = free ? (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) : 0;
      let r = free ? (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) : 0;
      if (st && free && (st.x || st.y)) { f = st.y; r = st.x; }
      const b = app.view.basis();
      app.cmd({ type: 'move', x: b.fx * f + b.rx * r, z: b.fz * f + b.rz * r, run: keys.has('ShiftLeft') || keys.has('ShiftRight') || !!(st && free && st.run) });
      if (app.remote) app.net.frame(dt); else for (let i = 0; i < steps; i++) g.update(step);
    }
    if (minigameOpen() && !me.activity) closeMinigame(true);
    const lost = g.camJam > 0 || g.terminalsDown();
    if (app.feed && !lost && (camT -= dt) <= 0) {
      camT = 0.25;
      for (const a of app.view.seenFromFeed(app.feed)) if (a !== me) noteCameraSighting(g, me, a);
    }
    app.interact = computeInteract();
    app.view.update(dt, { feed: app.feed, markers: app.markers, guide: app.guide, signalLost: lost });
    app.hud.root.style.visibility = app.feed ? 'hidden' : '';
    app.hud.update(dt, clock);
    app.meetingUI?.update();
    app.modal?.el._tick?.();
  }
  requestAnimationFrame(frame);
}

app.toMenu();
requestAnimationFrame(frame);
window.__app = app; // handy for debugging and automated play-tests
