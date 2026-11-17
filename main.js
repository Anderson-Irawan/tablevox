// TableVox: interactive presentation.
// 3D models: Kenney Mini Characters, Food Kit and Furniture Kit (CC0, www.kenney.nl).
// The table waiter is our own model (the app's face).
import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/addons/loaders/GLTFLoader.js';

/* ------------------------------------------------------------------ content */
const SLIDES = [
  { key: 'title', dur: 9 },
  { key: 'walk', dur: 9, kicker: '01 Arrive', title: 'Walk in.<br>Sit anywhere.', line: 'No queue, no app to download.', at: 'at-top-left', tone: 'is-navy' },
  { key: 'sit', dur: 7, kicker: '02 Sit down', title: 'One tap.<br>Then just talk.', line: 'The waiter on the table wakes up.', at: 'at-bottom-left', tone: 'is-orange' },
  { key: 'chat', dur: 22, kicker: '03 Order', title: 'A conversation,<br>not a form.', line: 'One readback, then a real yes.', at: 'at-top-left', tone: 'is-navy' },
  { key: 'kitchen', dur: 9, kicker: '04 Kitchen', title: 'Straight to<br>the kitchen.', line: 'The stock counts itself down.', at: 'at-top-left', tone: 'is-yellow' },
  { key: 'food', dur: 12, kicker: '05 Served', title: 'The food<br>comes to you.', line: 'One tap on Ready for the cook.', at: 'at-bottom-left', tone: 'is-orange' },
  { key: 'end', dur: 9, kicker: 'TableVox', title: 'Order by talking.<br>Eat sooner.', points: ['Faster orders, fewer mistakes', 'Fixed prices and portions', 'Kitchen and stock in sync'], at: 'at-top-left', tone: 'is-navy' },
];

const CHAT = [
  { at: 0.4, who: 'waiter', text: 'Hi! What would you like to order?' },
  { at: 2.8, who: 'guest', text: 'One special fried rice, spicy please.' },
  { at: 5.0, who: 'waiter', text: 'Got it.' },
  { at: 6.6, who: 'guest', text: 'What goes well with it?' },
  { at: 9.0, who: 'waiter', text: 'Prawn crackers. Crunchy, perfect with fried rice. Want some?' },
  { at: 12.4, who: 'guest', text: 'Sure. And a sweet iced tea. That is all.' },
  { at: 15.0, who: 'waiter', text: 'So that is one special fried rice, spicy, one prawn crackers and one iced tea. All correct?' },
  { at: 19.0, who: 'guest', text: 'Yes, send it.' },
  { at: 20.4, who: 'system', text: 'Order #47 sent to the kitchen' },
];
const spanOf = (i) => (CHAT[i + 1] ? CHAT[i + 1].at : CHAT[i].at + 3);
const waiterTalking = (t) => CHAT.some((c, i) => c.who === 'waiter' && t > c.at && t < Math.min(spanOf(i), c.at + 0.6 + c.text.length * 0.05));
const guestTalking = (t) => CHAT.some((c, i) => c.who === 'guest' && t > c.at && t < Math.min(spanOf(i), c.at + 1.6));

const STOCK = [
  { name: 'Rice', unit: 'g', from: 20000, use: 200 },
  { name: 'Chicken', unit: 'g', from: 8000, use: 80 },
  { name: 'Eggs', unit: 'pcs', from: 60, use: 1 },
  { name: 'Crackers', unit: 'pcs', from: 80, use: 7 },
  { name: 'Tea', unit: 'pcs', from: 100, use: 1 },
];

/* ------------------------------------------------------------------ renderer */
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const stage = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
stage.appendChild(renderer.domElement);

const COLORS = { navy: 0x1b1535, navy2: 0x2a2250, orange: 0xff5a36, yellow: 0xffc93c, cream: 0xfbf6ec, floor: 0xe8d6bb, wall: 0xf6ead6 };
const scene = new THREE.Scene();
scene.background = new THREE.Color(COLORS.cream);
scene.fog = new THREE.Fog(COLORS.cream, 20, 38);
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);

scene.add(new THREE.HemisphereLight(0xfff6e6, 0xc9b79a, 1.5));
const sun = new THREE.DirectionalLight(0xfff0d8, 2.4);
sun.position.set(7, 13, 9);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0004;
Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13 });
scene.add(sun);

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...extra });
const mesh = (geometry, material, shadows = true) => {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = shadows;
  m.receiveShadow = true;
  return m;
};

/* ------------------------------------------------------------------ loading */
const loader = new GLTFLoader();
const cache = new Map();
const loadGltf = (url) => {
  if (!cache.has(url)) cache.set(url, new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject)));
  return cache.get(url);
};
const shadowsOn = (o) => o.traverse((c) => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });

