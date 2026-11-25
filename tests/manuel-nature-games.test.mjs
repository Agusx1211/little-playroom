// manuel's ten nature games (#453) against the game contract, with a fake stage: random multi-touch
// (up to 10 fingers), palm-sized bursts, a long idle stretch, a resize, and stop().
//   node --test tests/manuel-nature-games.test.mjs          (in isobox: isobox run node --test tests/manuel-nature-games.test.mjs)
import { test } from 'node:test';
import assert from 'node:assert/strict';

const IDS = ['flowers', 'butterflies', 'frogs', 'fireflies', 'berries', 'turtles', 'rainbows', 'clouds', 'ducks', 'garden'];

function fakeCtx(record) {
  const gradient = { addColorStop() {} };
  return new Proxy({}, {
    get(target, name) {
      if (name in target) return target[name];
      if (name === 'createLinearGradient' || name === 'createRadialGradient') return () => gradient;
      return (...args) => { record.calls.add(name); if (name === 'fillText' || name === 'strokeText') record.text++; return undefined; };
    },
    set(target, name, value) { target[name] = value; return true; },
  });
}

function fakeStage(seed = 1) {
  let s = seed >>> 0;
  const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const record = { calls: new Set(), text: 0, notes: 0, pops: 0, whooshes: 0, badAudio: 0 };
  const frames = [], pointers = [];
  let width = 1024, height = 768;
  const check = (n) => { if (typeof n !== 'number' || !(n > 0)) record.badAudio++; };
  const stage = {
    canvas: {},
    ctx: fakeCtx(record),
    get width() { return width; }, get height() { return height; }, get dpr() { return 2; },
    onFrame(fn) { frames.push(fn); return () => { const i = frames.indexOf(fn); if (i >= 0) frames.splice(i, 1); }; },
    onPointer(h) { pointers.push(h); return () => { const i = pointers.indexOf(h); if (i >= 0) pointers.splice(i, 1); }; },
    audio: {
      note(freq, dur) { check(freq); check(dur); record.notes++; },
      pop() { record.pops++; },
      whoosh() { record.whooshes++; },
    },
    rand,
  };
  return {
    stage, record, rand,
    frame(dt, t) { for (const f of frames.slice()) f(dt, t); },
    pointer(kind, p) { for (const h of pointers.slice()) h[kind](p); },
    resize(w, h) { width = w; height = h; },
    listeners: () => frames.length + pointers.length,
  };
}

