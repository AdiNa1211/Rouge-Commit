// Wire format shared by the game server and the browser client.
// Server side: snapshot / startInfo / encodeEvent. Client side: applyStart / applySnapshot / applyEvent.
import { SABOTAGES } from '../data/config.js';
import { roomAt } from '../data/map.js';

const r2 = v => Math.round(v * 100) / 100;

// what one player is allowed to know right now
export function snapshot(g, me, slow) {
  const s = {
    t: 's', time: r2(g.time),
    a: g.agents.map(a => [r2(a.pos.x), r2(a.pos.z), r2(a.facing), r2(a.speed), (a.alive ? 1 : 0) | (a.ejected ? 2 : 0), a.activity ? a.activity.type : 0, a.activity ? a.activity.station : 0]),
    b: g.bodies,
    sab: g.sabotage ? [g.sabotage.def.id, Number.isFinite(g.sabotage.timeLeft) ? r2(g.sabotage.timeLeft) : -1] : null,
    sabCd: r2(g.sabCd), camJam: r2(g.camJam), exfil: r2(g.exfil), td: g.taskDone, tt: g.taskTotal, lme: r2(g.lastMeetingEnd),
    me: { cd: me.cd, pager: me.pager, tasks: me.tasks.map(t => (t.done ? 1 : 0)), act: me.activity ? [me.activity.type, me.activity.station, r2(me.activity.t || 0)] : null, room: me.room },
    m: g.meeting ? [g.meeting.phase, r2(g.meeting.left)] : null,
  };
  if (slow) {
    const pub = list => list.slice(-30).map(({ forged, ...e }) => e);
    s.slow = { logs: { access: pub(g.logs.access), work: pub(g.logs.work), network: pub(g.logs.network), alerts: g.logs.alerts.slice(-10) },
      sight: me.mem.sightings.slice(-40).map(({ t, until, who, room, doing, via }) => ({ t: r2(t), until: r2(until), who, room, doing, via })) };
  }
  return s;
}

export function startInfo(g, me) {
  return { you: me.id, role: me.role, moles: me.role === 'mole' ? g.agents.filter(a => a.role === 'mole').map(a => a.id) : [], tasks: me.tasks };
}

// returns the payload this player should receive for a sim event, or undefined to send nothing
export function encodeEvent(type, p, g, me) {
  switch (type) {
    case 'task:done': return { agent: p.agent.id, name: p.task.name };
    case 'sabotage:start': return { id: p.def.id };
    case 'sabotage:end': return { id: p.def.id, fixed: p.fixed };
    case 'alert': return p;
    case 'steal': return p.agent === me ? { agent: me.id } : undefined;
    case 'forge': return p.by === me ? { by: me.id, entry: { who: p.entry.who, room: p.entry.room } } : undefined;
    case 'cameras:jam': return p.by === me ? { by: me.id } : undefined;
    case 'kill': return { victim: p.victim.id, body: p.body, killer: me === p.victim || me === p.killer ? p.killer.id : null };
    case 'meeting:start': return { ctx: p.ctx, chat: p.chat, left: p.left };
    case 'meeting:chat': return p;
    case 'meeting:vote': return p;
    case 'meeting:phase': return { phase: p.phase, left: p.left, result: p.result };
    case 'meeting:end': return {};
    case 'eject': return { agent: p.agent.id, role: g.S.confirmEjects ? p.agent.role : null };
    case 'end': return { result: p, roles: Object.fromEntries(g.agents.map(a => [a.id, a.role])) };
    default: return undefined;
  }
}

// ---- client side: keep a local mirror of the match in the same shape the UI already reads ----
export function applyStart(g, info) {
  for (const a of g.agents) a.role = info.moles.includes(a.id) ? 'mole' : 'staff';
  const me = g.agent(info.you);
  me.role = info.role;
  me.tasks = info.tasks;
  g.remote = true;
}

