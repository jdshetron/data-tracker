// 3D models and 3D charts for the site, built from Three.js primitives (no model files).
//
//   hero(canvas, items)            film set: retro TV (its screen shows today's top titles),
//                                  film reels, clapperboard, popcorn and a scrolling film strip
//   barGrid(canvas, tooltip, rows) a 3D bar chart (one row of bars per group) you can rotate

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const C = {
  gold: 0xffc94d, cyan: 0x4cc9f0, red: 0xe63946, cream: 0xfff4e0,
  up: 0x4ade80, down: 0xfb7185, flat: 0x8b8798, ink: 0x0d0c12,
};
const CAT_COLOR = { TV: C.cyan, Movie: C.gold };

export function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch { return false; }
}

// ---------------------------------------------------------------- shared helpers

function setup(canvas, fov = 38) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 200);
  return { renderer, scene, camera };
}

function resize(renderer, camera, canvas) {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return false;
  const pr = renderer.getPixelRatio();
  if (canvas.width !== Math.round(w * pr) || canvas.height !== Math.round(h * pr)) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    return true;
  }
  return false;
}

// Render loop that pauses while the canvas is off screen.
function run(canvas, renderer, scene, camera, tick) {
  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);
  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    if (!visible) return;
    const resized = resize(renderer, camera, canvas);
    tick(REDUCED ? 0 : clock.getElapsedTime(), resized);
    renderer.render(scene, camera);
  });
}

function canvasTexture(w, h, draw) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { tex, ctx, canvas: c };
}

function textSprite(text, { px = 64, color = "#ffc94d", font = "Bebas Neue", height = 0.45 } = {}) {
  const measure = document.createElement("canvas").getContext("2d");
  measure.font = `${px}px "${font}", sans-serif`;
  const w = Math.ceil(measure.measureText(text).width) + 24, h = Math.ceil(px * 1.3);
  const { tex } = canvasTexture(w, h, ctx => {
    ctx.font = `${px}px "${font}", sans-serif`;
    ctx.fillStyle = color;
    ctx.textBaseline = "middle";
    ctx.shadowColor = color; ctx.shadowBlur = 12;
    ctx.fillText(text, 12, h / 2);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(height * w / h, height, 1);
  return s;
}

const metal = (color = 0xc3c7d1, rough = 0.28) => new THREE.MeshStandardMaterial({ color, metalness: 0.9, roughness: rough });
const plastic = (color, rough = 0.45) => new THREE.MeshStandardMaterial({ color, metalness: 0.1, roughness: rough });

// ---------------------------------------------------------------- the models

function filmReel() {
  const g = new THREE.Group();
  const inner = new THREE.Group();
  inner.rotation.x = Math.PI / 2;            // build flat, then face the camera
  const plateMat = metal(0xc9ccd6, 0.22);
  const dark = plastic(0x15131c, 0.6);
  for (const y of [-0.07, 0.07]) {
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.035, 72), plateMat);
    plate.position.y = y;
    inner.add(plate);
    for (let i = 0; i < 6; i++) {          // the cut-outs
      const a = (i / 6) * Math.PI * 2;
      const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 32), dark);
      hole.position.set(Math.cos(a) * 0.58, y, Math.sin(a) * 0.58);
      inner.add(hole);
    }
  }
  const film = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.12, 48), plastic(0x2a1c14, 0.35));
  inner.add(film);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.24, 24), metal(0x8a8f9c));
  inner.add(hub);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 12, 96), plateMat);
  rim.rotation.x = Math.PI / 2;
  inner.add(rim);
  g.add(inner);
  return g;
}

