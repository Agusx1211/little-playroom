// Behaviour checks for pepocho's second batch (#430, antony [4840]): magnets, blob, rain, daynight.
import { test } from 'node:test';
import assert from 'node:assert/strict';

function fakeStage(seed = 1, width = 1024, height = 768) {
  let s = seed >>> 0;
  const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const gradient = { addColorStop() {} };
  const ctx = new Proxy({}, {
    get(t, n) { if (n in t) return t[n]; if (n === 'createLinearGradient' || n === 'createRadialGradient') return () => gradient; return () => {}; },
    set(t, n, v) { t[n] = v; return true; },
  });
  const frames = [], pointers = [];
  const record = { notes: 0, pops: 0, whooshes: 0 };
  const stage = {
    canvas: {}, ctx, get width() { return width; }, get height() { return height; }, get dpr() { return 2; },
    onFrame(fn) { frames.push(fn); return () => frames.splice(frames.indexOf(fn), 1); },
    onPointer(h) { pointers.push(h); return () => pointers.splice(pointers.indexOf(h), 1); },
    audio: { note() { record.notes++; }, pop() { record.pops++; }, whoosh() { record.whooshes++; } },
    rand,
  };
  let t = 0;
  return {
    stage, record,
    run(seconds) { for (let i = 0; i < seconds * 60; i++) { t += 1 / 60; for (const f of frames.slice()) f(1 / 60, t); } },
    pointer(kind, p) { for (const h of pointers.slice()) h[kind]?.({ pressure: 1, pointerType: 'touch', ...p }); },
  };
}

test('magnets: a held finger gathers the specks round it, and they spread again', async () => {
  const game = (await import('../games/magnets.js')).default;
  const h = fakeStage(2);
  const run = game.start(h.stage);
  const r = 120;
  const before = run.debug(300, 300, r).near;
  h.pointer('down', { id: 1, x: 300, y: 300 });
  h.run(3);
  const held = run.debug(300, 300, r).near;
  assert.ok(held > before * 3 && held > 40, `gathered: ${before} -> ${held}`);
  h.pointer('up', { id: 1, x: 300, y: 300 });
  h.run(8);
  assert.ok(run.debug(300, 300, r).near < held, 'they drift away again');
  assert.ok(run.debug().finite);
  run.stop();
});

test('blob: pokes and drags dent it, it stays finite and settles back round', async () => {
  const game = (await import('../games/blob.js')).default;
  const h = fakeStage(4);
  const run = game.start(h.stage);
  const hue0 = run.debug().hue;
  for (let k = 0; k < 20; k++) {
    h.pointer('down', { id: k, x: 512 + (k % 5) * 30, y: 384 + (k % 3) * 40 });
    for (let j = 0; j < 10; j++) { h.pointer('move', { id: k, x: 512 + j * 40, y: 384 - j * 25 }); h.run(1 / 30); }
    h.pointer('up', { id: k, x: 900, y: 100 });
  }
  assert.ok(run.debug().finite, 'no NaN after violent dragging');
  assert.notEqual(Math.round(run.debug().hue), Math.round(hue0), 'touching changed its colour');
  h.run(6);
  const [lo, hi] = run.debug().spread;
  assert.ok(lo > 0.8 && hi < 1.2, `round again (rim at ${lo.toFixed(2)}-${hi.toFixed(2)} of its radius)`);
  run.stop();
});

test('rain: tapping a cloud makes it rain, drops land as ripples, then it stops', async () => {
  const game = (await import('../games/rain.js')).default;
  const h = fakeStage(6);
  const run = game.start(h.stage);
  // The first cloud starts at 15 % of the width, 16 % of the height.
  h.pointer('down', { id: 1, x: 1024 * 0.15, y: 768 * 0.16 });
  assert.equal(run.debug().states[0], 'raining');
  h.run(1.5);
  assert.ok(run.debug().drops > 10, 'it rains');
  assert.ok(run.debug().ripples > 0, 'drops land as ripples');
  h.run(4);
  assert.equal(run.debug().states[0], 'idle', 'it stops after a while');
  // A tap on the sky brings a cloud over and it rains there.
  h.pointer('down', { id: 2, x: 600, y: 600 });
  assert.ok(run.debug().states.includes('raining'));
  run.stop();
});

test('daynight: pulling the sun down turns day to night and back, with no flicker at a boundary', async () => {
  const game = (await import('../games/daynight.js')).default;
  const h = fakeStage(8);
  const run = game.start(h.stage);
  h.run(0.2);
  assert.equal(run.debug().sky, 'day');
  h.pointer('down', { id: 1, x: 500, y: 200 });
  h.pointer('move', { id: 1, x: 500, y: 760 });
  h.run(1);
  assert.equal(run.debug().sky, 'night');
  h.pointer('move', { id: 1, x: 500, y: 100 });
  h.run(1);
  assert.equal(run.debug().sky, 'day');
  // Held right at the day/dusk boundary, it settles on one phase.
  let changes = 0, last = run.debug().sky;
  for (let i = 0; i < 120; i++) {
    h.pointer('move', { id: 1, x: 500, y: 768 * 0.72 - (768 * 0.6) * (0.5 + (i % 2 ? 0.02 : -0.02)) });
    h.run(1 / 60);
    if (run.debug().sky !== last) { changes++; last = run.debug().sky; }
  }
  assert.ok(changes <= 1, `no flicker (${changes} changes)`);
  run.stop();
});
