// Authoritative match simulation. No rendering, no DOM: input arrives as commands,
// output leaves as events on the bus. A network layer can sit on exactly that seam.
import { Bus, Rng, dist } from '../core/util.js';
import { SETTINGS, CHARACTERS, SABOTAGES, WIN_CONDITIONS, MATCH_DAYS } from '../data/config.js';
import { MAP, roomAt, roomById } from '../data/map.js';
import { TASKS } from '../data/tasks.js';
import { Nav } from './nav.js';
import { initAI, updateAI } from './ai.js';
import { Meeting } from './meeting.js';

let navCache = null;

export class Game {
  constructor({ seed = (Math.random() * 2 ** 31) | 0, humanId = null, humans = null, humanRole = 'random', map = MAP, settings = SETTINGS, day = null } = {}) {
    this.map = map;
    this.nav = navCache && navCache.map === map ? navCache : (navCache = new Nav(map));
    this.rng = new Rng(seed);
    this.day = MATCH_DAYS.find(d => d.id === day) || this.rng.pick(MATCH_DAYS);
    this.S = settings = { ...settings, ...this.day.settings };
    this.bus = new Bus();
    this.time = 0;
    this.phase = 'play';
    this.result = null;
    this.meeting = null;
    this.sabotage = null;
    this.sabCd = settings.sabotageCooldownStart;
    this.camJam = 0;
    this.exfil = 0;
    this.bodies = [];
    this.lastMeetingEnd = 0;
    this.lastBody = null;
    this.pendingAlerts = [];
    this.logs = { access: [], work: [], network: [], alerts: [] };

    this.stations = {};
    for (const s of map.stations) {
      const c = this.nav.nearestFree(s.x, s.z);
      const free = this.nav.reach[Math.floor(s.z / map.cell) * this.nav.W + Math.floor(s.x / map.cell)];
      const p = free ? { x: s.x, z: s.z } : this.nav.centre(c[0], c[1]);
      this.stations[s.id] = { ...s, x: p.x, z: p.z, room: roomAt(map, p.x, p.z).id };
    }

    // one local player, or several networked ones; everyone else gets an AI brain
    const hs = humans || (humanId ? [humanId] : []);
    if (hs.length > 1) humanId = null;
    const order = this.rng.shuffle(CHARACTERS.map(c => c.id));
    const others = order.filter(id => id !== humanId);
    let moles;
    if (humanId && humanRole === 'mole') moles = [humanId, ...others.slice(0, settings.moleCount - 1)];
    else if (humanId && humanRole === 'staff') moles = others.slice(0, settings.moleCount);
    else moles = order.slice(0, settings.moleCount);

    const spawns = this.rng.shuffle(map.spawns);
    this.agents = CHARACTERS.map((def, i) => {
      const role = moles.includes(def.id) ? 'mole' : 'staff';
      const tasks = this.rng.shuffle(TASKS).slice(0, settings.tasksPerStaff).map(t => ({
        id: t.id, name: t.name, station: this.rng.pick(t.stations), done: false, fake: role === 'mole',
      }));
      return {
        id: def.id, def, role, alive: true, ejected: false, isHuman: hs.includes(def.id), vel: { x: 0, z: 0 },
        pos: { x: spawns[i][0], z: spawns[i][1] }, facing: 0, speed: 0, move: { x: 0, z: 0, run: false },
        path: null, room: null, roomLog: [], tasks, activity: null, lastTask: null,
        pager: settings.pagerCharges,
        cd: { kill: settings.killCooldownStart, steal: 12, jam: 20, forge: 25 },
      };
    });
    this.human = this.agents.find(a => a.isHuman) || null;
    this.taskTotal = this.agents.filter(a => a.role === 'staff').length * settings.tasksPerStaff;
    this.taskDone = 0;
    this.trackRooms(true);
    initAI(this);
  }

  agent(id) { return this.agents.find(a => a.id === id); }
  living(role) { return this.agents.filter(a => a.alive && (!role || a.role === role)); }
  roomName(id) { return roomById(this.map, id)?.name || 'the office'; }
  // room name as it reads mid-sentence: "the Server Room", "Reception"
  place(id) { const r = roomById(this.map, id); return r ? (r.bare ? r.name : `the ${r.name}`) : 'the office'; }
  canSee(a, b) { return dist(a.pos, b.pos) <= this.S.visionRange && this.nav.los(a.pos, b.pos); }
  near(a, p, r) { return dist(a.pos, p) <= r; }
  terminalsDown() { return !!this.sabotage?.def.blocksTerminals; }