function clapperboard() {
  const g = new THREE.Group();
  const stripes = canvasTexture(256, 64, (ctx, w, h) => {
    ctx.fillStyle = "#111"; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#f5f5f0";
    for (let x = -h; x < w + h; x += 64) {
      ctx.beginPath(); ctx.moveTo(x, h); ctx.lineTo(x + 32, h); ctx.lineTo(x + 32 + h, 0); ctx.lineTo(x + h, 0); ctx.fill();
    }
  }).tex;
  const today = new Date().toISOString().slice(0, 10);
  const slate = canvasTexture(512, 320, (ctx, w, h) => {
    ctx.fillStyle = "#23222a"; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.lineWidth = 4;
    ctx.strokeRect(14, 14, w - 28, h - 28);
    [[14, 110, w - 14, 110], [14, 210, w - 14, 210], [w / 2, 110, w / 2, 210]].forEach(([a, b, c2, d]) => {
      ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c2, d); ctx.stroke();
    });
    ctx.fillStyle = "rgba(255,255,255,.9)";
    ctx.font = '54px "Bebas Neue", sans-serif';
    ctx.fillText("TV & MOVIE TRACKER", 34, 84);
    ctx.font = '30px "Bebas Neue", sans-serif';
    ctx.fillText("SCENE", 34, 140); ctx.fillText("TAKE", w / 2 + 20, 140);
    ctx.fillText(`DATE  ${today}`, 34, 260);
    ctx.font = '58px "Bebas Neue", sans-serif';
    ctx.fillStyle = "#ffc94d";
    ctx.fillText("001", 110, 196); ctx.fillText("DAILY", w / 2 + 110, 196);
  }).tex;

  const body = new THREE.Mesh(new RoundedBoxGeometry(1.6, 1.05, 0.08, 2, 0.03), plastic(0x23222a, 0.7));
  g.add(body);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.52, 0.95), new THREE.MeshStandardMaterial({ map: slate, roughness: 0.9 }));
  face.position.z = 0.041;
  g.add(face);
  const stripeMat = new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.5 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.2, 0.09), stripeMat);
  base.position.y = 0.625;
  g.add(base);
  const pivot = new THREE.Group();            // hinge at the top-left corner
  pivot.position.set(-0.8, 0.735, 0);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.2, 0.09), stripeMat);
  arm.position.set(0.8, 0.1, 0);
  pivot.add(arm);
  g.add(pivot);
  const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 16), metal());
  hinge.rotation.x = Math.PI / 2;
  hinge.position.set(-0.78, 0.735, 0);
  g.add(hinge);
  g.userData.arm = pivot;
  return g;
}

function popcorn() {
  const g = new THREE.Group();
  const stripes = canvasTexture(256, 32, (ctx, w, h) => {
    for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? "#fff4e0" : "#e63946"; ctx.fillRect(i * 32, 0, 32, h); }
  }).tex;
  stripes.wrapS = THREE.RepeatWrapping;
  stripes.repeat.x = 2;
  const bucket = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.4, 1.05, 40, 1, true),
    new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.55, side: THREE.DoubleSide }));
  g.add(bucket);
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.4, 40), plastic(0xe63946));
  bottom.rotation.x = Math.PI / 2; bottom.position.y = -0.525;
  g.add(bottom);
  const kernelGeo = new THREE.IcosahedronGeometry(1, 0);
  const kernelMat = new THREE.MeshStandardMaterial({ color: 0xfff1cf, roughness: 0.85, flatShading: true });
  const rand = mulberry(7);
  for (let i = 0; i < 70; i++) {
    const k = new THREE.Mesh(kernelGeo, kernelMat);
    const r = Math.sqrt(rand()) * 0.5, a = rand() * Math.PI * 2;
    k.position.set(Math.cos(a) * r, 0.5 + rand() * 0.28 * (1 - r), Math.sin(a) * r);
    k.scale.setScalar(0.07 + rand() * 0.06);
    k.rotation.set(rand() * 3, rand() * 3, rand() * 3);
    g.add(k);
  }
  return g;
}

