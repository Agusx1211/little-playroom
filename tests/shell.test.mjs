import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { transition, initialState, createStage, HOLD_MS, BAR_MS } from '../shell.js';
import { createAudio } from '../audio.js';
import { games } from '../games/registry.js';

const enter = () => transition(initialState(), { type: 'select', game: 'bubbles' }, 0);
const pointer = (type, id = 2, x = 12, y = 12) => ({ type, id, x, y });
const hold = () => transition(enter(), pointer('down'), 0);
const bar = () => transition(hold(), {type: 'tick'}, HOLD_MS);

test('picker boots muted and only a game selection leaves it', () => {
  const state = initialState();
  assert.deepEqual(state, { mode: 'picker', page: 0, muted: true });
  for (const type of ['home','sound','next','down','up','interact','pause','tick']) {
    assert.equal(transition(state, {type}, 5000), state);
  }
  assert.deepEqual(enter(), {mode: 'playing', game: 'bubbles', muted: true});
});

test('only the corner can arm a hold; game touches and parent actions cannot switch games', () => {
  const state = enter();
  for (const event of [pointer('down', 1, 73, 10), pointer('down', 2, 0, 100),
    pointer('down', 3, -2, 8), {type:'home'},{type:'sound'},{type:'select',game:'snow'}]) {
    assert.equal(transition(state, event, 100), state);
  }
  assert.equal(hold().mode, 'holding');
  assert.equal(transition(hold(), {type:'tick'}, HOLD_MS - 1).mode, 'holding');
  assert.equal(bar().mode, 'parent');
});

test('tap, drag or interruption cancels a hold without exiting the game', () => {
  for (const event of [pointer('up'), pointer('move', 2, 60, 11), {type:'pause'}]) {
    const state = transition(hold(), event, 800);
    assert.deepEqual(state, enter());
    assert.equal(transition(state, {type:'tick'}, HOLD_MS + 50).mode, 'playing');
  }
  const edge = transition(enter(), pointer('down', 42, 68, 69), 10);
  assert.equal(transition(edge, pointer('move', 42, 73, 69), 12).mode, 'playing');
});

test('another nine fingers cannot steal, cancel, or finish the holding finger’s gesture', () => {
  let state = hold();
  for (let id = 10; id < 19; id++) {
    for (const type of ['down','move','up']) state = transition(state, pointer(type,id), 100);
  }
  assert.equal(state.id, 2);
  assert.equal(transition(state, pointer('move', 2, 19, 18), 500), state);
  assert.equal(transition(state, {type:'tick'}, HOLD_MS).mode, 'parent');
});

test('only parent home exits; controls time out four seconds after last use', () => {
  const parent = bar();
  assert.equal(transition(parent, {type:'tick'}, HOLD_MS + BAR_MS - 1), parent);
  assert.deepEqual(transition(parent, {type:'tick'}, HOLD_MS + BAR_MS), enter());
  const sound = transition(parent, {type:'sound'}, 4500);
  assert.equal(sound.muted, false);
  assert.equal(sound.until, 8500);
  const touched = transition(sound, {type:'interact'}, 7000);
  assert.equal(touched.until, 11000);
  assert.deepEqual(transition(touched, {type:'home'}, 8100), {mode:'picker',page:0,muted:false});
  assert.equal(transition(sound, {type:'pause'}, 4600).mode, 'playing');
});

test('next changes games directly, wraps around, and keeps the sound setting', () => {
  let state = transition(bar(), {type:'sound'}, 2500);
  for (let i = 1; i <= games.length; i++) {
    state = transition(state, {type:'next'}, 2500 + i);
    assert.deepEqual(state, {mode:'playing', game:games[i % games.length].id, muted:false});
  }
  assert.deepEqual(transition(hold(), {type:'next'}, 300), {mode:'playing', game:games[1].id, muted:true});
});

test('picker navigation stops at the ends and home returns to the page of the active game', () => {
  const lastPage = Math.ceil(games.length / 20) - 1;
  const back = {type:'turnPage', direction:-1};
  const forward = {type:'turnPage', direction:1};
  let state = initialState();
  assert.equal(transition(state, back, 0), state);
  for (let i = 1; i <= lastPage; i++) {
    state = transition(state, forward, i);
    assert.equal(state.page, i);
  }
  assert.equal(transition(state, forward, 10), state);
  state = transition(state, {type:'select', game:games.at(-1).id}, 20);
  state = transition(state, pointer('down'), 30);
  state = transition(state, {type:'tick'}, 30 + HOLD_MS);
  assert.equal(transition(state, {type:'home'}, 40 + HOLD_MS).page, lastPage);
});

test('sound helpers are silent and callable before audio access and without a device', () => {
  const audio = createAudio();
  assert.equal(audio.muted, true);
  audio.note(220, 0.2); audio.pop(); audio.whoosh();
  audio.setMuted(false); audio.note(220, 0.2); audio.setMuted(true);
  assert.equal(audio.muted, true);
});

