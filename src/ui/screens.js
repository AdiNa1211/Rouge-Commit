// Full-screen moments: main menu, role reveal, pause, match result.
import { h } from './dom.js';
import { CHARACTERS, ROLES, SETTINGS } from '../data/config.js';
import { fmtTime } from '../core/util.js';

const CONTROLS = [['W A S D', 'Move'], ['Shift', 'Run'], ['Drag', 'Turn camera'], ['Scroll', 'Zoom'], ['E', 'Use'], ['R', 'Report'],
  ['C', 'Page stand-up'], ['N', 'Notebook'], ['M', 'Map'], ['T', 'Talk nearby'], ['Esc', 'Pause']];
const controls = () => h('ul', { class: 'keys' }, CONTROLS.map(([k, v]) => h('li', {}, h('kbd', {}, k), v)));

export function showMenu(app) {
  const pick = app.pick;
  let code;
  const cards = CHARACTERS.map(c => h('button', { class: 'pick', 'data-id': c.id, onclick: () => { pick.char = c.id; sync(); app.sfx('click'); } },
    h('i', { class: 'avatar', style: { background: c.color } }, c.name[0]), h('div', {}, h('b', {}, c.full), h('span', {}, c.job))));
  const roles = [['random', 'Surprise me'], ['staff', 'Staff'], ['mole', 'Mole']].map(([id, label]) =>
    h('button', { class: 'seg', 'data-id': id, onclick: () => { pick.role = id; sync(); app.sfx('click'); } }, label));
  const sync = () => {
    cards.forEach(b => b.classList.toggle('sel', b.dataset.id === pick.char));
    roles.forEach(b => b.classList.toggle('sel', b.dataset.id === pick.role));
  };
  const root = h('div', { class: 'overlay menu' }, h('div', { class: 'menu-wrap' },
    h('section', { class: 'menu-intro' },
      h('p', { class: 'eyebrow' }, 'Halcyon Labs HQ · release day'),
      h('h1', {}, 'Rogue', h('br'), 'Commit'),
      h('p', { class: 'lede' }, 'Ten colleagues. Two of them are moles. One production database.'),
      h('ul', { class: 'rules' },
        h('li', {}, h('b', {}, 'Staff'), ` close ${SETTINGS.tasksPerStaff} tickets each and vote both moles out of the building.`),
        h('li', {}, h('b', {}, 'Moles'), ' fake the work, break production, leak the data and catch people alone.'),
        h('li', {}, h('b', {}, 'Everyone'), ' watches who is really working. Cameras, door logs and eyewitnesses all lie a little.')),
      controls()),
    h('section', { class: 'menu-pick panel' },
      h('h2', {}, 'Who are you today?'),
      h('div', { class: 'pick-grid' }, cards),
      h('div', { class: 'role-row' }, h('span', {}, 'Your role'), h('div', { class: 'segs' }, roles)),
      h('button', { class: 'btn primary big', onclick: () => app.start() }, 'Clock in'),
      window.MP
        ? h('div', { class: 'online' }, h('h3', {}, 'Play with friends'),
          h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => app.online.create() }, 'Create a room'),
            (code = h('input', { id: 'room-code', placeholder: '4-letter code', maxlength: '4', 'aria-label': 'Room code' })),
            h('button', { class: 'btn', onclick: () => app.online.join(code.value) }, 'Join')))
        : h('p', { class: 'muted' }, 'Playing with friends needs the game server: run "npm run server" in the project folder and open the address it prints.'))));
  sync();
  document.getElementById('ui').append(root);
  return root;
}

export function showReveal(app, done) {
  const g = app.game, me = g.human, mole = me.role === 'mole';
  const partner = g.agents.find(a => a.role === 'mole' && a !== me);
  let closed = false;
  const close = () => { if (closed) return; closed = true; root.remove(); done(); };
  const root = h('div', { class: `overlay reveal ${me.role}`, onclick: close },
    h('p', { class: 'eyebrow' }, `${me.def.full} · ${me.def.job}`),
    h('h1', {}, mole ? 'You are a mole' : 'You are staff'),
    h('p', { class: 'lede' }, mole ? `${partner.def.full} is the other mole. Nobody else knows.` : `${SETTINGS.moleCount} of your ${g.agents.length - 1} colleagues are moles. ${ROLES.staff.blurb}`),
    h('p', { class: 'muted' }, 'Click to start'));
  document.getElementById('ui').append(root);
  setTimeout(close, 5200);
}

