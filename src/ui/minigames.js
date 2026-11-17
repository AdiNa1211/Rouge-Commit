// Reusable minigame framework. A minigame is (body, params, win, miss) => optional cleanup.
// Tasks and sabotage repairs pick one by name and feed it generated content.
import { h, clear } from './dom.js';

const shuffle = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(x => x[1]);
// `backticks` in explanations render as inline code
const rich = text => h('p', {}, text.split('`').map((part, i) => (i % 2 ? h('code', {}, part) : part)));
const learnCard = (label, text) => h('div', { class: 'mg-learn' }, h('b', {}, label), rich(text));

const GAMES = {
  findLine(body, p, win, miss) {
    body.append(h('div', { class: 'mg-code' }, p.lines.map((line, i) =>
      h('button', { class: 'mg-line', onclick: e => (i === p.bad ? (e.currentTarget.classList.add('ok'), win()) : miss(e.currentTarget)) },
        h('span', { class: 'ln' }, String(i + 1)), h('span', {}, line)))));
  },

  match(body, p, win, miss) {
    let pick = null, left = 0;
    const dot = c => (c ? h('i', { class: 'dot', style: { background: c } }) : null);
    const L = p.pairs.map((pr, i) => h('button', { class: 'mg-chip', onclick: e => {
      if (e.currentTarget.disabled) return;
      L.forEach(b => b.classList.remove('sel'));
      e.currentTarget.classList.add('sel'); pick = i;
    } }, dot(pr.color), pr.a));
    const R = shuffle(p.pairs.map((pr, i) => h('button', { class: 'mg-chip', onclick: e => {
      if (pick == null) return miss(e.currentTarget);
      if (pick !== i) return miss(e.currentTarget);
      for (const b of [L[i], e.currentTarget]) { b.classList.remove('sel'); b.classList.add('ok'); b.disabled = true; }
      pick = null;
      if (++left === p.pairs.length) win();
    } }, dot(pr.color), pr.b)));
    body.append(h('div', { class: 'mg-cols' }, h('div', { class: 'mg-col' }, L), h('div', { class: 'mg-col' }, R)));
  },

  sequence(body, p, win, miss) {
    let next = 0;
    const done = h('ol', { class: 'mg-done' });
    const pool = h('div', { class: 'mg-pool' }, shuffle(p.items.map((text, i) => h('button', { class: 'mg-chip', onclick: e => {
      if (i !== next) return miss(e.currentTarget);
      e.currentTarget.remove();
      done.append(h('li', {}, text));
      if (++next === p.items.length) win();
    } }, text))));
    body.append(done, pool);
  },

  classify(body, p, win, miss) {
    let left = p.rows.length;
    body.append(h('div', { class: 'mg-rows' }, p.rows.map(row => {
      const el = h('div', { class: 'mg-row' }, h('span', { class: 'mono' }, row.text),
        h('span', { class: 'mg-pair' }, p.labels.map((label, i) => h('button', { class: `mg-chip small ${i ? 'no' : 'yes'}`, onclick: () => {
          if (el.classList.contains('ok')) return;
          if (i !== row.answer) return miss(el);
          el.classList.add('ok');
          el.querySelectorAll('button')[1 - i].style.visibility = 'hidden';
          if (--left === 0) win();
        } }, label))));
      return el;
    })));
  },

  multi(body, p, win, miss) {
    const tiles = p.items.map(it => h('button', { class: 'mg-file mono', onclick: e => e.currentTarget.classList.toggle('sel') }, it.text));
    const grid = h('div', { class: 'mg-grid' }, tiles);
    body.append(grid, h('button', { class: 'btn primary', onclick: () => {
      const ok = p.items.every((it, i) => it.bad === tiles[i].classList.contains('sel'));
      ok ? win() : miss(grid);
    } }, 'Quarantine flagged files'));
  },

  timing(body, p, win, miss) {
    let round = 0, x = 0, dir = 1, raf, last = performance.now(), zone;
    const needle = h('div', { class: 'mg-needle' }), band = h('div', { class: 'mg-band' });
    const pips = h('div', { class: 'mg-pips' }, Array.from({ length: p.rounds }, () => h('i')));
    const place = () => { const w = 0.26 - round * 0.06; const s = 0.1 + Math.random() * (0.8 - w); zone = [s, s + w]; band.style.left = `${s * 100}%`; band.style.width = `${w * 100}%`; };
    const stop = () => {
      if (x >= zone[0] && x <= zone[1]) {
        pips.children[round].classList.add('on');
        if (++round === p.rounds) return win();
        place();
      } else miss(body.querySelector('.mg-track'));
    };
    const key = e => { if (e.code === 'Space') { e.preventDefault(); stop(); } };
    const loop = now => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      x += dir * dt * (0.75 + round * 0.3);
      if (x > 1) { x = 1; dir = -1; } else if (x < 0) { x = 0; dir = 1; }
      needle.style.left = `${x * 100}%`;
      raf = requestAnimationFrame(loop);
    };
    place();
    body.append(h('div', { class: 'mg-track' }, band, needle), pips, h('button', { class: 'btn primary', onclick: stop }, 'Pull shot (Space)'));
    window.addEventListener('keydown', key);
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', key); };
  },

  keypad(body, p, win, miss) {
    let entry = '', timer;
    const screen = h('div', { class: 'mg-screen mono' });
    const show = () => {
      screen.textContent = p.code.split('').join(' ');
      screen.classList.add('reveal');
      clearTimeout(timer);
      timer = setTimeout(() => { screen.classList.remove('reveal'); draw(); }, 2600);
    };
    const draw = () => { if (!screen.classList.contains('reveal')) screen.textContent = entry.padEnd(p.code.length, '·').split('').join(' '); };
    const press = d => {
      if (screen.classList.contains('reveal')) { clearTimeout(timer); screen.classList.remove('reveal'); }
      entry += d; draw();
      if (entry.length < p.code.length) return;
      if (entry === p.code) return win();
      entry = ''; miss(screen); draw();
    };
    const pad = h('div', { class: 'mg-pad' }, '1234567890'.split('').map(d => h('button', { class: 'mg-key', onclick: () => press(d) }, d)));
    body.append(screen, pad, h('button', { class: 'btn', onclick: () => { entry = ''; show(); } }, 'Show the key again'));
    show();
    return () => clearTimeout(timer);
  },

  choice(body, p, win, miss) {
    let r = 0;
    const draw = () => {
      const round = p.rounds[r];
      const prompt = round.code
        ? h('div', { class: 'mg-prompt mono', html: round.prompt.replace(/[<&]/g, c => (c === '<' ? '&lt;' : '&amp;')).replace('___', '<b class="blank">?</b>') })
        : h('div', { class: 'mg-prompt' }, round.prompt);
      const next = () => (++r === p.rounds.length ? win() : draw());
      const pool = h('div', { class: 'mg-pool' }, round.options.map(o => h('button', { class: `mg-chip${round.code ? ' mono' : ''}`, onclick: e => {
        if (o !== round.answer) return miss(e.currentTarget);
        if (!round.explain) return next();
        e.currentTarget.classList.add('ok');
        pool.querySelectorAll('button').forEach(b => { b.disabled = true; });
        const last = r === p.rounds.length - 1;
        const go = h('button', { class: 'btn primary', onclick: next }, last ? 'Ship it' : 'Next question');
        body.append(learnCard('Correct', round.explain), go);
        go.focus();
      } }, o)));
      clear(body).append(p.rounds.length > 1 ? h('div', { class: 'mg-step' }, `${round.explain ? 'Question' : 'Query'} ${r + 1} of ${p.rounds.length}`) : null, prompt, pool);
    };
    draw();
  },

  gridPick(body, p, win, miss) {
    const head = h('tr', {}, h('th'), p.slots.map((s, c) => h('th', {}, h('button', { class: 'mg-chip small', onclick: e => (c === p.answer ? win() : miss(e.currentTarget)) }, s))));
    const rows = p.people.map((name, r) => h('tr', {}, h('th', {}, name), p.slots.map((_, c) => h('td', { class: p.busy[r][c] ? 'busy' : 'free' }, p.busy[r][c] ? 'busy' : ''))));
    body.append(h('table', { class: 'mg-table' }, head, rows));
  },

  reboot(body, p, win) {
    let left = p.nodes.length;
    const timers = [];
    body.append(h('div', { class: 'mg-grid nodes' }, p.nodes.map(name => h('button', { class: 'mg-node mono', onclick: e => {
      const el = e.currentTarget;
      if (el.classList.contains('boot') || el.classList.contains('ok')) return;
      el.classList.add('boot');
      timers.push(setTimeout(() => { el.classList.remove('boot'); el.classList.add('ok'); if (--left === 0) win(); }, 1100));
    } }, h('i'), name))));
    return () => timers.forEach(clearTimeout);
  },
};

