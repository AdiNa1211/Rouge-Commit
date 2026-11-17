// The "Halcyon Labs" office. Pure data: rooms, doors, furniture, stations, cameras.
// Units are metres; x runs east, z runs south. A new map is another object of this shape.

const PROP_SIZE = {
  desk: [1.6, 0.8], rack: [0.8, 1.0], kiosk: [0.8, 0.5], sofa: [2, 0.9], plant: [0.6, 0.6],
  fridge: [0.8, 0.8], shelf: [2, 0.6], car: [2, 4.2], stall: [1.2, 1.5], board: [2, 0.25],
  vending: [1, 0.8], pingpong: [2.7, 1.5], recep: [4, 1], table: [2, 1.2], counter: [3, 0.7],
  screen: [3, 0.1], button: [0.9, 0.9],
};
const NON_SOLID = new Set(['screen']);

const props = [];
const stations = [];

// rot is quarter turns; a station's standing spot sits in front of the prop
function P(type, x, z, rot = 0, extra = {}) {
  const [bw, bd] = extra.size || PROP_SIZE[type];
  const odd = rot % 2 === 1;
  const p = { type, x, z, rot, w: odd ? bd : bw, d: odd ? bw : bd, bw, bd, solid: !NON_SOLID.has(type), ...extra };
  props.push(p);
  if (extra.station) {
    const off = bd / 2 + 0.6;
    const a = rot * Math.PI / 2;
    stations.push({ ...extra.station, x: x + Math.sin(a) * off, z: z + Math.cos(a) * off, fx: x, fz: z });
  }
  return p;
}
const S = (id, label, workstation = false) => ({ id, label, workstation });
const deskRow = (xs, z, rot, st = {}) => xs.forEach(x => P('desk', x, z, rot, st[x] ? { station: st[x] } : {}));

