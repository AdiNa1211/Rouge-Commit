// AI colleagues: perception, memory, suspicion and the staff / mole behaviour loops.
import { PERSONALITIES, SABOTAGES } from '../data/config.js';
import { dist, clamp } from '../core/util.js';

export const addSus = (a, id, v) => {
  if (!a.brain || id === a.id) return;
  a.brain.sus[id] = clamp((a.brain.sus[id] || 0) + v, -40, 100);
};
export const addFact = (a, fact) => { a.mem.facts.push(fact); if (a.mem.facts.length > 40) a.mem.facts.shift(); };

export function makeBrain(game, a) {
  const rng = game.rng;
  return {
    per: PERSONALITIES[a.def.personality], state: 'idle', wait: rng.range(1, 5), goal: null, timer: 0,
    think: rng.range(0, 0.4), sus: {}, watch: {}, respond: false, hurry: false, hunt: null,
    reportAt: null, reportBody: null, ignore: new Set(), repath: 0,
  };
}

export function initAI(game) {
  const rng = game.rng;
  for (const a of game.agents) {
    // everyone, the human included, keeps a memory of who they saw where
    a.mem = { seen: {}, sightings: [], facts: [] };
    if (a.isHuman) continue;
    a.brain = makeBrain(game, a);
  }
  game.percT = 0;
  const ais = () => game.agents.filter(a => a.brain && a.alive);

  game.bus.on('kill', ({ killer, victim, body }) => {
    for (const w of ais()) {
      if (w === killer || w.role === 'mole' || !game.canSee(w, killer)) continue;
      w.brain.sus[killer.id] = 100;
      addFact(w, { type: 'witness', who: killer.id, victim: victim.id, room: body.room, t: game.time });
      w.brain.reportAt = game.time + 0.4;
      w.brain.reportBody = body.id;
    }
  });

  // watching someone "work": a real ticket moves the counter, a fake one does not
  game.bus.on('activity:end', ({ agent, kind, fake, completed, cancelled }) => {
    for (const w of ais()) {
      const seen = w.brain.watch[agent.id];
      delete w.brain.watch[agent.id];
      if (!seen || cancelled || w.role === 'mole' || !agent.alive || game.time - seen.since < 1.5) continue;
      if (kind === 'task' && completed) {
        addSus(w, agent.id, -14);
        addFact(w, { type: 'sawTask', who: agent.id, room: agent.room, t: game.time });
      } else if (fake && kind !== 'fix' && rng.chance(w.brain.per.observe * 0.55)) {
        addSus(w, agent.id, 15);
        addFact(w, { type: 'fakeTask', who: agent.id, room: agent.room, t: game.time });
      }
    }
  });

  game.bus.on('sabotage:start', s => {
    const st = game.stations[s.def.station];
    const staff = ais().filter(a => a.role === 'staff');
    for (const a of ais()) {
      const b = a.brain;
      b.respond = a.role === 'staff' ? rng.chance(s.def.critical ? 0.7 : 0.5) : rng.chance(0.4);
      // the log-readers check where the hostile command came from
      if (a.role === 'staff' && b.per.usesLogs) {
        for (const o of game.living()) {
          const seen = a.mem.seen[o.id];
          if (o !== a && seen && game.time - seen.t < 8 && seen.room === s.origin) {
            addSus(a, o.id, 9);
            addFact(a, { type: 'sabOrigin', who: o.id, room: s.origin, sab: s.def.name, t: game.time });
          }
        }
      }
    }
    staff.sort((x, y) => dist(x.pos, st) - dist(y.pos, st)).slice(0, 2).forEach(a => { a.brain.respond = true; });
    for (const a of ais()) {
      const b = a.brain;
      if (b.respond && (b.state === 'idle' || b.state === 'move')) { b.state = 'idle'; b.wait = rng.range(0.3, 1.4); }
    }
  });

  game.bus.on('sabotage:end', () => {
    for (const a of ais()) {
      const b = a.brain;
      b.respond = false;
      if (b.goal?.kind === 'fix') {
        if (a.activity) game.command(a.id, { type: 'cancel' });
        b.state = 'idle'; b.wait = rng.range(0.5, 2.5); b.goal = null;
      }
    }
  });

  game.bus.on('meeting:end', () => {
    for (const a of game.agents) {
      if (!a.brain) continue;
      Object.assign(a.brain, { state: 'idle', wait: rng.range(0.8, 4.5), goal: null, hunt: null, watch: {}, reportAt: null, respond: false, hurry: false });
    }
  });
}

function noteSighting(game, a, o, via) {
  const prev = a.mem.seen[o.id];
  const doing = o.activity ? (o.activity.type === 'fix' ? 'fixing the incident' : `at the ${game.stations[o.activity.station].label}`) : 'walking';
  const fresh = !prev || prev.room !== o.room || game.time - prev.t > 6;
  if (fresh) {
    const s = { t: game.time, until: game.time, who: o.id, room: o.room, doing, via };
    a.mem.sightings.push(s);
    if (a.mem.sightings.length > 80) a.mem.sightings.shift();
    a.mem.seen[o.id] = { t: game.time, room: o.room, doing, entry: s };
  } else {
    prev.t = game.time;
    prev.entry.until = game.time;
    if (o.activity) { prev.doing = doing; prev.entry.doing = doing; }
  }
}

