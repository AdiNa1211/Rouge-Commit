// Stylised office characters built from primitives, driven by the sim's agent state.
import * as THREE from 'three';
import { mat } from './world.js';

const mesh = (geo, m, x = 0, y = 0, z = 0) => {
  const me = new THREE.Mesh(geo, m);
  me.position.set(x, y, z);
  me.castShadow = true;
  return me;
};

function hair(style, color, head) {
  const m = mat(color);
  const cap = (r = 0.285, theta = 1.3) => mesh(new THREE.SphereGeometry(r, 18, 12, 0, Math.PI * 2, 0, theta), m);
  if (style === 'bald') {
    return head.add(mesh(new THREE.SphereGeometry(0.1, 8, 8), m, -0.23, 0.02, -0.1), mesh(new THREE.SphereGeometry(0.1, 8, 8), m, 0.23, 0.02, -0.1));
  }
  if (style === 'beanie') {
    head.add(cap(0.292, 1.25), mesh(new THREE.TorusGeometry(0.275, 0.045, 8, 22), m, 0, 0.07, 0));
    head.children.at(-1).rotation.x = Math.PI / 2;
    return head.add(mesh(new THREE.SphereGeometry(0.06, 8, 8), mat('#f4f6f8'), 0, 0.31, 0));
  }
  const c = cap();
  c.rotation.x = -0.38;
  head.add(c);
  if (style === 'long') head.add(mesh(new THREE.BoxGeometry(0.46, 0.5, 0.16), m, 0, -0.16, -0.2));
  if (style === 'bob') {
    const b = mesh(new THREE.SphereGeometry(0.29, 16, 12), m, 0, -0.04, -0.07);
    b.scale.set(1.06, 0.95, 0.95);
    head.add(b);
  }
  if (style === 'bun') head.add(mesh(new THREE.SphereGeometry(0.12, 10, 10), m, 0, 0.26, -0.14));
  if (style === 'puffs') head.add(mesh(new THREE.SphereGeometry(0.15, 10, 10), m, -0.24, 0.2, -0.04), mesh(new THREE.SphereGeometry(0.15, 10, 10), m, 0.24, 0.2, -0.04));
  if (style === 'spiky') for (let i = 0; i < 5; i++) {
    const s = mesh(new THREE.ConeGeometry(0.07, 0.2, 6), m, -0.16 + i * 0.08, 0.27, 0.02 - Math.abs(i - 2) * 0.03);
    s.rotation.z = (2 - i) * 0.22;
    head.add(s);
  }
}

function accessory(acc, head, body) {
  const dark = mat('#1b1e26');
  if (acc === 'glasses') {
    for (const x of [-0.1, 0.1]) head.add(mesh(new THREE.TorusGeometry(0.065, 0.014, 6, 16), dark, x, 0.02, 0.255));
    head.add(mesh(new THREE.BoxGeometry(0.07, 0.014, 0.014), dark, 0, 0.02, 0.26));
  } else if (acc === 'headphones') {
    const band = mesh(new THREE.TorusGeometry(0.3, 0.025, 6, 20, Math.PI), dark, 0, 0.02, 0);
    head.add(band);
    for (const x of [-0.3, 0.3]) { const e = mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.07, 12), mat('#e8483f'), x, 0, 0); e.rotation.z = Math.PI / 2; head.add(e); }
  } else if (acc === 'beard') {
    head.add(mesh(new THREE.SphereGeometry(0.2, 12, 10, 0, Math.PI * 2, 1.7, 1.3), mat('#1d1512'), 0, 0.02, 0.09));
  } else if (acc === 'earrings') {
    for (const x of [-0.27, 0.27]) head.add(mesh(new THREE.SphereGeometry(0.035, 8, 8), mat('#f2c230', { metalness: 0.6, roughness: 0.3 }), x, -0.1, 0));
  } else if (acc === 'tie') {
    body.add(mesh(new THREE.BoxGeometry(0.08, 0.34, 0.02), mat('#a12b3a'), 0, 0.95, 0.27));
  }
}

function nameTag(name, color, danger) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const x = c.getContext('2d');
  x.font = '700 30px "Chakra Petch", "Trebuchet MS", sans-serif';
  const w = Math.min(240, x.measureText(name).width + 62);
  x.fillStyle = danger ? 'rgba(120,18,30,0.92)' : 'rgba(16,20,34,0.82)';
  x.beginPath(); x.roundRect((256 - w) / 2, 8, w, 48, 24); x.fill();
  x.fillStyle = color;
  x.beginPath(); x.arc((256 - w) / 2 + 24, 32, 10, 0, 7); x.fill();
  x.fillStyle = '#fff';
  x.textBaseline = 'middle';
  x.fillText(name, (256 - w) / 2 + 42, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.scale.set(1.7, 0.425, 1);
  s.position.y = 2.2;
  s.renderOrder = 10;
  return s;
}