// --- Server Room
for (let i = 0; i < 8; i++) P('rack', 1.2 + i, 1.05, 0);
[1.2, 3.2, 6.8, 7.8, 8.8].forEach(x => P('rack', x, 4.6, 0));
P('rack', 2.2, 4.6, 0, { station: S('srv2', 'App server rack') });
P('kiosk', 5, 3.0, 0, { station: S('core', 'Core cluster console', true) });
// --- DevOps Bay
P('desk', 0.9, 11.5, 1, { station: S('ci1', 'Pipeline console', true) });
P('desk', 0.9, 15.3, 1, { station: S('ci2', 'Deploy console', true) });
P('plant', 9.0, 9.5);
P('screen', 9.4, 16, 3);
// --- Dev floor: Backend Pod (west) and Frontend Pod (east)
deskRow([12.5, 15, 17.5, 20], 3.0, 2, { 12.5: S('be1', 'Backend workstation', true) });
deskRow([12.5, 15, 17.5, 20], 3.85, 0, { 17.5: S('be2', 'Backend workstation', true), 20: S('be3', 'Query workbench', true) });
deskRow([12.5, 15, 17.5], 9.5, 2);
deskRow([12.5, 15, 17.5], 10.35, 0, { 15: S('be4', 'Query workbench', true) });
P('kiosk', 19.5, 17.2, 2, { station: S('db1', 'Database console', true) });
P('rack', 20.7, 16.95, 2);
P('plant', 10.5, 17);
P('board', 22, 14.5, 1);
deskRow([24, 26.5, 29], 3.0, 2, { 24: S('fe1', 'Frontend workstation', true) });
deskRow([24, 26.5, 29], 3.85, 0, { 26.5: S('fe2', 'API explorer', true), 29: S('fe3', 'Frontend workstation', true) });
deskRow([24.5, 27, 29.5], 9.5, 2, { 27: S('fe4', 'API explorer', true) });
deskRow([24.5, 27, 29.5], 10.35, 0);
P('sofa', 32.8, 12, 1);
P('plant', 33, 17);
// --- Product Corner
P('board', 40, 0.7, 0, { station: S('pm1', 'Sprint board') });
P('desk', 36.5, 1.0, 0, { station: S('pm2', 'Planning desk', true) });
P('desk', 43.5, 1.0, 0);
P('sofa', 43.5, 6.9, 2);
P('plant', 45, 0.9);
// --- QA Lab
P('desk', 34.4, 11, 1, { station: S('qa1', 'Test bench', true) });
P('desk', 34.4, 14.5, 1, { station: S('qa2', 'Test bench', true) });
P('desk', 45.1, 11, 3, { station: S('qa3', 'Device rig', true) });
P('desk', 45.1, 14.5, 3);
P('shelf', 36.5, 8.3, 0);
// --- Conference + meeting rooms
P('table', 55, 4.6, 0, { size: [8, 2.2] });
P('kiosk', 62.5, 0.8, 0, { station: S('conf1', 'Room calendar') });
P('screen', 55, 0.55, 0);
P('plant', 46.5, 8.9);
P('table', 52.6, 13.8, 0, { size: [3, 1.4] });
P('table', 57, 13.8, 0, { size: [3, 1.4] });
// --- Corridor
[[9.5, 18.4], [33, 18.4], [45.5, 18.4], [25.5, 21.1], [47.5, 21.1], [57, 21.1]].forEach(([x, z]) => P('plant', x, z));
// --- Security Office
P('kiosk', 2, 33.2, 2, { station: S('cams', 'Camera wall') });
P('kiosk', 4, 33.2, 2, { station: S('logs', 'Audit log terminal') });
P('kiosk', 6, 33.2, 2, { station: S('sec1', 'Key vault') });
P('desk', 0.9, 26, 1);
P('shelf', 7.1, 27, 3);
// --- IT Support
P('desk', 8.4, 28, 1, { station: S('it1', 'Malware scanner', true) });
P('kiosk', 14, 33.2, 2, { station: S('router', 'Core switch') });
P('rack', 15.5, 32.9, 2);
P('table', 12.5, 28.5, 0, { size: [2, 1] });
P('shelf', 16.1, 25.5, 3);
// --- CEO Office
P('desk', 22, 31.5, 2, { station: S('ceo1', 'Executive desk', true) });
P('sofa', 17.5, 27, 1);
P('plant', 26, 33);
P('shelf', 26.1, 26.5, 3);
// --- Reception
P('recep', 33, 29.5, 0);
stations.push({ ...S('recep', 'Front desk'), x: 33, z: 28.4, fx: 33, fz: 29.5 });
P('sofa', 27.5, 25.5, 1);
P('sofa', 38, 25.5, 3);
[[27.4, 39], [38, 39], [27.4, 33], [38, 33]].forEach(([x, z]) => P('plant', x, z));
// --- Storage
P('shelf', 18.5, 34.3, 0);
P('shelf', 21, 34.3, 0, { station: S('stor1', 'Backup shelf') });
P('shelf', 23.5, 34.3, 0);
P('shelf', 19, 39.1, 0);
P('shelf', 22, 39.1, 0);
// --- Restrooms
[34.8, 36.4, 38.0].forEach(z => P('stall', 45.8, z));
P('counter', 42, 34.35, 0);
// --- Break Room
P('counter', 39.35, 27, 1, { size: [4, 0.7], coffee: true });
stations.push({ ...S('coffee', 'Espresso machine'), x: 40.3, z: 26.5, fx: 39.35, fz: 26.5 });
P('fridge', 39.4, 23.2);
P('pingpong', 43.2, 31.5);
P('vending', 46.1, 32.5, 3);
// --- Cafeteria
[[49.2, 24.6], [56, 24.6], [49.5, 31.6], [55.5, 31.6]].forEach(([x, z]) => P('table', x, z, 0, { stools: true }));
// emergency button: the only place a stand-up can be paged from
P('button', 52.5, 28, 0, { station: S('emergency', 'Emergency button') });
// --- Kitchen
P('counter', 63.15, 28, 3, { size: [6, 0.7] });
P('fridge', 61, 22.4, 0, { station: S('fridge', 'Smart fridge'), smart: true });
P('table', 59.5, 32, 0, { size: [1.6, 0.9] });
// --- Parking
[25, 28.5, 38, 41.5].forEach((x, i) => P('car', x, 44.2, 0, { tint: ['#d9534f', '#3b6ea5', '#e8e8e8', '#3c8f5a'][i] }));

