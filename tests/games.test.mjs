// The gate for every game in games/registry.js (#430, antony [4805]). Each game runs against a fake
// shell for 60 s of frames: random multi-touch (up to 10 fingers), palm bursts of 10 pointers, a 5 s
// idle stretch and a turn of the tablet. A game fails if it throws, draws text (the fake ctx's
// fillText and strokeText throw), touches the network, leaves a timer running after stop(), passes
// the audio something that is not a positive number, or blows the draw-call or frame-time budget
// (main-thread CPU per frame: p95 <= 4 ms; one frame over 30 ms allowed, none over 100 ms).
// Strobing (nothing faster than 3 flashes a second) cannot be judged from a fake canvas: check it by eye.
//
//   node --test tests/games.test.mjs          (in isobox: isobox run node --test tests/games.test.mjs)
import { test } from 'node:test';
import assert from 'node:assert/strict';

const SECONDS = 60;
const FPS = 60;
const MAX_DRAWS_PER_FRAME = 1500;    // fills, strokes, rects and images: ~300 particles plus a scene
// CPU time of the main thread per frame (process.threadCpuUsage, pepocho b64ff27), after a 2 s warm-up
// for the JIT. Not wall time: other programs on a busy host would count. Not process.cpuUsage either:
// it adds V8's GC and compiler helper threads, which ran 2-3x the main thread's time (blob: 37.5 ms max
// vs 15.5 ms). No real drawing happens, so this is the game's own script.
// p95 and p99 judge the game's steady cost; the maximum only catches a real stall (aurora 557e6f0):
// one GC pause or host stall of ~30 ms is invisible to a child and must not fail a healthy game.
const FRAME_BUDGET_MS = { p95: 4, p99: 12, max: 100 };
const WARMUP_FRAMES = 2 * FPS;
const cpuNow = typeof process.threadCpuUsage === 'function' ? (prev) => process.threadCpuUsage(prev) : (prev) => process.cpuUsage(prev);

// ---- what the game is allowed to touch, recorded ----------------------------------------------

function makeRecord() {
  return { text: 0, network: [], drawsThisFrame: 0, maxDraws: 0, badAudio: [], audio: 0, errors: [] };
}

const DRAW_CALLS = new Set(['fill', 'stroke', 'fillRect', 'strokeRect', 'drawImage', 'putImageData']);

function fakeCtx(record, width = () => 1024, height = () => 768) {
  const gradient = { addColorStop() {} };
  const state = {};
  return new Proxy(state, {
    get(target, name) {
      if (name in target) return target[name];
      switch (name) {
        case 'fillText': case 'strokeText':
          return () => { record.text++; throw new Error('a game drew text'); };
        case 'measureText': return () => ({ width: 0 });
        case 'createLinearGradient': case 'createRadialGradient': case 'createConicGradient': return () => gradient;
        case 'createPattern': return () => ({});
        case 'getImageData': case 'createImageData':
          return (...a) => {
            const w = Math.max(1, Math.floor(typeof a[0] === 'object' ? a[0].width : (a.length >= 4 ? a[2] : a[0]))), h = Math.max(1, Math.floor(typeof a[0] === 'object' ? a[0].height : (a.length >= 4 ? a[3] : a[1])));
            return { width: w, height: h, data: new Uint8ClampedArray(Math.min(w * h * 4, 1 << 24)) };
          };
        case 'getTransform': return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
        case 'canvas': return { width: width(), height: height() };
        default:
          return () => { if (DRAW_CALLS.has(name)) record.drawsThisFrame++; };
      }
    },
    set(target, name, value) { target[name] = value; return true; },
  });
}

