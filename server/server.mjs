// Multiplayer host: serves the built game and runs one authoritative match per room.
// Players are humans on any of the 10 characters; every unclaimed character is an AI.
import http from 'node:http';
import os from 'node:os';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Game } from '../src/sim/game.js';
import { makeBrain } from '../src/sim/ai.js';
import { CHARACTERS } from '../src/data/config.js';
import { dist } from '../src/core/util.js';
import { snapshot, startInfo, encodeEvent } from '../src/net/protocol.js';

const PORT = +(process.env.PORT || 8080);
const DIST = fileURLToPath(new URL('../dist/', import.meta.url));
const TICK = 1000 / 30;
const rooms = new Map();
const LAN = Object.values(os.networkInterfaces()).flat().find(i => i.family === 'IPv4' && !i.internal)?.address;

const server = http.createServer((req, res) => {
  const path = req.url.split('?')[0];
  if (path === '/favicon.ico') { res.writeHead(204).end(); return; }
  const file = path === '/' ? 'index.html' : path.slice(1);
  if (!['index.html', 'game.js'].includes(file) || !existsSync(DIST + file)) { res.writeHead(404).end('Not found. Run "npm run build" first.'); return; }
  let body = readFileSync(DIST + file);
  // tells the page it was served by a game server, so it shows the online lobby
  if (file === 'index.html') body = String(body).replace('<script src="game.js">', '<script>window.MP = true;</script>\n<script src="game.js">');
  res.writeHead(200, { 'content-type': file.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8', 'cache-control': 'no-store' }).end(body);
});

const wss = new WebSocketServer({ server, path: '/ws' });
const send = (ws, msg) => { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); };

function lobbyState(room) {
  const players = [...room.players.values()].map(p => ({ char: p.char, host: p.host }));
  for (const [ws, p] of room.players) send(ws, { t: 'lobby', code: room.code, players, you: p.char, host: p.host, running: !!room.game, lan: LAN ? `${LAN}:${PORT}` : null });
}

function freeChar(room, want) {
  const taken = new Set([...room.players.values()].map(p => p.char));
  if (want && CHARACTERS.some(c => c.id === want) && !taken.has(want)) return want;
  return CHARACTERS.find(c => !taken.has(c.id))?.id || null;
}

function newCode() {
  for (;;) {
    const code = Array.from({ length: 4 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ'[(Math.random() * 23) | 0]).join('');
    if (!rooms.has(code)) return code;
  }
}

function startGame(room) {
  const g = (room.game = new Game({ humans: [...room.players.values()].map(p => p.char) }));
  for (const [ws, p] of room.players) send(ws, { t: 'start', info: startInfo(g, g.agent(p.char)) });
  g.bus.on('*', (type, payload) => {
    for (const [ws, p] of room.players) {
      const d = encodeEvent(type, payload, g, g.agent(p.char));
      if (d !== undefined) send(ws, { t: 'e', e: type, d });
    }
  });
  let last = Date.now(), n = 0;
  room.timer = setInterval(() => {
    const now = Date.now();
    const dt = Math.min(0.2, (now - last) / 1000);
    last = now;
    const steps = Math.max(1, Math.ceil(dt / 0.034));
    for (let i = 0; i < steps; i++) g.update(dt / steps);
    if (++n % 2 === 0 || g.phase === 'ended') {
      for (const [ws, p] of room.players) send(ws, snapshot(g, g.agent(p.char), n % 30 === 0));
    }
    if (g.phase === 'ended') stopGame(room);
  }, TICK);
}

function stopGame(room) {
  clearInterval(room.timer);
  room.game = null;
  lobbyState(room);
}

function leave(ws) {
  const room = ws.room;
  if (!room) return;
  const p = room.players.get(ws);
  room.players.delete(ws);
  ws.room = null;
  if (!room.players.size) { clearInterval(room.timer); rooms.delete(room.code); return; }
  if (p.host) room.players.values().next().value.host = true;
  // a player who drops mid-match is taken over by the AI so the match can finish
  const a = room.game?.agent(p.char);
  if (a) { a.isHuman = false; a.move.x = a.move.z = 0; a.brain = makeBrain(room.game, a); }
  lobbyState(room);
}

const HANDLERS = {
  create(ws, m) {
    leave(ws);
    const room = { code: newCode(), players: new Map(), game: null, timer: null };
    rooms.set(room.code, room);
    room.players.set(ws, { char: freeChar(room, m.char), host: true });
    ws.room = room;
    lobbyState(room);
  },
  join(ws, m) {
    const room = rooms.get(String(m.code || '').toUpperCase().trim());
    if (!room) return send(ws, { t: 'err', text: 'No room with that code. Ask the host for the four letters shown on their screen.' });
    if (room.game) return send(ws, { t: 'err', text: 'That match is already running. Join when it ends.' });
    leave(ws);
    const char = freeChar(room, m.char);
    if (!char) return send(ws, { t: 'err', text: 'That room is full.' });
    room.players.set(ws, { char, host: false });
    ws.room = room;
    lobbyState(room);
  },
  pick(ws, m) {
    const room = ws.room, p = room?.players.get(ws);
    if (!p || room.game) return;
    p.char = freeChar(room, m.char) === m.char ? m.char : p.char;
    lobbyState(room);
  },
  start(ws) {
    const room = ws.room;
    if (room && !room.game && room.players.get(ws)?.host) startGame(room);
  },
  // gameplay command from a player; the sim validates it exactly like an AI's
  c(ws, m) {
    const room = ws.room, p = room?.players.get(ws);
    if (!p || !room.game || !m.c || typeof m.c.type !== 'string') return;
    const { ai, ...cmd } = m.c;
    room.game.command(p.char, cmd);
  },
  near(ws, m) {
    const room = ws.room, p = room?.players.get(ws), g = room?.game;
    const text = String(m.text || '').trim().slice(0, 80);
    if (!p || !g || !text || g.phase !== 'play') return;
    const me = g.agent(p.char);
    if (!me.alive) return;
    for (const [other, q] of room.players) {
      const o = g.agent(q.char);
      if (o === me || (dist(o.pos, me.pos) < 9 && g.canSee(me, o))) send(other, { t: 'bark', who: me.id, text });
    }
  },
  leave(ws) { leave(ws); },
};

wss.on('connection', ws => {
  ws.on('message', raw => {
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    try { HANDLERS[m?.t]?.(ws, m); } catch (e) { console.error('handler error', m?.t, e); }
  });
  ws.on('close', () => leave(ws));
});

server.listen(PORT, () => {
  console.log(`Rogue Commit server running.\n  This computer:  http://localhost:${PORT}`);
  for (const list of Object.values(os.networkInterfaces())) for (const i of list) {
    if (i.family === 'IPv4' && !i.internal) console.log(`  Same Wi-Fi:     http://${i.address}:${PORT}`);
  }
});
