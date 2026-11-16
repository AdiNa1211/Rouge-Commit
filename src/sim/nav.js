// Collision grid, line of sight and A* pathfinding, all derived from map data.
import { buildWalls } from '../data/map.js';

export class Nav {
  constructor(map) {
    this.map = map;
    this.cs = map.cell;
    this.W = Math.round(map.width / this.cs);
    this.H = Math.round(map.depth / this.cs);
    const n = this.W * this.H;
    this.wall = new Uint8Array(n).fill(1);   // walls + void: blocks sight
    for (const r of map.rooms) this.fill(this.wall, r.x, r.z, r.x + r.w, r.z + r.h, 0);
    this.walls = buildWalls(map);
    for (const w of this.walls) {
      const line = Math.max(0, Math.round(w.at / this.cs) - 1);
      const a = Math.round(w.from / this.cs), b = Math.round(w.to / this.cs) - 1;
      for (let i = a; i <= b; i++) {
        const [cx, cz] = w.axis === 'h' ? [i, line] : [line, i];
        if (cx < this.W && cz < this.H) this.wall[cz * this.W + cx] = 1;
      }
    }
    this.solid = this.wall.slice();          // + furniture: blocks bodies
    for (const p of map.props) {
      if (p.solid) this.fill(this.solid, p.x - p.w / 2, p.z - p.d / 2, p.x + p.w / 2, p.z + p.d / 2, 1);
    }
    this.nav = this.solid.slice();           // furniture grown by one cell: AI clearance
    for (let z = 0; z < this.H; z++) for (let x = 0; x < this.W; x++) {
      if (!this.solid[z * this.W + x]) continue;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, nz = z + dz;
        if (nx >= 0 && nz >= 0 && nx < this.W && nz < this.H) this.nav[nz * this.W + nx] = 1;
      }
    }
    // cells an AI can actually walk to from the spawn; furniture can seal off small pockets
    this.reach = new Uint8Array(n);
    const [sx, sz] = map.spawns[0];
    const stack = [Math.floor(sz / this.cs) * this.W + Math.floor(sx / this.cs)];
    this.reach[stack[0]] = 1;
    while (stack.length) {
      const i = stack.pop(), x = i % this.W, z = (i / this.W) | 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, nz = z + dz, ni = nz * this.W + nx;
        if (nx < 0 || nz < 0 || nx >= this.W || nz >= this.H || this.nav[ni] || this.reach[ni]) continue;
        this.reach[ni] = 1;
        stack.push(ni);
      }
    }
    // free standing spots per room for wandering
    this.freeByRoom = {};
    for (const r of map.rooms) {
      const list = [];
      for (let z = r.z + 0.75; z < r.z + r.h; z += 1) for (let x = r.x + 0.75; x < r.x + r.w; x += 1) {
        if (this.reach[Math.floor(z / this.cs) * this.W + Math.floor(x / this.cs)]) list.push({ x, z });
      }
      this.freeByRoom[r.id] = list;
    }
  }

  fill(grid, x0, z0, x1, z1, v) {
    const e = 1e-6;
    const a = Math.max(0, Math.floor((x0 + e) / this.cs)), b = Math.min(this.W - 1, Math.ceil((x1 - e) / this.cs) - 1);
    const c = Math.max(0, Math.floor((z0 + e) / this.cs)), d = Math.min(this.H - 1, Math.ceil((z1 - e) / this.cs) - 1);
    for (let z = c; z <= d; z++) for (let x = a; x <= b; x++) grid[z * this.W + x] = v;
  }

  blocked(grid, x, z) {
    const cx = Math.floor(x / this.cs), cz = Math.floor(z / this.cs);
    if (cx < 0 || cz < 0 || cx >= this.W || cz >= this.H) return true;
    return grid[cz * this.W + cx] === 1;
  }

  // can a body of this radius stand here
  canStand(x, z, r = 0.3) {
    return !(this.blocked(this.solid, x - r, z - r) || this.blocked(this.solid, x + r, z - r) ||
      this.blocked(this.solid, x - r, z + r) || this.blocked(this.solid, x + r, z + r));
  }

  clear(grid, a, b) {
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    const steps = Math.ceil(d / 0.22);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (this.blocked(grid, a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false;
    }
    return true;
  }

  los(a, b) { return this.clear(this.wall, a, b); }

  nearestFree(x, z) {
    const sx = Math.floor(x / this.cs), sz = Math.floor(z / this.cs);
    for (let r = 0; r < 12; r++) {
      let best = null, bd = 1e9;
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const cx = sx + dx, cz = sz + dz;
        if (cx < 0 || cz < 0 || cx >= this.W || cz >= this.H || !this.reach[cz * this.W + cx]) continue;
        const d = dx * dx + dz * dz;
        if (d < bd) { bd = d; best = [cx, cz]; }
      }
      if (best) return best;
    }
    return null;
  }

  centre(cx, cz) { return { x: (cx + 0.5) * this.cs, z: (cz + 0.5) * this.cs }; }

  // A* on the grown grid, then string-pulled. Returns waypoints or null.
  findPath(from, to) {
    const s = this.nearestFree(from.x, from.z), g = this.nearestFree(to.x, to.z);
    if (!s || !g) return null;
    const W = this.W, start = s[1] * W + s[0], goal = g[1] * W + g[0];
    const gScore = new Float32Array(W * this.H).fill(Infinity);
    const came = new Int32Array(W * this.H).fill(-1);
    const closed = new Uint8Array(W * this.H);
    const heap = [];
    const push = (i, f) => {
      heap.push([f, i]);
      let c = heap.length - 1;
      while (c > 0) {
        const p = (c - 1) >> 1;
        if (heap[p][0] <= heap[c][0]) break;
        [heap[p], heap[c]] = [heap[c], heap[p]]; c = p;
      }
    };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let p = 0;
        for (;;) {
          let m = p; const l = p * 2 + 1, r = l + 1;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === p) break;
          [heap[p], heap[m]] = [heap[m], heap[p]]; p = m;
        }
      }
      return top[1];
    };
    const hx = i => {
      const dx = Math.abs((i % W) - g[0]), dz = Math.abs(((i / W) | 0) - g[1]);
      return Math.max(dx, dz) + 0.414 * Math.min(dx, dz);
    };
    gScore[start] = 0;
    push(start, hx(start));
    let found = false;
    while (heap.length) {
      const cur = pop();
      if (cur === goal) { found = true; break; }
      if (closed[cur]) continue;
      closed[cur] = 1;
      const cx = cur % W, cz = (cur / W) | 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const nx = cx + dx, nz = cz + dz;
        if (nx < 0 || nz < 0 || nx >= W || nz >= this.H) continue;
        const ni = nz * W + nx;
        if (this.nav[ni] || closed[ni]) continue;
        // no squeezing diagonally past a corner
        if (dx && dz && (this.nav[cz * W + nx] || this.nav[nz * W + cx])) continue;
        const ng = gScore[cur] + (dx && dz ? 1.414 : 1);
        if (ng < gScore[ni]) { gScore[ni] = ng; came[ni] = cur; push(ni, ng + hx(ni)); }
      }
    }
    if (!found) return null;
    const cells = [];
    for (let i = goal; i !== -1; i = came[i]) cells.push(this.centre(i % W, (i / W) | 0));
    cells.reverse();
    const out = [cells[0]];
    let anchor = 0;
    for (let i = 2; i < cells.length; i++) {
      if (!this.clear(this.nav, cells[anchor], cells[i])) { out.push(cells[i - 1]); anchor = i - 1; }
    }
    out.push(cells[cells.length - 1]);
    return out;
  }
}
