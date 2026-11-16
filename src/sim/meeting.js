// Stand-up meetings: discussion, accusations, alibis, voting and what the AI learns from it.
import { clamp } from '../core/util.js';
import { addSus, addFact } from './ai.js';

const FACT_WEIGHT = { witness: 45, fakeTask: 10, nearBody: 9, log: 8, sabOrigin: 7, heard: 4, hunch: 4 };
const FACT_ORDER = ['witness', 'fakeTask', 'nearBody', 'log', 'sabOrigin', 'heard'];

export class Meeting {
  constructor(game, ctx) {
    this.g = game;
    this.ctx = ctx;
    this.S = game.S.meeting;
    this.phase = 'discussion';
    this.t = 0;
    this.left = this.S.discussion;
    this.chat = [];
    this.votes = {};
    this.queue = [];
    this.accusations = [];
    this.replied = new Set();
    this.result = null;
    this.refT = ctx.body ? ctx.body.t : game.time;
    this.prepare();
  }

  get voters() { return this.g.living(); }
  ais(role) { return this.g.living(role).filter(a => a.brain); }
  name(id) { return this.g.agent(id).def.name; }
  at(delay, fn) { this.queue.push({ at: this.t + delay, fn }); this.queue.sort((a, b) => a.at - b.at); }

  prepare() {
    const g = this.g, rng = g.rng, body = this.ctx.body;
    for (const a of this.ais('staff')) {
      const b = a.brain;
      if (body) {
        for (const o of g.living()) {
          if (o === a) continue;
          const hit = a.mem.sightings.find(s => s.who === o.id && s.room === body.room && s.until >= body.t - 12 && s.t <= body.t + 4);
          if (hit) {
            addSus(a, o.id, 18 * (0.5 + b.per.observe));
            addFact(a, { type: 'nearBody', who: o.id, room: body.room, t: body.t });
          } else if (a.mem.sightings.some(s => s.who === o.id && s.until >= body.t - 3 && s.t <= body.t + 3)) {
            addSus(a, o.id, -8);
          }
        }
        if (b.per.usesLogs && !g.terminalsDown()) {
          for (const e of g.logs.access) {
            if (e.room !== body.room || !e.who || e.who === a.id || e.t < body.t - 20 || e.t > body.t + 3) continue;
            if (!g.agent(e.who).alive) continue;
            addSus(a, e.who, 11);
            addFact(a, { type: 'log', who: e.who, room: e.room, t: e.t });
          }
        }
      }
      if (a.def.personality === 'suspicious' && this.ctx.by !== a.id) addSus(a, this.ctx.by, 5);
    }
    const by = g.agent(this.ctx.by);
    if (by.brain) this.at(1.2, () => this.opener(by));
    else this.sys(body ? `${by.def.name} reported ${this.name(body.victim)} crashed in ${g.place(body.room)}.` : `${by.def.name} paged an emergency stand-up.`);
    const D = this.S.discussion;
    for (const a of rng.shuffle(this.ais())) {
      if (a !== by) this.at(rng.range(3, D - 7), () => this.speak(a));
      if (['suspicious', 'aggressive', 'social', 'manipulative'].includes(a.def.personality)) this.at(rng.range(D * 0.5, D - 3), () => this.speak(a, true));
    }
  }

  update(dt) {
    this.t += dt;
    this.left -= dt;
    while (this.queue.length && this.queue[0].at <= this.t) this.queue.shift().fn();
    if (this.phase === 'discussion' && this.left <= 0) this.openVoting();
    else if (this.phase === 'voting') {
      if (this.voters.every(a => a.id in this.votes)) this.left = Math.min(this.left, 1.2);
      if (this.left <= 0) this.tally();
    } else if (this.phase === 'results' && this.left <= 0) this.finish();
  }

  // ---- chat ---------------------------------------------------------------
  sys(text) { this.chat.push({ who: null, text, t: this.t }); this.g.bus.emit('meeting:chat', this.chat.at(-1)); }
  say(a, text, meta = {}) {
    if (!a.alive || this.phase === 'results') return;
    const line = { who: a.id, text, t: this.t, ...meta };
    this.chat.push(line);
    this.g.bus.emit('meeting:chat', line);
  }