export const MAP = {
  name: 'Halcyon Labs HQ',
  width: 64, depth: 48, cell: 0.5, wallHeight: 2.3,
  // physical rooms get walls; badge rooms write to the door access log
  rooms: [
    { id: 'server', name: 'Server Room', x: 0, z: 0, w: 10, h: 9, floor: '#39424f', badge: true },
    { id: 'devops', name: 'DevOps Bay', x: 0, z: 9, w: 10, h: 9, floor: '#6f6a8c', badge: true },
    { id: 'devfloor', name: 'Dev Floor', x: 10, z: 0, w: 24, h: 18, floor: '#b8a98f' },
    { id: 'product', name: 'Product Corner', x: 34, z: 0, w: 12, h: 8, floor: '#c79a8a' },
    { id: 'qa', name: 'QA Lab', x: 34, z: 8, w: 12, h: 10, floor: '#8fb5a6' },
    { id: 'conference', name: 'Conference Room', x: 46, z: 0, w: 18, h: 10, floor: '#7d8fb0' },
    { id: 'meetA', name: 'Meeting Room A', bare: true, x: 46, z: 10, w: 9, h: 8, floor: '#a9b78b' },
    { id: 'meetB', name: 'Meeting Room B', bare: true, x: 55, z: 10, w: 9, h: 8, floor: '#b7a58b' },
    { id: 'corridor', name: 'Main Corridor', x: 0, z: 18, w: 64, h: 4, floor: '#d4cdc0' },
    { id: 'security', name: 'Security Office', x: 0, z: 22, w: 8, h: 12, floor: '#4c5a70', badge: true },
    { id: 'it', name: 'IT Support', bare: true, x: 8, z: 22, w: 9, h: 12, floor: '#8a9bb3', badge: true },
    { id: 'ceo', name: 'CEO Office', x: 17, z: 22, w: 10, h: 12, floor: '#9c7b5f', badge: true },
    { id: 'lobby', name: 'Reception', bare: true, x: 27, z: 22, w: 12, h: 18, floor: '#e3d9c6' },
    { id: 'storage', name: 'Storage', bare: true, x: 17, z: 34, w: 10, h: 6, floor: '#8f8b82', badge: true },
    { id: 'restrooms', name: 'Restrooms', x: 39, z: 34, w: 8, h: 6, floor: '#bcd3d8' },
    { id: 'break', name: 'Break Room', x: 39, z: 22, w: 8, h: 12, floor: '#e0b46c' },
    { id: 'cafeteria', name: 'Cafeteria', x: 47, z: 22, w: 11, h: 12, floor: '#d9c7a3' },
    { id: 'kitchen', name: 'Kitchen', x: 58, z: 22, w: 6, h: 12, floor: '#cfd2d6' },
    { id: 'parking', name: 'Parking', bare: true, x: 22, z: 40, w: 22, h: 8, floor: '#5b5f66', outdoor: true },
  ],
  // named areas inside a physical room (open plan), checked before rooms
  zones: [
    { id: 'backend', name: 'Backend Pod', x: 10, z: 0, w: 12, h: 18 },
    { id: 'frontend', name: 'Frontend Pod', x: 22, z: 0, w: 12, h: 18 },
  ],
  // gaps in walls: axis 'h' = wall along x at z=at, 'v' = wall along z at x=at
  doors: [
    { axis: 'h', at: 9, from: 4, to: 6 }, { axis: 'h', at: 18, from: 4, to: 6 },
    { axis: 'v', at: 10, from: 12, to: 14 },
    { axis: 'h', at: 18, from: 15, to: 17 }, { axis: 'h', at: 18, from: 27, to: 29 },
    { axis: 'v', at: 34, from: 3, to: 5 },
    { axis: 'h', at: 8, from: 39, to: 41 }, { axis: 'h', at: 18, from: 39, to: 41 },
    { axis: 'v', at: 46, from: 4, to: 6 },
    { axis: 'h', at: 10, from: 49, to: 51 }, { axis: 'h', at: 10, from: 59, to: 61 },
    { axis: 'h', at: 18, from: 49, to: 51 }, { axis: 'h', at: 18, from: 59, to: 61 },
    { axis: 'h', at: 22, from: 3, to: 5 }, { axis: 'h', at: 22, from: 11, to: 13 },
    { axis: 'h', at: 22, from: 21, to: 23 }, { axis: 'h', at: 22, from: 29, to: 37 },
    { axis: 'h', at: 22, from: 42, to: 44 }, { axis: 'h', at: 22, from: 51, to: 54 },
    { axis: 'v', at: 58, from: 27, to: 29 }, { axis: 'v', at: 47, from: 27, to: 29 },
    { axis: 'v', at: 39, from: 36, to: 38 }, { axis: 'v', at: 27, from: 36, to: 38 },
    { axis: 'h', at: 40, from: 31, to: 35 },
  ],
  props,
  stations,
  cameras: [
    { id: 'cam-west', name: 'Corridor West', x: 0.8, y: 2.6, z: 18.3, lx: 16, lz: 20.2 },
    { id: 'cam-east', name: 'Corridor East', x: 63.2, y: 2.6, z: 21.2, lx: 48, lz: 19.8 },
    { id: 'cam-server', name: 'Server Room', x: 9.2, y: 2.6, z: 8.2, lx: 3.5, lz: 3 },
    { id: 'cam-dev', name: 'Dev Floor', x: 33.2, y: 2.8, z: 17.2, lx: 21, lz: 7 },
    { id: 'cam-lobby', name: 'Reception', bare: true, x: 27.4, y: 2.8, z: 22.4, lx: 33.5, lz: 32 },
  ],
  // where everyone lands when a stand-up is called
  seats: [
    [52.5, 2.7], [54.2, 2.7], [55.8, 2.7], [57.5, 2.7], [59.9, 4.6],
    [57.5, 6.5], [55.8, 6.5], [54.2, 6.5], [52.5, 6.5], [50.1, 4.6],
  ],
  seatFocus: [55, 4.6],
  spawns: [
    [30, 24], [31.5, 24], [33, 24], [34.5, 24], [36, 24],
    [30, 26], [31.5, 26], [33, 26], [34.5, 26], [36, 26],
  ],
  exitSign: { x: 63.6, z: 20 },
};