  update(dt) {
    if (this.phase === 'ended') return;
    if (this.phase === 'meeting') { this.meeting.update(dt); return; }
    this.time += dt;
    this.sabCd = Math.max(0, this.sabCd - dt);
    this.camJam = Math.max(0, this.camJam - dt);
    for (const a of this.agents) for (const k in a.cd) a.cd[k] = Math.max(0, a.cd[k] - dt);
    this.moveHuman(dt);
    // a dead human ghost who disconnects is handed to the AI, which never does ghost tickets
    for (const a of this.agents) if (!a.alive && !a.isHuman && a.role === 'staff' && !a.tasksDropped) this.dropTasks(a);
    updateAI(this, dt);
    if (this.phase !== 'play') return;
    this.tickActivities(dt);
    this.trackRooms();
    this.tickSabotage(dt);
    while (this.pendingAlerts.length && this.pendingAlerts[0].at <= this.time) this.alert(this.pendingAlerts.shift());
    this.checkWin();
  }

  moveHuman(dt) { for (const h of this.agents) if (h.isHuman) this.movePlayer(h, dt); }

  // short acceleration ramp so starts, stops and turns read as smooth instead of snapping
  movePlayer(h, dt) {
    const m = h.move, len = Math.hypot(m.x, m.z), v = h.vel;
    const go = !h.activity && len > 0.01;
    const sp = go ? (m.run ? this.S.runSpeed : this.S.walkSpeed) * (h.alive ? 1 : 1.25) : 0;
    const k = Math.min(1, dt * (go ? 16 : 22));
    v.x += ((go ? (m.x / len) * sp : 0) - v.x) * k;
    v.z += ((go ? (m.z / len) * sp : 0) - v.z) * k;
    h.speed = Math.hypot(v.x, v.z);
    if (h.speed < 0.05) { v.x = v.z = 0; h.speed = 0; return; }
    const dx = v.x * dt, dz = v.z * dt, r = 0.26;
    if (this.nav.canStand(h.pos.x + dx, h.pos.z, r)) h.pos.x += dx; else v.x = 0;
    if (this.nav.canStand(h.pos.x, h.pos.z + dz, r)) h.pos.z += dz; else v.z = 0;
    if (go) h.facing = Math.atan2(m.x, m.z);
  }

  tickActivities(dt) {
    for (const a of this.agents) {
      const act = a.activity;
      if (!act || act.type !== 'steal') continue;
      act.t += dt;
      if (act.t < this.S.stealDuration) continue;
      const st = this.stations[act.station];
      this.exfil = Math.min(100, this.exfil + this.S.stealAmount);
      a.cd.steal = this.S.stealCooldown;
      this.pendingAlerts.push({ at: this.time + this.rng.range(...this.S.stealAlertDelay), kind: 'theft', room: st.room,
        text: `Data exfiltration traced to ${this.place(st.room)}` });
      this.pendingAlerts.sort((x, y) => x.at - y.at);
      this.endActivity(a, { completed: false });
      this.bus.emit('steal', { agent: a, station: st });
    }
  }

  trackRooms(silent) {
    for (const a of this.agents) {
      if (!a.alive) continue;
      const r = roomAt(this.map, a.pos.x, a.pos.z);
      const id = r ? r.id : a.room;
      if (id === a.room) continue;
      a.room = id;
      a.roomLog.push({ t: this.time, room: id });
      if (!silent && roomById(this.map, id)?.badge) {
        this.logs.access.push({ t: this.time, who: this.rng.chance(this.S.badgeMissChance) ? null : a.id, room: id });
      }
    }
  }

  whereWas(a, t) {
    let room = a.roomLog[0]?.room;
    for (const e of a.roomLog) { if (e.t <= t) room = e.room; else break; }
    return room;
  }

  tickSabotage(dt) {
    const s = this.sabotage;
    if (!s) return;
    if (s.def.critical) s.timeLeft -= dt;
    if (s.def.leakPerSec) this.exfil = Math.min(100, this.exfil + s.def.leakPerSec * dt);
  }

  alert(a) {
    const entry = { t: this.time, kind: a.kind, room: a.room, text: a.text };
    this.logs.alerts.push(entry);
    if (a.kind === 'theft') this.logs.network.push({ ...entry });
    this.bus.emit('alert', entry);
  }

  logLogin(a, stationId, kind = 'login', task = null) {
    const st = this.stations[stationId];
    this.logs.work.push({ t: this.time, who: this.rng.chance(this.S.badgeMissChance) ? null : a.id, station: st.label, room: st.room, kind, task });
  }

  endActivity(a, info = {}) {
    const act = a.activity;
    if (!act) return;
    a.activity = null;
    this.bus.emit('activity:end', { agent: a, kind: act.type, fake: !!act.fake, completed: false, cancelled: false, ...info });
  }

