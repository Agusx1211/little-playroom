// ducks: a green pond. Mother Duck leads a little line of ducklings; every touch puts food on the
// water and she waddles straight for it, duckling after duckling swimming along the exact path she
// swam. Tap a duckling and it shakes the drops off with a squeak; tap Mother Duck and she gives a
// big honk that reaches all the way across the pond. When nobody touches, she stops, bobs and
// preens, and the line loops on in her wake.
//
// Mother's mind, as explicit states:
//   IDLE (bob, preen) -(touch drops food)-> WADDLING (to the spot) -> eating 0.8 s -> IDLE.
// The ducklings are not stateful: each one swims at a fixed lag along Mother's recorded path.

const DUCKLINGS = 4;
const MAX_DROPS = 60;
const MAX_RINGS = 20;
const TRAIL_STEP = 0.09;          // seconds between trail samples; the line's spacing

const Mood = Object.freeze({ IDLE: 'idle', WADDLING: 'waddling', EATING: 'eating' });

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export default {
  id: 'ducks',
  colors: ['#ffd25c', '#4f9d69'],

  icon(ctx, size, t) {
    ctx.fillStyle = '#3f7d5c';
    ctx.fillRect(0, 0, size, size);
    const bob = Math.sin(t * 2.4) * size * 0.02;
    for (const [k, s] of [[0, 0.55], [0.22, 0.17], [0.34, 0.13]]) {
      const x = size * (0.32 + k), y = size * (0.58 + (k ? 0.1 : 0) * 0.4) + bob * (k ? 1.3 : 1);
      ctx.fillStyle = k ? '#ffd25c' : '#fff6e0';
      ctx.beginPath();
      ctx.ellipse(x, y, size * s * 0.5, size * s * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + size * s * 0.42, y - size * s * 0.34, size * s * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e07a1f';
      ctx.fillRect(x + size * s * 0.56, y - size * s * 0.32, size * s * 0.2, size * s * 0.09);
    }
  },

  start(stage) {
    const ctx = stage.ctx;
    let stopped = false;
    let sinceTouch = 0, idleClock = 0, sinceSound = 0;
    const short = () => Math.min(stage.width, stage.height);
    const duckR = () => clamp(short() * 0.055, 18, 52);
    const mother = {
      x: stage.width * 0.5, y: stage.height * 0.55, mood: Mood.IDLE, clock: 0,
      target: null, flip: 1, bob: 0, preen: 0, seed: stage.rand(),
    };
    const trail = [{ x: mother.x, y: mother.y }];     // timed history of Mother's path
    let trailClock = 0;
    const ducklings = Array.from({ length: DUCKLINGS }, (_, i) => ({
      lag: (i + 1) * 7,                              // trail samples behind Mother
      x: mother.x, y: mother.y, shake: 0, seed: stage.rand(),
    }));
    const drops = [], rings = [], crumbs = [];

    function splashAt(x, y, n, color) {
      for (let k = 0; k < n && drops.length < MAX_DROPS; k++) {
        const a = stage.rand() * Math.PI * 2;
        drops.push({ x, y, vx: Math.cos(a) * short() * 0.18 * stage.rand(), vy: -short() * (0.1 + stage.rand() * 0.18), life: 1, color });
      }
    }

    function placeOnTrail(d, t) {
      const idx = Math.max(0, trail.length - 1 - d.lag);
      const p = trail[idx];
      const next = trail[Math.min(trail.length - 1, idx + 1)];
      const sway = Math.sin(t * 3 + d.seed * 9) * short() * 0.006;
      d.x += (p.x + sway - d.x) * 0.2;
      d.y += (p.y - sway * 0.5 - d.y) * 0.2;
      d.heading = Math.atan2(next.y - p.y, next.x - p.x);
      d.flip = Math.cos(d.heading) >= 0 ? 1 : -1;
    }

    const offFrame = stage.onFrame((dt, t) => {
      if (stopped) return;
      sinceTouch += dt; sinceSound += dt;
      // record Mother's path for the line
      trailClock += dt;
      if (trailClock >= TRAIL_STEP) {
        trailClock = 0;
        trail.push({ x: mother.x, y: mother.y });
        if (trail.length > 90) trail.shift();
      }
      // Idle: after 5 s Mother turns in a slow circle so the line keeps drawing loops.
      if (sinceTouch > 5) {
        idleClock += dt;
        if (idleClock > 6) {
          idleClock = 0;
          mother.preen = 1.4;
          if (sinceSound > 1) { stage.audio.note(390, 0.14); sinceSound = 0; }
        }
      }
      mother.bob += dt;
      mother.preen = Math.max(0, mother.preen - dt);
      switch (mother.mood) {
        case Mood.IDLE: break;
        case Mood.WADDLING: {
          const dx = mother.target.x - mother.x, dy = mother.target.y - mother.y;
          const d = Math.hypot(dx, dy);
          const v = short() * 0.28;
          if (d < duckR() * 0.4) { mother.mood = Mood.EATING; mother.clock = 0; splashAt(mother.x, mother.y + duckR() * 0.4, 5, '#eafcff'); }
          else {
            mother.x += (dx / d) * v * dt;
            mother.y += (dy / d) * v * dt * 0.75;
            mother.flip = dx >= 0 ? 1 : -1;
            if (rings.length < MAX_RINGS && stage.rand() < dt * 6) rings.push({ x: mother.x, y: mother.y + duckR() * 0.5, r: duckR() * 0.5, life: 0.8 });
          }
          break;
        }
        case Mood.EATING:
          mother.clock += dt;
          mother.preen = 0;
          if (mother.clock > 0.8) { mother.mood = Mood.IDLE; mother.clock = 0; }   // EATING -> IDLE
          break;
      }
      // idle circling keeps the line drawing loops
      if (mother.mood === Mood.IDLE && sinceTouch > 5) {
        const a = t * 0.5;
        mother.x += Math.cos(a) * short() * 0.05 * dt;
        mother.y += Math.sin(a) * short() * 0.03 * dt;
        mother.flip = Math.cos(a) >= 0 ? 1 : -1;
      }
      mother.x = clamp(mother.x, duckR(), stage.width - duckR());
      mother.y = clamp(mother.y, stage.height * 0.2, stage.height * 0.9);
      for (const d of ducklings) placeOnTrail(d, t);
      for (const d of ducklings) d.shake = Math.max(0, d.shake - dt * 1.6);
      for (let i = drops.length - 1; i >= 0; i--) {
        const p = drops[i];
        p.vy += short() * 1.9 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * 1.3;
        if (p.life <= 0) drops.splice(i, 1);
      }
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.r += dt * short() * 0.22; r.life -= dt * 1.4;
        if (r.life <= 0) rings.splice(i, 1);
      }
      for (let i = crumbs.length - 1; i >= 0; i--) {
        const c = crumbs[i];
        c.life -= dt / 6;   // food waits a long while, then dissolves
        if (c.life <= 0 || Math.hypot(c.x - mother.x, c.y - mother.y) < duckR() * 0.5) crumbs.splice(i, 1);   // eaten
      }

      const water = ctx.createLinearGradient(0, 0, 0, stage.height);
      water.addColorStop(0, '#4f9d69'); water.addColorStop(1, '#2c6b4f');
      ctx.fillStyle = water;
      ctx.fillRect(0, 0, stage.width, stage.height);
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      for (let k = 0; k < 5; k++) {
        const y = stage.height * (0.15 + k * 0.19);
        const x = ((t * 22 + k * 240) % (stage.width + 220)) - 110;
        ctx.beginPath();
        ctx.ellipse(x, y, short() * 0.1, short() * 0.008, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // lily pads at the edges
      ctx.fillStyle = '#35784f';
      for (const [kx, ky, kr] of [[0.08, 0.12, 0.05], [0.92, 0.2, 0.06], [0.06, 0.88, 0.07], [0.94, 0.82, 0.05]]) {
        ctx.beginPath();
        ctx.arc(stage.width * kx, stage.height * ky, short() * kr, 0.4, Math.PI * 2 - 0.4);
        ctx.lineTo(stage.width * kx, stage.height * ky);
        ctx.fill();
      }
      // ripples, then the ducks (Mother last: she leads on top)
      ctx.strokeStyle = '#eafcff';
      ctx.lineWidth = 2;
      for (const r of rings) {
        ctx.globalAlpha = clamp(r.life, 0, 1) * 0.5;
        ctx.beginPath();
        ctx.ellipse(r.x, r.y, r.r, r.r * 0.4, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      for (const c of crumbs) {
        ctx.globalAlpha = clamp(c.life * 2, 0, 1);
        ctx.fillStyle = '#e8d5a0';
        ctx.beginPath();
        ctx.arc(c.x, c.y, short() * 0.006 + 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      const drawDuck = (d, big, color, flip, shake, bob) => {
        const r = duckR() * (big ? 1.35 : 0.62);
        const wob = shake > 0 ? Math.sin(shake * 40) * r * 0.3 : 0;
        const y = d.y + Math.sin(bob * 4) * short() * 0.004;
        // reflection
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath();
        ctx.ellipse(d.x, y + r * 0.62, r * 0.9, r * 0.24, 0, 0, Math.PI * 2);
        ctx.fill();
        // body
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(d.x + wob, y, r, r * 0.66, 0, 0, Math.PI * 2);
        ctx.fill();
        // tail flick
        ctx.beginPath();
        ctx.moveTo(d.x - flip * r * 0.9 + wob, y - r * 0.1);
        ctx.quadraticCurveTo(d.x - flip * r * 1.25 + wob, y - r * 0.55, d.x - flip * r * 0.7 + wob, y - r * 0.3);
        ctx.fill();
        // head
        const headLift = big && mother.preen > 0 ? -r * 0.5 * mother.preen : 0;
        ctx.beginPath();
        ctx.arc(d.x + flip * r * 0.72 + wob, y - r * 0.6 + headLift, r * 0.4, 0, Math.PI * 2);
        ctx.fill();
        // beak
        ctx.fillStyle = '#e07a1f';
        ctx.fillRect(d.x + flip * r * (1.0) + wob, y - r * 0.64 + headLift, flip * r * 0.42, r * 0.16);
        // eye
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(d.x + flip * r * 0.78 + wob, y - r * 0.72 + headLift, r * 0.07, 0, Math.PI * 2);
        ctx.fill();
      };
      for (let i = ducklings.length - 1; i >= 0; i--) {
        const d = ducklings[i];
        drawDuck(d, false, '#ffd25c', d.flip, d.shake, mother.bob + i);
      }
      drawDuck(mother, true, '#fff6e0', mother.flip, 0, mother.bob);
      for (const p of drops) {
        ctx.globalAlpha = clamp(p.life, 0, 1);
        ctx.fillStyle = p.color || '#eafcff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, short() * 0.005 + 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    });

    const offPointer = stage.onPointer({
      down(p) {
        if (stopped) return;
        sinceTouch = 0;
        if (rings.length < MAX_RINGS) rings.push({ x: p.x, y: p.y, r: short() * 0.03, life: 1 });
        // a duckling tapped: shake and squeak
        for (const d of ducklings) {
          if (Math.hypot(d.x - p.x, d.y - p.y) < duckR() * 0.8) {
            d.shake = 1;
            splashAt(d.x, d.y, 6, '#eafcff');
            if (sinceSound > 0.14) { stage.audio.note(980 + d.seed * 200, 0.1); sinceSound = 0; }
            return;
          }
        }
        if (Math.hypot(mother.x - p.x, mother.y - p.y) < duckR() * 1.6) {   // Mother: a big honk
          if (sinceSound > 0.2) { stage.audio.note(320, 0.22); stage.audio.note(260, 0.3); sinceSound = 0; }
          splashAt(mother.x, mother.y + duckR() * 0.5, 8, '#eafcff');
          return;
        }
        // anywhere else: food lands there, Mother goes
        crumbs.push({ x: p.x, y: clamp(p.y, stage.height * 0.22, stage.height * 0.9), life: 1 });
        mother.target = { x: p.x, y: clamp(p.y, stage.height * 0.22, stage.height * 0.9) };
        mother.mood = Mood.WADDLING; mother.clock = 0;   // IDLE/EATING -> WADDLING
        if (sinceSound > 0.14) { stage.audio.pop(); sinceSound = 0; }
      },
      move() {},
      up() {},
    });

    return {
      stop() {
        stopped = true;
        for (const off of [offFrame, offPointer]) if (typeof off === 'function') off();
      },
      debug: () => ({ entities: 1 + ducklings.length + drops.length + rings.length + crumbs.length, mood: mother.mood }),
    };
  },
};
