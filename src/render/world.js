// Builds the 3D office from map data. Every prop type has one small builder.
import * as THREE from 'three';

const cache = new Map();
export function mat(color, extra) {
  if (extra) return new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.03, ...extra });
  if (!cache.has(color)) cache.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.03 }));
  return cache.get(color);
}
const glow = (color, k = 1) => mat('#0c1220', { emissive: color, emissiveIntensity: k });

export function box(w, h, d, m, x = 0, y = 0, z = 0) {
  const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  me.position.set(x, y, z);
  me.castShadow = me.receiveShadow = true;
  return me;
}
function cyl(rt, rb, h, m, x = 0, y = 0, z = 0, seg = 14) {
  const me = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
  me.position.set(x, y, z);
  me.castShadow = me.receiveShadow = true;
  return me;
}

const SCREEN_TINTS = ['#4fd1ff', '#7cf2c0', '#ffd27a', '#c8a6ff', '#ff9f8a'];
let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

const BUILD = {
  desk(g) {
    g.add(box(1.6, 0.06, 0.8, mat('#d8c3a0'), 0, 0.98, 0));
    g.add(box(0.08, 0.95, 0.6, mat('#3a4050'), -0.7, 0.475, 0), box(0.08, 0.95, 0.6, mat('#3a4050'), 0.7, 0.475, 0));
    g.add(box(0.06, 0.22, 0.06, mat('#22262f'), 0, 1.11, -0.22), box(0.78, 0.46, 0.04, mat('#22262f'), 0, 1.44, -0.22));
    g.add(box(0.72, 0.4, 0.012, glow(SCREEN_TINTS[(rnd() * 5) | 0], 0.85), 0, 1.44, -0.195));
    g.add(box(0.42, 0.02, 0.14, mat('#2b303b'), 0, 1.02, 0.12));
    if (rnd() < 0.6) g.add(cyl(0.05, 0.045, 0.1, mat(['#ff6b5e', '#f2c230', '#18b8a6', '#ffffff'][(rnd() * 4) | 0]), 0.55, 1.06, 0.2));
  },
  rack(g, p, fx) {
    g.add(box(0.8, 2.0, 1.0, mat('#1d222c'), 0, 1.0, 0));
    for (let i = 0; i < 6; i++) g.add(box(0.56, 0.035, 0.012, fx.leds[i % 3], 0, 0.35 + i * 0.27, 0.506));
    g.add(box(0.62, 1.8, 0.01, mat('#2a3140'), 0, 1.0, 0.501));
  },
  // pedestal with a red dome under a glass cover, a nod to the classic emergency button
  button(g) {
    g.add(cyl(0.42, 0.5, 0.9, mat('#3b4458'), 0, 0.45, 0), cyl(0.5, 0.5, 0.06, mat('#c7ccd6'), 0, 0.93, 0));
    g.add(cyl(0.3, 0.3, 0.12, glow('#ff3b30', 1.4), 0, 1.02, 0));
    const cover = new THREE.Mesh(new THREE.SphereGeometry(0.4, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat('#bfe6ff', { transparent: true, opacity: 0.28 }));
    cover.position.y = 0.96; g.add(cover);
  },
  kiosk(g) {
    g.add(box(0.55, 1.0, 0.3, mat('#3b4458'), 0, 0.5, -0.05));
    const s = box(0.72, 0.46, 0.05, mat('#1c2130'), 0, 1.2, 0.02);
    const f = box(0.64, 0.38, 0.012, glow('#58e0ff', 1.1), 0, 1.2, 0.05);
    s.rotation.x = f.rotation.x = -0.45;
    f.position.set(0, 1.213, 0.046);
    g.add(s, f);
  },
  sofa(g) {
    const c = mat(['#4f6d8f', '#8a5a6e', '#5f8a6b'][(rnd() * 3) | 0]);
    g.add(box(2, 0.42, 0.9, c, 0, 0.26, 0), box(2, 0.5, 0.22, c, 0, 0.68, -0.34), box(0.2, 0.3, 0.9, c, -0.9, 0.55, 0), box(0.2, 0.3, 0.9, c, 0.9, 0.55, 0));
  },
  plant(g) {
    g.add(cyl(0.22, 0.16, 0.36, mat('#b5654a'), 0, 0.18, 0));
    const leaf = mat('#3f9b62');
    [[0, 0.62, 0, 0.3], [0.12, 0.92, 0.05, 0.24], [-0.1, 1.12, -0.04, 0.19]].forEach(([x, y, z, r]) => {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), leaf);
      m.position.set(x, y, z); m.castShadow = true; g.add(m);
    });
  },
  fridge(g, p) {
    g.add(box(0.8, 1.9, 0.8, mat('#dfe4ea'), 0, 0.95, 0), box(0.04, 0.5, 0.04, mat('#8b93a1'), 0.3, 1.2, 0.42));
    if (p.smart) g.add(box(0.32, 0.22, 0.012, glow('#7cf2c0', 1), -0.12, 1.45, 0.407));
  },
  shelf(g) {
    g.add(box(0.06, 1.9, 0.6, mat('#5a6170'), -0.97, 0.95, 0), box(0.06, 1.9, 0.6, mat('#5a6170'), 0.97, 0.95, 0));
    for (let i = 0; i < 4; i++) {
      g.add(box(1.94, 0.05, 0.6, mat('#7d8494'), 0, 0.25 + i * 0.52, 0));
      for (let k = 0; k < 3; k++) if (rnd() < 0.75) g.add(box(0.4, 0.3, 0.4, mat(['#c9a36a', '#8fa3bf', '#b8b0a2', '#d98f6b'][(rnd() * 4) | 0]), -0.6 + k * 0.6, 0.43 + i * 0.52, 0));
    }
  },
  car(g, p) {
    g.add(box(1.9, 0.6, 4.0, mat(p.tint), 0, 0.6, 0), box(1.65, 0.5, 2.0, mat('#1e2733'), 0, 1.12, -0.1));
    [[-0.95, 1.25], [0.95, 1.25], [-0.95, -1.25], [0.95, -1.25]].forEach(([x, z]) => {
      const w = cyl(0.33, 0.33, 0.24, mat('#15171c'), x, 0.33, z); w.rotation.z = Math.PI / 2; g.add(w);
    });
  },
  stall(g) {
    const c = mat('#8fa9b5');
    g.add(box(1.2, 1.9, 0.05, c, 0, 0.95, -0.72), box(1.2, 1.9, 0.05, c, 0, 0.95, 0.72), box(0.05, 1.7, 1.3, mat('#a9c0ca'), -0.58, 0.95, 0));
    g.add(box(0.4, 0.42, 0.5, mat('#f4f6f8'), 0.3, 0.21, 0));
  },
  board(g) {
    g.add(box(0.05, 1.9, 0.05, mat('#5a6170'), -0.95, 0.95, 0), box(0.05, 1.9, 0.05, mat('#5a6170'), 0.95, 0.95, 0));
    g.add(box(2, 1.15, 0.05, mat('#f7f8fa'), 0, 1.35, 0));
    for (let i = 0; i < 9; i++) {
      g.add(box(0.2, 0.2, 0.012, mat(['#ffd45e', '#ff8f7a', '#7fd8c9', '#b9a2ff'][(rnd() * 4) | 0]), -0.72 + (i % 3) * 0.72 + rnd() * 0.12, 1.02 + ((i / 3) | 0) * 0.3, 0.032));
    }
  },
  vending(g) {
    g.add(box(1, 1.9, 0.8, mat('#b8433d'), 0, 0.95, 0), box(0.62, 1.2, 0.012, glow('#ffe6b0', 0.8), -0.12, 1.15, 0.407));
  },
  pingpong(g) {
    g.add(box(2.7, 0.06, 1.5, mat('#2f7d5a'), 0, 0.76, 0), box(0.02, 0.15, 1.5, mat('#f4f6f8'), 0, 0.86, 0));
    [[-1.15, -0.6], [1.15, -0.6], [-1.15, 0.6], [1.15, 0.6]].forEach(([x, z]) => g.add(box(0.07, 0.73, 0.07, mat('#3a4050'), x, 0.365, z)));
  },
  recep(g) {
    g.add(box(4, 1.05, 1, mat('#f1ece2'), 0, 0.525, 0), box(4.1, 0.06, 1.1, mat('#6b4f3a'), 0, 1.08, 0));
    g.add(box(2.2, 0.26, 0.012, glow('#ff8a4c', 1.1), 0, 0.62, 0.507));
  },
  table(g, p) {
    const [w, d] = [p.bw, p.bd];
    g.add(box(w, 0.07, d, mat('#c9b08a'), 0, 0.74, 0));
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => g.add(box(0.08, 0.7, 0.08, mat('#3a4050'), sx * (w / 2 - 0.15), 0.35, sz * (d / 2 - 0.15))));
    if (p.stools) [[-0.5, -1], [0.5, -1], [-0.5, 1], [0.5, 1]].forEach(([x, s]) => g.add(cyl(0.2, 0.2, 0.46, mat('#e07a4d'), x, 0.23, s * (d / 2 + 0.38))));
  },
  counter(g, p) {
    const w = p.bw;
    g.add(box(w, 0.9, 0.7, mat('#55607a'), 0, 0.45, 0), box(w + 0.04, 0.05, 0.74, mat('#e6e1d8'), 0, 0.925, 0));
    if (p.coffee) {
      g.add(box(0.5, 0.52, 0.42, mat('#2a2e38'), 0.5, 1.21, 0), box(0.3, 0.1, 0.012, glow('#ffb35c', 1.2), 0.5, 1.36, 0.213));
      g.add(cyl(0.05, 0.045, 0.09, mat('#ffffff'), 0.5, 1.0, 0.25));
    }
  },
  screen(g) {
    g.add(box(3, 1.3, 0.06, mat('#161a24'), 0, 1.6, 0), box(2.84, 1.14, 0.012, glow('#3fb6ff', 0.75), 0, 1.6, 0.035));
  },
};

