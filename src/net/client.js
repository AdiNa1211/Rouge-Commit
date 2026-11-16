// Browser side of multiplayer: lobby messages, a mirrored Game the UI reads as usual,
// local prediction for your own movement and smoothing for everyone else.
import { Game } from '../sim/game.js';
import { dist } from '../core/util.js';
import { applyStart, applySnapshot, applyEvent } from './protocol.js';

export class Net {
  constructor(app) {
    this.app = app;
    this.ws = null;
    this.game = null;
    this.lobby = null;
    this.hold = 0;
    this.lastMove = '';
    this.moveT = 0;
  }

  connect() {
    if (this.ws?.readyState === 1) return Promise.resolve();
    return new Promise((ok, fail) => {
      const ws = (this.ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`));
      ws.onopen = ok;
      ws.onerror = () => fail(new Error('Could not reach the game server.'));
      ws.onclose = () => { if (this.ws === ws) this.app.onNetClosed(); };
      ws.onmessage = e => this.receive(JSON.parse(e.data));
    });
  }

  send(msg) { if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(msg)); }
  close() { const ws = this.ws; this.ws = null; this.game = null; ws?.close(); }

  receive(m) {
    const g = this.game;
    if (m.t === 'lobby') { this.lobby = m; this.app.onLobby(m); }
    else if (m.t === 'err') this.app.onNetError(m.text);
    else if (m.t === 'start') {
      const mirror = new Game({ seed: 1, humanId: m.info.you });
      applyStart(mirror, m.info);
      this.game = mirror;
      this.app.startRemote(mirror);
    } else if (!g) return;
    else if (m.t === 's') applySnapshot(g, m, performance.now() < this.hold);
    else if (m.t === 'e') applyEvent(g, m.e, m.d);
    else if (m.t === 'bark') this.app.hud?.bark(g.agent(m.who), m.text);
  }

  // same contract as game.command, answered locally so the UI never waits on the network
  command(c) {
    const g = this.game, me = g.human, reach = g.S.interactRange + 0.4;
    if (c.type === 'move') {
      me.move.x = c.x; me.move.z = c.z; me.move.run = !!c.run;
      const key = `${c.x.toFixed(2)},${c.z.toFixed(2)},${+!!c.run}`, now = performance.now();
      if (key === this.lastMove && now - this.moveT < 200) return true;
      this.lastMove = key; this.moveT = now;
    } else if (c.type === 'beginTask') {
      const st = g.stations[c.station];
      if (!st || me.activity || dist(me.pos, st) > reach || (g.terminalsDown() && st.workstation)) return false;
      if (me.role !== 'mole' && !me.tasks.some(t => t.station === st.id && !t.done)) return false;
      me.facing = Math.atan2(st.fx - me.pos.x, st.fz - me.pos.z);
      me.activity = { type: 'task', station: st.id, fake: me.role === 'mole', t: 0 };
      this.hold = performance.now() + 1200;
    } else if (c.type === 'beginFix') {
      const st = g.sabotage && g.stations[g.sabotage.def.station];
      if (!st || !me.alive || me.activity || dist(me.pos, st) > reach) return false;
      me.activity = { type: 'fix', station: st.id, t: 0 };
      this.hold = performance.now() + 1200;
    } else if (c.type === 'completeTask' || c.type === 'cancel' || c.type === 'completeFix') {
      const task = c.type === 'completeTask' && me.activity && me.tasks.find(t => t.station === me.activity.station && !t.done);
      if (task) task.done = true;
      me.activity = null;
      this.hold = performance.now() + 700;
    }
    this.send({ t: 'c', c });
    return true;
  }

  frame(dt) {
    const g = this.game, me = g.human;
    if (g.phase === 'play') {
      g.time += dt;
      if (g.sabotage?.def.critical) g.sabotage.timeLeft -= dt;
      // your own steps are simulated here with the server's exact rules, then gently reconciled
      g.movePlayer(me, dt);
      if (me.net) {
        const ex = me.net.x - me.pos.x, ez = me.net.z - me.pos.z, e = Math.hypot(ex, ez);
        if (e > 2.5) { me.pos.x = me.net.x; me.pos.z = me.net.z; }
        else if (me.speed < 0.1 && e > 0.02) { const k = Math.min(1, dt * 8); me.pos.x += ex * k; me.pos.z += ez * k; }
      }
    } else if (g.meeting) g.meeting.left -= dt;
    const k = Math.min(1, dt * 14);
    for (const a of g.agents) {
      if (a === me || !a.net) continue;
      const ex = a.net.x - a.pos.x, ez = a.net.z - a.pos.z;
      if (Math.hypot(ex, ez) > 4) { a.pos.x = a.net.x; a.pos.z = a.net.z; } else { a.pos.x += ex * k; a.pos.z += ez * k; }
    }
  }
}
