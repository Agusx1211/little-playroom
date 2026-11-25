// magnets: a sky of coloured specks drawn to every finger. Each touching finger pulls the specks
// towards it and swirls them round it; let go and they spread out again on a slow current. No end.

const SPECKS = 220;
const HUES = [0, 30, 55, 120, 180, 210, 270, 310];

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export default {
  id: 'magnets',
  colors: ['#ff4f8b', '#4fd1ff'],

  icon(ctx, size, t) {
    ctx.fillStyle = '#0b0b24';
    ctx.fillRect(0, 0, size, size);
    const cx = size / 2, cy = size / 2;
    for (let i = 0; i < 24; i++) {
      const a = i * 0.9 + t * 1.5, d = size * (0.12 + (i % 6) * 0.05);
      ctx.fillStyle = `hsl(${HUES[i % HUES.length]}, 90%, 65%)`;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, size * 0.025, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath();
    ctx.arc(cx, cy, size * 0.06, 0, Math.PI * 2);
    ctx.fill();
  },

  start(stage) {
    const ctx = stage.ctx;
    let stopped = false;
    let sinceTouch = 0;
    const fingers = new Map();   // pointer id -> {x, y, age}
    const specks = Array.from({ length: SPECKS }, (_, i) => ({
      x: stage.rand() * stage.width, y: stage.rand() * stage.height, vx: 0, vy: 0,
      hue: HUES[i % HUES.length], r: 0.6 + stage.rand() * 0.8, spin: stage.rand() < 0.5 ? 1 : -1,
      ring: 0.03 + stage.rand() * 0.07,   // the radius it settles at round a finger, as a share of the short side
    }));
    const short = () => Math.min(stage.width, stage.height);

    function step(s, dt, t) {
      // Steering, not forces: each speck eases its velocity towards a desired one. With a finger
      // down, that is towards a ring of its own radius round the nearest finger, swirling round
      // it; a constant swirl force would keep adding energy and fling the specks out instead.
      let wantX, wantY;
      let nearest = null, best = Infinity;
      for (const [, f] of fingers) { const d = Math.hypot(f.x - s.x, f.y - s.y); if (d < best) { best = d; nearest = f; } }
      if (nearest) {
        const dx = nearest.x - s.x, dy = nearest.y - s.y, d = best + 0.001;
        const inward = clamp((d - s.ring * short()) * 3, -short() * 0.5, short() * 1.4);
        const swirl = Math.min(short() * 0.35, d * 2.5) * s.spin;
        wantX = dx / d * inward - dy / d * swirl;
        wantY = dy / d * inward + dx / d * swirl;
      } else {
        // A slow current: the specks drift on, gently.
        const k = sinceTouch > 5 ? 0.6 : 1;
        wantX = Math.cos(s.y / short() * 3 + t * 0.2) * short() * 0.06 * k;
        wantY = Math.sin(s.x / short() * 3 + t * 0.17) * short() * 0.06 * k;
      }
      const ease = Math.min(1, dt * (nearest ? 5 : 1.2));
      s.vx += (wantX - s.vx) * ease;
      s.vy += (wantY - s.vy) * ease;
      s.x += s.vx * dt; s.y += s.vy * dt;
      // Wrap round the edges so nothing is ever lost.
      if (s.x < 0) s.x += stage.width; else if (s.x > stage.width) s.x -= stage.width;
      if (s.y < 0) s.y += stage.height; else if (s.y > stage.height) s.y -= stage.height;
    }

    const offFrame = stage.onFrame((dt, t) => {
      if (stopped) return;
      sinceTouch += dt;
      for (const [, f] of fingers) f.age += dt;
      for (const s of specks) step(s, dt, t);

      ctx.fillStyle = '#08081e';
      ctx.fillRect(0, 0, stage.width, stage.height);
      // Each finger glows, from the very first frame it touches.
      for (const [, f] of fingers) {
        const r = short() * (0.06 + 0.015 * Math.sin(f.age * 4));
        ctx.fillStyle = 'rgba(255,255,255,0.10)';
        ctx.beginPath();
        ctx.arc(f.x, f.y, r * 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath();
        ctx.arc(f.x, f.y, r * 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      const size = clamp(short() * 0.007, 2, 6);
      for (const s of specks) {
        const speed = Math.min(1, Math.hypot(s.vx, s.vy) / (short() * 0.8));
        ctx.fillStyle = `hsl(${s.hue}, 90%, ${55 + 20 * speed}%)`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, size * s.r * (1 + speed * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
    });

    let sinceNote = 1;
    const offNotes = stage.onFrame((dt) => { sinceNote += dt; });
    const offPointer = stage.onPointer({
      down(p) {
        if (stopped) return;
        sinceTouch = 0;
        fingers.set(p.id, { x: p.x, y: p.y, age: 0 });
        if (sinceNote > 0.15) { stage.audio.note(330 + 330 * (1 - p.y / Math.max(1, stage.height)), 0.35); sinceNote = 0; }
      },
      move(p) {
        const f = fingers.get(p.id);
        if (stopped || !f) return;
        sinceTouch = 0;
        f.x = p.x; f.y = p.y;
      },
      up(p) { fingers.delete(p.id); },
    });

    return {
      stop() {
        stopped = true;
        for (const off of [offFrame, offNotes, offPointer]) if (typeof off === 'function') off();
      },
      debug: (x = 0, y = 0, r = 0) => ({
        entities: specks.length + fingers.size,
        near: specks.filter(s => Math.hypot(s.x - x, s.y - y) <= r).length,
        finite: specks.every(s => Number.isFinite(s.x) && Number.isFinite(s.y)),
      }),
    };
  },
};