function screenTexture() {
  const W = 512, H = 384;
  const { tex, ctx } = canvasTexture(W, H, () => {});
  function draw({ kicker, title, value, change, up }) {
    const grd = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W * 0.7);
    grd.addColorStop(0, "#0f3b4d"); grd.addColorStop(1, "#02090d");
    ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.fillStyle = "#4cc9f0"; ctx.font = '38px "Bebas Neue", sans-serif';
    ctx.fillText(kicker, W / 2, 76);
    let size = 96;
    ctx.font = `${size}px "Bebas Neue", sans-serif`;
    while (ctx.measureText(title).width > W - 60 && size > 40) { size -= 4; ctx.font = `${size}px "Bebas Neue", sans-serif`; }
    ctx.fillStyle = "#ffffff"; ctx.shadowColor = "#4cc9f0"; ctx.shadowBlur = 18;
    ctx.fillText(title, W / 2, 180);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ffc94d"; ctx.font = '600 44px "Inter", sans-serif';
    ctx.fillText(value, W / 2, 252);
    if (change) {
      ctx.fillStyle = up ? "#4ade80" : "#fb7185"; ctx.font = '600 34px "Inter", sans-serif';
      ctx.fillText(change, W / 2, 304);
    }
    ctx.fillStyle = "rgba(0,0,0,.22)";
    for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 2);   // scanlines
    tex.needsUpdate = true;
  }
  return { tex, draw };
}

function retroTV(screen) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new RoundedBoxGeometry(2.1, 1.55, 1.15, 4, 0.16), plastic(0x7a1f2b, 0.38));
  g.add(body);
  const bezel = new THREE.Mesh(new RoundedBoxGeometry(1.5, 1.14, 0.1, 3, 0.08), plastic(0x14121a, 0.5));
  bezel.position.set(-0.22, 0, 0.56);
  g.add(bezel);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.36, 1.02),
    new THREE.MeshBasicMaterial({ map: screen.tex, toneMapped: false }));
  glass.position.set(-0.22, 0, 0.615);
  g.add(glass);
  const panel = new THREE.Mesh(new RoundedBoxGeometry(0.38, 1.14, 0.06, 2, 0.04), plastic(0x2b2733, 0.6));
  panel.position.set(0.78, 0, 0.56);
  g.add(panel);
  for (const y of [0.3, -0.05]) {
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.1, 24), metal(0xd4b26a, 0.3));
    knob.rotation.x = Math.PI / 2; knob.position.set(0.78, y, 0.63);
    g.add(knob);
  }
  for (let i = 0; i < 4; i++) {               // speaker grille
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.025, 0.02), plastic(0x0d0c12));
    slot.position.set(0.78, -0.3 - i * 0.07, 0.6);
    g.add(slot);
  }
  for (const s of [-1, 1]) {                  // rabbit-ear antennas
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.1, 8), metal());
    rod.position.set(s * 0.32, 1.22, 0);
    rod.rotation.z = -s * 0.5;
    g.add(rod);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 16), metal(0xd4b26a));
    tip.position.set(s * 0.58, 1.7, 0);
    g.add(tip);
  }
  const mount = new THREE.Mesh(new THREE.SphereGeometry(0.14, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), metal(0x8a8f9c));
  mount.position.y = 0.77;
  g.add(mount);
  for (const x of [-0.75, 0.75]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.025, 0.4, 8), metal(0x8a8f9c));
    leg.position.set(x, -0.95, 0.25); leg.rotation.x = 0.25;
    g.add(leg);
  }
  const glow = new THREE.PointLight(C.cyan, 1.6, 4, 2);
  glow.position.set(-0.2, 0, 1.2);
  g.add(glow);
  return g;
}