const inRect = (r, x, z) => x >= r.x && x < r.x + r.w && z >= r.z && z < r.z + r.h;

export function roomAt(map, x, z) {
  for (const r of map.zones) if (inRect(r, x, z)) return r;
  for (const r of map.rooms) if (inRect(r, x, z)) return r;
  return null;
}

export function roomById(map, id) {
  return map.zones.find(r => r.id === id) || map.rooms.find(r => r.id === id);
}

// Walls come from room outlines: 1 m edge units, de-duplicated, minus door gaps, merged into runs.
export function buildWalls(map) {
  const units = new Map();
  const add = (axis, at, i, low) => {
    const k = `${axis}:${at}:${i}`;
    const prev = units.get(k);
    units.set(k, prev === undefined ? low : prev && low);
  };
  for (const r of map.rooms) {
    const low = !!r.outdoor;
    for (let i = r.x; i < r.x + r.w; i++) { add('h', r.z, i, low); add('h', r.z + r.h, i, low); }
    for (let i = r.z; i < r.z + r.h; i++) { add('v', r.x, i, low); add('v', r.x + r.w, i, low); }
  }
  for (const d of map.doors) for (let i = d.from; i < d.to; i++) units.delete(`${d.axis}:${d.at}:${i}`);
  const lines = new Map();
  for (const [k, low] of units) {
    const [axis, at, i] = k.split(':');
    const lk = `${axis}:${at}:${low ? 1 : 0}`;
    (lines.get(lk) || lines.set(lk, []).get(lk)).push(+i);
  }
  const walls = [];
  for (const [lk, list] of lines) {
    const [axis, at, low] = lk.split(':');
    list.sort((a, b) => a - b);
    let start = list[0], prev = list[0];
    for (let n = 1; n <= list.length; n++) {
      if (n < list.length && list[n] === prev + 1) { prev = list[n]; continue; }
      walls.push({ axis, at: +at, from: start, to: prev + 1, low: low === '1' });
      start = prev = list[n];
    }
  }
  return walls;
}
