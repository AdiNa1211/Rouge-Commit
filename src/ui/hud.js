// In-match HUD: identity, tickets, progress, minimap, prompts, feed, and the
// evidence tools (notebook, audit logs, camera wall, mole toolkit).
import { h, clear } from './dom.js';
import { fmtTime } from '../core/util.js';
import { SABOTAGES, ROLES } from '../data/config.js';
import { MARK } from '../render/view.js';
import { isTouch, createStick, createTouchBar } from './touch.js';

export const chip = a => h('span', { class: 'who' }, h('i', { class: 'dot', style: { background: a.def.color } }), a.def.name);

function setText(el, v) { if (el._v !== v) { el._v = v; el.textContent = v; } }

// ---- evidence ---------------------------------------------------------------
function logLists(g, snap) {
  const who = id => (id ? chip(g.agent(id)) : h('span', { class: 'unk' }, 'badge unread'));
  const list = (title, rows, empty) => h('section', {}, h('h4', {}, title),
    rows.length ? h('ul', { class: 'rows' }, rows.slice(-14).reverse()) : h('p', { class: 'muted' }, empty));
  return [
    list('Door access', snap.access.map(e => h('li', {}, h('time', {}, fmtTime(e.t)), who(e.who), h('span', {}, `entered ${g.place(e.room)}`))), 'No badge swipes yet.'),
    list('Workstation activity', snap.work.map(e => h('li', {}, h('time', {}, fmtTime(e.t)), who(e.who),
      h('span', {}, e.kind === 'task' ? `closed "${e.task}" at ${e.station}` : `logged in at ${e.station}, no ticket closed`))), 'No logins yet.'),
    list('Network', snap.network.map(e => h('li', { class: e.kind }, h('time', {}, fmtTime(e.t)), h('span', {}, e.text))), 'Nothing unusual.'),
  ];
}

export function evidenceView(app) {
  const g = app.game, me = g.human;
  const seen = me.mem.sightings.slice(-40).reverse().map(s => h('li', {}, h('time', {}, fmtTime(s.t)), chip(g.agent(s.who)),
    h('span', {}, `${g.roomName(s.room)} · ${s.doing}${s.via === 'camera' ? ' · on camera' : ''}`)));
  const alerts = g.logs.alerts.slice(-8).reverse().map(a => h('li', { class: 'theft' }, h('time', {}, fmtTime(a.t)), h('span', {}, a.text)));
  return h('div', { class: 'evidence' },
    h('section', {}, h('h4', {}, 'Who you saw'), seen.length ? h('ul', { class: 'rows' }, seen) : h('p', { class: 'muted' }, 'You have not seen anyone yet.')),
    h('section', {}, h('h4', {}, 'Public alerts'), alerts.length ? h('ul', { class: 'rows' }, alerts) : h('p', { class: 'muted' }, 'No alerts so far.')),
    app.notes.logs
      ? h('div', {}, h('p', { class: 'muted' }, `Audit logs as you read them at ${fmtTime(app.notes.logs.t)}`), logLists(g, app.notes.logs))
      : h('section', {}, h('h4', {}, 'Audit logs'), h('p', { class: 'muted' }, 'Read the audit log terminal in the Security Office to add door, workstation and network logs here.')));
}

export function openNotebook(app) {
  app.openModal('notebook', h('div', { class: 'overlay' }, h('div', { class: 'panel wide' },
    h('header', {}, h('div', {}, h('h2', {}, 'Notebook'), h('p', { class: 'hint' }, 'Everything you have witnessed. None of it is proof on its own.')),
      h('button', { class: 'btn ghost', onclick: () => app.closeModal() }, 'Close (Esc)')),
    evidenceView(app))));
}

export function openLogs(app) {
  const g = app.game;
  const down = g.terminalsDown();
  if (!down) app.notes.logs = { t: g.time, access: g.logs.access.slice(), work: g.logs.work.slice(), network: g.logs.network.slice() };
  app.openModal('logs', h('div', { class: 'overlay' }, h('div', { class: 'panel wide terminal' },
    h('header', {}, h('div', {}, h('h2', {}, 'Audit log terminal'), h('p', { class: 'hint' }, 'Badge readers miss about one swipe in five, and logs can be forged.')),
      h('button', { class: 'btn ghost', onclick: () => app.closeModal() }, 'Close (Esc)')),
    down ? h('p', { class: 'signal' }, 'NETWORK DOWN. Logs are unreachable until the core switch is re-patched.') : h('div', { class: 'evidence three' }, logLists(g, app.notes.logs)))));
}

