// Task catalogue. Each entry names the stations it can appear at, the minigame
// that plays it, and a generator for that round's content. Add a task = add an entry.

const CODE = [
  { lines: ['function total(cart) {', '  let sum = 0;', '  for (const item of cart) {', '    sum =+ item.price;', '  }', '  return sum;', '}'], bad: 3,
    why: '`=+` assigns a positive number instead of adding. `+=` keeps a running total.' },
  { lines: ['async function load(id) {', '  const res = await fetch(`/api/users/${id}`);', '  if (res.ok = false) throw new Error("fail");', '  return res.json();', '}'], bad: 2,
    why: 'A single `=` assigns false, so the error is never thrown. Check `!res.ok` instead.' },
  { lines: ['const users = await db.query(sql);', 'for (let i = 0; i <= users.length; i++) {', '  notify(users[i].email);', '}'], bad: 1,
    why: 'Arrays start at 0, so the last index is length - 1. `<=` reads one item past the end.' },
  { lines: ['def retry(fn, times=3):', '    for attempt in range(times):', '        try:', '            return fn()', '        except Exception:', '            times += 1'], bad: 5,
    why: 'Raising `times` inside the loop never makes it retry; the range was already fixed. Let the loop finish and re-raise.' },
  { lines: ['if (user.role === "admin") {', '  grantAccess(user);', '} else if (user.role = "guest") {', '  denyAccess(user);', '}'], bad: 2,
    why: '`=` assigns "guest" to every user. Comparisons need `===`.' },
  { lines: ['const cache = new Map();', 'function get(key) {', '  if (cache.has(key)) return cache.get(key);', '  const v = compute(key);', '  cache.set(v, key);', '  return v;', '}'], bad: 4,
    why: 'The cache stores the value as the key. `set(key, v)` is the right order.' },
  { lines: ['fun average(xs: List<Int>): Int {', '  var sum = 0', '  for (x in xs) sum += x', '  return sum / 0', '}'], bad: 3,
    why: 'Dividing by zero crashes. Divide by `xs.size` (and guard the empty list).' },
  { lines: ['const name = user.profile.name;', 'const greeting = "Hi, " + name;', 'button.addEventListener("click", greet());', 'function greet() { alert(greeting); }'], bad: 2,
    why: '`greet()` runs the function right away and passes its result. Pass `greet` itself so it runs on click.' },
  { lines: ['SELECT * FROM users', "WHERE email = '\" + input + \"'"], bad: 1,
    why: 'Gluing user input into SQL allows SQL injection. Use a parameterised query instead.' },
  { lines: ['const items = ["a", "b", "c"];', 'items.forEach(item => {', '  console.log(item)', '};'], bad: 3,
    why: 'The callback opened with `(` and `{`, so it must close with `})`. Brackets come in pairs.' },
  { lines: ['let count = 0;', 'setInterval(() => {', '  count++;', '}, 1000);', 'console.log(count);'], bad: 4,
    why: 'The log runs once, before any tick, so it always prints 0. Log inside the callback to see it change.' },
];
const API = [
  ['Login screen', 'POST /auth/session'], ['Profile page', 'GET /users/me'], ['Cart badge', 'GET /cart/count'],
  ['Checkout button', 'POST /orders'], ['Search bar', 'GET /search?q='], ['Avatar upload', 'PUT /users/me/avatar'],
  ['Logout link', 'DELETE /auth/session'], ['Order history', 'GET /orders'], ['Settings save', 'PATCH /users/me'],
  ['Notification bell', 'GET /notifications'],
];
const VISITORS = [
  ['Courier with a parcel', 'Front desk'], ['Candidate, 2 pm interview', 'Engineering Manager'],
  ['External auditor', 'Security Office'], ['Espresso technician', 'Break Room'], ['Investor', 'CEO Office'],
  ['Printer repair', 'IT Support'], ['Usability-test volunteer', 'Design team'], ['Pizza delivery', 'Cafeteria'],
];
const SQL = [
  ['SELECT name, email ___ users WHERE active = 1;', ['FROM', 'INTO', 'JOIN', 'SET']],
  ['SELECT team, COUNT(*) FROM tickets ___ team;', ['GROUP BY', 'ORDER IN', 'HAVING', 'WHERE']],
  ["UPDATE accounts ___ plan = 'pro' WHERE id = 42;", ['SET', 'PUT', 'INTO', 'VALUES']],
  ['SELECT * FROM orders o ___ users u ON u.id = o.user_id;', ['JOIN', 'WITH', 'UNION', 'FROM']],
  ['DELETE FROM sessions ___ expires_at < NOW();', ['WHERE', 'WHEN', 'IF', 'HAVING']],
  ['SELECT * FROM logs ORDER BY created_at ___ LIMIT 10;', ['DESC', 'DOWN', 'LAST', 'REVERSE']],
  ["INSERT ___ users (name, email) VALUES ('Leo', 'leo@halcyon.dev');", ['INTO', 'TO', 'IN', 'ON']],
  ['SELECT team, COUNT(*) FROM tickets GROUP BY team ___ COUNT(*) > 5;', ['HAVING', 'WHERE', 'AND', 'LIMIT']],
  ['SELECT ___ country FROM customers;', ['DISTINCT', 'UNIQUE', 'SINGLE', 'ONLY']],
];
// [prompt, options with the answer first, why]
const QUIZ = {
  backend: [
    ['Which HTTP status code means "not found"?', ['404', '200', '301', '500'], '404 means the server understood the request but has nothing at that address. 200 is OK, 500 is a server crash.'],
    ['Which HTTP method should create a new order?', ['POST', 'GET', 'DELETE', 'HEAD'], 'POST sends new data to the server. GET only reads, so it should never change anything.'],
    ['How should a server store user passwords?', ['As a salted hash (bcrypt, argon2)', 'In plain text', 'Base64-encoded', 'In a cookie'], 'A slow salted hash cannot be turned back into the password, so a leaked database does not leak logins.'],
    ['What does a database index speed up?', ['Finding rows by that column', 'Inserting new rows', 'Taking backups', 'Saving disk space'], 'An index is like a book index: lookups jump straight to the rows. The price is slightly slower writes.'],
    ['The same slow query runs on every request with the same answer. Simplest fix?', ['Cache the result for a short time', 'Buy a bigger server', 'Add more logging', 'Retry it twice'], 'A cache keeps a recent answer in memory, so repeat requests skip the slow work.'],
    ['What does a 500 status code tell the client?', ['The server hit an error', 'The request was fine', 'You must log in', 'The page moved'], '5xx codes mean the server failed. 4xx codes mean the request itself was wrong.'],
    ['Why use environment variables for settings like a database URL?', ['Each environment can differ without code changes', 'They make code run faster', 'They encrypt the data', 'Browsers need them'], 'The same build can run on a laptop, staging and production, each reading its own values.'],
    ['What is an API?', ['An agreed way for programs to talk to each other', 'A type of database', 'A web browser', 'A programming language'], 'An API defines the requests one program can send and the replies it gets, like a menu for software.'],
  ],
  frontend: [
    ['Which language controls colours and layout on a web page?', ['CSS', 'HTML', 'SQL', 'Bash'], 'HTML gives the page structure, CSS styles it, and JavaScript makes it interactive.'],
    ['What is the best HTML element for something you click to run an action?', ['<button>', '<div>', '<span>', '<img>'], 'A real button works with the keyboard and screen readers for free. A clickable div does not.'],
    ['What does "responsive design" mean?', ['The layout adapts to the screen size', 'The page loads instantly', 'It answers user emails', 'It uses animations'], 'One page that rearranges itself for phones, tablets and desktops, usually with CSS media queries.'],
    ['Why give an image alt text?', ['Screen readers read it aloud', 'It makes the image sharper', 'It stops people copying it', 'It is required for colour'], 'Alt text describes the image for blind users and shows up if the image fails to load.'],
    ['What is the DOM?', ['The browser\'s live tree of the page that JavaScript can change', 'A CSS framework', 'A server', 'An image format'], 'JavaScript edits the DOM to update what you see without reloading the page.'],
    ['In JavaScript, what does === compare?', ['Value and type', 'Only the value', 'Only the type', 'Memory size'], '`1 == "1"` is true because == converts types; `1 === "1"` is false. Prefer ===.'],
    ['A page downloads a 4 MB photo on every visit. What helps most?', ['Resize and compress it, then let the browser cache it', 'Add more JavaScript', 'Use a bigger font', 'Make it a GIF'], 'Smaller files load faster, and caching means returning visitors skip the download entirely.'],
    ['In a UI framework, what is "state"?', ['Data that changes and redraws the screen', 'The CSS file', 'The server address', 'A finished build'], 'When state changes (a counter, a form value), the framework re-renders the parts that use it.'],
  ],
  devops: [
    ['What does CI (continuous integration) do on every push?', ['Builds and tests the code automatically', 'Emails the whole team', 'Deletes old branches', 'Deploys to every customer'], 'CI catches broken code minutes after it is pushed, before it reaches anyone else.'],
    ['What is a container image?', ['The app packaged with everything it needs to run', 'A screenshot of a server', 'A backup of the database', 'A virtual keyboard'], 'Because the image carries its own dependencies, it runs the same on a laptop and in production.'],
    ['Why deploy to staging before production?', ['To catch problems where real users are not affected', 'Staging is faster', 'Production needs a password', 'It is cheaper to run'], 'Staging copies production closely, so surprises show up there first.'],
    ['What does a load balancer do?', ['Spreads traffic across several servers', 'Weighs the servers', 'Backs up the database', 'Speeds up the CPU'], 'If one server dies or gets busy, the load balancer sends requests to the healthy ones.'],
    ['Where should API keys and passwords live?', ['In a secrets manager or environment variables', 'In the Git repo', 'In a code comment', 'In the README'], 'Anything committed to Git stays in its history forever, and anyone with repo access can read it.'],
    ['A deploy breaks checkout. What is the quickest safe move?', ['Roll back to the last good version', 'Debug it live in production', 'Wait for users to report it', 'Delete the logs'], 'Rolling back restores service first; you can investigate the bad version calmly afterwards.'],
    ['What do monitoring and alerts give you?', ['You learn something broke before users tell you', 'Faster code', 'Free servers', 'Automatic code reviews'], 'Dashboards and alerts watch errors, latency and traffic, and page the on-call engineer when they spike.'],
    ['What does "infrastructure as code" mean?', ['Servers and networks are defined in versioned files', 'Writing code on a server', 'Coding without a laptop', 'Printing the code'], 'Tools like Terraform let you review, repeat and roll back infrastructure changes just like app code.'],
  ],
};
const quiz = (r, track, title) => ({ title, hint: 'Pick the right answer. Each one comes with a quick explanation.',
  rounds: r.shuffle(QUIZ[track]).slice(0, 2).map(([prompt, o, why]) => ({ prompt, options: r.shuffle(o), answer: o[0], explain: why })) });