  whereLine(a) {
    const g = this.g;
    let room = g.whereWas(a, this.refT), task = null;
    if (a.role === 'mole') {
      // a mole never admits to the scene; the cover story is one of their fake tickets
      if (this.ctx.body && room === this.ctx.body.room) {
        const alt = a.tasks.map(t => g.stations[t.station].room).filter(r => r !== room);
        room = g.rng.pick(alt) || room;
      }
      task = a.tasks.find(t => g.stations[t.station].room === room);
    } else if (a.lastTask && a.lastTask.room === room && this.refT - a.lastTask.t < 40) task = a.lastTask;
    return `I was in ${g.place(room)}${task ? `, working on "${task.name}"` : ''}.`;
  }

  opener(a) {
    const g = this.g, body = this.ctx.body;
    if (body) this.say(a, `I found ${this.name(body.victim)} crashed in ${g.place(body.room)}.`, { kind: 'info' });
    else if (!this.speak(a)) this.say(a, 'I paged this. Something is off and I want everyone accounted for.', { kind: 'info' });
  }

  // spread a claim to everyone listening; how hard it lands depends on trust in the speaker
  broadcast(speaker, target, type, sign = 1) {
    for (const l of this.ais('staff')) {
      if (l === speaker || l.id === target) continue;
      const trust = clamp(1 - (l.brain.sus[speaker.id] || 0) / 50, 0.2, 1.2);
      addSus(l, target, sign * FACT_WEIGHT[type] * l.brain.per.sway * trust);
      if (sign > 0 && type !== 'witness') addFact(l, { type: 'heard', who: target, by: speaker.id, t: this.g.time });
    }
  }

  accuse(speaker, target, type, text, claim) {
    this.say(speaker, text, { kind: 'accuse', target });
    this.accusations.push({ by: speaker.id, target });
    this.broadcast(speaker, target, type);
    const x = this.g.agent(target);
    const key = `${speaker.id}>${target}`;
    if (x.brain && x.alive && !this.replied.has(key)) {
      this.replied.add(key);
      this.at(this.g.rng.range(1.2, 2.6), () => this.defend(x, speaker));
    }
    if (claim) this.contradict(speaker, target, claim);
  }

  defend(x, accuser) {
    if (x.role === 'staff') {
      addSus(x, accuser.id, 7);
      this.say(x, `Not me, ${accuser.def.name}. ${this.whereLine(x)}`, { kind: 'alibi' });
    } else {
      this.say(x, `That's a reach. ${this.whereLine(x)} Funny how fast ${accuser.def.name} points fingers.`, { kind: 'alibi' });
      for (const l of this.ais('staff')) if (l !== accuser) addSus(l, accuser.id, 3 * l.brain.per.sway * (x.def.personality === 'manipulative' ? 1.6 : 1));
    }
  }

  // someone who saw the accused elsewhere at that moment speaks up
  contradict(speaker, target, claim) {
    const g = this.g;
    for (const c of g.rng.shuffle(this.ais('staff'))) {
      if (c === speaker || c.id === target) continue;
      const s = c.mem.sightings.find(e => e.who === target && e.room !== claim.room && e.until >= claim.t - 5 && e.t <= claim.t + 3);
      if (!s) continue;
      this.at(g.rng.range(1.5, 3), () => {
        this.say(c, `That doesn't add up. I saw ${this.name(target)} in ${g.place(s.room)} right then.`, { kind: 'vouch', target });
        addSus(c, speaker.id, 14);
        for (const l of this.ais('staff')) { addSus(l, target, -8); if (l !== c) addSus(l, speaker.id, 8); }
      });
      return;
    }
  }

  speak(a, second) {
    return a.role === 'mole' ? this.speakMole(a, second) : this.speakStaff(a, second);
  }