for (const id of IDS) {
  test(`${id}: contract, multi-touch, palm, idle, resize, stop`, async () => {
    const game = (await import(`../games/${id}.js`)).default;
    assert.equal(game.id, id);
    assert.equal(game.colors.length, 2);
    const iconRec = { calls: new Set(), text: 0 };
    for (const t of [0, 0.5, 3]) game.icon(fakeCtx(iconRec), 128, t);
    assert.equal(iconRec.text, 0, 'the icon draws no text');

    const h = fakeStage(7);
    const run = game.start(h.stage);
    assert.equal(typeof run.stop, 'function');
    let t = 0, maxEntities = 0;
    const down = new Map();
    const dt = 1 / 60;
    for (let i = 0; i < 60 * 30; i++) {
      t += dt;
      const phase = t < 18 ? 'play' : t < 25 ? 'idle' : 'play';
      if (phase === 'play') {
        // Random fingers: put down, move, lift; up to 10 at once.
        if (down.size < 10 && h.rand() < 0.3) {
          const id2 = Math.floor(h.rand() * 1e9);
          const p = { id: id2, x: h.rand() * h.stage.width, y: h.rand() * h.stage.height, pressure: 0.5, pointerType: 'touch' };
          down.set(id2, p); h.pointer('down', p);
        }
        for (const [, p] of down) {
          p.x = Math.min(h.stage.width, Math.max(0, p.x + (h.rand() - 0.5) * 40));
          p.y = Math.min(h.stage.height, Math.max(0, p.y + (h.rand() - 0.5) * 40));
          h.pointer('move', { ...p });
        }
        for (const [id2, p] of down) if (h.rand() < 0.08) { down.delete(id2); h.pointer('up', p); }
        // A palm: 12 points within 60 px, all at once, then lifted.
        if (i % 240 === 120) {
          const cx = h.rand() * h.stage.width, cy = h.rand() * h.stage.height;
          const palm = Array.from({ length: 12 }, (_, k) => ({ id: 1e10 + i * 100 + k, x: cx + (h.rand() - 0.5) * 120, y: cy + (h.rand() - 0.5) * 120, pressure: 1, pointerType: 'touch' }));
          for (const p of palm) h.pointer('down', p);
          h.frame(dt, t);
          for (const p of palm) h.pointer('up', p);
        }
      } else {
        for (const [id2, p] of down) { down.delete(id2); h.pointer('up', p); }
      }
      if (i === 60 * 26) h.resize(768, 1024);   // the tablet turns
      h.frame(dt, t);
      if (run.debug) maxEntities = Math.max(maxEntities, run.debug().entities);
    }
    assert.equal(h.record.text, 0, 'no text is ever drawn');
    assert.equal(h.record.badAudio, 0, 'the audio only ever gets positive numbers');
    assert.ok(maxEntities <= 300, `under 300 things on screen (${maxEntities})`);
    assert.ok(h.record.calls.has('fillRect') || h.record.calls.has('fill'), 'it draws');
    run.stop();
    assert.equal(h.listeners(), 0, 'stop() takes its frame and pointer callbacks back');
    // After stop nothing happens, even if the shell still calls.
    const before = h.record.calls.size;
    h.frame(dt, t); h.pointer('down', { id: 999, x: 10, y: 10, pressure: 0.5, pointerType: 'touch' });
    assert.equal(h.record.calls.size, before, 'stopped games stop drawing');
  });
}

// ---- what each toy actually does on screen ------------------------------------------------------

const dt = 1 / 60;

test('flowers: a tap blooms a flower at the finger, on the very next frame', async () => {
  const game = (await import('../games/flowers.js')).default;
  const h = fakeStage(3);
  const run = game.start(h.stage);
  h.frame(dt, 0);
  assert.equal(run.debug().flowers, 0);
  h.pointer('down', { id: 1, x: 300, y: 600, pressure: 0.5, pointerType: 'touch' });
  h.frame(dt, dt);
  assert.equal(run.debug().flowers, 1, 'the flower is there the frame after the touch');
  // and it grows: after a second it is an adult that can dance
  for (let i = 0; i < 120; i++) h.frame(dt, dt + i * dt);
  const grown = run.debug();
  assert.ok(grown.flowers === 1);
  // ten taps on ten places: flowers answer every one
  for (let k = 0; k < 10; k++) h.pointer('down', { id: 10 + k, x: 100 + k * 80, y: 500 + (k % 3) * 60, pressure: 0.5, pointerType: 'touch' });
  h.frame(dt, 3);
  assert.equal(run.debug().flowers, 11);
  run.stop();
});

test('butterflies: a held finger gathers three into the whirl; letting go releases them', async () => {
  const game = (await import('../games/butterflies.js')).default;
  const h = fakeStage(5);
  const run = game.start(h.stage);
  h.pointer('down', { id: 1, x: 512, y: 384, pressure: 0.5, pointerType: 'touch' });
  for (let i = 0; i < 60 * 3; i++) h.frame(dt, i * dt);
  assert.equal(run.debug().orbiting, 3, 'the three nearest ride the whirl');
  h.pointer('up', { id: 1, x: 512, y: 384, pressure: 0.5, pointerType: 'touch' });
  for (let i = 0; i < 30; i++) h.frame(dt, 3 + i * dt);
  assert.equal(run.debug().orbiting, 0, 'all drift again after the finger lifts');
  run.stop();
});