// Timers on a simulated clock, so a game's own setTimeout/setInterval/requestAnimationFrame work
// in the run and anything still pending after stop() is caught.
function installTimers(clock) {
  const saved = {};
  const names = ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame'];
  for (const n of names) saved[n] = globalThis[n];
  let next = 1;
  const pending = new Map();   // handle -> {due, fn, every}
  globalThis.setTimeout = (fn, ms = 0, ...args) => { const h = next++; pending.set(h, { due: clock.now + Math.max(0, ms) / 1000, fn: () => fn(...args), every: 0 }); return h; };
  globalThis.setInterval = (fn, ms = 0, ...args) => { const h = next++; const every = Math.max(1, ms) / 1000; pending.set(h, { due: clock.now + every, fn: () => fn(...args), every }); return h; };
  globalThis.clearTimeout = globalThis.clearInterval = (h) => { pending.delete(h); };
  globalThis.requestAnimationFrame = (fn) => { const h = next++; pending.set(h, { due: clock.now, fn: () => fn(clock.now * 1000), every: 0, raf: true }); return h; };
  globalThis.cancelAnimationFrame = (h) => { pending.delete(h); };
  return {
    pending,
    fire() {
      for (const [h, t] of [...pending]) {
        if (t.due > clock.now) continue;
        if (t.every > 0) t.due += t.every; else pending.delete(h);
        t.fn();
      }
    },
    restore() { for (const n of names) globalThis[n] = saved[n]; },
  };
}

function installNetworkWatch(record) {
  const saved = { fetch: globalThis.fetch, XMLHttpRequest: globalThis.XMLHttpRequest, WebSocket: globalThis.WebSocket, Image: globalThis.Image };
  globalThis.fetch = (url) => { record.network.push(`fetch ${url}`); return Promise.reject(new Error('offline')); };
  globalThis.XMLHttpRequest = class { open(m, url) { record.network.push(`xhr ${url}`); } send() {} setRequestHeader() {} };
  globalThis.WebSocket = class { constructor(url) { record.network.push(`websocket ${url}`); } close() {} send() {} };
  // Images are allowed only from inline data (an inline SVG, a data: or blob: URL).
  globalThis.Image = class {
    constructor() { this.width = 0; this.height = 0; this.complete = false; }
    set src(v) { this._src = String(v); if (!/^(data|blob):/.test(this._src)) record.network.push(`image ${this._src}`); }
    get src() { return this._src; }
  };
  return () => { Object.assign(globalThis, saved); };
}

// ---- the fake shell ----------------------------------------------------------------------------

function fakeShell(record, seed) {
  let s = seed >>> 0;
  const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  let width = 1024, height = 768;
  const frames = [], pointers = [];
  let running = true;
  const positive = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0;
  const stage = {
    canvas: { width: width * 2, height: height * 2, style: {} },
    ctx: fakeCtx(record, () => width, () => height),
    get width() { return width; }, get height() { return height; }, get dpr() { return 2; },
    onFrame(fn) { frames.push(fn); return () => { const i = frames.indexOf(fn); if (i >= 0) frames.splice(i, 1); }; },
    onPointer(h) { pointers.push(h); return () => { const i = pointers.indexOf(h); if (i >= 0) pointers.splice(i, 1); }; },
    audio: {
      note(freq, dur) { record.audio++; if (!positive(freq) || !positive(dur)) record.badAudio.push(`note(${freq}, ${dur})`); },
      pop() { record.audio++; },
      whoosh() { record.audio++; },
    },
    rand,
  };
  const guard = (fn) => { try { fn(); } catch (e) { record.errors.push(e); } };
  return {
    stage, rand,
    frame(dt, t) { if (!running) return; for (const f of frames.slice()) guard(() => f(dt, t)); },
    // The shell calls the callbacks a game registered; a game may leave some out.
    pointer(kind, p) { if (!running) return; for (const h of pointers.slice()) if (typeof h?.[kind] === 'function') guard(() => h[kind]({ ...p })); },
    resize(w, h) { width = w; height = h; },
    // After stop() the shell stops calling the game, as the real one drops the stage.
    halt() { running = false; },
  };
}

// ---- the run -----------------------------------------------------------------------------------

async function loadGames() {
  const { games } = await import('../games/registry.js');
  return games;
}

const games = await loadGames();

test('the registry lists twenty-five distinct games', () => {
  assert.equal(games.length, 25);
  assert.equal(new Set(games.map(g => g.id)).size, games.length);
});