  speakStaff(a, second) {
    const g = this.g, b = a.brain, rng = g.rng;
    const alive = g.living().filter(o => o !== a);
    const top = alive.reduce((m, o) => ((b.sus[o.id] || 0) > (b.sus[m.id] || 0) ? o : m), alive[0]);
    if (top && (b.sus[top.id] || 0) >= b.per.accuseAt) {
      const facts = a.mem.facts.filter(f => f.who === top.id);
      const f = FACT_ORDER.map(t => facts.findLast(x => x.type === t)).find(Boolean);
      const X = top.def.name, room = f?.room ? g.place(f.room) : '';
      const V = this.ctx.body ? this.name(this.ctx.body.victim) : 'it';
      const lines = {
        witness: `I watched ${X} take ${f?.victim ? this.name(f.victim) : 'them'} down. It is ${X}. Vote now.`,
        fakeTask: `${X} stood at a station in ${room} and the ticket counter never moved. That was fake work.`,
        nearBody: `${X} was in ${room} right around when ${V} went down.`,
        log: `The door log has ${X} badging into ${room} just before it happened.`,
        sabOrigin: `The network log traced the ${f?.sab} to ${room}, and ${X} was standing in there.`,
        heard: `I'm with ${f?.by ? this.name(f.by) : 'the others'} on this. ${X} feels off to me too.`,
      };
      const type = f ? f.type : 'hunch';
      this.accuse(a, top.id, type, f ? lines[type] : `I can't prove it yet, but ${X} keeps turning up where things break.`,
        type === 'nearBody' ? { room: f.room, t: f.t } : null);
      return true;
    }
    if (second) return false;
    const good = a.mem.facts.findLast(f => f.type === 'sawTask' && g.agent(f.who).alive);
    if (good && rng.chance(0.55)) {
      this.say(a, `${this.name(good.who)} is fine by me. I watched them close a ticket in ${g.place(good.room)}.`, { kind: 'vouch', target: good.who });
      for (const l of this.ais('staff')) if (l !== a) addSus(l, good.who, -7 * l.brain.per.sway);
      return true;
    }
    const tail = { passive: " I'll skip unless someone has proof.", logical: ' I want evidence before I vote.', suspicious: ' Somebody here is lying though.' }[a.def.personality] || ' Saw nothing odd.';
    this.say(a, this.whereLine(a) + tail, { kind: 'alibi' });
    return true;
  }

  speakMole(a, second) {
    const g = this.g, rng = g.rng, body = this.ctx.body;
    const manip = a.def.personality === 'manipulative';
    const staff = g.living('staff').filter(o => o.id !== this.ctx.by || rng.chance(0.3));
    if (staff.length && rng.chance(manip ? 0.9 : 0.6) && !(second && rng.chance(0.5))) {
      const heat = o => this.ais('staff').reduce((s, l) => s + (l.brain.sus[o.id] || 0), 0);
      const hot = staff.reduce((m, o) => (heat(o) > heat(m) ? o : m), staff[0]);
      const t = heat(hot) > 20 && rng.chance(0.7) ? hot : rng.pick(staff);
      if (body) this.accuse(a, t.id, 'nearBody', `I passed ${t.def.name} near ${g.place(body.room)} just before this. Just saying.`, { room: body.room, t: body.t });
      else this.accuse(a, t.id, 'fakeTask', `${t.def.name} keeps hovering at stations without the counter moving.`);
      return true;
    }
    if (second) return false;
    this.say(a, `${this.whereLine(a)} Didn't see anything.`, { kind: 'alibi' });
    return true;
  }

  // ---- the human at the table --------------------------------------------
  playerAction(a, kind, targetId, own) {
    const x = this.g.agent(targetId);
    if (!a.alive || !x || !x.alive || x === a || this.phase === 'results') return false;
    const X = x.def.name;
    if (kind === 'accuse') {
      this.accuse(a, x.id, 'nearBody', own || `I think it's ${X}.`);
      const friend = this.ais('staff').find(c => c !== x && (c.brain.sus[x.id] || 0) <= -12);
      if (friend) this.at(2.4, () => { this.say(friend, `I watched ${X} do real work. I don't buy it.`, { kind: 'vouch', target: x.id }); addSus(friend, a.id, 5); });
    } else if (kind === 'ask') {
      this.say(a, own || `${X}, where were you?`, { kind: 'ask', target: x.id });
      if (x.brain) this.at(this.g.rng.range(1, 2.2), () => this.say(x, this.whereLine(x), { kind: 'alibi' }));
    } else if (kind === 'vouch') {
      this.say(a, own || `${X} is clear. I saw them working.`, { kind: 'vouch', target: x.id });
      this.broadcast(a, x.id, 'fakeTask', -0.6);
    } else return false;
    return true;
  }