  checkWin() {
    if (this.phase === 'ended') return;
    for (const c of WIN_CONDITIONS) {
      if (!c.test(this)) continue;
      this.phase = 'ended';
      this.result = { side: c.side, id: c.id, text: c.text };
      this.bus.emit('end', this.result);
      return;
    }
  }

  // ---- commands: the only way anything acts on the world -----------------
  command(id, cmd) {
    const a = this.agent(id);
    if (!a || this.phase === 'ended') return false;
    if (this.phase === 'meeting') {
      if (cmd.type === 'vote') return this.meeting.castVote(a, cmd.target);
      if (cmd.type === 'say') return this.meeting.playerSay(a, cmd.text);
      if (cmd.type === 'meetingAction') return this.meeting.playerAction(a, cmd.kind, cmd.target);
      return false;
    }
    const fn = this.handlers[cmd.type];
    return fn ? !!fn.call(this, a, cmd) : false;
  }

  handlers = {
    move(a, c) { a.move.x = c.x; a.move.z = c.z; a.move.run = !!c.run; return true; },

    beginTask(a, c) {
      const st = this.stations[c.station];
      if (!st || a.activity || !this.near(a, st, this.S.interactRange + 0.4)) return false;
      if (!a.alive && !(a.isHuman && a.role === 'staff')) return false;
      if (this.terminalsDown() && st.workstation) return false;
      const fake = a.role === 'mole';
      if (!fake && !a.tasks.some(t => t.station === st.id && !t.done)) return false;
      a.facing = Math.atan2(st.fx - a.pos.x, st.fz - a.pos.z);
      a.activity = { type: 'task', station: st.id, fake, t: 0 };
      this.bus.emit('activity:start', { agent: a, kind: 'task' });
      return true;
    },

    completeTask(a) {
      const act = a.activity;
      if (!act || act.type !== 'task') return false;
      const st = this.stations[act.station];
      const task = a.tasks.find(t => t.station === st.id && !t.done);
      if (act.fake) {
        if (st.workstation) this.logLogin(a, st.id);
        if (task && a.isHuman) task.done = true;
        this.endActivity(a, { completed: false });
        return true;
      }
      if (!task) { this.endActivity(a, { cancelled: true }); return false; }
      task.done = true;
      this.taskDone++;
      a.lastTask = { name: task.name, t: this.time, room: st.room };
      this.logLogin(a, st.id, 'task', task.name);
      this.endActivity(a, { completed: true });
      this.bus.emit('task:done', { agent: a, task });
      this.checkWin();
      return true;
    },

    cancel(a) { if (!a.activity) return false; this.endActivity(a, { cancelled: true }); return true; },

    beginFix(a) {
      const s = this.sabotage;
      if (!s || !a.alive || a.activity) return false;
      const st = this.stations[s.def.station];
      if (!this.near(a, st, this.S.interactRange + 0.4)) return false;
      a.facing = Math.atan2(st.fx - a.pos.x, st.fz - a.pos.z);
      a.activity = { type: 'fix', station: st.id, t: 0 };
      this.bus.emit('activity:start', { agent: a, kind: 'fix' });
      return true;
    },

    completeFix(a) {
      if (!a.activity || a.activity.type !== 'fix' || !this.sabotage) return false;
      this.endActivity(a, { completed: true });
      this.clearSabotage(a, true);
      return true;
    },

    sabotage(a, c) {
      const def = SABOTAGES[c.id];
      if (!def || a.role !== 'mole' || !a.alive || this.sabotage || this.sabCd > 0) return false;
      this.sabotage = { def, timeLeft: def.timer ?? Infinity, t0: this.time, origin: a.room, by: a.id };
      this.logs.network.push({ t: this.time, kind: 'sabotage', room: a.room,
        text: `Hostile command (${def.name}) issued from the ${this.roomName(a.room)} segment` });
      this.bus.emit('sabotage:start', this.sabotage);
      return true;
    },

    kill(a, c) {
      const t = this.agent(c.target);
      if (a.role !== 'mole' || !a.alive || a.cd.kill > 0 || !t || !t.alive || t.role === 'mole') return false;
      if (!this.near(a, t.pos, this.S.killRange)) return false;
      if (a.activity) this.endActivity(a, { cancelled: true });
      if (t.activity) this.endActivity(t, { cancelled: true });
      t.alive = false;
      t.speed = 0;
      a.cd.kill = this.S.killCooldown;
      const body = { id: `${t.id}@${this.time.toFixed(1)}`, victim: t.id, pos: { ...t.pos }, room: t.room, t: this.time, reported: false };
      this.bodies.push(body);
      this.lastBody = body;
      this.dropTasks(t);
      this.bus.emit('kill', { killer: a, victim: t, body });
      this.checkWin();
      return true;
    },

    steal(a, c) {
      const st = this.stations[c.station];
      if (a.role !== 'mole' || !a.alive || a.activity || !st?.workstation || a.cd.steal > 0) return false;
      if (this.terminalsDown() || !this.near(a, st, this.S.interactRange + 0.4)) return false;
      a.facing = Math.atan2(st.fx - a.pos.x, st.fz - a.pos.z);
      a.activity = { type: 'steal', station: st.id, fake: true, t: 0 };
      this.logLogin(a, st.id);
      this.bus.emit('activity:start', { agent: a, kind: 'steal' });
      return true;
    },

    jamCameras(a) {
      if (a.role !== 'mole' || !a.alive || a.cd.jam > 0) return false;
      this.camJam = this.S.cameraJamDuration;
      a.cd.jam = this.S.cameraJamCooldown;
      this.bus.emit('cameras:jam', { by: a });
      return true;
    },

    // plant a false door-log entry that puts an innocent colleague somewhere sensitive
    forge(a) {
      if (a.role !== 'mole' || !a.alive || a.cd.forge > 0) return false;
      const marks = this.living('staff');
      if (!marks.length) return false;
      const badge = this.map.rooms.filter(r => r.badge).map(r => r.id);
      const room = this.lastBody && badge.includes(this.lastBody.room) && this.rng.chance(0.6) ? this.lastBody.room
        : this.sabotage && badge.includes(this.sabotage.origin) ? this.sabotage.origin : this.rng.pick(badge);
      const entry = { t: Math.max(0, this.time - this.rng.range(3, 14)), who: this.rng.pick(marks).id, room, forged: true };
      this.logs.access.push(entry);
      this.logs.access.sort((x, y) => x.t - y.t);
      a.cd.forge = this.S.forgeCooldown;
      this.bus.emit('forge', { by: a, entry });
      return true;
    },

    report(a, c) {
      const body = this.bodies.find(b => b.id === c.body && !b.reported);
      if (!body || !a.alive) return false;
      if (!c.ai && !this.near(a, body.pos, this.S.reportRange)) return false;
      this.startMeeting({ kind: 'body', by: a.id, body });
      return true;
    },

    pager(a) {
      if (!a.alive || a.pager <= 0 || this.sabotage?.def.critical) return false;
      const btn = this.stations.emergency;
      if (btn && !this.near(a, btn, this.S.interactRange + 0.4)) return false;
      if (this.time - this.lastMeetingEnd < this.S.pagerLockout) return false;
      a.pager--;
      this.startMeeting({ kind: 'pager', by: a.id });
      return true;
    },
  };

