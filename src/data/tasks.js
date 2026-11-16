// Task catalogue. Each entry names the stations it can appear at, the minigame
// that plays it, and a generator for that round's content. Add a task = add an entry.

const CODE = [
  { lines: ['function total(cart) {', '  let sum = 0;', '  for (const item of cart) {', '    sum =+ item.price;', '  }', '  return sum;', '}'], bad: 3 },
  { lines: ['async function load(id) {', '  const res = await fetch(`/api/users/${id}`);', '  if (res.ok = false) throw new Error("fail");', '  return res.json();', '}'], bad: 2 },
  { lines: ['const users = await db.query(sql);', 'for (let i = 0; i <= users.length; i++) {', '  notify(users[i].email);', '}'], bad: 1 },
  { lines: ['def retry(fn, times=3):', '    for attempt in range(times):', '        try:', '            return fn()', '        except Exception:', '            times += 1'], bad: 5 },
  { lines: ['if (user.role === "admin") {', '  grantAccess(user);', '} else if (user.role = "guest") {', '  denyAccess(user);', '}'], bad: 2 },
  { lines: ['const cache = new Map();', 'function get(key) {', '  if (cache.has(key)) return cache.get(key);', '  const v = compute(key);', '  cache.set(v, key);', '  return v;', '}'], bad: 4 },
  { lines: ['fun average(xs: List<Int>): Int {', '  var sum = 0', '  for (x in xs) sum += x', '  return sum / 0', '}'], bad: 3 },
];
const API = [
  ['Login screen', 'POST /auth/session'], ['Profile page', 'GET /users/me'], ['Cart badge', 'GET /cart/count'],
  ['Checkout button', 'POST /orders'], ['Search bar', 'GET /search?q='], ['Avatar upload', 'PUT /users/me/avatar'],
];
const VISITORS = [
  ['Courier with a parcel', 'Front desk'], ['Candidate, 2 pm interview', 'Engineering Manager'],
  ['External auditor', 'Security Office'], ['Espresso technician', 'Break Room'], ['Investor', 'CEO Office'],
];
const SQL = [
  ['SELECT name, email ___ users WHERE active = 1;', ['FROM', 'INTO', 'JOIN', 'SET']],
  ['SELECT team, COUNT(*) FROM tickets ___ team;', ['GROUP BY', 'ORDER IN', 'HAVING', 'WHERE']],
  ["UPDATE accounts ___ plan = 'pro' WHERE id = 42;", ['SET', 'PUT', 'INTO', 'VALUES']],
  ['SELECT * FROM orders o ___ users u ON u.id = o.user_id;', ['JOIN', 'WITH', 'UNION', 'FROM']],
  ['DELETE FROM sessions ___ expires_at < NOW();', ['WHERE', 'WHEN', 'IF', 'HAVING']],
  ['SELECT * FROM logs ORDER BY created_at ___ LIMIT 10;', ['DESC', 'DOWN', 'LAST', 'REVERSE']],
];
const BACKLOGS = [
  ['P0 · Checkout is down', 'P1 · Password reset email never arrives', 'P2 · Dark mode toggle misaligned', 'P3 · Rename "Colour" to "Color"'],
  ['P0 · Payments double-charge', 'P1 · Push notifications delayed an hour', 'P2 · Avatar looks blurry', 'P3 · Add confetti on signup'],
  ['P0 · Login loops forever', 'P1 · Export drops the last row', 'P2 · Tooltip typo', 'P3 · New loading spinner'],
];
const ACCESS = [
  ['Intern → production root', 1], ['On-call engineer → pager rota', 0], ['Contractor → customer payment data', 1],
  ['QA engineer → staging database', 0], ['Designer → design system repo', 0], ['Unknown device → VPN admin', 1],
  ['Backend dev → read replica', 0], ['Former employee → source code', 1],
];
const BAD_FILES = ['invoice.pdf.exe', 'holiday_photos.scr', 'payroll.xlsm.js', 'update_flash.bat', 'resume.docx.vbs'];
const GOOD_FILES = ['roadmap_q3.pdf', 'standup_notes.md', 'logo_final_v7.png', 'api_spec.yaml', 'budget.xlsx', 'README.txt', 'team_photo.jpg', 'release_notes.docx'];
const ROUTES = ['GET /cart', 'POST /login', 'GET /feed', 'PUT /profile', 'GET /health', 'POST /orders', 'DELETE /session'];
const pad = n => String(n).padStart(2, '0');