// Kenney furniture is modelled at about half real size, with its origin at a corner:
// each piece is scaled up and re-centred so x, z is its middle.
const FURNITURE_SCALE = 2.3;
async function furniture(name, x, z, rotY = 0, parent = room) {
  const g = await loadGltf(`assets/furniture/${name}.glb`);
  const inner = g.scene.clone(true);
  inner.scale.setScalar(FURNITURE_SCALE);
  const box = new THREE.Box3().setFromObject(inner);
  const centre = box.getCenter(new THREE.Vector3());
  inner.position.set(-centre.x, -box.min.y, -centre.z);
  const o = new THREE.Group();
  o.add(inner);
  o.position.set(x, 0, z);
  o.rotation.y = rotY;
  o.userData.height = box.max.y - box.min.y;
  shadowsOn(o);
  parent.add(o);
  return o;
}
/** A food model scaled so its widest side is `size` metres, sitting on y = 0. */
async function food(name, size) {
  const g = await loadGltf(`assets/food/${name}.glb`);
  const inner = g.scene.clone(true);
  const box = new THREE.Box3().setFromObject(inner);
  const dims = box.getSize(new THREE.Vector3());
  inner.scale.setScalar(size / Math.max(dims.x, dims.z));
  const scaled = new THREE.Box3().setFromObject(inner);
  inner.position.y -= scaled.min.y;
  const o = new THREE.Group();
  o.add(inner);
  shadowsOn(o);
  return o;
}
/** An animated Kenney character, scaled to `height` metres, with its clips ready to play. */
async function character(file, height) {
  const g = await loadGltf(`assets/characters/${file}.glb`);
  const body = g.scene;
  body.scale.setScalar(1);
  const box = new THREE.Box3().setFromObject(body);
  body.scale.setScalar(height / box.getSize(new THREE.Vector3()).y);
  const root = new THREE.Group();
  root.add(body);
  shadowsOn(root);
  const mixer = new THREE.AnimationMixer(body);
  const actions = Object.fromEntries(g.animations.map((clip) => [clip.name, mixer.clipAction(clip)]));
  let current = '';
  const play = (name, fade = 0.35) => {
    if (current === name || !actions[name]) return;
    const next = actions[name].reset().setEffectiveWeight(1).fadeIn(fade).play();
    if (current) actions[current].fadeOut(fade);
    current = name;
    return next;
  };
  return { root, body, mixer, play, get current() { return current; } };
}

/* ------------------------------------------------------------------ the room (own geometry, brand colours) */
const room = new THREE.Group();
scene.add(room);
const floor = mesh(new THREE.PlaneGeometry(20, 16), mat(COLORS.floor, { roughness: 0.9 }), false);
floor.rotation.x = -Math.PI / 2;
room.add(floor);
for (let x = -9; x < 10; x += 2) {
  for (let z = -7; z < 8; z += 2) {
    if (((x + 9) / 2 + (z + 7) / 2) % 2) continue;
    const tile = mesh(new THREE.PlaneGeometry(2, 2), mat(0xddc6a3, { roughness: 0.95 }), false);
    tile.rotation.x = -Math.PI / 2;
    tile.position.set(x + 1, 0.003, z + 1);
    room.add(tile);
  }
}
const wallMat = mat(COLORS.wall, { roughness: 0.95 });
const wall = (w, h, d, x, y, z) => { const m = mesh(new THREE.BoxGeometry(w, h, d), wallMat); m.position.set(x, y, z); room.add(m); return m; };
wall(20, 4.2, 0.3, 0, 2.1, -8);
wall(0.3, 4.2, 8, -10, 2.1, -4);
wall(0.3, 4.2, 4, -10, 2.1, 6);
wall(0.3, 1.2, 4, -10, 3.6, 2);
const band = mesh(new THREE.BoxGeometry(20, 1.1, 0.05), mat(COLORS.orange));
band.position.set(0, 0.55, -7.83);
room.add(band);
const bandSide = mesh(new THREE.BoxGeometry(0.05, 1.1, 8), mat(COLORS.orange));
bandSide.position.set(-9.83, 0.55, -4);
room.add(bandSide);

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return { canvas: c, texture: t };
}

// windows
[-6.5, 3].forEach((x) => {
  const glass = mesh(new THREE.PlaneGeometry(2.6, 1.5), new THREE.MeshStandardMaterial({ color: 0xbfe3f0, emissive: 0x6aa6c2, emissiveIntensity: 0.35, roughness: 0.15 }), false);
  glass.position.set(x, 2.4, -7.84);
  room.add(glass);
  const frame = mesh(new THREE.BoxGeometry(2.8, 0.14, 0.2), mat(COLORS.navy2));
  frame.position.set(x, 1.6, -7.75);
  room.add(frame);
});