export function openCams(app) {
  const g = app.game;
  const cams = g.map.cameras;
  const lost = h('div', { class: 'signal big' }, 'SIGNAL LOST');
  const label = h('b', {});
  const pick = c => {
    app.feed = c;
    label.textContent = `CAM · ${c.name.toUpperCase()}`;
    bar.querySelectorAll('button[data-cam]').forEach(b => b.classList.toggle('sel', b.dataset.cam === c.id));
    app.sfx('click');
  };
  const bar = h('div', { class: 'cam-bar' },
    cams.map(c => h('button', { class: 'btn', 'data-cam': c.id, onclick: () => pick(c) }, c.name)),
    h('button', { class: 'btn ghost', onclick: () => app.closeModal() }, 'Leave (Esc)'));
  const root = h('div', { class: 'overlay cams' }, h('div', { class: 'cam-top' }, h('i', { class: 'rec' }), label, h('span', {}, 'One feed at a time. You are exposed while you watch.')), lost, bar);
  root._tick = () => { lost.style.display = g.camJam > 0 || g.terminalsDown() ? '' : 'none'; };
  app.openModal('cams', root, () => { app.feed = null; });
  pick(cams[0]);
  root._tick();
}

export function openSabotage(app) {
  const g = app.game, me = g.human;
  const item = (title, sub, ready, wait, run) => h('button', { class: 'sab', disabled: !ready, onclick: () => { run(); app.closeModal(); } },
    h('b', {}, title), h('span', {}, ready ? sub : wait));
  const list = h('div', { class: 'sab-list' });
  const where = h('p', { class: 'hint' });
  let sig = '';
  const draw = () => {
    const now = [Math.ceil(g.sabCd), !!g.sabotage, Math.ceil(me.cd.jam), Math.ceil(me.cd.forge), me.room].join();
    if (now === sig) return;
    sig = now;
    where.textContent = `Commands are traced to the room you send them from. You are in ${g.place(me.room)}.`;
    const busy = g.sabotage ? 'An incident is already running' : `Ready in ${Math.ceil(g.sabCd)}s`;
    clear(list).append(
      ...Object.values(SABOTAGES).map(s => item(s.verb, s.critical ? `Staff have ${s.timer}s to fix it or the company folds` : s.leakPerSec ? 'Leaks data until staff restore a backup' : 'Blinds cameras, logs and workstations',
        !g.sabotage && g.sabCd <= 0, busy, () => app.cmd({ type: 'sabotage', id: s.id }))),
      item('Jam the cameras', `Camera wall shows static for ${g.S.cameraJamDuration}s`, me.cd.jam <= 0, `Ready in ${Math.ceil(me.cd.jam)}s`, () => app.cmd({ type: 'jamCameras' })),
      item('Forge a door-log entry', 'Puts an innocent colleague in a restricted room', me.cd.forge <= 0, `Ready in ${Math.ceil(me.cd.forge)}s`, () => app.cmd({ type: 'forge' })));
  };
  const root = h('div', { class: 'overlay mg' }, h('div', { class: 'panel' },
    h('header', {}, h('div', {}, h('h2', {}, 'Mole toolkit'), where), h('button', { class: 'btn ghost', onclick: () => app.closeModal() }, 'Close (Esc)')),
    list));
  root._tick = draw;
  draw();
  app.openModal('sabotage', root);
}