function filmStrip() {
  const film = canvasTexture(512, 128, (ctx, w, h) => {
    ctx.fillStyle = "#0b0a0f"; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#f2efe6";
    for (let x = 6; x < w; x += 32) { ctx.fillRect(x, 8, 18, 14); ctx.fillRect(x, h - 22, 18, 14); }
    const tints = [["#ffc94d", "#e76f51"], ["#4cc9f0", "#3a0ca3"], ["#e63946", "#ffb4a2"], ["#80ed99", "#1b4332"]];
    tints.forEach(([a, b], i) => {
      const x = 8 + i * 126, g = ctx.createLinearGradient(x, 30, x + 112, h - 30);
      g.addColorStop(0, a); g.addColorStop(1, b);
      ctx.fillStyle = g; ctx.fillRect(x, 32, 112, h - 64);
    });
  }).tex;
  film.wrapS = THREE.RepeatWrapping;
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-7, 2.6, -3.5), new THREE.Vector3(-3.5, 1.2, -2.6), new THREE.Vector3(-0.5, 2.4, -3.2),
    new THREE.Vector3(2.5, 0.2, -2.4), new THREE.Vector3(5, -1.8, -3), new THREE.Vector3(8, -2.4, -3.6),
  ]);
  const segs = 220, width = 0.62, pos = [], uv = [], idx = [];
  const z = new THREE.Vector3(0, 0, 1), side = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, p = curve.getPointAt(t), tan = curve.getTangentAt(t);
    side.crossVectors(tan, z).normalize();
    const twist = Math.sin(t * Math.PI * 2) * 0.5;
    side.applyAxisAngle(tan, twist);
    pos.push(p.x + side.x * width / 2, p.y + side.y * width / 2, p.z + side.z * width / 2,
      p.x - side.x * width / 2, p.y - side.y * width / 2, p.z - side.z * width / 2);
    uv.push(t * 9, 1, t * 9, 0);
    if (i < segs) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
    map: film, emissiveMap: film, emissive: 0xffffff, emissiveIntensity: 0.45, roughness: 0.5, side: THREE.DoubleSide,
  }));
  mesh.userData.tex = film;
  return mesh;
}