for (const game of games) {
  test(`${game.id}: 60 s of touches, palms, idle and a turn, then stop()`, () => {
    const record = makeRecord();
    const clock = { now: 0 };
    const timers = installTimers(clock);
    const unwatch = installNetworkWatch(record);
    try {
      assert.equal(typeof game.id, 'string');
      assert.ok(Array.isArray(game.colors) && game.colors.length === 2 && game.colors.every(c => typeof c === 'string'), 'colors: two strings');
      assert.equal(typeof game.icon, 'function');
      assert.equal(typeof game.start, 'function');
      for (const t of [0, 1.3, 7]) game.icon(fakeCtx(record), 96, t);

      const shell = fakeShell(record, 0x430 + game.id.length);
      const run = game.start(shell.stage);
      assert.ok(run && typeof run.stop === 'function', 'start() returns { stop() }');

      const dt = 1 / FPS, frameMs = [];
      const down = new Map();
      let nextId = 1;
      for (let i = 0; i < SECONDS * FPS; i++) {
        clock.now += dt;
        const t = clock.now;
        const idle = t >= 30 && t < 35;   // 5 s without a touch, mid-run
        if (!idle) {
          if (down.size < 10 && shell.rand() < 0.25) {
            const p = { id: nextId++, x: shell.rand() * shell.stage.width, y: shell.rand() * shell.stage.height, pressure: 0.5, pointerType: 'touch' };
            down.set(p.id, p); shell.pointer('down', p);
          }
          for (const [, p] of down) {
            p.x = Math.min(shell.stage.width, Math.max(0, p.x + (shell.rand() - 0.5) * 50));
            p.y = Math.min(shell.stage.height, Math.max(0, p.y + (shell.rand() - 0.5) * 50));
            shell.pointer('move', p);
          }
          for (const [id, p] of down) if (shell.rand() < 0.07) { down.delete(id); shell.pointer('up', p); }
          if (i % (4 * FPS) === 2 * FPS) {   // a palm: 10 pointers at once within ~12 cm, then lifted
            const cx = shell.rand() * shell.stage.width, cy = shell.rand() * shell.stage.height;
            const palm = Array.from({ length: 10 }, () => ({ id: nextId++, x: cx + (shell.rand() - 0.5) * 140, y: cy + (shell.rand() - 0.5) * 140, pressure: 1, pointerType: 'touch' }));
            for (const p of palm) shell.pointer('down', p);
            shell.frame(dt, t);
            for (const p of palm) shell.pointer('up', p);
          }
        } else {
          for (const [id, p] of down) { down.delete(id); shell.pointer('up', p); }
        }
        if (i === 45 * FPS) shell.resize(768, 1024);   // the tablet turns
        record.drawsThisFrame = 0;
        const start = cpuNow();
        shell.frame(dt, t);
        timers.fire();
        const used = cpuNow(start);
        if (i >= WARMUP_FRAMES) frameMs.push((used.user + used.system) / 1000);
        record.maxDraws = Math.max(record.maxDraws, record.drawsThisFrame);
        if (record.errors.length) break;
      }
      for (const [, p] of down) shell.pointer('up', p);

      run.stop();
      shell.halt();
      const left = [...timers.pending.values()];
      assert.deepEqual(record.errors.map(e => String(e && e.stack || e).split('\n').slice(0, 3).join(' | ')), [], 'no exceptions');
      assert.equal(record.text, 0, 'no text is ever drawn');
      assert.deepEqual(record.network, [], 'nothing from the network');
      assert.deepEqual(record.badAudio, [], 'audio gets positive, finite numbers');
      assert.equal(left.length, 0, `stop() leaves no timers running (${left.length} pending${left.some(x => x.raf) ? ', some requestAnimationFrame' : ''})`);
      assert.ok(record.maxDraws <= MAX_DRAWS_PER_FRAME, `at most ${MAX_DRAWS_PER_FRAME} draw calls a frame (worst ${record.maxDraws})`);
      const sorted = frameMs.slice().sort((a, b) => a - b);
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const p99 = sorted[Math.floor(sorted.length * 0.99)];
      const max = sorted[sorted.length - 1];
      assert.ok(p95 <= FRAME_BUDGET_MS.p95, `frame CPU time p95 ${p95.toFixed(2)} ms <= ${FRAME_BUDGET_MS.p95}`);
      assert.ok(p99 <= FRAME_BUDGET_MS.p99, `frame CPU time p99 ${p99.toFixed(2)} ms <= ${FRAME_BUDGET_MS.p99}`);
      assert.ok(max <= FRAME_BUDGET_MS.max, `frame CPU time max ${max.toFixed(2)} ms <= ${FRAME_BUDGET_MS.max}`);
    } finally {
      timers.restore();
      unwatch();
    }
  });
}
