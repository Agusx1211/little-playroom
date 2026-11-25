import { games } from './games/registry.js';
import { createAudio } from './audio.js';

export const HOLD_MS = 2000;
export const BAR_MS = 4000;
const CORNER = 72;
const DRIFT = 24;
export const initialState = () => ({ mode: 'picker', muted: true });

function playing(state) { return { mode: 'playing', game: state.game, muted: state.muted }; }
function insideCorner(p) { return p.x >= 0 && p.y >= 0 && p.x < CORNER && p.y < CORNER; }

export function transition(state, event, now) {
  switch (state.mode) {
    case 'picker':
      return event.type === 'select' ? { mode: 'playing', game: event.game, muted: state.muted } : state;
    case 'playing':
      if (event.type === 'down' && insideCorner(event)) {
        return { ...state, mode: 'holding', id: event.id, x: event.x, y: event.y, until: now + HOLD_MS };
      }
      return state;
    case 'holding': {
      if (event.type === 'pause') return playing(state);
      if (event.type === 'tick' && now >= state.until) {
        return { ...playing(state), mode: 'parent', until: now + BAR_MS };
      }
      if (state.id !== event.id) return state;
      const movedAway = event.type === 'move' && (!insideCorner(event) || Math.hypot(event.x - state.x, event.y - state.y) > DRIFT);
      return event.type === 'up' || movedAway ? playing(state) : state;
    }
    case 'parent':
      if (event.type === 'pause' || (event.type === 'tick' && now >= state.until)) return playing(state);
      if (event.type === 'home') return { mode: 'picker', muted: state.muted };
      if (event.type === 'sound') return { ...state, muted: !state.muted, until: now + BAR_MS };
      if (event.type === 'interact') return { ...state, until: now + BAR_MS };
      return state;
    default:
      throw new Error('Unknown shell mode');
  }
}

function fitCanvas(canvas, width, height, dpr) {
  const w = Math.max(1, Math.round(width * dpr));
  const h = Math.max(1, Math.round(height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
}

function buildPicker(container, select) {
  const tiles = games.map(game => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tile';
    button.setAttribute('aria-label', game.id);
    button.style.setProperty('--tint', game.colors[0]);
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    button.append(canvas);
    button.addEventListener('click', () => select(game.id));
    container.append(button);
    return { game, button, canvas, ctx: canvas.getContext('2d'), size: 0 };
  });
  let dpr = 1;
  let last = -Infinity;
  function resize() {
    dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    for (const tile of tiles) {
      const bounds = tile.button.getBoundingClientRect();
      tile.size = Math.min(bounds.width, bounds.height);
      tile.canvas.style.width = tile.canvas.style.height = tile.size + 'px';
      fitCanvas(tile.canvas, tile.size, tile.size, dpr);
    }
    last = -Infinity;
  }
  function frame(t) {
    if (t - last < 0.09) return;
    last = t;
    for (const { game, ctx, size } of tiles) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      ctx.save();
      game.icon(ctx, size, t);
      ctx.restore();
    }
  }
  return { resize, frame };
}