export function showPause(app) {
  app.openModal('pause', h('div', { class: 'overlay' }, h('div', { class: 'panel' },
    h('header', {}, h('h2', {}, 'Paused')),
    controls(),
    h('div', { class: 'row' },
      h('button', { class: 'btn primary', onclick: () => app.closeModal() }, 'Back to work'),
      h('button', { class: 'btn', onclick: () => { app.toggleMute(); app.closeModal(); } }, app.muted() ? 'Turn sound on' : 'Turn sound off'),
      h('button', { class: 'btn ghost', onclick: () => { app.closeModal(); app.toMenu(); } }, 'Quit to menu')))), null, true);
}

export function showEnd(app) {
  const g = app.game, me = g.human, r = g.result;
  const won = r.side === me.role;
  const root = h('div', { class: `overlay end ${won ? 'won' : 'lost'}` }, h('div', { class: 'panel wide' },
    h('p', { class: 'eyebrow' }, r.side === 'staff' ? 'Staff win' : 'Moles win'),
    h('h1', {}, won ? 'Victory' : 'Defeat'),
    h('p', { class: 'lede' }, r.text),
    h('p', { class: 'muted' }, `${fmtTime(g.time)} on the clock · ${g.taskDone} of ${g.taskTotal} tickets shipped · ${Math.floor(g.exfil)}% of the data leaked`),
    h('div', { class: 'cast' }, g.agents.map(a => h('div', { class: `cast-card ${a.role}${a.alive ? '' : ' gone'}` },
      h('i', { class: 'avatar', style: { background: a.def.color } }, a.def.name[0]),
      h('div', {}, h('b', {}, a.def.name + (a === me ? ' (you)' : '')), h('span', {}, a.role === 'mole' ? 'Mole' : a.def.job)),
      h('em', {}, a.alive ? 'Still standing' : a.ejected ? 'Walked out' : 'Crashed')))),
    h('div', { class: 'row' },
      app.remote
        ? h('button', { class: 'btn primary big', onclick: () => { root.remove(); app.online.backToLobby(); } }, 'Back to the room')
        : h('button', { class: 'btn primary big', onclick: () => { root.remove(); app.start(); } }, 'Play again'),
      h('button', { class: 'btn', onclick: () => { root.remove(); app.toMenu(); } }, app.remote ? 'Leave' : 'Main menu'))));
  document.getElementById('ui').append(root);
  return root;
}

// LAN wording only when served from this machine or a private address; a public host gets a plain link
function lobbyLink(st) {
  const host = location.hostname;
  const loopback = /^(localhost|127\.)/.test(host);
  const lan = loopback || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
  if (!lan) return h('li', {}, 'Share this link: ', h('b', {}, location.origin), ' and the code above.');
  return h('li', {}, 'Friends on the same Wi-Fi open ', h('b', {}, loopback && st.lan ? st.lan : location.host), ' in their browser and join with the code above.');
}

// waiting room for an online match; unclaimed characters are played by the AI
export function showLobby(app, st) {
  const who = Object.fromEntries(st.players.map(p => [p.char, p]));
  const cards = CHARACTERS.map(c => {
    const p = who[c.id], mine = c.id === st.you;
    return h('button', { class: `pick${mine ? ' you' : p ? ' taken' : ''}`, disabled: !!p, onclick: () => { app.pick.char = c.id; app.net.send({ t: 'pick', char: c.id }); } },
      h('i', { class: 'avatar', style: { background: c.color } }, c.name[0]), h('div', {}, h('b', {}, c.full), h('span', {}, c.job)),
      h('em', {}, mine ? 'You' : p ? (p.host ? 'Host' : 'Player') : 'AI'));
  });
  const root = h('div', { class: 'overlay menu' }, h('div', { class: 'menu-wrap' },
    h('section', { class: 'menu-intro' },
      h('p', { class: 'eyebrow' }, 'Online room'),
      h('div', { class: 'code' }, st.code),
      h('p', { class: 'lede' }, `${st.players.length} of 10 seats are human. The AI plays the rest.`),
      h('ul', { class: 'rules' },
        lobbyLink(st),
        h('li', {}, 'Roles are dealt at random when the host starts. Two of the ten are moles.'),
        h('li', {}, 'Anyone who disconnects mid-match is taken over by the AI.'))),
    h('section', { class: 'menu-pick panel' },
      h('h2', {}, 'Pick your seat'),
      h('div', { class: 'pick-grid' }, cards),
      st.running ? h('p', { class: 'muted' }, 'A match is still finishing in this room.') : null,
      h('div', { class: 'row' },
        st.host ? h('button', { class: 'btn primary big', disabled: st.running, onclick: () => app.net.send({ t: 'start' }) }, 'Start match')
          : h('p', { class: 'muted' }, 'Waiting for the host to start.'),
        h('button', { class: 'btn ghost', onclick: () => app.toMenu() }, 'Leave room')))));
  document.getElementById('ui').append(root);
  return root;
}