/* ------------------------------------------------------------------ the table waiter (our own model: the app's face) */
const T = { x: 2, z: 0.6 };
let TABLE_TOP = 0.85; // replaced by the real table height once the model is loaded
const bot = new THREE.Group();
bot.scale.setScalar(1.25);
bot.position.set(T.x, TABLE_TOP, T.z - 0.28);
room.add(bot);
const botBase = mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.06, 32), mat(COLORS.navy2));
botBase.position.y = 0.03;
bot.add(botBase);
const botNeck = mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.12, 12), mat(COLORS.navy2));
botNeck.position.y = 0.1;
bot.add(botNeck);
const botHead = new THREE.Group();
botHead.position.y = 0.3;
bot.add(botHead);
const skull = mesh(new THREE.SphereGeometry(0.2, 48, 32), mat(COLORS.cream, { roughness: 0.5, emissive: COLORS.yellow, emissiveIntensity: 0 }));
skull.scale.set(1.05, 1, 0.9);
botHead.add(skull);
const ink = mat(COLORS.navy, { roughness: 0.3 });
const botEyes = [-1, 1].map((s) => {
  const e = new THREE.Group();
  e.position.set(0.072 * s, 0.035, 0.16);
  const ball = mesh(new THREE.SphereGeometry(0.03, 20, 14), ink, false);
  ball.scale.set(1, 1.3, 0.55);
  e.add(ball);
  const glint = mesh(new THREE.SphereGeometry(0.008, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), false);
  glint.position.set(0.01, 0.016, 0.016);
  e.add(glint);
  botHead.add(e);
  return e;
});
[-1, 1].forEach((s) => {
  const cheek = new THREE.Mesh(new THREE.CircleGeometry(0.028, 20), new THREE.MeshBasicMaterial({ color: COLORS.orange, transparent: true, opacity: 0.35 }));
  cheek.position.set(0.125 * s, -0.02, 0.166);
  cheek.lookAt(cheek.position.clone().multiplyScalar(2));
  botHead.add(cheek);
});
const botSmile = mesh(new THREE.TorusGeometry(0.04, 0.007, 8, 24, Math.PI * 0.72), ink, false);
botSmile.rotation.z = Math.PI + Math.PI * 0.14;
botSmile.position.set(0, -0.045, 0.176);
botHead.add(botSmile);
const botMouth = mesh(new THREE.SphereGeometry(1, 20, 14), mat(0x5a1630), false);
botMouth.position.set(0, -0.07, 0.172);
botHead.add(botMouth);
const botTie = new THREE.Group();
botTie.position.set(0, 0.07, 0.07);
bot.add(botTie);
[-1, 1].forEach((s) => {
  const wing = mesh(new THREE.ConeGeometry(0.035, 0.065, 16), mat(COLORS.yellow));
  wing.rotation.z = -s * Math.PI / 2;
  wing.position.x = 0.033 * s;
  botTie.add(wing);
});
const botGlow = new THREE.PointLight(0xffcf8a, 0, 1.8, 2);
botGlow.position.set(0, 0.35, 0.4);
bot.add(botGlow);

/* ------------------------------------------------------------------ kitchen screen + signs */
const screen = canvasTexture(640, 400, () => {});
let screenState = '';
function drawScreen(state) {
  if (state === screenState) return;
  screenState = state;
  const g = screen.canvas.getContext('2d');
  g.fillStyle = '#1b1535';
  g.fillRect(0, 0, 640, 400);
  g.fillStyle = '#fbf6ec';
  g.font = '700 36px "Space Grotesk"';
  g.fillText('DAPUR', 28, 54);
  g.fillStyle = '#ffc93c';
  g.font = '500 22px "Space Grotesk"';
  g.fillText(state === 'empty' ? '0 waiting' : state === 'ready' ? '1 ready' : '1 waiting', 170, 54);
  if (state !== 'empty') {
    g.fillStyle = '#ffffff';
    g.fillRect(28, 84, 300, 290);
    g.fillStyle = state === 'ready' ? '#3f9e6c' : '#ff5a36';
    g.fillRect(28, 84, 300, 14);
    g.fillStyle = '#1b1535';
    g.font = '700 28px "Space Grotesk"';
    g.fillText('TABLE T4  #47', 46, 140);
    g.font = '500 21px Inter';
    ['1x Special Fried Rice', '1x Prawn Crackers', '1x Iced Tea'].forEach((l, i) => g.fillText(l, 46, 184 + i * 36));
    g.fillStyle = state === 'ready' ? '#3f9e6c' : '#1b1535';
    g.fillRect(46, 300, 264, 54);
    g.fillStyle = '#fbf6ec';
    g.font = '700 24px "Space Grotesk"';
    g.fillText(state === 'ready' ? 'READY' : 'NEW', 140, 336);
  }
  screen.texture.needsUpdate = true;
}

