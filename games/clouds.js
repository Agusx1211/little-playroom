// clouds: a soft sky with a breeze. Touch an empty patch and a cloud puffs up right there with a
// little poof. Tap a cloud and it jiggles like jelly and shakes off a baby puff. Press and drag and
// your finger is the wind: clouds lean and slide along with it, and the ones blown off one edge drift
// back in on the other. When nobody touches, the little flock sails on across the sky.
//
// A cloud's life, as explicit states:
//   PUFFING (0.45 s, it grows) -> FLOATING (drifts; squash and lean settle; blown by any dragging
//   finger). Gone clouds are only ever made by the wind: a puff blown off-screen returns at the far
//   edge — nothing disappears.

const MAX_CLOUDS = 12;

const Phase = Object.freeze({ PUFFING: 'puffing', FLOATING: 'floating' });

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

const PUFFS = [[-0.42, 0.1, 0.3], [-0.12, -0.16, 0.38], [0.2, -0.02, 0.32], [0.44, 0.12, 0.22]];

export default {
  id: 'clouds',
  colors: ['#bfe3ff', '#fff5e0'],

  icon(ctx, size, t) {
    ctx.fillStyle = '#8ec9ff';
    ctx.fillRect(0, 0, size, size);
    const drift = (t * 0.08) % 1;
    for (const [kx, ky, kr] of [[0.35, 0.42, 0.16], [0.6, 0.55, 0.13], [0.45, 0.62, 0.11]]) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(size * ((kx + drift) % 1.2 - 0.1), size * ky + Math.sin(t * 1.3 + kx * 9) * size * 0.015, size * kr, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#fff3b0';
    ctx.beginPath();
    ctx.arc(size * 0.8, size * 0.2, size * 0.11, 0, Math.PI * 2);
    ctx.fill();
  },

  start(stage) {
    const ctx = stage.ctx;
    let stopped = false;
    let sinceTouch = 0, idleClock = 0, sinceSound = 0;
    const short = () => Math.min(stage.width, stage.height);
    const cloudR = () => clamp(short() * 0.13, 40, 130);
    const rings = [], babyPuffs = [];
    const fingers = new Map();     // id -> {x, y, vx, vy} last motion, for the wind
    const clouds = Array.from({ length: 3 }, (_, i) => ({
      x: stage.width * (0.25 + i * 0.25), y: stage.height * (0.2 + i * 0.14),
      r: cloudR() * (0.8 + stage.rand() * 0.4), vx: short() * 0.012, vy: 0,
      phase: Phase.FLOATING, clock: 1, squash: 0, lean: 0, seed: stage.rand(),
    }));

    function poof(x, y, r) {
      if (clouds.length >= MAX_CLOUDS) clouds.shift();
      clouds.push({ x, y, r, vx: 0, vy: 0, phase: Phase.PUFFING, clock: 0, squash: 0, lean: 0, seed: stage.rand() });
      if (rings.length < 14) rings.push({ x, y, r: r * 0.3, life: 1 });
      if (sinceSound > 0.14) { stage.audio.pop(); sinceSound = 0; }
    }

    function drawCloud(c, t) {
      const grow = c.phase === Phase.PUFFING ? clamp(c.clock / 0.45, 0.05, 1) : 1;
      const bob = Math.sin(t * 1.2 + c.seed * 8) * short() * 0.004;
      const squash = 1 - c.squash * 0.22;
      const r = c.r * grow;
      ctx.save();
      ctx.translate(c.x, c.y + bob);
      ctx.rotate(c.lean * 0.12);
      ctx.scale(1 / squash, squash);
      ctx.fillStyle = '#ffffff';
      for (const [dx, dy, pr] of PUFFS) {
        ctx.beginPath();
        ctx.arc(dx * r, dy * r * 0.7, pr * r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(210,228,248,0.9)';   // the shaded belly
      ctx.beginPath();
      ctx.ellipse(0, r * 0.22, r * 0.7, r * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const offFrame = stage.onFrame((dt, t) => {
      if (stopped) return;
      sinceTouch += dt; sinceSound += dt;
      // Idle: after 5 s the breeze keeps the flock sailing; a new puff joins now and then.
      if (sinceTouch > 5) {
        idleClock += dt;
        if (idleClock > 7) {
          idleClock = 0;
          poof(stage.width * (0.1 + stage.rand() * 0.8), stage.height * (0.12 + stage.rand() * 0.4), cloudR() * (0.6 + stage.rand() * 0.4));
        }
      }
      // wind: every dragging finger pushes the clouds near its path
      for (const [, f] of fingers) {
        f.vx *= 0.85; f.vy *= 0.85;
        if (Math.hypot(f.vx, f.vy) < 4) continue;
        for (const c of clouds) {
          const d = Math.hypot(c.x - f.x, c.y - f.y);
          if (d < c.r * 2.2) {
            const push = clamp(1 - d / (c.r * 2.2), 0, 1);
            c.vx += f.vx * push * dt * 5;
            c.vy += f.vy * push * dt * 3;
            c.lean = clamp(c.lean + f.vx * push * dt * 0.004, -1, 1);
          }
        }
      }
      for (const c of clouds) {
        c.clock += dt;
        if (c.phase === Phase.PUFFING && c.clock > 0.45) c.phase = Phase.FLOATING;   // PUFFING -> FLOATING
        c.squash = Math.max(0, c.squash - dt * 2.4);
        c.lean = Math.max(-1, Math.min(1, c.lean * (1 - dt * 2) - Math.sin(t + c.seed * 6) * dt * 0.1));
        // gentle own breeze + the wind you made, settling back to the calm drift
        c.vx += (short() * 0.012 - c.vx) * Math.min(1, dt * 0.6);
        c.vy += (0 - c.vy) * Math.min(1, dt * 1.4);
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        const w = c.r * 1.2;
        if (c.x > stage.width + w) c.x = -w;         // blown off one edge, back in the other
        if (c.x < -w) c.x = stage.width + w;
        c.y = clamp(c.y, short() * 0.06, stage.height * 0.72);
      }
      for (let i = babyPuffs.length - 1; i >= 0; i--) {
        const p = babyPuffs[i];
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy -= short() * 0.06 * dt; p.life -= dt * 0.9;
        if (p.life <= 0) babyPuffs.splice(i, 1);
      }
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.r += dt * short() * 0.3; r.life -= dt * 1.8;
        if (r.life <= 0) rings.splice(i, 1);
      }

      const sky = ctx.createLinearGradient(0, 0, 0, stage.height);
      sky.addColorStop(0, '#7fb3ff'); sky.addColorStop(1, '#d6ecff');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, stage.width, stage.height);
      // sun behind everything
      const glow = 1 + Math.sin(t * 0.8) * 0.04;
      ctx.fillStyle = '#fff3b0';
      ctx.beginPath();
      ctx.arc(stage.width * 0.86, stage.height * 0.14, short() * 0.06 * glow, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,243,176,0.6)';
      ctx.lineWidth = 3;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + t * 0.15;
        const r0 = short() * 0.08 * glow, r1 = r0 + short() * 0.022;
        ctx.beginPath();
        ctx.moveTo(stage.width * 0.86 + Math.cos(a) * r0, stage.height * 0.14 + Math.sin(a) * r0);
        ctx.lineTo(stage.width * 0.86 + Math.cos(a) * r1, stage.height * 0.14 + Math.sin(a) * r1);
        ctx.stroke();
      }
      for (const c of clouds) drawCloud(c, t);
      // baby puffs shaken loose by a tapped cloud
      for (const p of babyPuffs) {
        ctx.globalAlpha = clamp(p.life, 0, 1);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      for (const r of rings) {
        ctx.globalAlpha = clamp(r.life, 0, 1) * 0.6;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    });

    const offPointer = stage.onPointer({
      down(p) {
        if (stopped) return;
        sinceTouch = 0;
        fingers.set(p.id, { x: p.x, y: p.y, vx: 0, vy: 0 });
        if (rings.length < 14) rings.push({ x: p.x, y: p.y, r: short() * 0.03, life: 1 });
        const hit = clouds.find(c => Math.hypot(c.x - p.x, c.y - p.y) < c.r * 0.9);
        if (hit) {   // a cloud tapped: jelly squash + a baby puff shakes loose
          hit.squash = 1;
          if (babyPuffs.length < 40) {
            for (let k = 0; k < 3; k++) {
              babyPuffs.push({
                x: p.x, y: p.y, vx: (stage.rand() - 0.5) * short() * 0.3, vy: -short() * (0.1 + stage.rand() * 0.2),
                r: hit.r * (0.1 + stage.rand() * 0.12), life: 1,
              });
            }
          }
          if (sinceSound > 0.14) { stage.audio.note(700 + stage.rand() * 200, 0.12); sinceSound = 0; }
        } else {
          poof(p.x, p.y, cloudR() * (0.7 + stage.rand() * 0.5));
        }
      },
      move(p) {
        const f = fingers.get(p.id);
        if (!f) return;
        f.vx = (p.x - f.x) * 30; f.vy = (p.y - f.y) * 30;
        f.x = p.x; f.y = p.y;
      },
      up(p) { fingers.delete(p.id); },
    });

    return {
      stop() {
        stopped = true;
        for (const off of [offFrame, offPointer]) if (typeof off === 'function') off();
      },
      debug: () => ({ entities: clouds.length + babyPuffs.length + rings.length, phases: clouds.map(c => c.phase) }),
    };
  },
};