test('frogs: a touch sends the nearest frog hopping, and it lands with a splash or a pop', async () => {
  const game = (await import('../games/frogs.js')).default;
  const h = fakeStage(9);
  const run = game.start(h.stage);
  const before = h.record.notes + h.record.pops + h.record.whooshes;
  h.pointer('down', { id: 1, x: 200, y: 300, pressure: 0.5, pointerType: 'touch' });
  h.frame(dt, dt);
  assert.ok(run.debug().states.some(s => s === 'crouching' || s === 'hopping'), 'a frog starts its hop at once');
  for (let i = 0; i < 60 * 2; i++) h.frame(dt, dt + i * dt);
  assert.ok(h.record.notes + h.record.pops + h.record.whooshes > before, 'the landing makes a sound');
  assert.ok(run.debug().entities < 300);
  run.stop();
});

test('fireflies: a still finger gets a visitor that glows steady, and moving loses it', async () => {
  const game = (await import('../games/fireflies.js')).default;
  const h = fakeStage(11);
  const run = game.start(h.stage);
  h.pointer('down', { id: 1, x: 500, y: 400, pressure: 0.5, pointerType: 'touch' });
  for (let i = 0; i < 60 * 3; i++) h.frame(dt, i * dt);   // hold still
  assert.ok(run.debug().resting >= 1, 'one settled on the finger');
  // move the finger: it takes off again
  h.pointer('move', { id: 1, x: 560, y: 300, pressure: 0.5, pointerType: 'touch' });
  h.frame(dt, 3);
  h.frame(dt, 3 + dt);
  assert.equal(run.debug().resting, 0, 'a moved finger loses its firefly');
  run.stop();
});

test('berries: red is picked with a pop, green only wobbles', async () => {
  const game = (await import('../games/berries.js')).default;
  const h = fakeStage(13);
  const run = game.start(h.stage);
  // ripen everything: run long enough that some are RIPE, then tap on each berry row.
  for (let i = 0; i < 60 * 12; i++) h.frame(dt, i * dt);
  const states = () => run.debug().states;
  const pops0 = h.record.pops;
  // berries hang on an arc at mid-height; sweep taps along it until one ripe one is picked
  let picked = false;
  for (let k = 0; k < 60 && !picked; k++) {
    h.pointer('down', { id: 200 + k, x: 80 + (k % 20) * 46, y: h.stage.height * 0.6, pressure: 0.5, pointerType: 'touch' });
    h.frame(dt, 12 + k * 0.02);
    picked = h.record.pops > pops0;
  }
  assert.ok(picked, 'a ripe berry gets picked somewhere along the branch');
  assert.ok(states().includes('green') || states().includes('blossom'), 'the hedge keeps un-ripe fruit');
  run.stop();
});

test('turtles: a tap on a basking turtle plops it in, it cruises, and later it is back on the log', async () => {
  const game = (await import('../games/turtles.js')).default;
  const h = fakeStage(17);
  const run = game.start(h.stage);
  const states0 = run.debug().states;
  assert.ok(states0.every(s => s === 'basking'), 'everyone starts on the log');
  // the first turtle sits left of centre on the log: tap it
  h.pointer('down', { id: 1, x: 293, y: 287, pressure: 0.5, pointerType: 'touch' });
  h.frame(dt, dt);
  assert.ok(run.debug().states.some(s => s === 'plop'), 'the tapped turtle plops in at once');
  const seen = new Set();
  for (let i = 0; i < 60 * 12; i++) {
    h.frame(dt, dt + i * dt);
    for (const s of run.debug().states) seen.add(s);
  }
  assert.ok(seen.has('cruising') && seen.has('climb') && seen.has('shaking'), 'it swims, climbs and shakes');
  assert.ok(run.debug().states.every(s => ['basking', 'plop', 'cruising', 'climb', 'shaking'].includes(s)));
  run.stop();
});