/* ------------------------------------------------------------------ cast and props (filled in by build()) */
const cast = {};
const tray = new THREE.Group();
const steam = [];
const ticketCard = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.56), new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide }));
room.add(ticketCard);
const KITCHEN = { x: 5.8, z: -6.6 };
const SCREEN_POS = new THREE.Vector3(4.4, 2.35, -7.75);

async function build() {
  await document.fonts.ready;
  // The guest's table first: its real height places the plates and the table waiter.
  const mainTable = await furniture('tableRound', T.x, T.z, 0);
  TABLE_TOP = mainTable.userData.height;
  bot.position.y = TABLE_TOP;

  // Wall sign
  const sign = canvasTexture(1024, 256, (g, w, h) => {
    g.fillStyle = '#1b1535';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#fbf6ec';
    g.font = '700 108px "Space Grotesk"';
    g.textAlign = 'center';
    g.fillText('TABLEVOX', w / 2, 132);
    g.fillStyle = '#ff5a36';
    g.font = '500 44px "Space Grotesk"';
    g.fillText('just say your order', w / 2, 200);
  });
  const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 1.35), new THREE.MeshBasicMaterial({ map: sign.texture }));
  signMesh.position.set(-1.6, 3.2, -7.84);
  room.add(signMesh);
  const ticket = canvasTexture(256, 340, (g, w, h) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#ff5a36';
    g.fillRect(0, 0, w, 22);
    g.fillStyle = '#1b1535';
    g.font = '700 70px "Space Grotesk"';
    g.textAlign = 'center';
    g.fillText('#47', w / 2, 150);
    g.font = '500 30px "Space Grotesk"';
    g.fillText('TABLE T4', w / 2, 210);
  });
  ticketCard.material.map = ticket.texture;
  ticketCard.material.needsUpdate = true;
  drawScreen('empty');
  const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.06), new THREE.MeshBasicMaterial({ map: screen.texture }));
  screenMesh.position.copy(SCREEN_POS);
  room.add(screenMesh);
  const screenBack = mesh(new THREE.BoxGeometry(1.82, 1.18, 0.06), mat(0x111111));
  screenBack.position.copy(SCREEN_POS).add(new THREE.Vector3(0, 0, -0.04));
  room.add(screenBack);

  // Dining room: tables, chairs, rugs, plants, lamps (Kenney Furniture Kit)
  const TABLES = [[-4.5, -1.2], [-4.5, 3.6], [6, 3.4], [T.x, T.z]];
  const work = [];
  for (const [x, z] of TABLES) {
    work.push(furniture('rugRound', x, z, 0));
    if (x !== T.x || z !== T.z) work.push(furniture('tableRound', x, z, 0));
    work.push(furniture('chairCushion', x, z + 1.0, Math.PI));
    work.push(furniture('chairCushion', x, z - 1.0, 0));
    const light = new THREE.PointLight(0xffc98a, 6, 5, 2);
    light.position.set(x, 3.3, z);
    room.add(light);
  }
  work.push(furniture('pottedPlant', -9.2, -7.2, 0));
  work.push(furniture('pottedPlant', 0.6, -7.2, 0));
  work.push(furniture('pottedPlant', -9.2, 7.2, 0));
  work.push(furniture('plantSmall2', -8.6, 4.2, 0));
  work.push(furniture('bench', -9.3, -3.4, Math.PI / 2));
  work.push(furniture('speaker', 9.2, -7.3, 0));

  // Kitchen along the back right wall
  const kx = KITCHEN.x, kz = KITCHEN.z;
  work.push(furniture('kitchenFridge', kx + 3.2, kz - 0.6, 0));
  work.push(furniture('kitchenStove', kx + 1.9, kz - 0.6, 0));
  work.push(furniture('kitchenBar', kx - 1.8, kz + 0.9, Math.PI));
  work.push(furniture('kitchenBar', kx - 0.9, kz + 0.9, Math.PI));
  work.push(furniture('kitchenBar', kx, kz + 0.9, Math.PI));
  work.push(furniture('kitchenBarEnd', kx + 0.55, kz + 0.9, Math.PI));
  work.push(furniture('hoodModern', kx + 1.9, kz - 0.75, 0).then((h) => { h.position.y = 1.95; }));
  work.push(furniture('kitchenCabinetUpper', kx + 0.5, kz - 0.75, 0).then((c) => { c.position.y = 1.7; }));
  work.push(furniture('kitchenCoffeeMachine', kx - 1.4, kz + 0.95, Math.PI).then((m) => { m.position.y = 0.86; }));
  work.push(food('pot-stew', 0.42).then((p) => { p.position.set(kx + 1.75, 0.93, kz - 0.45); room.add(p); }));
  work.push(food('frying-pan', 0.38).then((p) => { p.position.set(kx + 2.15, 0.93, kz - 0.3); room.add(p); }));

  // Plates on the other diners' tables
  work.push(food('plate-dinner', 0.3).then((p) => { p.position.set(-4.5, TABLE_TOP + 0.01, -0.85); room.add(p); }));
  work.push(food('cup-tea', 0.12).then((p) => { p.position.set(-4.2, TABLE_TOP + 0.01, -0.9); room.add(p); }));
  work.push(food('plate-dinner', 0.3).then((p) => { p.position.set(-4.5, TABLE_TOP + 0.01, 3.95); room.add(p); }));

  // The order: on a tray the staff member carries (Kenney Food Kit)
  const trayBoard = mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.025, 40), mat(0x9a6a46));
  tray.add(trayBoard);
  work.push(food('plate-deep', 0.3).then((p) => { p.position.set(-0.05, 0.012, 0.06); tray.add(p); }));
  // Nasi goreng: a fried-rice mound in our own colours under Kenney's fried egg.
  const rice = mesh(new THREE.SphereGeometry(0.1, 24, 16), mat(0xc4813a, { roughness: 0.95, flatShading: true }));
  rice.scale.set(1, 0.42, 1);
  rice.position.set(-0.05, 0.05, 0.06);
  tray.add(rice);
  work.push(food('egg-cooked', 0.12).then((p) => { p.position.set(-0.03, 0.1, 0.07); tray.add(p); }));
  work.push(food('bowl', 0.15).then((p) => { p.position.set(-0.17, 0.012, -0.17); tray.add(p); }));
  work.push(food('cookie', 0.08).then((p) => { p.position.set(-0.17, 0.05, -0.17); p.rotation.x = 0.4; tray.add(p); }));
  // Es teh: an iced-tea glass with a straw.
  const tea = new THREE.Group();
  const teaGlass = mesh(new THREE.CylinderGeometry(0.05, 0.042, 0.17, 24), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, roughness: 0.1 }));
  teaGlass.position.y = 0.085;
  const teaLiquid = mesh(new THREE.CylinderGeometry(0.044, 0.038, 0.13, 24), mat(0xb8611c, { roughness: 0.2 }));
  teaLiquid.position.y = 0.07;
  const straw = mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.2, 8), mat(COLORS.orange));
  straw.position.set(0.018, 0.16, 0);
  straw.rotation.z = 0.22;
  tea.add(teaLiquid, teaGlass, straw);
  tea.position.set(0.18, 0.012, -0.14);
  tray.add(tea);
  room.add(tray);
  for (let i = 0; i < 3; i++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
    room.add(puff);
    steam.push(puff);
  }

  // People (Kenney Mini Characters, animated)
  const [guest, server, dinerA, dinerB] = await Promise.all([
    character('character-female-b', 1.32),
    character('character-male-e', 1.4),
    character('character-male-a', 1.36),
    character('character-female-d', 1.3),
  ]);
  Object.assign(cast, { guest, server, dinerA, dinerB });
  for (const p of [guest, server, dinerA, dinerB]) room.add(p.root);
  seat(dinerA, -4.5, -1.2 - SEAT_OFFSET, 0);
  seat(dinerB, -4.5, 3.6 + SEAT_OFFSET, Math.PI);
  dinerA.play('sit', 0);
  dinerB.play('sit', 0);
  await Promise.all(work);
}