export class Character {
  constructor(def) {
    this.def = def;
    const { look } = def;
    const g = (this.group = new THREE.Group());
    const rig = (this.rig = new THREE.Group());
    g.add(rig);
    const shirt = mat(def.color), skin = mat(look.skin), pants = mat('#2c3246');

    const body = (this.body = new THREE.Group());
    body.add(mesh(new THREE.CapsuleGeometry(0.27, 0.32, 4, 14), shirt, 0, 0.9, 0));
    body.add(mesh(new THREE.BoxGeometry(0.1, 0.13, 0.02), mat('#f4f6f8'), 0.1, 0.86, 0.265)); // staff badge
    rig.add(body);

    const limb = (x, y, len, m, r) => {
      const p = new THREE.Group();
      p.position.set(x, y, 0);
      p.add(mesh(new THREE.CapsuleGeometry(r, len, 3, 8), m, 0, -len / 2 - r * 0.4, 0));
      rig.add(p);
      return p;
    };
    this.legL = limb(-0.13, 0.56, 0.34, pants, 0.1);
    this.legR = limb(0.13, 0.56, 0.34, pants, 0.1);
    this.armL = limb(-0.36, 1.12, 0.3, shirt, 0.075);
    this.armR = limb(0.36, 1.12, 0.3, shirt, 0.075);
    for (const a of [this.armL, this.armR]) a.add(mesh(new THREE.SphereGeometry(0.08, 8, 8), skin, 0, -0.44, 0));
    for (const l of [this.legL, this.legR]) l.add(mesh(new THREE.BoxGeometry(0.17, 0.09, 0.27), mat('#f1ece2'), 0, -0.52, 0.04));

    const head = (this.head = new THREE.Group());
    head.position.y = 1.5;
    head.add(mesh(new THREE.SphereGeometry(0.27, 20, 16), skin));
    for (const x of [-0.1, 0.1]) head.add(mesh(new THREE.SphereGeometry(0.032, 8, 8), mat('#15171c'), x, 0.02, 0.245));
    hair(look.style, look.hair, head);
    accessory(look.acc, head, body);
    rig.add(head);

    // dropped laptop with a crash screen, shown beside a downed colleague
    this.crash = new THREE.Group();
    this.crash.add(mesh(new THREE.BoxGeometry(0.42, 0.03, 0.3), mat('#2a2e38'), 0.55, 0.02, 0.2));
    const scr = mesh(new THREE.BoxGeometry(0.42, 0.28, 0.02), mat('#0c1220', { emissive: '#2f6bff', emissiveIntensity: 1.6 }), 0.55, 0.15, 0.05);
    scr.rotation.x = -0.3;
    this.crash.add(scr);
    this.crash.visible = false;
    g.add(this.crash);

    this.tag = nameTag(def.name, def.color, false);
    g.add(this.tag);
    this.phase = Math.random() * 6;
    this.down = 0;
  }

  markDanger() {
    this.group.remove(this.tag);
    this.tag = nameTag(this.def.name, this.def.color, true);
    this.group.add(this.tag);
  }

  // pose: 'walk' | 'work' | 'idle' | 'down'
  update(dt, pose, speed, t) {
    const down = pose === 'down';
    this.down += ((down ? 1 : 0) - this.down) * Math.min(1, dt * 8);
    this.rig.rotation.x = -this.down * Math.PI / 2;
    this.rig.position.y = this.down * 0.28;
    this.rig.position.z = this.down * 0.8;
    this.crash.visible = down;
    this.tag.position.y = 2.2 - this.down * 1.3;
    let leg = 0, arm = 0, bob = 0, reach = 0;
    if (pose === 'walk') {
      this.phase += dt * speed * 2.6;
      leg = Math.sin(this.phase) * 0.75;
      arm = -leg * 0.8;
      bob = Math.abs(Math.cos(this.phase)) * 0.05;
    } else if (pose === 'work') {
      reach = -1.15;
      arm = Math.sin(t * 14 + this.phase) * 0.08;
      bob = Math.sin(t * 2 + this.phase) * 0.01;
    } else if (!down) bob = Math.sin(t * 2 + this.phase) * 0.012;
    const k = Math.min(1, dt * 14);
    this.legL.rotation.x += (leg - this.legL.rotation.x) * k;
    this.legR.rotation.x += (-leg - this.legR.rotation.x) * k;
    this.armL.rotation.x += (reach + arm - this.armL.rotation.x) * k;
    this.armR.rotation.x += (reach - arm - this.armR.rotation.x) * k;
    this.body.position.y = bob;
    this.head.position.y = 1.5 + bob;
    this.head.rotation.x = pose === 'work' ? 0.18 : 0;
  }
}