let current = null;

export function closeMinigame(silent) {
  if (!current) return;
  const c = current;
  current = null;
  c.cleanup?.();
  c.root.remove();
  if (!silent) c.onCancel?.();
}
export const minigameOpen = () => !!current;

export function openMinigame(type, params, { onDone, onCancel, fake, sfx } = {}) {
  closeMinigame(true);
  const body = h('div', { class: 'mg-body' });
  const root = h('div', { class: 'overlay mg' },
    h('div', { class: `panel mg-panel${params.urgent ? ' urgent' : ''}` },
      h('header', {},
        h('div', {}, h('h2', {}, params.title), params.hint ? h('p', { class: 'hint' }, params.hint) : null),
        h('button', { class: 'btn ghost', onclick: () => closeMinigame() }, 'Close (Esc)')),
      fake ? h('p', { class: 'fake-tag' }, 'Cover work. It looks real to anyone watching, but the ticket counter will not move.') : null,
      body));
  let finished = false;
  const finish = () => { if (current?.root === root) { closeMinigame(true); onDone?.(); } };
  // tickets with a lesson show it before closing; Esc or the button both ship the ticket
  const teach = () => {
    if (current?.root !== root) return;
    current.cleanup?.(); current.cleanup = null; current.onCancel = onDone;
    const go = h('button', { class: 'btn primary', onclick: finish }, 'Ship it');
    clear(body).append(learnCard('Why it matters', params.learn), go);
    go.focus();
  };
  const win = () => {
    if (finished) return;
    finished = true;
    sfx?.('good');
    root.querySelector('.panel').classList.add('won');
    setTimeout(params.learn ? teach : finish, 550);
  };
  const miss = el => {
    sfx?.('bad');
    if (!el) return;
    el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
  };
  document.getElementById('ui').append(root);
  current = { root, onCancel, cleanup: GAMES[type](body, params, win, miss) };
}