const root = new URL('../', import.meta.url);
async function cachedPaths() {
  const scope = 'https://example.test/nested/';
  let handler, ready, paths;
  const worker = { registration:{ scope }, skipWaiting() {}, addEventListener(name, fn) { if (name === 'install') handler = fn; } };
  const caches = { async open() { return { async addAll(requests) {
    paths = Array.from(requests, request => request.url.slice(scope.length)).sort();
    assert.ok(requests.every(request => request.url.startsWith(scope) && request.cache === 'reload'));
  } }; } };
  vm.runInNewContext(await readFile(new URL('sw.js',root),'utf8'), { self:worker, caches, URL, Request });
  handler({ waitUntil(promise) { ready = promise; } });
  await ready;
  return paths;
}

test('install precaches every runtime file under the app scope, including all 20 registered games', async () => {
  assert.equal(games.length, 20);
  assert.equal(new Set(games.map(game => game.id)).size, 20);
  const paths = await cachedPaths();
  const expected = ['index.html','manifest.webmanifest','audio.js','shell.js','sw.js'];
  for (const dir of ['games','icons']) {
    for (const name of await readdir(new URL(dir+'/', root))) expected.push(dir+'/'+name);
  }
  for (const file of expected) assert.ok(paths.includes(file), file+' is missing from the cache');
  for (const file of paths) await readFile(new URL(file, root));
  for (const game of games) assert.ok(paths.includes('games/'+game.id+'.js'));
});

test('stage permits independent frame and pointer subscriptions and clears them between games', () => {
  const canvas = {width:1, height:1, getContext:()=>({setTransform(){}}), getBoundingClientRect:()=>({width:800,height:600})};
  const host = createStage(canvas, createAudio());
  const calls = [];
  let offFirst, offA;
  host.start({ start(stage) {
    const frame = () => calls.push('frame');
    offFirst = stage.onFrame(frame);
    stage.onFrame(frame);
    offA = stage.onPointer({ down: p => { calls.push('a'+p.x); p.x=200; } });
    stage.onPointer({ down: p => calls.push('b'+p.x), up: () => calls.push('up') });
    return {stop(){}};
  } });
  host.pointer('down', {id:1,x:7});
  host.frame(0.01, 1);
  offFirst(); offFirst(); offA(); offA();
  host.pointer('down', {id:2,x:8});
  host.frame(0.02, 2);
  host.stop();
  host.frame(0.01, 3);
  assert.deepEqual(calls,['a7','b7','frame','frame','b8','frame','up','up']);
});

// Node's module parser finds static imports and re-exports without evaluating any game.
// Dynamic paths must be literal so the offline inventory can be checked before a flight.
function dependencies(sources) {
  const script = `const vm = require('node:vm'), fs = require('node:fs');
    const sources = JSON.parse(fs.readFileSync(0,'utf8'));
    const graph = sources.map(source=>new vm.SourceTextModule(source).dependencySpecifiers);
    process.stdout.write(JSON.stringify(graph));`;
  const statics = JSON.parse(execFileSync(process.execPath, ['--no-warnings','--experimental-vm-modules','-e',script],
    {input:JSON.stringify(sources), encoding:'utf8'}));
  return statics.map((items, i) => {
    for (const match of sources[i].matchAll(/\bimport\s*(?:(?:\/\*[\s\S]*?\*\/|\/\/[^\n]*\n)\s*)*\(\s*(?:'([^'\\]*)'|"([^"\\]*)")?\s*(\))?/g)) {
      assert.ok(match[3] && (match[1] || match[2]), 'Offline dynamic imports require a literal local module path');
      items.push(match[1] || match[2]);
    }
    return items;
  });
}

test('every module dependency resolves to a precached local file, including re-exports and lazy imports', async () => {
  const cache = new Set(await cachedPaths());
  const paths = [...cache].filter(path => path.endsWith('.js'));
  const graph = dependencies(await Promise.all(paths.map(path=>readFile(new URL(path,root),'utf8'))));
  for (const [index, imports] of graph.entries()) {
    for (const specifier of imports) {
      assert.match(specifier, /^\.\.?\//, paths[index]+' imports a non-local URL: '+specifier);
      const file = new URL(specifier, new URL(paths[index], root));
      assert.ok(file.href.startsWith(root.href) && cache.has(file.href.slice(root.href.length)),
        paths[index]+' imports '+specifier+' which is missing from the offline cache');
    }
  }
  assert.deepEqual(dependencies(["import './one.js'; export * from './two.js'; const get = () => import /* lazy */ ('./three.js');"]),
    [['./one.js','./two.js','./three.js']]);
  assert.throws(()=>dependencies(['const get = name => import(name);']), /literal local module path/);
});