/** How high a seated character's root goes so the sit pose lands on the chair seat (tuned by eye). */
const SIT_DROP = Number(new URLSearchParams(location.search).get('sit')) || 0.42;
function seat(p, x, z, rotY) {
  p.root.position.set(x, SIT_DROP, z);
  p.root.rotation.y = rotY;
}

/* ------------------------------------------------------------------ paths and helpers */
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const lerp = (a, b, k) => a + (b - a) * k;
function along(path, k) {
  const lengths = path.slice(1).map((p, i) => Math.hypot(p[0] - path[i][0], p[1] - path[i][1]));
  let d = clamp01(k) * lengths.reduce((a, b) => a + b, 0);
  for (let i = 0; i < lengths.length; i++) {
    if (d <= lengths[i] || i === lengths.length - 1) {
      const f = lengths[i] ? Math.min(1, d / lengths[i]) : 1;
      const a = path[i], b = path[i + 1];
      return { x: lerp(a[0], b[0], f), z: lerp(a[1], b[1], f), dir: Math.atan2(b[0] - a[0], b[1] - a[1]) };
    }
    d -= lengths[i];
  }
  const last = path[path.length - 1];
  return { x: last[0], z: last[1], dir: 0 };
}
// The guest sits on the chair on the +z side of the table, facing the table (-z).
const SEAT_OFFSET = 0.95; // chairs stand 1.0 from the table centre; a seated body sits slightly forward
const GUEST_SEAT = { x: T.x, z: T.z + SEAT_OFFSET };
const GUEST_PATH = [[-12, 2.3], [-7, 2.3], [-1, 2.4], [T.x, 2.4], [GUEST_SEAT.x, GUEST_SEAT.z + 0.45]];
const SERVER_PATH = [[KITCHEN.x - 0.9, KITCHEN.z + 2], [KITCHEN.x - 1.6, -2.4], [T.x + 1.6, T.z - 0.2], [T.x + 0.95, T.z - 0.05]];
const forward = (rotY) => new THREE.Vector3(Math.sin(rotY), 0, Math.cos(rotY));