// lets the camera wall feed the player's notebook
export function noteCameraSighting(game, viewer, o) { noteSighting(game, viewer, o, 'camera'); }

function perceive(game) {
  const S = game.S;
  for (const a of game.agents) {
    if (!a.alive) continue;
    const b = a.brain;
    for (const o of game.agents) {
      if (o === a || !o.alive) continue;
      if (!game.canSee(a, o)) { if (b) delete b.watch[o.id]; continue; }
      noteSighting(game, a, o, 'eyes');
      if (!b) continue;
      if (o.activity && o.activity.type !== 'fix') b.watch[o.id] ??= { since: game.time };
      else delete b.watch[o.id];
    }
    if (!b || b.reportAt != null) continue;
    for (const body of game.bodies) {
      if (body.reported || b.ignore.has(body.id)) continue;
      if (dist(a.pos, body.pos) > S.visionRange * 0.8 || !game.nav.los(a.pos, body.pos)) continue;
      if (a.role === 'mole' && !game.rng.chance(0.3)) { b.ignore.add(body.id); continue; }
      b.reportAt = game.time + game.rng.range(0.5, 1.4);
      b.reportBody = body.id;
    }
  }
}

export function updateAI(game, dt) {
  game.percT -= dt;
  if (game.percT <= 0) { game.percT = 0.25; perceive(game); }
  for (const a of game.agents) {
    if (!a.brain || !a.alive) continue;
    tick(game, a, dt);
    if (game.phase !== 'play') return;
  }
}

function tick(game, a, dt) {
  const b = a.brain;
  a.speed = 0;
  if (b.reportAt != null && game.time >= b.reportAt) {
    b.reportAt = null;
    if (game.command(a.id, { type: 'report', body: b.reportBody, ai: true })) return;
  }
  b.think -= dt;
  if (b.think <= 0) {
    b.think = 0.4;
    think(game, a);
    if (game.phase !== 'play') return;
  }
  if (b.state === 'idle') { b.wait -= dt; if (b.wait <= 0) chooseGoal(game, a); }
  else if (b.state === 'move') { if (follow(game, a, dt, b.hurry ? 1.4 : 1)) arrive(game, a); }
  else if (b.state === 'work') { b.timer -= dt; if (b.timer <= 0) finishWork(game, a); }
  else if (b.state === 'hunt') hunt(game, a, dt);
}

function follow(game, a, dt, mult) {
  const p = a.path;
  if (!p || !p.length) return true;
  const sp = game.S.aiSpeed * mult;
  let step = sp * dt;
  a.speed = sp;
  while (step > 0 && p.length) {
    const t = p[0], dx = t.x - a.pos.x, dz = t.z - a.pos.z, d = Math.hypot(dx, dz);
    if (d <= step) { a.pos.x = t.x; a.pos.z = t.z; p.shift(); step -= d; }
    else { a.pos.x += (dx / d) * step; a.pos.z += (dz / d) * step; a.facing = Math.atan2(dx, dz); step = 0; }
  }
  return !p.length;
}

function goTo(game, a, target, goal) {
  const b = a.brain;
  const path = game.nav.findPath(a.pos, target);
  if (!path) { b.state = 'idle'; b.wait = 1; return false; }
  if (path.length > 1) path.shift();
  a.path = path;
  b.goal = goal;
  b.state = 'move';
  return true;
}

// nobody but the victim (and other moles) can see either of them
function unseen(game, mole, victim) {
  for (const w of game.agents) {
    if (!w.alive || w === mole || w === victim || w.role === 'mole') continue;
    if (game.canSee(w, mole) || game.canSee(w, victim)) return false;
  }
  return true;
}

function think(game, a) {
  const b = a.brain, rng = game.rng, S = game.S;
  if (a.role === 'staff') {
    if (a.pager > 0 && game.time - game.lastMeetingEnd > S.pagerLockout + 10) {
      const top = Math.max(...game.living().filter(o => o !== a).map(o => b.sus[o.id] || 0));
      if (top >= b.per.pagerAt) game.command(a.id, { type: 'pager' });
    }
    return;
  }
  if (a.activity?.type === 'steal') return;
  if (a.cd.kill <= 0 && b.state !== 'hunt') {
    let best = null, bd = 10;
    for (const t of game.living('staff')) {
      const d = dist(a.pos, t.pos);
      if (d < bd && game.canSee(a, t) && unseen(game, a, t)) { best = t; bd = d; }
    }
    if (best) {
      if (a.activity) game.command(a.id, { type: 'cancel' });
      b.state = 'hunt'; b.hunt = { id: best.id, until: game.time + 7 }; b.repath = 0;
      return;
    }
  }
  if (!game.sabotage && game.sabCd <= 0 && rng.chance(0.07)) {
    game.command(a.id, { type: 'sabotage', id: rng.pick(Object.keys(SABOTAGES)) });
  }
  if (a.cd.jam <= 0 && rng.chance(0.008)) game.command(a.id, { type: 'jamCameras' });
  if (a.cd.forge <= 0 && rng.chance(0.01)) game.command(a.id, { type: 'forge' });
}