test('rainbows: a held finger raises and carries a bow; release shimmers then fades it out', async () => {
  const game = (await import('../games/rainbows.js')).default;
  const h = fakeStage(19);
  const run = game.start(h.stage);
  h.pointer('down', { id: 1, x: 300, y: 300, pressure: 0.5, pointerType: 'touch' });
  for (let i = 0; i < 40; i++) h.frame(dt, i * dt);
  assert.ok(run.debug().phases.includes('held'), 'the bow rides the held finger');
  h.pointer('move', { id: 1, x: 700, y: 340, pressure: 0.5, pointerType: 'touch' });
  for (let i = 0; i < 40; i++) h.frame(dt, 1 + i * dt);
  h.pointer('up', { id: 1, x: 700, y: 340, pressure: 0.5, pointerType: 'touch' });
  for (let i = 0; i < 30; i++) h.frame(dt, 2 + i * dt);
  assert.ok(run.debug().phases.includes('shimmer'), 'after release it shimmers');
  for (let i = 0; i < 60 * 6; i++) h.frame(dt, 3 + i * dt);
  assert.equal(run.debug().phases.length, 0, 'and fades away to an empty sky');
  run.stop();
});

test('clouds: a tap on clear sky puffs a new cloud; a tap on a cloud shakes off baby puffs', async () => {
  const game = (await import('../games/clouds.js')).default;
  const h = fakeStage(21);
  const run = game.start(h.stage);
  const n0 = run.debug().phases.length;
  h.pointer('down', { id: 1, x: 500, y: 560, pressure: 0.5, pointerType: 'touch' });
  h.frame(dt, dt);
  assert.equal(run.debug().phases.length, n0 + 1, 'a new cloud puffed up on the spot');
  assert.ok(run.debug().phases.includes('puffing'));
  const e0 = run.debug().entities;
  h.pointer('down', { id: 2, x: 500, y: 560, pressure: 0.5, pointerType: 'touch' });
  h.frame(dt, dt);
  assert.ok(run.debug().entities > e0 + 1, 'tapping the cloud shook loose baby puffs');
  run.stop();
});

test('ducks: a touch sends Mother waddling there and the line follows; a honk answers a tap on her', async () => {
  const game = (await import('../games/ducks.js')).default;
  const h = fakeStage(23);
  const run = game.start(h.stage);
  h.pointer('down', { id: 1, x: 220, y: 620, pressure: 0.5, pointerType: 'touch' });
  h.frame(dt, dt);
  assert.equal(run.debug().mood, 'waddling', 'Mother starts for the food at once');
  for (let i = 0; i < 60 * 4; i++) h.frame(dt, i * dt);   // she arrives and eats
  assert.equal(run.debug().mood, 'idle', 'she settles after eating');
  const notes0 = h.record.notes;
  h.pointer('down', { id: 2, x: 220, y: 620, pressure: 0.5, pointerType: 'touch' });
  h.frame(dt, 5);
  assert.ok(h.record.notes > notes0, 'a tap on Mother honks');
  run.stop();
});

test('garden: a seed planted by a touch ripens and is harvested with a pop', async () => {
  const game = (await import('../games/garden.js')).default;
  const h = fakeStage(29);
  const run = game.start(h.stage);
  h.pointer('down', { id: 1, x: 300, y: 600, pressure: 0.5, pointerType: 'touch' });
  h.frame(dt, dt);
  assert.ok(run.debug().phases.includes('seeded'), 'the seed is in the ground on the next frame');
  for (let i = 0; i < 60 * 3; i++) h.frame(dt, i * dt);
  assert.ok(run.debug().phases.includes('leafy'), 'it grew leaves');
  for (let i = 0; i < 60 * 9; i++) h.frame(dt, 3 + i * dt);
  assert.ok(run.debug().phases.includes('ripe'), 'and ripened');
  const n0 = run.debug().phases.length;
  const pops0 = h.record.pops;
  h.pointer('down', { id: 2, x: 300, y: 600, pressure: 0.5, pointerType: 'touch' });
  h.frame(dt, 12);
  assert.ok(h.record.pops > pops0, 'the ripe one pops out');
  assert.equal(run.debug().phases.length, n0 - 1, 'and the plot is empty again');
  run.stop();
});