/* ------------------------------------------------------------------ the world at (slide, time) */
// Positions come from the slide and its time, so moving back and forth always looks right.
function world(si, t) {
  const key = SLIDES[si].key;
  const index = (k) => SLIDES.findIndex((s) => s.key === k);
  const past = (k) => si > index(k);
  const now = (k) => key === k;
  const { guest, server } = cast;

  // Guest: walk in, then sit.
  if (now('title')) {
    guest.root.visible = false;
  } else {
    guest.root.visible = true;
    const walk = now('walk') ? clamp01((t - 0.4) / 7.6) : 1;
    if (walk < 1) {
      const p = along(GUEST_PATH, walk);
      guest.root.position.set(p.x, 0, p.z);
      guest.root.rotation.y = p.dir;
      guest.play('walk');
    } else {
      const sitK = now('walk') ? 0 : now('sit') ? ease(t / 1.1) : 1;
      guest.root.position.set(GUEST_SEAT.x, lerp(0, SIT_DROP, sitK), lerp(GUEST_SEAT.z + 0.45, GUEST_SEAT.z, sitK));
      guest.root.rotation.y = Math.PI;
      if (now('walk')) guest.play('idle');
      else if (now('chat') && guestTalking(t)) guest.play('emote-yes', 0.25);
      else guest.play('sit');
    }
  }

  // The table waiter wakes up, talks, listens.
  const awake = now('title') || now('walk') ? 0 : now('sit') ? clamp01((t - 1.4) / 0.8) : 1;
  botHead.scale.setScalar(0.86 + 0.14 * awake);
  botGlow.intensity = 2.4 * awake;
  skull.material.emissiveIntensity = 0.07 * awake;
  const speaking = now('chat') && waiterTalking(t);
  const open = speaking ? 0.4 + 0.45 * Math.abs(Math.sin(t * 15) * Math.sin(t * 4.7)) : 0;
  botMouth.visible = open > 0.05;
  botSmile.visible = !botMouth.visible;
  botMouth.scale.set(0.04, 0.008 + open * 0.034, 0.012);
  const blink = Math.sin(t * 1.3) > 0.985 || Math.sin(t * 0.7 + 1) > 0.994 ? 0.15 : 1;
  botEyes.forEach((e) => e.scale.set(1, awake < 0.5 ? 0.15 : blink, 1));
  botHead.rotation.set(now('chat') && guestTalking(t) ? -0.12 + Math.sin(t * 7) * 0.05 : 0, now('chat') ? Math.sin(t * 0.8) * 0.12 : 0, 0);
  botHead.position.y = 0.3 + (reduced ? 0 : Math.sin(t * 2) * 0.008 * awake);

  // The order ticket flies to the kitchen screen.
  if (now('kitchen')) {
    const k = ease(clamp01((t - 0.6) / 2.4));
    ticketCard.position.lerpVectors(new THREE.Vector3(T.x, 1.4, T.z), SCREEN_POS, k);
    ticketCard.position.y += Math.sin(k * Math.PI) * 1.3;
    ticketCard.rotation.set(0, k * Math.PI * 2, Math.sin(k * Math.PI) * 0.3);
    ticketCard.scale.setScalar(1 - k * 0.45);
    ticketCard.visible = k < 0.97;
  } else {
    ticketCard.visible = false;
  }
  drawScreen(now('kitchen') ? (t > 3 ? 'new' : 'empty') : now('food') ? (t > 1 ? 'ready' : 'new') : past('food') ? 'ready' : 'empty');

  // The staff member: at the pass, then carries the tray over.
  const go = now('food') ? clamp01((t - 1.4) / 5.4) : past('food') ? 1 : 0;
  const placed = now('food') ? clamp01((t - 7.1) / 0.8) : past('food') ? 1 : 0;
  const stepBack = now('food') ? ease(clamp01((t - 8.2) / 1.4)) : past('food') ? 1 : 0;
  const sp = along(SERVER_PATH, go);
  server.root.position.set(sp.x + stepBack * 0.7, 0, sp.z - stepBack * 0.2);
  if (go > 0 && go < 1) {
    server.root.rotation.y = sp.dir;
    server.play('walk');
  } else if (go >= 1) {
    server.root.rotation.y = -Math.PI / 2 - 0.25;
    server.play(placed >= 1 ? 'idle' : 'holding-both');
  } else {
    server.root.rotation.y = Math.PI;
    server.play('idle');
  }
  const carrying = (now('food') || past('food')) && go > 0 && placed < 1;
  if (carrying && go < 1) server.play('walk');
  tray.visible = now('food') || past('food');
  const held = server.root.position.clone().add(forward(server.root.rotation.y).multiplyScalar(0.4));
  held.y = 0.74; // at the hands of the carrying pose
  const onTable = new THREE.Vector3(T.x, TABLE_TOP + 0.005, T.z + 0.3);
  tray.position.lerpVectors(held, onTable, ease(placed));
  tray.rotation.y = lerp(server.root.rotation.y, 0, ease(placed));
  steam.forEach((puff, i) => {
    const phase = (t * 0.6 + i / 3) % 1;
    puff.material.opacity = placed >= 1 && tray.visible ? (1 - phase) * 0.45 : 0;
    puff.position.set(tray.position.x - 0.05 + Math.sin(phase * 6 + i) * 0.04, tray.position.y + 0.18 + phase * 0.45, tray.position.z + 0.06);
    puff.scale.setScalar(0.6 + phase);
  });
  if (now('food') && t > 8 && guest.current !== 'emote-yes') guest.play('emote-yes', 0.3);
}

