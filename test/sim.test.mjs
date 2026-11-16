// Headless AI-only matches: checks the sim never throws or stalls and reports balance.
import { Game } from '../src/sim/game.js';

const N = +(process.argv[2] || 200);
const stats = { wins: {}, time: 0, meetings: 0, ejStaff: 0, ejMole: 0, kills: 0, stall: 0, sab: 0, fixed: 0 };
for (let i = 0; i < N; i++) {
  const g = new Game({ seed: 1000 + i });
  g.bus.on('meeting:start', () => stats.meetings++);
  g.bus.on('eject', ({ agent }) => (agent.role === 'mole' ? stats.ejMole++ : stats.ejStaff++));
  g.bus.on('kill', () => stats.kills++);
  g.bus.on('sabotage:start', () => stats.sab++);
  g.bus.on('sabotage:end', e => e.fixed && stats.fixed++);
  let steps = 0;
  while (g.phase !== 'ended' && steps < 30000) { g.update(0.1); steps++; }
  if (g.phase !== 'ended') { stats.stall++; continue; }
  stats.wins[g.result.id] = (stats.wins[g.result.id] || 0) + 1;
  stats.time += g.time;
}
const done = N - stats.stall;
console.log(`games ${N}  stalled ${stats.stall}`);
console.log('wins', stats.wins);
console.log(`avg play time ${(stats.time / done).toFixed(0)}s  meetings/game ${(stats.meetings / N).toFixed(1)}  kills/game ${(stats.kills / N).toFixed(1)}`);
console.log(`ejected staff ${stats.ejStaff}  moles ${stats.ejMole}  sabotages ${stats.sab} fixed ${stats.fixed}`);
if (stats.stall) process.exit(1);