export function applySnapshot(g, s, holdSelf) {
  const me = g.human;
  g.time = s.time;
  s.a.forEach((v, i) => {
    const a = g.agents[i];
    const first = !a.net;
    a.net = { x: v[0], z: v[1] };
    if (first) { a.pos.x = v[0]; a.pos.z = v[1]; }
    a.alive = !!(v[4] & 1);
    a.ejected = !!(v[4] & 2);
    const r = roomAt(g.map, a.pos.x, a.pos.z);
    if (r) a.room = r.id;
    if (a === me) return;
    a.facing = v[2];
    a.speed = v[3];
    a.activity = v[5] ? { type: v[5], station: v[6], t: 0 } : null;
  });
  g.bodies = s.b;
  if (!s.sab) g.sabotage = null;
  else if (g.sabotage?.def.id === s.sab[0]) g.sabotage.timeLeft = s.sab[1] < 0 ? Infinity : s.sab[1];
  else g.sabotage = { def: SABOTAGES[s.sab[0]], timeLeft: s.sab[1] < 0 ? Infinity : s.sab[1] };
  Object.assign(g, { sabCd: s.sabCd, camJam: s.camJam, exfil: s.exfil, taskDone: s.td, taskTotal: s.tt, lastMeetingEnd: s.lme });
  me.cd = s.me.cd;
  me.pager = s.me.pager;
  if (s.me.room) me.room = s.me.room;
  if (!holdSelf) {
    s.me.tasks.forEach((d, i) => { me.tasks[i].done = !!d; });
    me.activity = s.me.act ? { type: s.me.act[0], station: s.me.act[1], t: s.me.act[2], fake: me.role === 'mole' } : null;
  } else if (me.activity && s.me.act) me.activity.t = s.me.act[2];
  if (g.meeting && s.m) g.meeting.left = s.m[1];
  if (s.slow) {
    g.logs = s.slow.logs;
    const cams = me.mem.sightings.filter(x => x.via === 'camera');
    me.mem.sightings = [...s.slow.sight.filter(x => x.via !== 'camera'), ...cams].sort((x, y) => x.t - y.t);
  }
}

export function applyEvent(g, type, d) {
  const bus = g.bus, A = id => g.agent(id);
  switch (type) {
    case 'task:done': return bus.emit(type, { agent: A(d.agent), task: { name: d.name } });
    case 'sabotage:start': {
      const def = SABOTAGES[d.id];
      g.sabotage = { def, timeLeft: def.timer ?? Infinity };
      return bus.emit(type, g.sabotage);
    }
    case 'sabotage:end': g.sabotage = null; return bus.emit(type, { def: SABOTAGES[d.id], fixed: d.fixed });
    case 'alert': g.logs.alerts.push(d); return bus.emit(type, d);
    case 'steal': return bus.emit(type, { agent: A(d.agent) });
    case 'forge': return bus.emit(type, { by: A(d.by), entry: d.entry });
    case 'cameras:jam': return bus.emit(type, { by: A(d.by) });
    case 'kill': {
      const victim = A(d.victim);
      victim.alive = false;
      if (!g.bodies.some(b => b.id === d.body.id)) g.bodies.push(d.body);
      return bus.emit(type, { killer: d.killer ? A(d.killer) : { def: { name: 'A mole' } }, victim, body: d.body });
    }
    case 'meeting:start':
      for (const a of g.agents) { a.activity = null; a.speed = 0; a.move.x = a.move.z = 0; a.vel.x = a.vel.z = 0; }
      g.phase = 'meeting';
      g.meeting = { ctx: d.ctx, phase: 'discussion', left: d.left, chat: d.chat.slice(), votes: {}, result: null };
      return bus.emit(type, g.meeting);
    case 'meeting:chat': if (g.meeting) { g.meeting.chat.push(d); bus.emit(type, d); } return;
    case 'meeting:vote': if (g.meeting) { g.meeting.votes[d.who] = true; bus.emit(type, d); } return;
    case 'meeting:phase': if (g.meeting) { Object.assign(g.meeting, d); bus.emit(type, g.meeting); } return;
    case 'meeting:end': { const m = g.meeting; g.phase = 'play'; g.meeting = null; return bus.emit(type, m); }
    case 'eject': { const a = A(d.agent); a.alive = false; a.ejected = true; if (d.role) a.role = d.role; return bus.emit(type, { agent: a }); }
    case 'end':
      for (const a of g.agents) a.role = d.roles[a.id];
      g.phase = 'ended';
      g.result = d.result;
      return bus.emit(type, d.result);
  }
}
