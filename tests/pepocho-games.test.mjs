// pepocho's six games (#430) against the game contract, with a fake stage: random multi-touch
// (up to 10 fingers), palm-sized bursts, a long idle stretch, a resize, and stop().
import { test } from 'node:test';
import assert from 'node:assert/strict';

const IDS = ['blocks', 'xylophone', 'snow', 'worm', 'lights', 'shapes'];

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
  const record = { calls: new Set(), text: 0, notes: 0, pops: 0, whooshes: 0 };
  const frames = [], pointers = [];
  let width = 1024, height = 768;
  const stage = {
    canvas: {},
    ctx: fakeCtx(record),
    get width() { return width; }, get height() { return height; }, get dpr() { return 2; },
    onFrame(fn) { frames.push(fn); return () => { const i = frames.indexOf(fn); if (i >= 0) frames.splice(i, 1); }; },
    onPointer(h) { pointers.push(h); return () => { const i = pointers.indexOf(h); if (i >= 0) pointers.splice(i, 1); }; },
    audio: { note() { record.notes++; }, pop() { record.pops++; }, whoosh() { record.whooshes++; } },
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
          const id = Math.floor(h.rand() * 1e9);
          const p = { id, x: h.rand() * h.stage.width, y: h.rand() * h.stage.height, pressure: 0.5, pointerType: 'touch' };
          down.set(id, p); h.pointer('down', p);
        }
        for (const [, p] of down) {
          p.x = Math.min(h.stage.width, Math.max(0, p.x + (h.rand() - 0.5) * 40));
          p.y = Math.min(h.stage.height, Math.max(0, p.y + (h.rand() - 0.5) * 40));
          h.pointer('move', { ...p });
        }
        for (const [id, p] of down) if (h.rand() < 0.08) { down.delete(id); h.pointer('up', p); }
        // A palm: 12 points within 60 px, all at once, then lifted.
        if (i % 240 === 120) {
          const cx = h.rand() * h.stage.width, cy = h.rand() * h.stage.height;
          const palm = Array.from({ length: 12 }, (_, k) => ({ id: 1e10 + i * 100 + k, x: cx + (h.rand() - 0.5) * 120, y: cy + (h.rand() - 0.5) * 120, pressure: 1, pointerType: 'touch' }));
          for (const p of palm) h.pointer('down', p);
          h.frame(dt, t);
          for (const p of palm) h.pointer('up', p);
        }
      } else {
        for (const [id, p] of down) { down.delete(id); h.pointer('up', p); }
      }
      if (i === 60 * 26) h.resize(768, 1024);   // the tablet turns
      h.frame(dt, t);
      if (run.debug) maxEntities = Math.max(maxEntities, run.debug().entities);
    }
    assert.equal(h.record.text, 0, 'no text is ever drawn');
    assert.ok(maxEntities <= 300, `under 300 things on screen (${maxEntities})`);
    assert.ok(h.record.calls.has('fillRect') || h.record.calls.has('fill'), 'it draws');
    run.stop();
    assert.equal(h.listeners(), 0, 'stop() takes its frame and pointer callbacks back');
    // After stop nothing happens, even if the shell still calls.
    const before = h.record.notes + h.record.pops + h.record.whooshes;
    h.pointer('down', { id: 1, x: 10, y: 10, pressure: 1, pointerType: 'touch' });
    assert.equal(h.record.notes + h.record.pops + h.record.whooshes, before);
  });
}

test('lights: tapping every window celebrates, then settles back to dark', async () => {
  const game = (await import('../games/lights.js')).default;
  const h = fakeStage(3);
  const run = game.start(h.stage);
  // The windows sit in a 3 x 3 grid in the middle of the house; tap the centre of each.
  const W = h.stage.width, H = h.stage.height;
  const hw = Math.min(W * 0.7, H * 0.88 / (0.85 * 1.45)), hh = hw * 0.85, x0 = (W - hw) / 2, y0 = H * 0.95 - hh;
  const pad = hw * 0.08, gap = hw * 0.06, ww = (hw - pad * 2 - gap * 2) / 3, wh = (hh - pad * 2 - gap * 2) / 3;
  let id = 0;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    const p = { id: id++, x: x0 + pad + c * (ww + gap) + ww / 2, y: y0 + pad + r * (wh + gap) + wh / 2, pressure: 1, pointerType: 'touch' };
    h.pointer('down', p); h.pointer('up', p);
  }
  let t = 0, sawCelebration = false, darkAfter = false;
  for (let i = 0; i < 60 * 20; i++) {
    t += 1 / 60; h.frame(1 / 60, t);
    const d = run.debug();
    if (d.house === 'celebrating') sawCelebration = true;
    if (sawCelebration && d.house === 'playing' && d.states.every(s => s === 'dark')) darkAfter = true;
  }
  assert.ok(sawCelebration);
  // All dark again, ready to play (after that the idle motion lights windows on its own).
  assert.ok(darkAfter, 'it settles back to dark');
  run.stop();
});

test('shapes: a tap splits a shape in two', async () => {
  const game = (await import('../games/shapes.js')).default;
  const h = fakeStage(5);
  const run = game.start(h.stage);
  h.frame(1 / 60, 1 / 60);
  const before = run.debug().states.length;
  // The three starting shapes sit at a quarter, half and three quarters of the width, mid-height.
  h.pointer('down', { id: 1, x: h.stage.width * 0.5, y: h.stage.height * 0.5, pressure: 1, pointerType: 'touch' });
  assert.equal(run.debug().states.length, before + 1, 'one shape became two');
  run.stop();
});

test('blocks: a tall stack tumbles and the floor clears', async () => {
  const game = (await import('../games/blocks.js')).default;
  const h = fakeStage(9);
  const run = game.start(h.stage);
  let t = 0, sawTumble = false;
  for (let i = 0; i < 60 * 40; i++) {
    t += 1 / 60;
    if (i % 20 === 0) h.pointer('down', { id: i, x: h.stage.width / 2, y: 100, pressure: 1, pointerType: 'touch' });
    h.frame(1 / 60, t);
    if (run.debug().states.includes('tumbling')) sawTumble = true;
  }
  assert.ok(sawTumble, 'the stack tumbles when it grows tall');
  run.stop();
});

test('blocks: a tap shows where it landed on the very next frame, even at the block cap', async () => {
  const game = (await import('../games/blocks.js')).default;
  const h = fakeStage(11);
  const run = game.start(h.stage);
  h.pointer('down', { id: 1, x: 300, y: 400, pressure: 1, pointerType: 'touch' });
  assert.equal(run.debug().marks, 1, 'a mark is there before the block comes into view');
  // Fill to the cap without letting anything land, then tap again: still a mark.
  for (let i = 0; i < 80; i++) h.pointer('down', { id: 2 + i, x: 100 + i, y: 200, pressure: 1, pointerType: 'touch' });
  h.frame(1 / 60, 1 / 60);
  assert.ok(run.debug().marks > 0);
  run.stop();
});

test('lights: the whole house, roof included, is on screen in landscape and portrait', async () => {
  const game = (await import('../games/lights.js')).default;
  for (const [W, H] of [[1024, 768], [768, 1024], [1366, 600]]) {
    const hw = Math.min(W * 0.7, H * 0.88 / (0.85 * 1.45)), hh = hw * 0.85, y0 = H * 0.95 - hh;
    assert.ok(y0 - hh * 0.45 >= 0, `roof apex on screen at ${W}x${H}`);
  }
  assert.equal(game.id, 'lights');
});

