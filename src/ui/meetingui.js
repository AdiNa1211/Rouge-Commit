// Stand-up screen: who is here, the discussion, your evidence, and the vote.
import { h, clear } from './dom.js';
import { fmtTime } from '../core/util.js';
import { evidenceView, chip } from './hud.js';

export function createMeetingUI(app, m) {
  const g = app.game, me = g.human, ctx = m.ctx;
  const out = !me.alive;
  let selected = null;
  const offs = [];
  const by = g.agent(ctx.by);
  const title = ctx.body
    ? `${g.agent(ctx.body.victim).def.name} was found crashed in ${g.place(ctx.body.room)}`
    : `${by.def.name} paged an emergency stand-up`;

  const phaseEl = h('div', { class: 'm-phase' });
  const log = h('div', { class: 'm-log' });
  const verdict = h('div', { class: 'm-verdict', style: { display: 'none' } });
  const actions = h('div', { class: 'm-actions' });
  const input = h('input', { id: 'm-say', placeholder: out ? 'You are out and cannot speak' : 'Type to the room. Use a name to accuse, question or vouch.', maxlength: '160', disabled: out });
  input.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter' && input.value.trim()) { app.cmd({ type: 'say', text: input.value }); input.value = ''; }
  });

  const cards = {};
  const grid = h('div', { class: 'm-players' }, g.agents.map(a => {
    const gone = !a.alive;
    const ally = me.role === 'mole' && a.role === 'mole' && a !== me;
    const tag = [a === me && 'You', ally && 'Fellow mole', a.id === ctx.by && (ctx.body ? 'Reported' : 'Paged')].filter(Boolean).join(' · ');
    const card = h('button', { class: `m-card${gone ? ' gone' : ''}${a === me ? ' me' : ''}`, disabled: gone || a === me || out, onclick: () => select(a.id) },
      h('i', { class: 'avatar', style: { background: a.def.color } }, a.def.name[0]),
      h('div', {}, h('b', {}, a.def.name), h('span', {}, gone ? (a.ejected ? 'Walked out' : 'Crashed') : a.def.job)),
      tag ? h('em', { class: ally ? 'red' : '' }, tag) : null,
      h('div', { class: 'm-votes' }));
    cards[a.id] = card;
    return card;
  }));

  // phones show discussion and evidence as tabs in one column; the tab bar is hidden on desktop
  const tab = (label, ev) => h('button', { class: `m-tab${ev ? '' : ' on'}`, onclick: e => {
    mgrid.classList.toggle('ev', ev);
    tabs.querySelectorAll('.m-tab').forEach(t => t.classList.toggle('on', t === e.currentTarget));
  } }, label);
  const tabs = h('div', { class: 'm-tabs' }, tab('Discussion', false), tab('Evidence', true));
  const mgrid = h('div', { class: 'm-grid' },
    h('div', { class: 'm-col room' }, h('h3', {}, 'In the room'), verdict, grid),
    tabs,
    h('div', { class: 'm-col chat' }, h('h3', {}, 'Discussion'), log, actions, input),
    h('div', { class: 'm-col evid' }, h('h3', {}, 'Your evidence'), evidenceView(app)));
  const root = h('div', { class: 'overlay meeting' }, h('div', { class: 'm-wrap' },
    h('header', { class: 'm-head' }, h('div', {}, h('p', { class: 'eyebrow' }, ctx.body ? 'Incident report' : 'Emergency stand-up'), h('h2', {}, title)), phaseEl),
    mgrid));
  document.getElementById('ui').append(root);

  function addLine(line) {
    const a = line.who && g.agent(line.who);
    log.append(a
      ? h('div', { class: `m-line ${line.kind || ''}${a === me ? ' mine' : ''}` }, chip(a), h('p', {}, line.text))
      : h('div', { class: 'm-line sys' }, line.text));
    log.scrollTop = log.scrollHeight;
  }

  function select(id) {
    selected = selected === id ? null : id;
    for (const k in cards) cards[k].classList.toggle('sel', k === selected);
    drawActions();
    app.sfx('click');
  }

  function drawActions() {
    clear(actions);
    if (out) return actions.append(h('p', { class: 'muted' }, 'You are out of the match and watching.'));
    if (m.phase === 'results') return;
    const x = selected && g.agent(selected);
    if (m.phase === 'discussion') {
      if (!x) return actions.append(h('p', { class: 'muted' }, 'Select a colleague to accuse, question or vouch for them.'));
      const act = (label, kind, cls) => h('button', { class: `btn ${cls}`, onclick: () => app.cmd({ type: 'meetingAction', kind, target: x.id }) }, label);
      actions.append(act(`Accuse ${x.def.name}`, 'accuse', 'danger'), act('Where were you?', 'ask', ''), act(`Vouch for ${x.def.name}`, 'vouch', 'good'));
    } else if (me.id in m.votes) {
      actions.append(h('p', { class: 'muted' }, 'Vote locked in. Waiting for the others.'));
    } else {
      actions.append(
        h('button', { class: 'btn danger', disabled: !x, onclick: () => { app.cmd({ type: 'vote', target: x.id }); m.votes[me.id] ??= x.id; app.sfx('myvote'); drawActions(); } }, x ? `Vote out ${x.def.name}` : 'Select someone to vote out'),
        h('button', { class: 'btn', onclick: () => { app.cmd({ type: 'vote', target: null }); m.votes[me.id] ??= null; app.sfx('myvote'); drawActions(); } }, 'Skip vote'));
    }
  }

  function showResults() {
    const r = m.result;
    for (const id in cards) {
      const voters = Object.keys(r.votes).filter(v => r.votes[v] === id);
      clear(cards[id].querySelector('.m-votes')).append(...voters.map(v => h('i', { class: 'dot', title: g.agent(v).def.name, style: { background: g.agent(v).def.color } })));
      cards[id].classList.toggle('ejected', id === r.ejected);
      cards[id].classList.remove('voted');
    }
    const skippers = Object.keys(r.votes).filter(v => !r.votes[v]).length + g.living().filter(a => !(a.id in r.votes)).length;
    verdict.style.display = '';
    if (r.ejected) {
      const a = g.agent(r.ejected);
      clear(verdict).append(h('b', {}, `${a.def.name} was walked out of the building.`),
        h('span', { class: r.role === 'mole' ? 'good' : 'bad' }, r.role === 'mole' ? `${a.def.name} was a mole.` : `${a.def.name} was not a mole.`));
      app.sfx('eject');
    } else {
      clear(verdict).append(h('b', {}, r.tie ? 'Tied vote. Nobody leaves.' : 'The room skipped. Nobody leaves.'), h('span', {}, `${skippers} skipped or abstained`));
    }
    clear(actions);
  }

  m.chat.forEach(addLine);
  offs.push(g.bus.on('meeting:chat', addLine));
  offs.push(g.bus.on('meeting:vote', ({ who }) => { cards[who].classList.add('voted'); app.sfx('vote'); }));
  offs.push(g.bus.on('meeting:phase', () => {
    if (m.phase === 'voting') { addLine({ who: null, text: 'Voting is open. Pick someone or skip.' }); drawActions(); }
    else showResults();
  }));
  drawActions();

  return {
    update() {
      const name = { discussion: 'Discussion', voting: 'Voting', results: 'Result' }[m.phase];
      const text = `${name} · ${fmtTime(Math.ceil(m.left))}`;
      if (phaseEl._v !== text) { phaseEl._v = text; phaseEl.textContent = text; phaseEl.className = `m-phase ${m.phase}`; }
    },
    destroy() { offs.forEach(f => f()); root.remove(); },
  };
}