function dust(count = 260) {
  const rand = mulberry(3), pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (rand() - 0.5) * 14; pos[i * 3 + 1] = (rand() - 0.5) * 7; pos[i * 3 + 2] = -4 + rand() * 6;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({
    color: C.gold, size: 0.035, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
}

function mulberry(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

// ---------------------------------------------------------------- hero scene

/**
 * @param canvas  the <canvas> to draw in
 * @param items   optional promise of [{title, value, change, up}] for the TV screen to cycle through
 */
export async function hero(canvas, items) {
  if (!webglAvailable()) { canvas.closest(".hero-stage")?.classList.add("no-3d"); return; }
  await document.fonts.ready;
  const { renderer, scene, camera } = setup(canvas, 36);
  camera.position.set(0, 0.2, 9);

  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const key = new THREE.SpotLight(C.gold, 60, 0, Math.PI / 5, 0.6, 1.6);
  key.position.set(-4, 6, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(C.cyan, 1.4);
  rim.position.set(5, 2, -3);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffffff, 0.6);
  fill.position.set(2, 3, 5);
  scene.add(fill);

  const rig = new THREE.Group();
  scene.add(rig);
  const screen = screenTexture();
  screen.draw({ kicker: "NOW TRACKING", title: "TV & MOVIES", value: "daily page views", change: "" });

  const tv = retroTV(screen);
  tv.position.set(0, -0.15, 0); tv.rotation.y = -0.22;
  const reel = filmReel(); reel.position.set(2.75, 1.25, -1.2); reel.rotation.y = -0.35;
  const reel2 = filmReel(); reel2.scale.setScalar(0.62); reel2.position.set(-2.7, 1.5, -1.6); reel2.rotation.y = 0.4;
  const clap = clapperboard(); clap.scale.setScalar(0.85); clap.position.set(2.45, -1.15, 0.9); clap.rotation.set(0, -0.45, 0.08);
  const corn = popcorn(); corn.scale.setScalar(0.95); corn.position.set(-2.45, -1.0, 0.7); corn.rotation.z = -0.08;
  const strip = filmStrip();
  rig.add(tv, reel, reel2, clap, corn, strip);
  scene.add(dust());
  const floaters = [[tv, 0, 0.06], [reel, 1.3, 0.1], [reel2, 2.1, 0.12], [clap, 0.7, 0.08], [corn, 2.8, 0.09]];
  floaters.forEach(([o]) => { o.userData.y0 = o.position.y; });

  let px = 0, py = 0;
  window.addEventListener("pointermove", e => {
    px = e.clientX / window.innerWidth - 0.5; py = e.clientY / window.innerHeight - 0.5;
  }, { passive: true });

  // TV screen: cycle through today's top titles
  let list = [], idx = 0, lastSwap = -10;
  Promise.resolve(items).then(v => { list = v || []; }).catch(() => {});

  run(canvas, renderer, scene, camera, (t, resized) => {
    if (resized) camera.position.z = camera.aspect < 1.15 ? 11.5 : camera.aspect < 1.5 ? 9.2 : 7.8;
    floaters.forEach(([o, phase, amp]) => { o.position.y = o.userData.y0 + Math.sin(t * 1.1 + phase) * amp; });
    reel.children[0].rotation.y = t * 0.9;
    reel2.children[0].rotation.y = -t * 1.3;
    const phase = t % 4;                       // clapper: snap shut, then slowly open again
    clap.userData.arm.rotation.z = REDUCED ? 0.35 : phase < 0.12 ? 0.45 * (1 - phase / 0.12) : phase < 1.4 ? 0 : 0.45 * Math.min(1, (phase - 1.4) / 0.8);
    strip.userData.tex.offset.x = -t * 0.08;
    rig.rotation.y += (px * 0.35 - rig.rotation.y) * 0.05;
    rig.rotation.x += (py * 0.15 - rig.rotation.x) * 0.05;
    if (list.length && (t - lastSwap > 3.2 || lastSwap < 0)) {
      lastSwap = t;
      screen.draw(list[idx % list.length]);
      idx++;
    }
  });
}

// ---------------------------------------------------------------- 3D bar chart

/**
 * rows: [{ label, bars: [{ label, value, category, detail, change }] }]
 * Each row is a line of bars on the floor; height is proportional to value.
 * Hovering (or tapping) a bar shows its detail in `tooltip`.
 */
export async function barGrid(canvas, tooltip, rows, { maxHeight = 4, spacing = 0.95, rowGap = 1.7, rowLabelColor = "#ffc94d", sqrt = false } = {}) {
  const scaleOf = v => (sqrt ? Math.sqrt(v) : v);
  if (!webglAvailable()) { canvas.closest(".stage")?.classList.add("no-3d"); return; }
  await document.fonts.ready;
  const { renderer, scene, camera } = setup(canvas, 40);
  renderer.toneMapping = THREE.NoToneMapping;   // keep the category colours saturated
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));
  const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(-5, 9, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(C.cyan, 0.6); rim.position.set(6, 4, -6); scene.add(rim);
  const warm = new THREE.PointLight(C.gold, 18, 0, 2); warm.position.set(0, 6, 4); scene.add(warm);

  const all = rows.flatMap(r => r.bars);
  const max = Math.max(1, ...all.map(b => scaleOf(b.value || 0)));
  const cols = Math.max(...rows.map(r => r.bars.length));
  const W = (cols - 1) * spacing, D = (rows.length - 1) * rowGap;

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W + 6, D + 5),
    new THREE.MeshStandardMaterial({ color: 0x0c0b12, roughness: 0.9, metalness: 0, envMapIntensity: 0.2 }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const grid = new THREE.GridHelper(Math.max(W, D) + 6, Math.round(Math.max(W, D) + 6), C.gold, 0x2a2633);
  grid.material.transparent = true; grid.material.opacity = 0.18; grid.position.y = 0.002;
  scene.add(grid);

  const geo = new RoundedBoxGeometry(0.66, 1, 0.66, 2, 0.06);
  geo.translate(0, 0.5, 0);
  const capGeo = new THREE.BoxGeometry(0.7, 0.045, 0.7);
  const bars = [];
  rows.forEach((row, r) => {
    const z = -D / 2 + r * rowGap;
    const label = textSprite(row.label, { color: rowLabelColor, height: Math.min(0.62, rowGap * 0.42), px: 96 });
    label.center.set(1, 0.5);
    label.position.set(-W / 2 - 0.7, 0.3, z);
    scene.add(label);
    row.bars.forEach((b, i) => {
      if (b.value == null) return;
      const color = CAT_COLOR[b.category] ?? C.gold;
      const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.15, roughness: 0.38, emissive: color, emissiveIntensity: 0.12, envMapIntensity: 0.5 });
      const mesh = new THREE.Mesh(geo, mat);
      const h = 0.12 + maxHeight * scaleOf(b.value) / max;
      mesh.position.set(-W / 2 + i * spacing, 0, z);
      mesh.scale.y = 0.001;
      const capColor = b.change == null ? new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.55) : b.change > 0 ? C.up : b.change < 0 ? C.down : C.flat;
      const cap = new THREE.Mesh(capGeo, new THREE.MeshBasicMaterial({ color: capColor, toneMapped: false }));
      cap.position.copy(mesh.position);
      mesh.userData = { bar: b, h, cap, delay: (r * cols + i) * Math.min(0.025, 1.5 / (rows.length * cols)) };
      scene.add(mesh, cap);
      bars.push(mesh);
    });
  });

  const target = new THREE.Vector3(0, maxHeight * 0.32, 0);
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(target);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.maxPolarAngle = Math.PI * 0.47;
  controls.minDistance = 3;
  controls.autoRotate = !REDUCED;
  controls.autoRotateSpeed = 0.55;
  canvas.addEventListener("pointerdown", () => { controls.autoRotate = false; });

  function frame() {
    const fov = THREE.MathUtils.degToRad(camera.fov);
    const needW = (W + 7) / (2 * Math.tan(fov / 2) * camera.aspect);
    const needH = (maxHeight + D * 0.5 + 2) / (2 * Math.tan(fov / 2));
    const dist = Math.max(needW, needH) * 1.1;
    const dir = new THREE.Vector3(0.22, 0.78, 1).normalize();
    camera.position.copy(target).addScaledVector(dir, dist);
    controls.maxDistance = dist * 2;
    controls.update();
  }

  // hover / tap
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let hovered = null;
  function pick(e) {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(bars, false)[0];
    if (hovered && hovered !== hit?.object) hovered.material.emissiveIntensity = 0.12;
    hovered = hit?.object || null;
    if (hovered) {
      hovered.material.emissiveIntensity = 0.55;
      tooltip.innerHTML = hovered.userData.bar.detail;
      tooltip.hidden = false;
      const x = e.clientX - rect.left, y = e.clientY - rect.top;
      tooltip.style.left = `${Math.min(x + 14, rect.width - tooltip.offsetWidth - 8)}px`;
      tooltip.style.top = `${Math.max(8, y - tooltip.offsetHeight - 12)}px`;
      canvas.style.cursor = "pointer";
    } else {
      tooltip.hidden = true;
      canvas.style.cursor = "grab";
    }
  }
  canvas.addEventListener("pointermove", pick);
  canvas.addEventListener("pointerdown", pick);
  canvas.addEventListener("pointerleave", () => {
    tooltip.hidden = true;
    if (hovered) hovered.material.emissiveIntensity = 0.12;
    hovered = null;
  });

  const ease = x => 1 - Math.pow(1 - Math.min(Math.max(x, 0), 1), 3);
  const start = performance.now();
  run(canvas, renderer, scene, camera, (_t, resized) => {
    if (resized) frame();
    const s = (performance.now() - start) / 1000;
    for (const m of bars) {
      const k = REDUCED ? 1 : ease((s - m.userData.delay) / 1.1);
      m.scale.y = Math.max(0.001, m.userData.h * k);
      m.userData.cap.position.y = m.scale.y + 0.02;
    }
    if (controls.autoRotate) {   // sway side to side instead of spinning all the way round
      const az = controls.getAzimuthalAngle();
      if (az > 0.5) controls.autoRotateSpeed = Math.abs(controls.autoRotateSpeed);
      else if (az < -0.3) controls.autoRotateSpeed = -Math.abs(controls.autoRotateSpeed);
    }
    controls.update();
  });
}