// ---- HUD ----------------------------------------------------------------------
export function createHud(app) {
  const g = app.game, me = g.human, mole = me.role === 'mole';
  const partner = mole ? g.agents.find(a => a.role === 'mole' && a !== me) : null;
  const el = {};
  const btn = (key, label, fn, cls = '') => {
    const b = h('button', { class: `act ${cls}`, onclick: fn }, h('kbd', {}, key), h('b', {}, label), h('small', {}));
    b._sub = b.querySelector('small');
    return b;
  };
  el.use = btn('E', 'Use', () => app.act.use());
  el.report = btn('R', 'Report', () => app.act.report(), 'warn');
  el.pager = btn('C', 'Page stand-up', () => app.act.pager());
  el.note = btn('N', 'Notebook', () => app.act.notebook());
  el.kill = mole ? btn('Q', 'Eliminate', () => app.act.kill(), 'danger') : null;
  el.sab = mole ? btn('X', 'Toolkit', () => app.act.sabotage(), 'danger') : null;
  el.steal = mole ? btn('F', 'Steal data', () => app.act.steal(), 'danger') : null;

  const root = h('div', { id: 'hud' },
    h('div', { class: 'hud-tl' },
      h('div', { class: 'idcard' }, h('i', { class: 'avatar', style: { background: me.def.color } }, me.def.name[0]),
        h('div', {}, h('b', {}, me.def.full), h('span', {}, me.def.job)),
        (el.role = h('span', { class: `role ${me.role}` }, ROLES[me.role].name))),
      (el.card = h('div', { class: 'card' },
        (el.cardHead = h('button', { class: 'card-head', onclick: () => setCollapsed(!el.card.classList.contains('collapsed')) },
          h('h3', {}, mole ? 'Cover tickets (fake)' : 'Your tickets'), (el.count = h('span', { class: 'count' })), h('i', { class: 'chev' }))),
        (el.tasks = h('ul', { class: 'tasks' })),
        partner ? h('p', { class: 'partner' }, 'Fellow mole: ', chip(partner)) : null))),
    (el.tc = h('div', { class: 'hud-tc' },
      (el.bars = h('div', { class: 'bars' },
        h('label', {}, 'Tickets shipped', (el.taskN = h('b', {}))), h('div', { class: 'bar' }, (el.taskBar = h('i'))),
        h('label', {}, 'Data leaked', (el.leakN = h('b', {}))), h('div', { class: 'bar leak' }, (el.leakBar = h('i'))))),
      (el.objective = h('div', { class: 'objective' })),
      (el.alarm = h('div', { class: 'alarm', style: { display: 'none' } })))),
    (el.tr = h('div', { class: 'hud-tr' }, (el.map = h('canvas', { id: 'minimap', title: 'Press M or tap to enlarge', onclick: () => { bigMap = !bigMap; } })), (el.where = h('div', { class: 'where' })),
      h('div', { class: 'legend' }, h('span', {}, h('i', { class: 'dot', style: { background: mole ? MARK.cover : MARK.task } }), mole ? 'Cover tickets' : 'Your tickets'),
        h('span', {}, h('i', { class: 'dot', style: { background: MARK.fix } }), 'Incident')))),
    h('div', { class: 'hud-bl' }, (el.feed = h('div', { class: 'feed' })),
      (el.say = h('input', { id: 'say', class: 'say', placeholder: 'Say something to people nearby, then Enter', maxlength: '80', style: { display: 'none' } }))),
    (el.prompt = h('div', { class: 'hud-bc' })),
    h('div', { class: 'hud-br' }, [el.kill, el.steal, el.sab, el.report, el.pager, el.note, el.use].filter(Boolean)));
  document.getElementById('ui').append(root);

  // ticket list folds to one line; remembered per browser, folded by default on phones
  const touch = isTouch();
  let stick = null;
  if (touch) {
    stick = createStick(root); root.append(createTouchBar(app));
    // phones: tickets, progress bars and the round radar share one row; tap the radar for the full map
    el.tc.prepend(h('div', { class: 'top-row' }, el.card, el.bars, h('div', { class: 'radar' }, el.map, el.where)));
    el.tr.remove();
  }
  function setCollapsed(v) {
    el.card.classList.toggle('collapsed', v);
    el.cardHead.setAttribute('aria-expanded', String(!v));
    try { localStorage.setItem('rogue-commit-tickets', v ? 'folded' : 'open'); } catch { /* optional */ }
  }
  let saved = null;
  try { saved = localStorage.getItem('rogue-commit-tickets'); } catch { /* optional */ }
  setCollapsed(saved ? saved === 'folded' : touch);

  el.say.addEventListener('blur', () => { if (!el.say.value.trim()) el.say.style.display = 'none'; });
  el.say.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter') { app.sayNearby(el.say.value); el.say.value = ''; el.say.style.display = 'none'; el.say.blur(); }
    if (e.key === 'Escape') { el.say.style.display = 'none'; el.say.blur(); }
  });

  let taskSig = '', bigMap = false;
  const RADAR = 88;
  const mapCtx = el.map.getContext('2d');

  function drawMap(t) {
    const radar = touch && !bigMap, map = g.map;
    const k = bigMap ? 10 : radar ? 4 : 3.6;
    const W = radar ? RADAR : Math.round(map.width * k), H = radar ? RADAR : Math.round(map.depth * k);
    if (el.map.width !== W || el.map.height !== H) { el.map.width = W; el.map.height = H; el.map.classList.toggle('big', bigMap); }
    const c = mapCtx;
    c.clearRect(0, 0, W, H);
    c.save();
    // radar keeps the player in the middle of a circle; the full map stays a plain rectangle
    if (radar) { c.beginPath(); c.arc(W / 2, H / 2, W / 2, 0, 7); c.clip(); c.fillStyle = '#0f1424'; c.fill(); c.translate(W / 2 - me.pos.x * k, H / 2 - me.pos.z * k); }
    for (const r of map.rooms) {
      c.globalAlpha = r.id === me.room || (r.id === 'devfloor' && ['backend', 'frontend'].includes(me.room)) ? 0.95 : 0.55;
      c.fillStyle = r.floor;
      c.fillRect(r.x * k, r.z * k, r.w * k, r.h * k);
    }
    c.globalAlpha = 1;
    c.strokeStyle = '#0f1424'; c.lineWidth = bigMap ? 3 : 1.4;
    c.beginPath();
    for (const w of g.nav.walls) {
      if (w.axis === 'h') { c.moveTo(w.from * k, w.at * k); c.lineTo(w.to * k, w.at * k); }
      else { c.moveTo(w.at * k, w.from * k); c.lineTo(w.at * k, w.to * k); }
    }
    c.stroke();
    if (bigMap) {
      c.font = '600 12px "IBM Plex Sans", sans-serif'; c.textAlign = 'center'; c.fillStyle = 'rgba(15,20,36,0.85)';
      for (const r of [...map.rooms.filter(r => r.id !== 'devfloor'), ...map.zones]) c.fillText(r.name, (r.x + r.w / 2) * k, (r.z + r.h / 2) * k + 4);
    }
    // rooms holding one of your tickets get a coloured outline, the station a pulsing diamond
    const mark = (s, kind) => {
      const col = MARK[kind], x = s.x * k, z = s.z * k, beat = 0.5 + 0.5 * Math.sin(t * (kind === 'fix' ? 8 : 4));
      const room = map.rooms.find(r => s.x >= r.x && s.x < r.x + r.w && s.z >= r.z && s.z < r.z + r.h);
      if (room) { c.strokeStyle = col; c.lineWidth = bigMap ? 4 : 2; c.strokeRect(room.x * k + 1.5, room.z * k + 1.5, room.w * k - 3, room.h * k - 3); }
      const r = (bigMap ? 9 : 4.6) * (1 + 0.25 * beat);
      c.globalAlpha = 0.35 * (1 - beat); c.fillStyle = col;
      c.beginPath(); c.arc(x, z, r * 2.2, 0, 7); c.fill();
      c.globalAlpha = 1; c.strokeStyle = '#0f1424'; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(x, z - r); c.lineTo(x + r, z); c.lineTo(x, z + r); c.lineTo(x - r, z); c.closePath();
      c.fill(); c.stroke();
    };
    for (const id in app.markers) mark(g.stations[id], app.markers[id]);
    if (partner?.alive) { c.fillStyle = '#ff5d57'; c.beginPath(); c.arc(partner.pos.x * k, partner.pos.z * k, bigMap ? 5 : 2.6, 0, 7); c.fill(); }
    c.save();
    c.translate(me.pos.x * k, me.pos.z * k);
    c.rotate(-me.facing);
    const s = bigMap ? 9 : 5;
    c.fillStyle = '#fff'; c.strokeStyle = '#0f1424'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(0, s); c.lineTo(s * 0.7, -s * 0.7); c.lineTo(0, -s * 0.3); c.lineTo(-s * 0.7, -s * 0.7); c.closePath();
    c.fill(); c.stroke();
    c.restore();
    c.restore();
  }

  function drawTasks() {
    const down = g.terminalsDown();
    const sig = me.tasks.map(t => +t.done).join('') + down;
    if (sig === taskSig) return;
    taskSig = sig;
    el.count.textContent = `${me.tasks.filter(t => t.done).length}/${me.tasks.length}`;
    clear(el.tasks).append(...me.tasks.map(t => {
      const st = g.stations[t.station];
      return h('li', { class: t.done ? 'done' : down && st.workstation ? 'off' : '' }, h('i', { style: { borderColor: mole ? MARK.cover : MARK.task } }), h('span', {}, t.name), h('em', {}, g.roomName(st.room)));
    }));
  }

  const lines = [];
  function push(node, kind = '') {
    const li = h('div', { class: `line ${kind}` }, node);
    el.feed.append(li);
    lines.push({ li, t: 9 });
    while (lines.length > 6) lines.shift().li.remove();
  }

  return {
    root,
    stick,
    toggleTickets: () => setCollapsed(!el.card.classList.contains('collapsed')),
    toast: (text, kind) => push(text, kind),
    bark: (a, text) => push(h('span', {}, chip(a), ` ${text}`), 'bark'),
    toggleMap: () => { bigMap = !bigMap; },
    openSay: () => { el.say.style.display = ''; el.say.focus(); },
    closeSay: () => { el.say.style.display = 'none'; el.say.blur(); },
    destroy: () => root.remove(),
    update(dt, t) {
      const it = app.interact, s = g.sabotage, ghost = !me.alive;
      drawTasks();
      const pct = g.taskTotal ? g.taskDone / g.taskTotal : 0;
      el.taskBar.style.width = `${pct * 100}%`;
      setText(el.taskN, `${g.taskDone} / ${g.taskTotal}`);
      el.leakBar.style.width = `${g.exfil}%`;
      setText(el.leakN, `${Math.floor(g.exfil)}%`);
      const next = me.tasks.find(x => !x.done);
      setText(el.objective, ghost ? (mole ? 'You were walked out. Watch your partner finish the job.' : 'You are out, but your tickets still count. Finish them.')
        : s ? s.def.hint
        : mole ? 'Blend in. Catch someone alone, or open the toolkit and break something.'
        : next ? `Next ticket: ${next.name} · ${g.roomName(g.stations[next.station].room)}` : 'Your tickets are shipped. Watch who is really working.');
      el.alarm.style.display = s ? '' : 'none';
      if (s) setText(el.alarm, s.def.critical ? `${s.def.alert} · ${Math.max(0, Math.ceil(s.timeLeft))}s` : s.def.alert);
      setText(el.where, ghost ? 'Spectating' : g.roomName(me.room));
      setText(el.role, ghost ? 'Out' : ROLES[me.role].name);

      el.use.disabled = !it.use || it.use.blocked;
      el.report.disabled = !it.report;
      el.report.classList.toggle('hot', !!it.report);
      const canPage = me.alive && me.pager > 0 && !s?.def.critical && g.time - g.lastMeetingEnd >= g.S.pagerLockout;
      el.pager.disabled = !canPage;
      setText(el.pager._sub, me.pager > 0 ? (canPage ? `${me.pager} left` : s?.def.critical ? 'fix the outage first' : 'not yet') : 'used');
      if (mole) {
        el.kill.disabled = !it.kill || me.cd.kill > 0;
        setText(el.kill._sub, me.cd.kill > 0 ? `${Math.ceil(me.cd.kill)}s` : it.kill ? it.kill.def.name : 'get close');
        el.steal.disabled = !it.steal;
        setText(el.steal._sub, me.cd.steal > 0 ? `${Math.ceil(me.cd.steal)}s` : 'at a workstation');
        el.sab.disabled = !me.alive;
        setText(el.sab._sub, g.sabotage ? 'incident live' : g.sabCd > 0 ? `${Math.ceil(g.sabCd)}s` : 'ready');
      }
      const tips = [];
      if (it.use) tips.push(['E', it.use.label]);
      if (it.steal) tips.push(['F', 'Steal data from this workstation']);
      if (it.kill && me.cd.kill <= 0) tips.push(['Q', `Eliminate ${it.kill.def.name}`]);
      if (it.report) tips.push(['R', `Report ${g.agent(it.report.victim).def.name}`]);
      if (me.activity?.type === 'steal') tips.length = 0, tips.push(['', `Copying files… ${Math.ceil(g.S.stealDuration - me.activity.t)}s`]);
      const sig = tips.map(x => x.join()).join('|');
      if (el.prompt._v !== sig) {
        el.prompt._v = sig;
        clear(el.prompt).append(...tips.map(([k, text]) => h('div', { class: 'tip' }, k ? h('kbd', {}, k) : null, text)));
      }
      for (const l of lines) { l.t -= dt; if (l.t < 1) l.li.style.opacity = Math.max(0, l.t); }
      while (lines.length && lines[0].t <= 0) lines.shift().li.remove();
      drawMap(t);
    },
  };
}