/* ------------------------------------------------------------------ camera */
const CAMERA = {
  title: (t) => ({ pos: [Math.sin(t * 0.1 + 0.6) * 14, 8.2, Math.cos(t * 0.1 + 0.6) * 14], look: [0, 0.6, -1] }),
  walk: () => { const g = cast.guest.root.position; return { pos: [g.x + 3.4, 3.1, g.z + 5.4], look: [g.x + 0.6, 1.0, g.z - 0.6] }; },
  sit: () => ({ pos: [T.x + 1.9, 2.0, T.z + 3.2], look: [T.x - 0.1, 0.95, T.z] }),
  chat: (t) => ({ pos: [T.x + 1.75 + Math.sin(t * 0.15) * 0.15, 1.7, T.z + 1.35], look: [T.x - 0.15, TABLE_TOP + 0.3, T.z - 0.05] }),
  kitchen: () => ({ pos: [T.x - 0.6, 4.4, T.z + 5.4], look: [4.6, 1.5, -5.6] }),
  food: (t) => (t < 6.8 ? { pos: [T.x - 3.6, 3.8, T.z + 4.8], look: [3.6, 0.9, -2.8] } : { pos: [T.x - 1.45, TABLE_TOP + 0.95, T.z + 1.55], look: [T.x, TABLE_TOP + 0.12, T.z + 0.15] }),
  end: (t) => ({ pos: [T.x + 1.7 + Math.sin(t * 0.3) * 0.1, TABLE_TOP + 0.75, T.z + 1.0], look: [T.x - 0.1, TABLE_TOP + 0.3, T.z - 0.1] }),
};
const REVIEW = new URLSearchParams(location.search).has('at'); // a still for review: camera and overlays jump into place
const camPos = new THREE.Vector3(14, 9, 14);
const camLook = new THREE.Vector3(0, 0.6, -1);
let dragYaw = 0;
let dragPitch = 0;

/* ------------------------------------------------------------------ interface */
const $ = (id) => document.getElementById(id);
const els = {
  hero: $('hero'), text: $('slideText'), kicker: $('kicker'), title: $('slideTitle'), line: $('slideLine'), points: $('slidePoints'),
  chat: $('chat'), ops: $('ops'), ticket: $('ticket'), ticketState: $('ticketState'), bars: $('bars'), label: $('dockLabel'),
  prev: $('prev'), next: $('next'), auto: $('auto'), replay: $('replay'),
};
const LABELS = ['Intro', 'Arrive', 'Sit down', 'Order', 'Kitchen', 'Served', 'Close'];
let si = 0;
let slideStart = performance.now();
let auto = false;
const bubbles = [];

els.bars.innerHTML = STOCK.map((s, i) => `<div class="bar" id="bar${i}"><span>${s.name}</span><span class="bar-meter"><i></i></span><output></output></div>`).join('');
function setStock(used) {
  STOCK.forEach((s, i) => {
    const row = $(`bar${i}`);
    const value = used ? s.from - s.use : s.from;
    row.querySelector('i').style.width = `${(value / (s.from * 1.25)) * 100 - (used ? 5 : 0)}%`;
    row.querySelector('output').textContent = `${value.toLocaleString('id-ID')} ${s.unit}`;
    row.classList.toggle('is-dipping', used);
  });
}
function buildChat() {
  els.chat.textContent = '';
  bubbles.length = 0;
  for (const c of CHAT) {
    const el = document.createElement('div');
    el.className = `bubble is-${c.who}`;
    if (c.who === 'system') el.textContent = c.text;
    else {
      const who = document.createElement('b');
      who.textContent = c.who === 'guest' ? 'Guest' : 'Waiter';
      el.append(who, c.text);
    }
    els.chat.appendChild(el);
    bubbles.push({ el, at: c.at });
  }
}

