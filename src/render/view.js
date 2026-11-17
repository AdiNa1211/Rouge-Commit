// Renderer, cameras and per-frame sync from sim state to the 3D scene.
import * as THREE from 'three';
import { buildWorld, placeMarkers } from './world.js';
import { Character } from './characters.js';
import { dist, clamp } from '../core/util.js';

export const MARK = { task: '#ffd45e', cover: '#ff6ad5', fix: '#ff5a4f' };
const angleLerp = (a, b, t) => a + (((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * t;

export class View {
  constructor(canvas) {
    this.canvas = canvas;
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }));
    this.touch = matchMedia('(pointer: coarse)').matches;
    this.ratio = Math.min(window.devicePixelRatio || 1, this.touch ? 1.25 : 1.5);
    r.setPixelRatio(this.ratio);
    this.slow = 0;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#171d2e');
    this.scene.fog = new THREE.Fog('#171d2e', 40, 95);
    this.camera = new THREE.PerspectiveCamera(46, 1, 0.3, 200);
    this.feedCam = new THREE.PerspectiveCamera(72, 1, 0.2, 120);
    this.yaw = 0; this.pitch = 0.98; this.dist = 13.5;
    this.target = new THREE.Vector3(33, 0, 24);
    this.t = 0;
    this.chars = {};
    this.effects = [];
    this.fx = null;
    this.ghost = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.9, 4, 12), new THREE.MeshBasicMaterial({ color: '#9fd8ff', transparent: true, opacity: 0.35, depthWrite: false }));
    this.ghost.position.y = 0.9;
    this.ghost.visible = false;
    this.scene.add(this.ghost);
    // floor arrow at the player's feet pointing to the nearest open ticket or incident
    this.guide = new THREE.Group();
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.6, 3), new THREE.MeshBasicMaterial({ color: '#ffd45e', depthTest: false, transparent: true, opacity: 0.95 }));
    tip.rotation.x = Math.PI / 2;
    tip.position.z = 1.25;
    tip.renderOrder = 9;
    this.guide.add(tip);
    this.guide.visible = false;
    this.scene.add(this.guide);
    this.bindInput();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    for (const c of [this.camera, this.feedCam]) { c.aspect = w / h; c.updateProjectionMatrix(); }
  }

  // one finger or mouse drag turns the camera, two fingers pinch to zoom
  bindInput() {
    const c = this.canvas, pts = new Map();
    let pinch = 0;
    c.addEventListener('pointerdown', e => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      c.setPointerCapture(e.pointerId);
      if (pts.size === 2) { const [p, q] = [...pts.values()]; pinch = Math.hypot(p.x - q.x, p.y - q.y); }
    });
    c.addEventListener('pointermove', e => {
      const prev = pts.get(e.pointerId);
      if (!prev) return;
      const cur = { x: e.clientX, y: e.clientY };
      pts.set(e.pointerId, cur);
      if (this.mode !== 'follow') return;
      if (pts.size >= 2) {
        const [p, q] = [...pts.values()], d = Math.hypot(p.x - q.x, p.y - q.y);
        if (pinch) this.dist = clamp(this.dist * (pinch / d), 6, 22);
        pinch = d;
        return;
      }
      this.yaw -= (cur.x - prev.x) * 0.006;
      this.pitch = clamp(this.pitch + (cur.y - prev.y) * 0.004, 0.5, 1.4);
    });
    const end = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = 0; };
    c.addEventListener('pointerup', end);
    c.addEventListener('pointercancel', end);
    c.addEventListener('contextmenu', e => e.preventDefault());
    c.addEventListener('wheel', e => { this.dist = clamp(this.dist + Math.sign(e.deltaY) * 1.2, 6, 22); e.preventDefault(); }, { passive: false });
  }

  // attach to a match; the office itself is built once and reused
  bind(game, attract) {
    for (const id in this.chars) {
      const g = this.chars[id].group;
      this.scene.remove(g);
      g.traverse(o => { o.geometry?.dispose(); o.material?.map?.dispose(); });
    }
    this.chars = {};
    this.off?.();
    if (!this.fx) this.fx = buildWorld(this.scene, game.map, game.nav);
    placeMarkers(this.fx, game.stations);
    this.game = game;
    this.mode = attract ? 'orbit' : 'follow';
    const h = game.human;
    for (const a of game.agents) {
      const ch = new Character(a.def);
      if (h && h.role === 'mole' && a.role === 'mole' && a !== h) ch.markDanger();
      ch.group.position.set(a.pos.x, 0, a.pos.z);
      this.scene.add(ch.group);
      this.chars[a.id] = ch;
    }
    if (h) { this.target.set(h.pos.x, 0, h.pos.z); this.yaw = 0; }
    this.off = game.bus.on('kill', ({ body }) => this.burst(body.pos));
  }

  burst(pos) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.34, 32), new THREE.MeshBasicMaterial({ color: '#7fd0ff', transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(pos.x, 0.08, pos.z);
    this.scene.add(m);
    this.effects.push({ m, t: 0 });
  }

  // camera-relative movement axes for WASD
  basis() {
    return { fx: -Math.sin(this.yaw), fz: -Math.cos(this.yaw), rx: Math.cos(this.yaw), rz: -Math.sin(this.yaw) };
  }

  seenFromFeed(cam) {
    const g = this.game, p = { x: cam.x, z: cam.z };
    return g.living().filter(a => dist(p, a.pos) < 26 && g.nav.los(p, a.pos));
  }

  update(dt, ui = {}) {
    const g = this.game, fx = this.fx;
    if (!g) return;
    this.t += dt;
    const t = this.t, h = g.human, feed = ui.feed || null;
    fx.leds.forEach((m, i) => { m.emissiveIntensity = 0.7 + 0.9 * Math.abs(Math.sin(t * (1.7 + i * 0.9) + i)); });
    const alarm = g.sabotage && g.phase === 'play' ? 0.5 + 0.5 * Math.sin(t * 6) : 0;
    fx.hemi.color.setRGB(0.87 + 0.13 * alarm, 0.91 - 0.45 * alarm, 1 - 0.55 * alarm);
    fx.hemi.intensity = g.sabotage ? 0.85 : 1.05;

    const eye = feed ? { x: feed.x, z: feed.z } : h && h.alive ? h.pos : null;
    for (const a of g.agents) {
      const ch = this.chars[a.id];
      const body = !a.alive && g.bodies.find(b => b.victim === a.id);
      const pos = a.alive ? a.pos : body ? body.pos : null;
      if (!pos) { ch.group.visible = false; continue; }
      let vis = true;
      if (this.mode !== 'orbit' && eye && !(a === h && !feed)) {
        vis = dist(eye, pos) <= (feed ? 26 : g.S.visionRange) && g.nav.los(eye, pos);
      }
      if (feed && ui.signalLost) vis = false;
      ch.group.visible = vis;
      ch.group.position.set(pos.x, 0, pos.z);
      ch.group.rotation.y = angleLerp(ch.group.rotation.y, a.facing, Math.min(1, dt * 12));
      ch.update(dt, !a.alive ? 'down' : a.activity ? 'work' : a.speed > 0.1 ? 'walk' : 'idle', a.speed, t);
    }
    const isGhost = h && !h.alive && !h.ejected && this.mode === 'follow';
    this.ghost.visible = !!isGhost && !feed;
    if (isGhost) this.ghost.position.set(h.pos.x, 0.9 + Math.sin(t * 2) * 0.06, h.pos.z);

    const marks = ui.markers || {};
    for (const id in fx.markers) {
      const m = fx.markers[id], state = marks[id];
      m.g.visible = !!state && !feed;
      if (!state) continue;
      const col = MARK[state] || MARK.task;
      m.gem.material.color.set(col); m.ring.material.color.set(col); m.beam.material.color.set(col);
      m.beam.material.opacity = 0.2 + 0.1 * Math.sin(t * 4);
      m.gem.position.y = 2.9 + Math.sin(t * 3) * 0.14;
      m.gem.rotation.y = t * 2;
      m.ring.scale.setScalar(1 + (state === 'fix' ? 0.25 : 0.1) * Math.sin(t * 5));
    }

    for (const e of this.effects) {
      e.t += dt;
      e.m.scale.setScalar(1 + e.t * 9);
      e.m.material.opacity = Math.max(0, 1 - e.t * 1.6);
      if (e.t > 0.7) this.scene.remove(e.m);
    }
    this.effects = this.effects.filter(e => e.t <= 0.7);

    const gd = ui.guide;
    this.guide.visible = !!gd && !!h && !feed && this.mode === 'follow';
    if (this.guide.visible) {
      this.guide.position.set(h.pos.x, 0.12, h.pos.z);
      this.guide.rotation.y = Math.atan2(gd.x - h.pos.x, gd.z - h.pos.z);
      this.guide.children[0].material.color.set(MARK[gd.kind] || MARK.task);
      this.guide.children[0].position.z = 1.25 + Math.sin(t * 5) * 0.08;
    }
    // drop resolution once if the machine cannot hold a steady frame rate
    this.slow = dt > 0.03 ? this.slow + dt : Math.max(0, this.slow - dt * 0.5);
    if (this.slow > 2.5 && this.ratio > 1) { this.ratio = 1; this.renderer.setPixelRatio(1); this.resize(); this.slow = 0; }

    let cam = this.camera;
    if (feed) {
      cam = this.feedCam;
      // ceiling-mounted, tilted down, panning slowly
      const dx = feed.lx - feed.x, dz = feed.lz - feed.z, d = Math.hypot(dx, dz), pan = Math.sin(t * 0.3) * 1.6;
      cam.position.set(feed.x, 4.1, feed.z);
      cam.lookAt(feed.x + (dx / d) * 7.5 - (dz / d) * pan, 0, feed.z + (dz / d) * 7.5 + (dx / d) * pan);
      this.fadeWalls(null, dt);
    } else {
      if (this.mode === 'orbit') {
        this.yaw += dt * 0.04;
        this.target.lerp(new THREE.Vector3(33 + Math.sin(t * 0.05) * 14, 0, 19), Math.min(1, dt));
        this.pitch = 0.82; this.dist = 30;
      } else if (h) {
        this.target.lerp(new THREE.Vector3(h.pos.x, 0, h.pos.z), Math.min(1, dt * 18));
      }
      const cp = Math.cos(this.pitch) * this.dist;
      cam.position.set(this.target.x + Math.sin(this.yaw) * cp, Math.sin(this.pitch) * this.dist + 1.1, this.target.z + Math.cos(this.yaw) * cp);
      cam.lookAt(this.target.x, 1.1, this.target.z);
      this.fadeWalls(this.mode === 'follow' ? cam.position : null, dt);
    }
    fx.sun.position.set(this.target.x - 11, 28, this.target.z + 9);
    fx.sun.target.position.copy(this.target);
    this.renderer.render(this.scene, cam);
  }

  // walls between the camera and the player go see-through
  fadeWalls(camPos, dt) {
    const tx = this.target.x, tz = this.target.z;
    for (const w of this.fx.walls) {
      let want = 1;
      if (camPos) {
        const dx = tx - camPos.x, dz = tz - camPos.z;
        let t0 = 0, t1 = 0.97, hit = true;
        for (const [o, d, lo, hi] of [[camPos.x, dx, w.minX - 0.4, w.maxX + 0.4], [camPos.z, dz, w.minZ - 0.4, w.maxZ + 0.4]]) {
          if (Math.abs(d) < 1e-6) { if (o < lo || o > hi) hit = false; continue; }
          let a = (lo - o) / d, b = (hi - o) / d;
          if (a > b) [a, b] = [b, a];
          t0 = Math.max(t0, a); t1 = Math.min(t1, b);
          if (t0 > t1) hit = false;
        }
        // only the part of the ray below wall height matters
        if (hit && camPos.y * (1 - t0) < this.game.map.wallHeight + 0.4) want = 0.16;
      }
      if (Math.abs(w.fade - want) < 0.01) continue;
      w.fade += (want - w.fade) * Math.min(1, dt * 10);
      const m = w.mesh.material, tr = w.fade < 0.98;
      if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; }
      m.opacity = w.fade;
      w.mesh.castShadow = w.fade > 0.6;
      w.cap.visible = w.fade > 0.5;
    }
  }
}