  playerSay(a, text) {
    text = String(text || '').trim().slice(0, 160);
    if (!text || !a.alive) return false;
    const low = text.toLowerCase();
    const named = this.g.living().find(o => o !== a && low.includes(o.def.name.toLowerCase()));
    if (!named) { this.say(a, text); return true; }
    const kind = /\b(sus|mole|vote|lying|liar|kill|killed|saw|fake|faking|it'?s|is it|guilty)\b/.test(low) ? 'accuse'
      : /\b(clear|safe|innocent|trust|vouch|with me|not)\b/.test(low) ? 'vouch'
      : /where|what were|\?/.test(low) ? 'ask' : null;
    if (kind === 'accuse' && /\b(clear|safe|innocent|not the|isn'?t)\b/.test(low)) return this.playerSayAs(a, text, 'vouch', named);
    return this.playerSayAs(a, text, kind, named);
  }

  // free text keeps the player's own words but triggers the same effects as the buttons
  playerSayAs(a, text, kind, x) {
    if (!kind) { this.say(a, text); return true; }
    return this.playerAction(a, kind, x.id, text);
  }

  // ---- voting -------------------------------------------------------------
  openVoting() {
    this.phase = 'voting';
    this.left = this.S.voting;
    this.queue = [];
    for (const a of this.ais()) this.at(this.g.rng.range(1.5, this.S.voting - 6), () => this.castVote(a, this.decide(a)));
    this.g.bus.emit('meeting:phase', this);
  }

  decide(a) {
    const g = this.g, rng = g.rng, b = a.brain;
    const others = g.living().filter(o => o !== a);
    if (a.role === 'staff') {
      const top = others.reduce((m, o) => ((b.sus[o.id] || 0) > (b.sus[m.id] || 0) ? o : m), others[0]);
      return top && (b.sus[top.id] || 0) >= b.per.voteAt ? top.id : null;
    }
    const jury = this.ais('staff');
    const heat = o => (jury.length ? jury.reduce((s, l) => s + (l.brain.sus[o.id] || 0), 0) / jury.length : 0);
    const partner = others.find(o => o.role === 'mole');
    if (partner && heat(partner) >= 50 && rng.chance(0.5)) return partner.id;
    const staff = others.filter(o => o.role === 'staff');
    if (!staff.length) return null;
    const top = staff.reduce((m, o) => (heat(o) > heat(m) ? o : m), staff[0]);
    if (heat(top) >= 12) return top.id;
    const mine = this.accusations.findLast(x => x.by === a.id && g.agent(x.target).alive);
    if (mine) return mine.target;
    return a.def.personality === 'manipulative' && rng.chance(0.5) ? rng.pick(staff).id : null;
  }

  castVote(a, target) {
    if (this.phase !== 'voting' || !a.alive || a.id in this.votes) return false;
    if (target && (!this.g.agent(target)?.alive || target === a.id)) return false;
    this.votes[a.id] = target || null;
    this.g.bus.emit('meeting:vote', { who: a.id });
    return true;
  }

  tally() {
    const counts = {};
    let skips = 0;
    for (const a of this.voters) {
      const v = this.votes[a.id];
      if (v) counts[v] = (counts[v] || 0) + 1; else skips++;
    }
    const ranked = Object.entries(counts).sort((x, y) => y[1] - x[1]);
    const tie = ranked.length > 1 && ranked[0][1] === ranked[1][1];
    const ejected = ranked.length && !tie && ranked[0][1] > skips ? ranked[0][0] : null;
    this.result = { counts, skips, votes: { ...this.votes }, ejected, tie: tie || (ranked.length && ranked[0][1] === skips),
      role: ejected && this.g.S.confirmEjects ? this.g.agent(ejected).role : null };
    this.phase = 'results';
    this.left = this.S.results;
    this.queue = [];
    this.g.bus.emit('meeting:phase', this);
  }

  finish() {
    const g = this.g, r = this.result;
    if (r.ejected) {
      const out = g.agent(r.ejected);
      const voters = Object.keys(r.votes).filter(id => r.votes[id] === out.id);
      for (const l of this.ais('staff')) {
        if (out.role === 'staff') {
          voters.forEach(v => addSus(l, v, 4));
          this.accusations.filter(x => x.target === out.id).forEach(x => addSus(l, x.by, 7));
        } else voters.forEach(v => addSus(l, v, -12));
      }
      g.eject(out);
    }
    // old hunches fade; hard evidence does not
    for (const l of this.ais('staff')) for (const id in l.brain.sus) if (l.brain.sus[id] < 100) l.brain.sus[id] *= 0.85;
    g.endMeeting();
  }
}