export function createStage(canvas, audio) {
  const ctx = canvas.getContext('2d');
  let width = 1, height = 1, dpr = 1;
  const frames = new Set();
  const pointers = new Set();
  let session;
  const active = new Map();
  function subscribe(list, handler) {
    const subscription = { handler };
    list.add(subscription);
    return () => list.delete(subscription);
  }
  function notify(type, p) {
    for (const { handler } of [...pointers]) handler[type]?.({ ...p });
  }
  const stage = {
    canvas, ctx, audio, rand: Math.random,
    get width() { return width; }, get height() { return height; }, get dpr() { return dpr; },
    onFrame(callback) { return subscribe(frames, callback); },
    onPointer(callbacks) { return subscribe(pointers, callbacks); },
  };
  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = rect.width; height = rect.height;
    dpr = Math.min(globalThis.devicePixelRatio || 1, 2);
    fitCanvas(canvas, width, height, dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function releaseAll() {
    for (const p of active.values()) notify('up', p);
    active.clear();
  }
  function stop() {
    releaseAll();
    session?.stop();
    session = null;
    frames.clear();
    pointers.clear();
  }
  function start(game) {
    // A new game must receive a clean context even if the pixel dimensions stayed the same.
    canvas.width = Math.max(1, canvas.width);
    resize();
    session = game.start(stage);
  }
  function pointer(type, p) {
    if (type !== 'down' && !active.has(p.id)) return;
    if (type === 'up') active.delete(p.id);
    else active.set(p.id, p);
    notify(type, p);
  }
  function frame(dt, t) {
    for (const { handler } of [...frames]) handler(dt, t);
  }
  return { resize, releaseAll, start, stop, pointer, frame };
}

function boot() {
  const pickerElement = document.querySelector('#picker');
  const canvas = document.querySelector('#stage');
  const bar = document.querySelector('#parents');
  const sound = document.querySelector('#sound');
  const hold = document.querySelector('#hold');
  const audio = createAudio();
  const game = createStage(canvas, audio);
  const picker = buildPicker(document.querySelector('#tiles'), id => dispatch({ type: 'select', game: id }));
  let state = initialState();
  let lastFrame = null;
  let frameId;
  function dispatch(event, now = performance.now()) {
    const next = transition(state, event, now);
    if (state === next) return;
    const before = state;
    state = next;
    const selecting = state.mode === 'picker';
    pickerElement.hidden = !selecting;
    canvas.hidden = selecting;
    bar.hidden = state.mode !== 'parent';
    hold.toggleAttribute('hidden', state.mode !== 'holding');
    if (state.mode === 'holding' && before.mode !== 'holding') hold.style.setProperty('--offset', 100);
    if (before.muted !== state.muted) audio.setMuted(state.muted);
    sound.setAttribute('aria-pressed', String(!state.muted));
    if (before.game !== state.game) {
      game.stop();
      if (selecting) picker.resize();
      else game.start(games.find(item => item.id === state.game));
      lastFrame = null;
    }
  }
  function draw(now) {
    dispatch({ type: 'tick' }, now);
    if (state.mode === 'picker') picker.frame(now / 1000);
    else game.frame(lastFrame === null ? 0 : Math.min(0.05, (now - lastFrame) / 1000), now / 1000);
    if (state.mode === 'holding') hold.style.setProperty('--offset', 100 * Math.max(0, state.until - now) / HOLD_MS);
    lastFrame = now;
    frameId = requestAnimationFrame(draw);
  }
  function handlePointer(type, event) {
    if (event.pointerType === 'mouse' && type === 'down' && event.button !== 0) return;
    const rect = canvas.getBoundingClientRect();
    const p = { id: event.pointerId, x: event.clientX - rect.left, y: event.clientY - rect.top,
      pressure: event.pressure, pointerType: event.pointerType };
    if (type === 'down') canvas.setPointerCapture(event.pointerId);
    dispatch({ type, ...p });
    game.pointer(type, p);
  }
  for (const [name, type] of [['pointerdown','down'], ['pointermove','move'], ['pointerup','up'],
    ['pointercancel','up'], ['lostpointercapture','up']]) {
    canvas.addEventListener(name, event => handlePointer(type, event));
  }
  bar.addEventListener('pointerdown', () => dispatch({ type: 'interact' }));
  document.querySelector('#home').addEventListener('click', () => dispatch({ type: 'home' }));
  sound.addEventListener('click', () => dispatch({ type: 'sound' }));
  for (const name of ['contextmenu','selectstart','dragstart','gesturestart','gesturechange','gestureend']) {
    document.addEventListener(name, event => event.preventDefault(), { passive: false });
  }
  const resize = () => state.mode === 'picker' ? picker.resize() : game.resize();
  new ResizeObserver(resize).observe(document.documentElement);
  window.addEventListener('resize', resize);
  let wakeRequest;
  function keepAwake() {
    if (document.hidden || wakeRequest || !navigator.wakeLock) return;
    wakeRequest = navigator.wakeLock.request('screen').then(lock => {
      lock.addEventListener('release', () => { wakeRequest = null; }, { once: true });
    }).catch(() => { wakeRequest = null; });
  }
  document.addEventListener('pointerdown', keepAwake, { passive: true });
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(frameId);
    lastFrame = null;
    if (document.hidden) {
      game.releaseAll();
      dispatch({ type: 'pause' });
    } else {
      resize();
      keepAwake();
      frameId = requestAnimationFrame(draw);
    }
  });
  picker.resize();
  frameId = requestAnimationFrame(draw);
  keepAwake();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(error => console.warn('Offline setup failed', error));
  }
}

if (typeof document !== 'undefined') boot();
