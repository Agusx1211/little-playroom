// flowers: a meadow at noon. Every touch grows a flower right where the finger came down: the stem
// rises, the petals open, and the flower sways with the ones already there. A finger held still over
// a flower makes it dance and shake out pollen. When nobody touches, the meadow sways on its own.

const MAX_FLOWERS = 40;
const MAX_POLLEN = 120;
const MAX_RINGS = 20;
const GROW_S = 0.9;

const PETALS = [
  ['#ff5d8f', '#ffd25c'], ['#ffd25c', '#ff7a3d'], ['#c77dff', '#ffd25c'],
  ['#ff8fa3', '#fff1e0'], ['#7fd1ff', '#ffd25c'], ['#ff6f61', '#ffe29a'],
];

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function drawFlower(ctx, f, t) {
  const grow = clamp(f.age / GROW_S, 0, 1);
  const sway = Math.sin(t * 1.4 + f.seed * 6) * (0.06 + f.dance * 0.12);
  const stemH = f.h * (0.5 + grow * 0.5);
  const headX = f.x + Math.sin(sway) * stemH * 0.35;
  const headY = f.y - stemH;
  const r = f.h * 0.16 * grow * (1 + f.dance * 0.15);
  // stem
  ctx.strokeStyle = '#3f8f4f';
  ctx.lineWidth = Math.max(2, f.h * 0.03);
  ctx.beginPath();
  ctx.moveTo(f.x, f.y);
  ctx.quadraticCurveTo(f.x + Math.sin(sway) * stemH * 0.2, f.y - stemH * 0.55, headX, headY);
  ctx.stroke();
  // two leaves once half grown
  if (grow > 0.5) {
    ctx.fillStyle = '#57a05f';
    const ly = f.y - stemH * 0.4;
    ctx.beginPath();
    ctx.ellipse(f.x - f.h * 0.07, ly, f.h * 0.08, f.h * 0.032, -0.5 + sway, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(f.x + f.h * 0.07, ly - f.h * 0.06, f.h * 0.08, f.h * 0.032, 0.5 + sway, 0, Math.PI * 2);
    ctx.fill();
  }
  // petals
  const [petal, heart] = f.petal;
  ctx.fillStyle = petal;
  for (let k = 0; k < 6; k++) {
    const a = f.seed * Math.PI * 2 + (k / 6) * Math.PI * 2 + sway;
    ctx.beginPath();
    ctx.ellipse(headX + Math.cos(a) * r * 0.75, headY + Math.sin(a) * r * 0.75, r * 0.62, r * 0.34, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = heart;
  ctx.beginPath();
  ctx.arc(headX, headY, r * 0.45 * (1 + f.dance * 0.2), 0, Math.PI * 2);
  ctx.fill();
  return { headX, headY, r };
}

export default {
  id: 'flowers',
  colors: ['#8fe08a', '#ff8fa3'],

  icon(ctx, size, t) {
    ctx.fillStyle = '#6fbf63';
    ctx.fillRect(0, 0, size, size);
    const s = size * 0.34, x = size * 0.5, y = size * 0.62;
    ctx.strokeStyle = '#2f7a3d';
    ctx.lineWidth = size * 0.03;
    ctx.beginPath();
    ctx.moveTo(x, y + s);
    ctx.quadraticCurveTo(x + Math.sin(t * 1.4) * s * 0.2, y + s * 0.4, x + Math.sin(t * 1.4) * s * 0.3, y - s * 0.3);
    ctx.stroke();
    const hx = x + Math.sin(t * 1.4) * s * 0.3, hy = y - s * 0.3;
    ctx.fillStyle = '#ff5d8f';
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + t * 0.4;
      ctx.beginPath();
      ctx.ellipse(hx + Math.cos(a) * s * 0.42, hy + Math.sin(a) * s * 0.42, s * 0.32, s * 0.18, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ffd25c';
    ctx.beginPath();
    ctx.arc(hx, hy, s * 0.22 + Math.sin(t * 3) * s * 0.02, 0, Math.PI * 2);
    ctx.fill();
  },

  start(stage) {
    const ctx = stage.ctx;
    let stopped = false;
    let sinceTouch = 0, idleSway = 0;
    const flowers = [];
    const pollen = [];
    const rings = [];
    const finger = new Map();
    const short = () => Math.min(stage.width, stage.height);
    const flowerAt = (x, y) => {
      let best = null, bestD = short() * 0.11;
      for (const f of flowers) {
        const d = Math.hypot(f.x - x, (f.y - f.h * 0.6) - y);
        if (d < bestD) { bestD = d; best = f; }
      }
      return best;
    };

    function bloom(x, y) {
      if (flowers.length >= MAX_FLOWERS) flowers.shift();   // the oldest makes room
      flowers.push({
        x, y, h: short() * (0.18 + stage.rand() * 0.12),
        age: 0, dance: 0, seed: stage.rand(), petal: PETALS[flowers.length % PETALS.length],
      });
      if (pollen.length < MAX_POLLEN) {
        for (let k = 0; k < 5; k++) {
          pollen.push({ x, y, vx: (stage.rand() - 0.5) * short() * 0.3, vy: -stage.rand() * short() * 0.25, life: 1 });
        }
      }
      stage.audio.note(440 + (flowers.length % 7) * 55, 0.16);   // one note per new flower
    }

    const offFrame = stage.onFrame((dt, t) => {
      if (stopped) return;
      sinceTouch += dt;
      // Idle: the meadow breathes; now and then a seed sprouts on its own.
      idleSway += dt;
      if (sinceTouch > 6 && idleSway > 7) {
        idleSway = 0;
        bloom(stage.width * (0.12 + stage.rand() * 0.76), stage.height * (0.45 + stage.rand() * 0.45));
      }
      // A finger held still over a flower makes that flower dance and shed pollen.
      for (const f of flowers) f.dance = Math.max(0, f.dance - dt * 1.5);
      for (const [, p] of finger) {
        const f = flowerAt(p.x, p.y);
        if (!f || f.age < GROW_S) continue;
        f.dance = Math.min(1, f.dance + dt * 3);
        if (f.dance > 0.6 && pollen.length < MAX_POLLEN && stage.rand() < dt * 8) {
          pollen.push({
            x: f.x + (stage.rand() - 0.5) * f.h * 0.3, y: f.y - f.h * 0.6,
            vx: (stage.rand() - 0.5) * short() * 0.12, vy: -short() * (0.08 + stage.rand() * 0.1), life: 1,
          });
        }
      }
      for (const f of flowers) f.age += dt;
      for (let i = pollen.length - 1; i >= 0; i--) {
        const p = pollen[i];
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy += short() * 0.15 * dt; p.life -= dt * 0.6;
        if (p.life <= 0) pollen.splice(i, 1);
      }
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.r += dt * short() * 0.35; r.life -= dt * 2;
        if (r.life <= 0) rings.splice(i, 1);
      }

      const sky = ctx.createLinearGradient(0, 0, 0, stage.height);
      sky.addColorStop(0, '#cdefff'); sky.addColorStop(0.55, '#eafbd0');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, stage.width, stage.height);
      ctx.fillStyle = '#79c86e';
      ctx.fillRect(0, stage.height * 0.55, stage.width, stage.height * 0.45);
      for (const f of flowers) drawFlower(ctx, f, t);
      ctx.fillStyle = '#ffe9a3';
      for (const p of pollen) {
        ctx.globalAlpha = clamp(p.life, 0, 1);
        ctx.beginPath();
        ctx.arc(p.x, p.y, short() * 0.006 + 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#fff7d1';
      ctx.lineWidth = 3;
      for (const r of rings) {
        ctx.globalAlpha = clamp(r.life, 0, 1) * 0.7;
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
        finger.set(p.id, { x: p.x, y: p.y });
        if (rings.length < MAX_RINGS) rings.push({ x: p.x, y: p.y, r: short() * 0.03, life: 1 });
        bloom(p.x, clamp(p.y, stage.height * 0.3, stage.height * 0.97));
      },
      move(p) {
        if (finger.has(p.id)) finger.set(p.id, { x: p.x, y: p.y });
      },
      up(p) { finger.delete(p.id); },
    });

    return {
      stop() {
        stopped = true;
        for (const off of [offFrame, offPointer]) if (typeof off === 'function') off();
      },
      debug: () => ({ entities: flowers.length + pollen.length + rings.length, flowers: flowers.length }),
    };
  },
};
