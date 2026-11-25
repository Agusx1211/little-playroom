// worm: glowing worms that follow the finger. Up to three worms; each finger leads the nearest free
// worm, and without a finger they wander slowly on their own (which is also the idle motion).

const WORMS = 3;
const SEGMENTS = 26;
const HUES = [150, 280, 40];

// A worm is either following a finger or wandering, as explicit states.
const Worm = Object.freeze({ WANDERING: 'wandering', FOLLOWING: 'following' });

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function drawWorm(ctx, segs, hue, unit, t) {
  // Glow: layered translucent circles, no shadowBlur (too slow on older tablets).
  for (let i = segs.length - 1; i >= 0; i--) {
    const s = segs[i], k = 1 - i / segs.length;
    const r = unit * (0.35 + 0.65 * k) * (1 + 0.06 * Math.sin(t * 4 - i * 0.5));
    ctx.fillStyle = `hsla(${hue}, 90%, 60%, 0.12)`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, r * 2.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `hsl(${hue + i * 3}, 85%, ${55 + 20 * k}%)`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Eyes on the head.
  const h = segs[0], n = segs[1];
  const a = Math.atan2(h.y - n.y, h.x - n.x);
  ctx.fillStyle = '#ffffff';
  for (const side of [-1, 1]) {
    const ex = h.x + Math.cos(a + side * 0.6) * unit * 0.45, ey = h.y + Math.sin(a + side * 0.6) * unit * 0.45;
    ctx.beginPath();
    ctx.arc(ex, ey, unit * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1b1b3a';
    ctx.beginPath();
    ctx.arc(ex + Math.cos(a) * unit * 0.07, ey + Math.sin(a) * unit * 0.07, unit * 0.11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
  }
}

export default {
  id: 'worm',
  colors: ['#2ee6a6', '#b388ff'],

  icon(ctx, size, t) {
    ctx.fillStyle = '#0a0f24';
    ctx.fillRect(0, 0, size, size);
    const segs = Array.from({ length: 12 }, (_, i) => ({
      x: size * (0.78 - i * 0.05), y: size * (0.5 + Math.sin(t * 3 - i * 0.6) * 0.12),
    }));
    drawWorm(ctx, segs, HUES[0], size * 0.07, t);
  },

  start(stage) {
    const ctx = stage.ctx;
    let stopped = false;
    let sinceTouch = 0;
    const unit = () => clamp(Math.min(stage.width, stage.height) * 0.035, 10, 34);
    const worms = Array.from({ length: WORMS }, (_, w) => {
      const x = stage.width * (0.25 + 0.25 * w), y = stage.height * (0.35 + 0.15 * w);
      return {
        state: Worm.WANDERING, finger: null, hue: HUES[w],
        segs: Array.from({ length: SEGMENTS }, (_, i) => ({ x: x - i * 4, y })),
        heading: stage.rand() * Math.PI * 2, target: { x, y },
      };
    });
    const fingers = new Map();   // pointer id -> {x, y}

    // WANDERING -> FOLLOWING: the nearest wandering worm takes a new finger.
    function claim(id, x, y) {
      let best = null, bestD = Infinity;
      for (const w of worms) {
        if (w.state !== Worm.WANDERING) continue;
        const d = Math.hypot(w.segs[0].x - x, w.segs[0].y - y);
        if (d < bestD) { bestD = d; best = w; }
      }
      if (best) { best.state = Worm.FOLLOWING; best.finger = id; stage.audio.note(440 + 110 * worms.indexOf(best), 0.25); }
    }
    // FOLLOWING -> WANDERING when its finger lifts.
    function release(id) {
      for (const w of worms) if (w.state === Worm.FOLLOWING && w.finger === id) { w.state = Worm.WANDERING; w.finger = null; }
    }

    function stepWorm(w, dt, t) {
      const head = w.segs[0];
      let tx, ty, speed;
      switch (w.state) {
        case Worm.FOLLOWING: {
          const f = fingers.get(w.finger);
          tx = f ? f.x : head.x; ty = f ? f.y : head.y;
          speed = Math.max(stage.width, stage.height) * 1.4;
          break;
        }
        case Worm.WANDERING: {
          w.heading += (Math.sin(t * 0.7 + w.hue) * 0.9) * dt;
          const m = unit() * 3;
          // Turn back towards the middle near the edges.
          if (head.x < m || head.x > stage.width - m || head.y < m || head.y > stage.height - m) {
            w.heading = Math.atan2(stage.height / 2 - head.y, stage.width / 2 - head.x);
          }
          tx = head.x + Math.cos(w.heading) * 50; ty = head.y + Math.sin(w.heading) * 50;
          speed = unit() * (sinceTouch > 5 ? 2.2 : 3.2);
          break;
        }
      }
      const dx = tx - head.x, dy = ty - head.y, d = Math.hypot(dx, dy);
      if (d > 0.5) {
        const stepLen = Math.min(d, speed * dt);
        head.x += dx / d * stepLen; head.y += dy / d * stepLen;
      }
      head.x = clamp(head.x, 0, stage.width); head.y = clamp(head.y, 0, stage.height);
      // Each segment keeps its distance to the one in front: the body follows the head.
      const spacing = unit() * 0.55;
      for (let i = 1; i < w.segs.length; i++) {
        const a = w.segs[i - 1], b = w.segs[i];
        const ex = b.x - a.x, ey = b.y - a.y, e = Math.hypot(ex, ey) || 1;
        if (e > spacing) { b.x = a.x + ex / e * spacing; b.y = a.y + ey / e * spacing; }
      }
    }

    const offFrame = stage.onFrame((dt, t) => {
      if (stopped) return;
      sinceTouch += dt;
      for (const w of worms) stepWorm(w, dt, t);
      ctx.fillStyle = '#060a1c';
      ctx.fillRect(0, 0, stage.width, stage.height);
      // A faint trail of where the fingers are.
      for (const [, f] of fingers) {
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.beginPath();
        ctx.arc(f.x, f.y, unit() * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const w of worms) drawWorm(ctx, w.segs, w.hue, unit(), t);
    });

    const offPointer = stage.onPointer({
      down(p) {
        if (stopped) return;
        sinceTouch = 0;
        fingers.set(p.id, { x: p.x, y: p.y });
        claim(p.id, p.x, p.y);
      },
      move(p) {
        const f = fingers.get(p.id);
        if (stopped || !f) return;
        sinceTouch = 0;
        f.x = p.x; f.y = p.y;
      },
      up(p) { fingers.delete(p.id); release(p.id); },
    });

    return {
      stop() {
        stopped = true;
        if (typeof offFrame === 'function') offFrame();
        if (typeof offPointer === 'function') offPointer();
      },
      debug: () => ({ entities: worms.length * SEGMENTS, states: worms.map(w => w.state) }),
    };
  },
};