function go(i) {
  si = (i + SLIDES.length) % SLIDES.length;
  history.replaceState(null, '', `#${si + 1}`);
  slideStart = performance.now();
  const s = SLIDES[si];
  els.label.innerHTML = `<b>${String(si + 1).padStart(2, '0')}</b>${LABELS[si]}`;
  els.prev.disabled = si === 0;
  els.hero.classList.toggle('is-hidden', s.key !== 'title');
  els.text.className = `slide-text ${s.at ?? ''} ${s.tone ?? ''} ${s.key === 'title' ? 'is-hidden' : ''}`;
  if (s.key !== 'title') {
    els.kicker.textContent = s.kicker;
    els.title.innerHTML = s.title;
    els.line.textContent = s.line ?? '';
    els.line.hidden = !s.line;
    els.points.innerHTML = (s.points ?? []).map((p) => `<li>${p}</li>`).join('');
  }
  els.chat.classList.toggle('is-on', s.key === 'chat');
  els.ops.classList.toggle('is-on', s.key === 'kitchen' || s.key === 'food');
  document.body.classList.toggle('is-busy', ['chat', 'kitchen', 'food'].includes(s.key));
  if (s.key === 'chat') buildChat();
  setStock(false);
  els.ticket.classList.remove('is-ready');
  els.ticketState.textContent = 'New';
  dragYaw = 0;
  dragPitch = 0;
}
els.prev.addEventListener('click', () => go(si - 1));
els.next.addEventListener('click', () => go(si + 1));
els.replay.addEventListener('click', () => go(si));
els.auto.addEventListener('click', () => {
  auto = !auto;
  els.auto.setAttribute('aria-pressed', String(auto));
});
addEventListener('keydown', (e) => {
  if (['ArrowRight', ' ', 'PageDown'].includes(e.key)) { e.preventDefault(); go(si + 1); }
  if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); if (si > 0) go(si - 1); }
  if (e.key === 'Home') go(0);
});
let drag = null;
renderer.domElement.addEventListener('pointerdown', (e) => {
  drag = { x: e.clientX, y: e.clientY, yaw: dragYaw, pitch: dragPitch };
  renderer.domElement.setPointerCapture(e.pointerId);
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (!drag) return;
  dragYaw = drag.yaw - (e.clientX - drag.x) * 0.006;
  dragPitch = Math.max(-0.3, Math.min(0.5, drag.pitch + (e.clientY - drag.y) * 0.004));
});
renderer.domElement.addEventListener('pointerup', () => { drag = null; });

function resize() {
  const w = innerWidth;
  const h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w / h < 0.8 ? 56 : 40;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

/* ------------------------------------------------------------------ loop */
const clock = new THREE.Clock();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.1);
  const s = SLIDES[si];
  const t = (now - slideStart) / 1000;
  world(si, t);
  for (const p of Object.values(cast)) p.mixer.update(dt);

  if (s.key === 'chat') {
    const shown = bubbles.filter((b) => t >= b.at).length;
    const keep = innerWidth < 760 ? 3 : 5;
    bubbles.forEach((b, i) => {
      b.el.hidden = t < b.at || i < shown - keep;
      b.el.classList.toggle('is-shown', t >= b.at + 0.05);
    });
  }
  if (s.key === 'kitchen') setStock(t > 3.4);
  if (s.key === 'food') {
    setStock(true);
    const ready = t > 1;
    els.ticket.classList.toggle('is-ready', ready);
    els.ticketState.textContent = ready ? 'Ready' : 'New';
  }

  const c = CAMERA[s.key](t);
  const target = new THREE.Vector3(...c.pos);
  const look = new THREE.Vector3(...c.look);
  if (dragYaw || dragPitch) {
    const offset = target.clone().sub(look);
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), dragYaw);
    offset.y += dragPitch * offset.length();
    target.copy(look).add(offset);
  }
  const k = reduced || REVIEW ? 1 : 1 - Math.exp(-2.6 * dt);
  camPos.lerp(target, k);
  camLook.lerp(look, k);
  camera.position.copy(camPos);
  camera.lookAt(camLook);
  renderer.render(scene, camera);

  if (auto && t > s.dur) go(si + 1);
}

build()
  .catch((err) => {
    console.error('Could not load the scene', err);
    document.querySelector('.loader-label').textContent = 'Could not load the 3D scene';
  })
  .finally(() => {
    document.body.classList.remove('is-loading');
    document.body.classList.add('is-ready');
    if (REVIEW) document.body.classList.add('is-review');
    // Deep link to a slide (#4); ?at=10 starts that slide 10 s in (for reviewing a moment).
    const start = Number(location.hash.slice(1)) || 1;
    go(start - 1);
    slideStart -= (Number(new URLSearchParams(location.search).get('at')) || 0) * 1000;
    requestAnimationFrame(frame);
  });