const PIPELINES = [
  ['Checkout', 'Lint', 'Unit tests', 'Build image', 'Deploy to staging'],
  ['Install dependencies', 'Type check', 'Run tests', 'Bundle assets', 'Upload to CDN'],
  ['Checkout', 'Run tests', 'Build app bundle', 'Sign the release', 'Submit to the app store'],
  ['Plan infrastructure', 'Review the plan', 'Apply changes', 'Smoke test', 'Shift traffic'],
];
const BACKLOGS = [
  ['P0 · Checkout is down', 'P1 · Password reset email never arrives', 'P2 · Dark mode toggle misaligned', 'P3 · Rename "Colour" to "Color"'],
  ['P0 · Payments double-charge', 'P1 · Push notifications delayed an hour', 'P2 · Avatar looks blurry', 'P3 · Add confetti on signup'],
  ['P0 · Login loops forever', 'P1 · Export drops the last row', 'P2 · Tooltip typo', 'P3 · New loading spinner'],
  ['P0 · Customer data visible to other users', 'P1 · Search ignores accents', 'P2 · Footer overlaps on tablets', 'P3 · Animate the logo'],
  ['P0 · App crashes on launch', 'P1 · Invoices show the wrong currency', 'P2 · Slow settings page', 'P3 · Add more emoji reactions'],
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
    gen: r => { const c = r.pick(CODE); return { title: 'Fix the failing build', hint: 'Click the line with the bug.', lines: c.lines, bad: c.bad, learn: c.why }; } },
  { id: 'wireApi', name: 'Wire screens to endpoints', stations: ['fe2', 'fe4'], minigame: 'match',
    gen: r => ({ title: 'Wire screens to endpoints', hint: 'Pick a screen, then the endpoint it calls.', pairs: r.shuffle(API).slice(0, 4).map(([a, b]) => ({ a, b })),
      learn: 'Every screen talks to the backend through an endpoint: a method (GET reads, POST creates, PUT/PATCH update, DELETE removes) plus a path.' }) },
  { id: 'fixQuery', name: 'Repair a broken query', stations: ['be3', 'be4', 'db1'], minigame: 'choice',
    gen: r => ({ title: 'Repair a broken query', rounds: r.shuffle(SQL).slice(0, 3).map(([prompt, o]) => ({ prompt, code: true, options: r.shuffle(o), answer: o[0] })),
      learn: 'SQL reads like a sentence: SELECT what, FROM which table, WHERE which rows. JOIN links tables, GROUP BY makes totals.' }) },
  { id: 'pipeline', name: 'Order the deploy pipeline', stations: ['ci1', 'ci2'], minigame: 'sequence',
    gen: r => ({ title: 'Order the deploy pipeline', hint: 'Click the stages in the order they run.', items: r.pick(PIPELINES),
      learn: 'Pipelines run the cheapest checks first, so a typo fails in seconds instead of after a ten-minute build.' }) },
  { id: 'restart', name: 'Restart stalled app servers', stations: ['srv2', 'core'], minigame: 'reboot',
    gen: r => ({ title: 'Restart stalled app servers', hint: 'Click every red node and wait for green.', nodes: Array.from({ length: 5 }, (_, i) => `app-${pad(r.int(1, 40))}`),
      learn: 'Restarting fixes a stuck process for now. The log from before the restart tells you why it stalled.' }) },
  { id: 'verifyTests', name: 'Verify test results', stations: ['qa1', 'qa2', 'qa3'], minigame: 'classify',
    gen: r => ({ title: 'Verify test results', hint: 'Pass when the response matches the expectation.', labels: ['Pass', 'Fail'],
      rows: r.shuffle(ROUTES).slice(0, 5).map(route => {
        const exp = r.pick([200, 200, 201, 204]); const ok = r.chance(0.5);
        return { text: `${route}  expected ${exp} · got ${ok ? exp : r.pick([500, 404, 403, 502])}`, answer: ok ? 0 : 1 };
      }), learn: '2xx means success, 4xx means the request was wrong (404 missing, 403 forbidden), 5xx means the server broke.' }) },
  { id: 'rotateKey', name: 'Rotate the API key', stations: ['sec1'], minigame: 'keypad',
    gen: r => ({ title: 'Rotate the API key', hint: 'Memorise the new key, then enter it.', code: Array.from({ length: 6 }, () => r.int(0, 9)).join(''),
      learn: 'Rotating keys regularly means a leaked key stops working soon. Store the new one in a secrets manager, never in code.' }) },
  { id: 'scanFiles', name: 'Quarantine suspicious files', stations: ['it1'], minigame: 'multi',
    gen: r => ({ title: 'Quarantine suspicious files', hint: 'Flag every file hiding an executable extension.',
      items: r.shuffle([...r.shuffle(BAD_FILES).slice(0, 3).map(text => ({ text, bad: true })), ...r.shuffle(GOOD_FILES).slice(0, 6).map(text => ({ text, bad: false }))]),
      learn: 'A file named invoice.pdf.exe is really an .exe. Operating systems often hide the last extension, which is the trick.' }) },
  { id: 'backlog', name: 'Prioritise the sprint backlog', stations: ['pm1', 'pm2'], minigame: 'sequence',
    gen: r => ({ title: 'Prioritise the sprint backlog', hint: 'Most urgent first.', items: r.pick(BACKLOGS),
      learn: 'P0 is "drop everything", P3 is "nice to have". Broken money, data or logins outrank cosmetic issues.' }) },
  { id: 'access', name: 'Review access requests', stations: ['ceo1'], minigame: 'classify',
    gen: r => ({ title: 'Review access requests', hint: 'Least privilege: deny anything that person should not need.', labels: ['Approve', 'Deny'],
      rows: r.shuffle(ACCESS).slice(0, 5).map(([text, answer]) => ({ text, answer })),
      learn: 'Least privilege: give people only the access their job needs, so one stolen account cannot reach everything.' }) },
  { id: 'retro', name: 'Find a slot for the retro', stations: ['conf1'], minigame: 'gridPick',
    gen: r => {
      const slots = ['10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];
      const people = r.shuffle(['Maya', 'Dmitri', 'Priya', 'Leo', 'Sofia', 'Noah', 'Amara', 'Omar']).slice(0, 4);
      const answer = r.int(0, slots.length - 1);
      const busy = people.map(() => slots.map((_, c) => c !== answer && r.chance(0.45)));
      slots.forEach((_, c) => { if (c !== answer && busy.every(row => !row[c])) busy[r.int(0, 3)][c] = true; });
      return { title: 'Find a slot for the retro', hint: 'Pick the one hour when everybody is free.', slots, people, busy, answer,
        learn: 'A retro is where the team looks back at a sprint: what went well, what did not, and one thing to change.' };
    } },
  { id: 'tapes', name: 'Shelve backup drives by date', stations: ['stor1'], minigame: 'sequence',
    gen: r => {
      const set = new Set();
      while (set.size < 5) set.add(`2026-${pad(r.int(1, 11))}-${pad(r.int(1, 28))}`);
      return { title: 'Shelve backup drives by date', hint: 'Oldest first.', items: [...set].sort().map(d => `Backup ${d}`),
        learn: 'ISO dates (YYYY-MM-DD) sort correctly as plain text, which is why logs and backups use them.' };
    } },
  { id: 'espresso', name: 'Calibrate the espresso machine', stations: ['coffee'], minigame: 'timing',
    gen: () => ({ title: 'Calibrate the espresso machine', hint: 'Stop the needle inside the band. Three shots.', rounds: 3,
      learn: 'Caffeine is not a deployment strategy, but it helps the people writing one.' }) },
  { id: 'fridge', name: 'Patch the smart fridge', stations: ['fridge'], minigame: 'reboot',
    gen: () => ({ title: 'Patch the smart fridge', hint: 'Restart each module after the firmware update.', nodes: ['compressor-ctl', 'door-sensor', 'ice-os'],
      learn: 'IoT devices run software too, and unpatched ones are a favourite way into office networks.' }) },
  { id: 'badges', name: 'Match visitors to hosts', stations: ['recep'], minigame: 'match',
    gen: r => ({ title: 'Match visitors to hosts', hint: 'Pick a visitor, then where they should go.', pairs: r.shuffle(VISITORS).slice(0, 4).map(([a, b]) => ({ a, b })),
      learn: 'Checking visitors in stops tailgating, where someone follows staff through a door they should not open.' }) },
  { id: 'quizBackend', name: 'Answer a backend question', stations: ['be1', 'be2', 'db1'], minigame: 'choice',
    gen: r => quiz(r, 'backend', 'Backend basics') },
  { id: 'quizFrontend', name: 'Answer a frontend question', stations: ['fe1', 'fe3', 'qa3'], minigame: 'choice',
    gen: r => quiz(r, 'frontend', 'Frontend basics') },
  { id: 'quizDevops', name: 'Answer a DevOps question', stations: ['ci1', 'ci2', 'srv2'], minigame: 'choice',
    gen: r => quiz(r, 'devops', 'DevOps basics') },
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