function floorLabel(text) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 96;
  const x = c.getContext('2d');
  x.font = '700 54px "Chakra Petch", "Trebuchet MS", sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = 'rgba(20,24,40,0.42)';
  x.fillText(text.toUpperCase(), 256, 50);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 0.98), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  return m;
}

export function buildWorld(scene, map, nav) {
  seed = 7;
  const fx = { leds: [glow('#5dff9b', 1.4), glow('#58e0ff', 1.4), glow('#ffb35c', 1.4)], walls: [], markers: {} };
  const root = new THREE.Group();
  scene.add(root);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), mat('#1b2236'));
  ground.rotation.x = -Math.PI / 2; ground.position.set(32, -0.06, 24); ground.receiveShadow = true;
  root.add(ground);

  for (const r of map.rooms) {
    const f = box(r.w, 0.1, r.h, mat(r.floor, { roughness: 0.95 }), r.x + r.w / 2, -0.05, r.z + r.h / 2);
    f.castShadow = false;
    root.add(f);
    if (r.id === 'devfloor') continue;
    const l = floorLabel(r.name);
    const narrow = r.w < 7;
    if (narrow) l.scale.setScalar(r.w / 6.5);
    l.position.set(r.x + r.w / 2, 0.012, r.z + Math.min(r.h - 1.2, r.h * 0.62));
    if (r.id === 'corridor') l.position.set(20, 0.012, 20);
    root.add(l);
  }
  for (const z of map.zones) { const l = floorLabel(z.name); l.position.set(z.x + z.w / 2, 0.012, 13.6); root.add(l); }
  // parking bays
  for (let i = 0; i < 7; i++) root.add(box(0.08, 0.01, 4.4, mat('#e8e8e8'), 23.5 + i * 3.25 + (i > 3 ? 1.5 : 0), 0.01, 44.2));

  const H = map.wallHeight;
  for (const w of nav.walls) {
    const len = w.to - w.from + 0.3, mid = (w.from + w.to) / 2;
    const line = Math.max(0.25, w.at - 0.25);
    const h = w.low ? 0.7 : H;
    const m = w.low ? mat('#4d8a5b') : mat('#eceef3', { transparent: false });
    const me = w.axis === 'h' ? box(len, h, 0.3, m, mid, h / 2, line) : box(0.3, h, len, m, line, h / 2, mid);
    root.add(me);
    if (!w.low) {
      const cap = w.axis === 'h' ? box(len, 0.06, 0.34, mat('#39415a'), mid, h + 0.03, line) : box(0.34, 0.06, len, mat('#39415a'), line, h + 0.03, mid);
      cap.castShadow = false;
      root.add(cap);
      const half = w.axis === 'h' ? [len / 2, 0.15] : [0.15, len / 2];
      fx.walls.push({ mesh: me, cap, minX: me.position.x - half[0], maxX: me.position.x + half[0], minZ: me.position.z - half[1], maxZ: me.position.z + half[1], fade: 1 });
    }
  }
  for (const d of map.doors) {
    const mid = (d.from + d.to) / 2, len = d.to - d.from, line = d.at - 0.25;
    const strip = d.axis === 'h' ? box(len, 0.012, 0.5, mat('#39415a'), mid, 0.006, line) : box(0.5, 0.012, len, mat('#39415a'), line, 0.006, mid);
    strip.castShadow = false;
    root.add(strip);
  }

  for (const p of map.props) {
    const g = new THREE.Group();
    (BUILD[p.type] || (() => {}))(g, p, fx);
    g.position.set(p.x, 0, p.z);
    g.rotation.y = p.rot * Math.PI / 2;
    root.add(g);
  }

  // emergency exit at the east end of the corridor
  root.add(box(0.08, 2.0, 1.6, mat('#3f8f5a'), map.exitSign.x - 0.12, 1.0, map.exitSign.z));
  root.add(box(0.06, 0.28, 0.9, glow('#5dff9b', 1.6), map.exitSign.x - 0.14, 2.1, map.exitSign.z));

  // floating markers above stations: lit for your open tickets and for active incidents
  for (const s of map.stations) {
    const g = new THREE.Group();
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.3), new THREE.MeshBasicMaterial({ color: '#ffd45e' }));
    gem.position.y = 2.9;
    // tall light column so a ticket can be spotted from across the floor, over the walls
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 7, 16, 1, true),
      new THREE.MeshBasicMaterial({ color: '#ffd45e', transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    beam.position.y = 3.5;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.68, 32), new THREE.MeshBasicMaterial({ color: '#ffd45e', transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03;
    g.add(gem, ring, beam);
    g.visible = false;
    root.add(g);
    fx.markers[s.id] = { g, gem, ring, beam };
  }

  const hemi = new THREE.HemisphereLight('#dfe8ff', '#4a4338', 1.05);
  const sun = new THREE.DirectionalLight('#fff1dc', 1.9);
  sun.castShadow = true;
  const sm = matchMedia('(pointer: coarse)').matches ? 1024 : 2048;
  sun.shadow.mapSize.set(sm, sm);
  const sc = sun.shadow.camera;
  sc.left = -24; sc.right = 24; sc.top = 24; sc.bottom = -24; sc.near = 1; sc.far = 80;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  scene.add(hemi, sun, sun.target);
  const serverGlow = new THREE.PointLight('#4fb8ff', 14, 12); serverGlow.position.set(5, 2.2, 4);
  const secGlow = new THREE.PointLight('#58e0ff', 8, 9); secGlow.position.set(4, 2, 31.5);
  scene.add(serverGlow, secGlow);
  Object.assign(fx, { root, hemi, sun, serverGlow });
  return fx;
}

// positions station markers and stores their state for the frame update
export function placeMarkers(fx, stations) {
  for (const id in fx.markers) {
    const s = stations[id], m = fx.markers[id];
    m.g.position.set(s.fx, 0, s.fz);
    m.ring.position.set(s.x - s.fx, 0.03, s.z - s.fz);
    m.beam.position.set(s.x - s.fx, 3.5, s.z - s.fz);
  }
}