  // killed humans keep working as ghosts; ejected humans and AI-controlled dead cannot, so their tickets leave the total
  dropTasks(a) {
    if (a.role !== 'staff' || a.tasksDropped || (a.isHuman && !a.ejected)) return;
    a.tasksDropped = true;
    this.taskTotal -= a.tasks.filter(t => !t.done).length;
  }

  clearSabotage(by, fixed) {
    const s = this.sabotage;
    if (!s) return;
    this.sabotage = null;
    this.sabCd = this.S.sabotageCooldown;
    if (fixed) this.logs.network.push({ t: this.time, kind: 'fix', room: this.stations[s.def.station].room, text: `${s.def.name} resolved` });
    this.bus.emit('sabotage:end', { def: s.def, by, fixed });
  }

  startMeeting(ctx) {
    for (const a of this.agents) { if (a.activity) this.endActivity(a, { cancelled: true }); a.speed = 0; a.move.x = a.move.z = 0; }
    this.clearSabotage(null, false);
    for (const b of this.bodies) b.reported = true;
    this.phase = 'meeting';
    this.meeting = new Meeting(this, ctx);
    this.bus.emit('meeting:start', this.meeting);
  }

  eject(a) {
    a.alive = false;
    a.ejected = true;
    this.dropTasks(a);
    this.bus.emit('eject', { agent: a });
  }

  endMeeting() {
    const m = this.meeting;
    this.bodies = [];
    const seats = this.map.seats;
    const [fx, fz] = this.map.seatFocus;
    this.living().forEach((a, i) => {
      const s = seats[i % seats.length];
      a.pos.x = s[0]; a.pos.z = s[1];
      a.facing = Math.atan2(fx - s[0], fz - s[1]);
      a.path = null;
      a.cd.kill = Math.max(a.cd.kill, this.S.killCooldown * 0.75);
    });
    this.sabCd = Math.max(this.sabCd, 20);
    this.phase = 'play';
    this.lastMeetingEnd = this.time;
    this.trackRooms(true);
    this.bus.emit('meeting:end', m);
    this.meeting = null;
    this.checkWin();
  }
}
