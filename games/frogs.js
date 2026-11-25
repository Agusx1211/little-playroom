// frogs: a warm river with lily pads. Every touch calls the nearest frog: it crouches and leaps in a
// long arc to the finger — splashing into the water or landing on a pad — then sits up and croaks.
// A finger held still keeps that frog waiting by the finger, ready to hop again. When nobody touches,
// a frog now and then hops after a fly.

const MAX_PADS = 7;
const FROGS = 5;
const MAX_DROPS = 90;
const MAX_RINGS = 20;
const HOP_S = 0.55;

// A frog's mind, as explicit states:
//   SITTING -(finger calls, hop planned)-> CROUCHING (0.12 s) -(push off)-> HOPPING
//   HOPPING -(touchdown)-> SETTLING (0.2 s) -> SITTING. A call while hopping queues the next hop.
const Mood = Object.freeze({ SITTING: 'sitting', CROUCHING: 'crouching', HOPPING: 'hopping', SETTLING: 'settling' });

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export default {
  id: 'frogs',
  colors: ['#7fd17f', '#2e7d5b'],

  icon(ctx, size, t) {
    ctx.fillStyle = '#2e7d5b';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#3f8f4f';
    ctx.beginPath();
    ctx.ellipse(size * 0.5, size * 0.78, size * 0.42, size * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
    const hop = Math.abs(Math.sin(t * 2.2));
    const y = size * (0.62 - hop * 0.28);
    ctx.fillStyle = '#57b65f';
    ctx.beginPath();
    ctx.ellipse(size * 0.5, y, size * 0.3, size * 0.22 * (1 - hop * 0.12), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fffce8';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(size * 0.5 + s * size * 0.13, y - size * 0.17, size * 0.08, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#1d3b1f';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(size * 0.5 + s * size * 0.13, y - size * 0.17, size * 0.035, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  start(stage) {
    const ctx = stage.ctx;
    let stopped = false;
    let sinceTouch = 0, idleClock = 0, sinceCroak = 0;
    const short = () => Math.min(stage.width, stage.height);
    const waterY = () => stage.height * 0.34;
    const frogR = () => clamp(short() * 0.07, 22, 64);
    const pads = Array.from({ length: MAX_PADS }, (_, i) => ({
      x: stage.width * (0.1 + 0.8 * stage.rand()), y: waterY() + (stage.height - waterY()) * stage.rand() * 0.75,
      r: short() * (0.07 + stage.rand() * 0.04), bob: stage.rand() * 7, notch: stage.rand() * Math.PI * 2,
    }));
    const frogs = Array.from({ length: FROGS }, (_, i) => ({
      x: pads[i % pads.length].x, y: pads[i % pads.length].y - pads[i % pads.length].r * 0.25,
      mood: Mood.SITTING, clock: 0, from: null, to: null, queued: null, croak: 0, seed: stage.rand(),
      facing: stage.rand() < 0.5 ? -1 : 1,
    }));
    const drops = [], rings = [];
    const fingers = new Map();

    function planHop(f, x, y) {
      const goal = { x: clamp(x, 0, stage.width), y: clamp(y, waterY() - short() * 0.1, stage.height * 0.96) };
      if (f.mood === Mood.SITTING) { f.to = goal; f.mood = Mood.CROUCHING; f.clock = 0; f.from = { x: f.x, y: f.y }; }
      else if (f.mood === Mood.HOPPING || f.mood === Mood.SETTLING) { f.queuedTarget = goal; f.queued = true; }
      else f.to = goal;   // already CROUCHING: just aim again
    }

    function splash(x, y, big) {
      const n = big ? 8 : 4;
      for (let k = 0; k < n && drops.length < MAX_DROPS; k++) {
        drops.push({
          x, y, vx: (stage.rand() - 0.5) * short() * 0.5, vy: -short() * (0.3 + stage.rand() * 0.4), life: 1,
        });
      }
    }

    function croak(f) {
      if (sinceCroak > 0.14) { stage.audio.note(150 + f.seed * 60, 0.12); stage.audio.note(110 + f.seed * 40, 0.18); sinceCroak = 0; }
      f.croak = 1;
    }

    function land(f) {
      const wet = f.y > waterY();
      if (wet) { splash(f.x, f.y, true); stage.audio.whoosh(); }
      else stage.audio.pop();
      if (rings.length < MAX_RINGS) rings.push({ x: f.x, y: f.y, r: frogR() * 0.6, life: 1, wet });
      croak(f);
      if (f.queued) {   // SETTLING is skipped: it crouches straight into the queued hop
        f.queued = false;
        f.to = f.queuedTarget; f.queuedTarget = null;
        f.mood = Mood.CROUCHING; f.clock = 0; f.from = { x: f.x, y: f.y };
      } else f.mood = Mood.SETTLING;
    }

    function stepFrog(f, dt) {
      f.clock += dt;
      f.croak = Math.max(0, f.croak - dt * 2.5);
      switch (f.mood) {
        case Mood.SITTING: break;
        case Mood.CROUCHING:
          if (f.clock >= 0.12) { f.mood = Mood.HOPPING; f.clock = 0; }   // CROUCHING -> HOPPING
          break;
        case Mood.HOPPING: {
          const k = clamp(f.clock / HOP_S, 0, 1);
          f.x = f.from.x + (f.to.x - f.from.x) * k;
          f.y = f.from.y + (f.to.y - f.from.y) * k;
          f.facing = f.to.x >= f.from.x ? 1 : -1;
          if (k >= 1) land(f);   // HOPPING -> SETTLING (or CROUCHING again if queued)
          break;
        }
        case Mood.SETTLING:
          if (f.clock > 0.2) { f.mood = Mood.SITTING; f.clock = 0; }   // SETTLING -> SITTING
          break;
      }
    }

    const offFrame = stage.onFrame((dt, t) => {
      if (stopped) return;
      sinceTouch += dt; sinceCroak += dt;
      // Idle: after 5 s a frog hops after a fly somewhere on the water.
      if (sinceTouch > 5) {
        idleClock += dt;
        if (idleClock > 5) {
          idleClock = 0;
          const f = frogs.find(x => x.mood === Mood.SITTING) || frogs[0];
          planHop(f, stage.width * (0.1 + stage.rand() * 0.8), waterY() + (stage.height - waterY()) * stage.rand());
        }
      }
      for (const f of frogs) stepFrog(f, dt);
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        d.vy += short() * 2.4 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.life -= dt * 1.2;
        if (d.life <= 0 || d.y > stage.height) drops.splice(i, 1);
      }
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.r += dt * short() * (r.wet ? 0.3 : 0.18); r.life -= dt * 1.4;
        if (r.life <= 0) rings.splice(i, 1);
      }

      // sky, bank, water
      const sky = ctx.createLinearGradient(0, 0, 0, waterY());
      sky.addColorStop(0, '#ffe9a8'); sky.addColorStop(1, '#c9e8a0');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, stage.width, waterY());
      const water = ctx.createLinearGradient(0, waterY(), 0, stage.height);
      water.addColorStop(0, '#5fb3a1'); water.addColorStop(1, '#2e7d5b');
      ctx.fillStyle = water;
      ctx.fillRect(0, waterY(), stage.width, stage.height - waterY());
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 2;
      for (let k = 0; k < 5; k++) {
        const y = waterY() + (stage.height - waterY()) * (0.15 + k * 0.18);
        ctx.beginPath();
        ctx.moveTo(((t * 20 + k * 140) % (stage.width + 160)) - 80, y);
        ctx.lineTo(((t * 20 + k * 140) % (stage.width + 160)) - 20, y);
        ctx.stroke();
      }
      // lily pads
      for (const p of pads) {
        const bob = Math.sin(t * 1.1 + p.bob) * short() * 0.004;
        ctx.fillStyle = '#3f8f4f';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y + bob);
        ctx.arc(p.x, p.y + bob, p.r, p.notch + 0.4, p.notch + Math.PI * 2 - 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(20,70,40,0.35)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y + bob, p.r * 0.7, 0, Math.PI * 2);
        ctx.stroke();
      }
      // rings (splash rings on water, dust rings on land)
      for (const r of rings) {
        ctx.globalAlpha = clamp(r.life, 0, 1) * 0.6;
        ctx.strokeStyle = r.wet ? '#eafcff' : '#ffe9a8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(r.x, r.y, r.r, r.r * 0.4, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // frogs: body + eyes + throat that puffs on the croak
      for (const f of frogs) {
        const r = frogR();
        const crouch = f.mood === Mood.CROUCHING ? 0.82 : 1;
        const hopLift = f.mood === Mood.HOPPING ? Math.sin(clamp(f.clock / HOP_S, 0, 1) * Math.PI) * r * 0.9 : 0;
        const y = f.y - hopLift;
        ctx.fillStyle = 'rgba(10,40,25,0.25)';
        ctx.beginPath();
        ctx.ellipse(f.x, f.y + r * 0.55, r * 0.9, r * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#4da253';
        ctx.beginPath();
        ctx.ellipse(f.x, y, r * 1.05, r * 0.8 * crouch, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#6fc36f';
        ctx.beginPath();
        ctx.ellipse(f.x, y + r * 0.2, r * 0.7, r * 0.42 * crouch, 0, 0, Math.PI * 2);
        ctx.fill();
        // back legs
        ctx.strokeStyle = '#3f8f4f';
        ctx.lineWidth = r * 0.22;
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.arc(f.x + s * r * 0.95, y + r * 0.2, r * 0.4, s > 0 ? -0.6 : Math.PI + 0.6, s > 0 ? 1.2 : Math.PI - 1.2);
          ctx.stroke();
        }
        // eyes on top, blink slow
        const blink = (Math.sin(t * 0.7 + f.seed * 11) > 0.985) ? 0.25 : 1;
        ctx.fillStyle = '#fffce8';
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.ellipse(f.x + s * r * 0.5, y - r * 0.7, r * 0.3, r * 0.3 * blink, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#1d3b1f';
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.arc(f.x + s * r * 0.5 + f.facing * r * 0.06, y - r * 0.7, r * 0.12 * blink, 0, Math.PI * 2);
          ctx.fill();
        }
        // croaking throat
        if (f.croak > 0.05) {
          ctx.fillStyle = '#8fd18f';
          ctx.beginPath();
          ctx.ellipse(f.x + f.facing * r * 0.3, y + r * 0.45, r * 0.5 * f.croak, r * 0.34 * f.croak, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // splash drops
      ctx.fillStyle = '#eafcff';
      for (const d of drops) {
        ctx.globalAlpha = clamp(d.life, 0, 1);
        ctx.beginPath();
        ctx.arc(d.x, d.y, short() * 0.006 + 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // finger markers: a waiting frog keeps a ripple hint under the finger
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 2;
      for (const [, p] of fingers) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, short() * 0.03 + Math.sin(t * 3) * 2, 0, Math.PI * 2);
        ctx.stroke();
      }
    });

    const offPointer = stage.onPointer({
      down(p) {
        if (stopped) return;
        sinceTouch = 0;
        fingers.set(p.id, { x: p.x, y: p.y });
        if (rings.length < MAX_RINGS) rings.push({ x: p.x, y: p.y, r: short() * 0.03, life: 1, wet: p.y > waterY() });
        // the nearest frog takes the call (mid-hop it queues for the landing)
        let best = null, bestD = Infinity;
        for (const f of frogs) {
          const d = Math.hypot(f.x - p.x, f.y - p.y);
          if (d < bestD) { bestD = d; best = f; }
        }
        if (best) planHop(best, p.x, p.y);
      },
      move(p) {
        if (fingers.has(p.id)) fingers.set(p.id, { x: p.x, y: p.y });
      },
      up(p) { fingers.delete(p.id); },
    });

    return {
      stop() {
        stopped = true;
        for (const off of [offFrame, offPointer]) if (typeof off === 'function') off();
      },
      debug: () => ({ entities: frogs.length + pads.length + drops.length + rings.length, states: frogs.map(f => f.mood) }),
    };
  },
};