function chooseGoal(game, a) {
  const b = a.brain, rng = game.rng;
  b.hurry = false;
  if (game.sabotage && b.respond) {
    b.hurry = true;
    return goTo(game, a, game.stations[game.sabotage.def.station], { kind: 'fix' });
  }
  const open = a.tasks.filter(t => !t.done && !(game.terminalsDown() && game.stations[t.station].workstation));
  const mole = a.role === 'mole';
  if (open.length && rng.chance(mole ? 0.5 : 0.62 / b.per.breakTime)) {
    let t = rng.pick(open);
    if (!mole && rng.chance(0.5)) t = open.reduce((m, x) => (dist(a.pos, game.stations[x.station]) < dist(a.pos, game.stations[m.station]) ? x : m));
    return goTo(game, a, game.stations[t.station], { kind: 'task', station: t.station });
  }
  if (mole && a.cd.kill < 10 && rng.chance(0.6)) {
    const t = rng.pick(game.living('staff'));
    if (t) return goTo(game, a, t.pos, { kind: 'stalk' });
  }
  if (rng.chance(b.per.follow)) {
    const near = game.living().filter(o => o !== a && a.mem.seen[o.id] && game.time - a.mem.seen[o.id].t < 3);
    if (near.length) return goTo(game, a, rng.pick(near).pos, { kind: 'wander' });
  }
  if (rng.chance(0.15) && !game.terminalsDown()) {
    const desks = Object.values(game.stations).filter(s => s.workstation);
    const st = rng.pick(desks);
    return goTo(game, a, st, { kind: 'email', station: st.id });
  }
  const rooms = game.map.rooms.filter(r => game.nav.freeByRoom[r.id].length);
  const room = rng.pick(rooms);
  return goTo(game, a, rng.pick(game.nav.freeByRoom[room.id]), { kind: 'wander' });
}

function arrive(game, a) {
  const b = a.brain, rng = game.rng, g = b.goal || {};
  b.state = 'idle';
  b.wait = rng.range(1.5, 5) * b.per.breakTime;
  if (g.kind === 'task') {
    const st = game.stations[g.station];
    if (a.role === 'mole' && st.workstation && a.cd.steal <= 0 && rng.chance(0.75) && unseen(game, a, a)) {
      if (game.command(a.id, { type: 'steal', station: st.id })) { b.state = 'work'; b.timer = game.S.stealDuration + 0.4; g.kind = 'steal'; return; }
    }
    if (game.command(a.id, { type: 'beginTask', station: st.id })) { b.state = 'work'; b.timer = rng.range(5, 9.5); }
    else b.wait = 1;
  } else if (g.kind === 'fix') {
    if (game.command(a.id, { type: 'beginFix' })) { b.state = 'work'; b.timer = rng.range(4, 6.5); }
    else b.wait = 0.5;
  } else if (g.kind === 'email') {
    game.logLogin(a, g.station);
    b.wait = rng.range(2.5, 5);
  } else if (g.kind === 'stalk') {
    b.wait = rng.range(0.4, 1.8);
  }
}

function finishWork(game, a) {
  const b = a.brain, g = b.goal || {};
  if (g.kind === 'task') game.command(a.id, { type: 'completeTask' });
  else if (g.kind === 'fix') game.command(a.id, a.role === 'mole' ? { type: 'cancel' } : { type: 'completeFix' });
  b.state = 'idle';
  b.goal = null;
  b.wait = game.rng.range(1.2, 4) * b.per.breakTime;
}

function hunt(game, a, dt) {
  const b = a.brain, t = game.agent(b.hunt.id);
  if (!t.alive || game.time > b.hunt.until || a.cd.kill > 0 || !unseen(game, a, t)) {
    b.state = 'idle'; b.wait = game.rng.range(0.5, 1.5); b.hunt = null;
    return;
  }
  if (dist(a.pos, t.pos) <= game.S.killRange * 0.9) {
    game.command(a.id, { type: 'kill', target: t.id });
    b.hunt = null;
    if (game.phase !== 'play') return;
    // walk away and look busy somewhere else
    const st = game.stations[game.rng.pick(a.tasks).station];
    if (goTo(game, a, st, { kind: 'task', station: st.id })) b.hurry = true;
    return;
  }
  b.repath -= dt;
  if (b.repath <= 0) {
    b.repath = 0.35;
    const path = game.nav.findPath(a.pos, t.pos);
    if (path && path.length > 1) path.shift();
    a.path = path;
  }
  follow(game, a, dt, 1.3);
}