export const TASKS = [
  { id: 'fixBuild', name: 'Fix the failing build', stations: ['be1', 'be2', 'fe1', 'fe3'], minigame: 'findLine',
    gen: r => ({ title: 'Fix the failing build', hint: 'Click the line with the bug.', ...r.pick(CODE) }) },
  { id: 'wireApi', name: 'Wire screens to endpoints', stations: ['fe2', 'fe4'], minigame: 'match',
    gen: r => ({ title: 'Wire screens to endpoints', hint: 'Pick a screen, then the endpoint it calls.', pairs: r.shuffle(API).slice(0, 4).map(([a, b]) => ({ a, b })) }) },
  { id: 'fixQuery', name: 'Repair a broken query', stations: ['be3', 'be4', 'db1'], minigame: 'choice',
    gen: r => ({ title: 'Repair a broken query', rounds: r.shuffle(SQL).slice(0, 3).map(([prompt, o]) => ({ prompt, code: true, options: r.shuffle(o), answer: o[0] })) }) },
  { id: 'pipeline', name: 'Order the deploy pipeline', stations: ['ci1', 'ci2'], minigame: 'sequence',
    gen: () => ({ title: 'Order the deploy pipeline', hint: 'Click the stages in the order they run.', items: ['Checkout', 'Lint', 'Unit tests', 'Build image', 'Deploy to staging'] }) },
  { id: 'restart', name: 'Restart stalled app servers', stations: ['srv2', 'core'], minigame: 'reboot',
    gen: r => ({ title: 'Restart stalled app servers', hint: 'Click every red node and wait for green.', nodes: Array.from({ length: 5 }, (_, i) => `app-${pad(r.int(1, 40))}`) }) },
  { id: 'verifyTests', name: 'Verify test results', stations: ['qa1', 'qa2', 'qa3'], minigame: 'classify',
    gen: r => ({ title: 'Verify test results', hint: 'Pass when the response matches the expectation.', labels: ['Pass', 'Fail'],
      rows: r.shuffle(ROUTES).slice(0, 5).map(route => {
        const exp = r.pick([200, 200, 201, 204]); const ok = r.chance(0.5);
        return { text: `${route}  expected ${exp} · got ${ok ? exp : r.pick([500, 404, 403, 502])}`, answer: ok ? 0 : 1 };
      }) }) },
  { id: 'rotateKey', name: 'Rotate the API key', stations: ['sec1'], minigame: 'keypad',
    gen: r => ({ title: 'Rotate the API key', hint: 'Memorise the new key, then enter it.', code: Array.from({ length: 6 }, () => r.int(0, 9)).join('') }) },
  { id: 'scanFiles', name: 'Quarantine suspicious files', stations: ['it1'], minigame: 'multi',
    gen: r => ({ title: 'Quarantine suspicious files', hint: 'Flag every file hiding an executable extension.',
      items: r.shuffle([...r.shuffle(BAD_FILES).slice(0, 3).map(text => ({ text, bad: true })), ...r.shuffle(GOOD_FILES).slice(0, 6).map(text => ({ text, bad: false }))]) }) },
  { id: 'backlog', name: 'Prioritise the sprint backlog', stations: ['pm1', 'pm2'], minigame: 'sequence',
    gen: r => ({ title: 'Prioritise the sprint backlog', hint: 'Most urgent first.', items: r.pick(BACKLOGS) }) },
  { id: 'access', name: 'Review access requests', stations: ['ceo1'], minigame: 'classify',
    gen: r => ({ title: 'Review access requests', hint: 'Least privilege: deny anything that person should not need.', labels: ['Approve', 'Deny'],
      rows: r.shuffle(ACCESS).slice(0, 5).map(([text, answer]) => ({ text, answer })) }) },
  { id: 'retro', name: 'Find a slot for the retro', stations: ['conf1'], minigame: 'gridPick',
    gen: r => {
      const slots = ['10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];
      const people = r.shuffle(['Maya', 'Dmitri', 'Priya', 'Leo', 'Sofia', 'Noah', 'Amara', 'Omar']).slice(0, 4);
      const answer = r.int(0, slots.length - 1);
      const busy = people.map(() => slots.map((_, c) => c !== answer && r.chance(0.45)));
      slots.forEach((_, c) => { if (c !== answer && busy.every(row => !row[c])) busy[r.int(0, 3)][c] = true; });
      return { title: 'Find a slot for the retro', hint: 'Pick the one hour when everybody is free.', slots, people, busy, answer };
    } },
  { id: 'tapes', name: 'Shelve backup drives by date', stations: ['stor1'], minigame: 'sequence',
    gen: r => {
      const set = new Set();
      while (set.size < 5) set.add(`2026-${pad(r.int(1, 11))}-${pad(r.int(1, 28))}`);
      return { title: 'Shelve backup drives by date', hint: 'Oldest first.', items: [...set].sort().map(d => `Backup ${d}`) };
    } },
  { id: 'espresso', name: 'Calibrate the espresso machine', stations: ['coffee'], minigame: 'timing',
    gen: () => ({ title: 'Calibrate the espresso machine', hint: 'Stop the needle inside the band. Three shots.', rounds: 3 }) },
  { id: 'fridge', name: 'Patch the smart fridge', stations: ['fridge'], minigame: 'reboot',
    gen: () => ({ title: 'Patch the smart fridge', hint: 'Restart each module after the firmware update.', nodes: ['compressor-ctl', 'door-sensor', 'ice-os'] }) },
  { id: 'badges', name: 'Match visitors to hosts', stations: ['recep'], minigame: 'match',
    gen: r => ({ title: 'Match visitors to hosts', hint: 'Pick a visitor, then where they should go.', pairs: r.shuffle(VISITORS).slice(0, 4).map(([a, b]) => ({ a, b })) }) },
];

// repair minigames for each sabotage
export const FIXES = {
  outage: r => ({ title: 'Reboot the core cluster', hint: 'Bring services up in dependency order.', urgent: true,
    items: ['1 · Power bus', '2 · Storage array', '3 · Database', '4 · API gateway', '5 · Load balancer'] }),
  breach: r => {
    const h = r.int(10, 16), m = r.int(20, 45);
    const t = (dh, dm) => `${pad(h + dh)}:${pad(m + dm)}`;
    const good = `${t(0, -12)} snapshot · checksum OK`;
    return { title: 'Restore a clean backup', urgent: true, rounds: [{
      prompt: `Breach began at ${t(0, 0)}. Restore the newest snapshot taken before it with a valid checksum.`,
      options: r.shuffle([good, `${t(0, 6)} snapshot · checksum OK`, `${t(0, -4)} snapshot · checksum FAILED`, `${t(-3, 0)} snapshot · checksum OK`]), answer: good }] };
  },
  network: r => {
    const cols = r.shuffle([['Amber', '#f2a33a'], ['Teal', '#22b8a6'], ['Violet', '#9a6bf0'], ['Coral', '#ff6b5e']]);
    return { title: 'Re-patch the core switch', hint: 'Plug each cable into the port of the same colour.', urgent: true,
      pairs: cols.map(([n, c], i) => ({ a: `${n} cable`, b: `Port ${i + 1}`, color: c })) };
  },
};

export const taskById = id => TASKS.find(t => t.id === id);
