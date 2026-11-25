// Behaviour checks for pepocho's third batch (#430, antony [4859]): peekaboo, balloons, pond.
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
  const size = { width, height };
  const stage = {
    canvas: {}, ctx, get width() { return size.width; }, get height() { return size.height; }, get dpr() { return 2; },
    onFrame(fn) { frames.push(fn); return () => frames.splice(frames.indexOf(fn), 1); },
    onPointer(h) { pointers.push(h); return () => pointers.splice(pointers.indexOf(h), 1); },
    audio: { note() { record.notes++; }, pop() { record.pops++; }, whoosh() { record.whooshes++; } },
    rand,
  };
  let t = 0;
  return {
    stage, record, size,
    run(seconds) { for (let i = 0; i < Math.round(seconds * 60); i++) { t += 1 / 60; for (const f of frames.slice()) f(1 / 60, t); } },
    pointer(kind, p) { for (const h of pointers.slice()) h[kind]?.({ pressure: 1, pointerType: 'touch', ...p }); },
    tap(id, x, y) { this.pointer('down', { id, x, y }); this.pointer('up', { id, x, y }); },
  };
}

test('peekaboo: a tap on a bush brings a face up, it ducks back, a tap while up giggles', async () => {
  const game = (await import('../games/peekaboo.js')).default;
  const h = fakeStage(3);
  const run = game.start(h.stage);
  assert.deepEqual(run.debug().states, ['hidden', 'hidden', 'hidden']);
  // The middle bush sits at the middle of the width.
  h.tap(1, 512, 540);
  assert.equal(run.debug().states[1], 'rising', 'the face starts up at once');
  h.run(0.5);
  assert.equal(run.debug().states[1], 'shown');
  const notes = h.record.notes;
  h.tap(2, 512, 450);
  assert.ok(h.record.notes > notes, 'a giggle');
  h.run(1.5);
  assert.equal(run.debug().states[1], 'shown', 'a giggle restarts its time up');
  h.run(0.9);   // 2.4 s after the giggle: past the 2.2 s up, inside the 0.45 s duck
  assert.equal(run.debug().states[1], 'sinking');
  h.run(1);
  assert.equal(run.debug().states[1], 'hidden');
  // Idle: one of them teases by itself.
  h.run(10);
  const seen = new Set();
  for (let i = 0; i < 300; i++) { h.run(1 / 60); for (const s of run.debug().states) seen.add(s); }
  assert.ok(seen.has('teasing'), 'a friend peeks out alone when nobody touches');
  // The tablet turns: the bushes stay on screen and taps still find them.
  h.size.width = 768; h.size.height = 1024;
  h.tap(3, 768 / 6, 700);
  assert.equal(run.debug().states[0], 'rising');
  run.stop();
});

test('balloons: tapping a balloon pops it into confetti; tapping the sky blows a new one up', async () => {
  const game = (await import('../games/balloons.js')).default;
  const h = fakeStage(5);
  const run = game.start(h.stage);
  h.run(0.1);
  const b = run.debug().balloons.find(x => x.state === 'rising' && x.y > 100 && x.y < 700);
  assert.ok(b, 'there are balloons in the sky from the start');
  h.tap(1, b.x, b.y);
  assert.ok(run.debug().balloons.some(x => x.state === 'popping'), 'it pops at once');
  assert.ok(h.record.pops >= 1);
  h.run(0.3);
  assert.ok(run.debug().confetti > 10, 'confetti');
  // Find an empty spot of sky, tap it: a balloon inflates there, then rises.
  let spot = null;
  for (let y = 100; y < 700 && !spot; y += 40) for (let x = 60; x < 1000 && !spot; x += 40) {
    if (run.debug().balloons.every(q => Math.hypot(q.x - x, q.y - y) > 200)) spot = { x, y };
  }
  assert.ok(spot);
  h.pointer('down', { id: 2, x: spot.x, y: spot.y });
  const mine = run.debug().balloons.find(q => q.state === 'inflating');
  assert.ok(mine && Math.abs(mine.x - spot.x) < 1, 'a balloon starts under the finger');
  h.run(0.5);
  h.pointer('up', { id: 2, x: spot.x, y: spot.y });
  h.run(2);
  assert.ok(!run.debug().balloons.some(q => q.state === 'inflating'), 'it floats away');
  // A storm of taps never goes past the cap.
  for (let k = 0; k < 200; k++) h.tap(10 + k, (k * 37) % 1024, (k * 53) % 768);
  h.run(0.1);
  assert.ok(run.debug().balloons.filter(q => q.state !== 'popping').length <= 14, 'at most 14 balloons');
  assert.ok(run.debug().balloons.length <= 14 + 8, 'at most 8 bursts besides');
  assert.ok(run.debug().entities < 300);
  run.stop();
});

test('pond: a held finger gathers fish round it; let go and they swim off', async () => {
  const game = (await import('../games/pond.js')).default;
  const h = fakeStage(9);
  const run = game.start(h.stage);
  h.run(0.5);
  const r = 160;
  const before = run.debug(512, 384, r).near;
  h.pointer('down', { id: 1, x: 512, y: 384 });
  assert.ok(run.debug().entities > 9 + 5, 'a ripple at once');
  h.run(4);
  const held = run.debug(512, 384, r).near;
  assert.ok(held >= 4 && held > before, `fish gather: ${before} -> ${held}`);
  assert.ok(run.debug().states.includes('nibbling'));
  h.pointer('up', { id: 1, x: 512, y: 384 });
  h.run(6);
  assert.ok(!run.debug().states.includes('nibbling'), 'they swim off once the finger is gone');
  assert.ok(run.debug().finite);
  run.stop();
});
