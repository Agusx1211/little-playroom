// shapes: big soft shapes float about. Tapping one splits it into two smaller ones that drift
// apart; the smallest pop into sparkles instead. New big shapes float in whenever there are few
// left, so it never ends.

const KINDS = ['circle', 'square', 'triangle', 'star'];
const HUES = [0, 35, 55, 140, 200, 265, 310];
const MAX_SHAPES = 28;
const MAX_SPARKS = 180;
const MIN_SPLIT = 0.045;   // radius as a share of the short side: smaller than this pops instead

// A shape's life, as explicit states.
const Shape = Object.freeze({ ENTERING: 'entering', FLOATING: 'floating', POPPING: 'popping' });

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function path(ctx, kind, r) {
  ctx.beginPath();
  switch (kind) {
    case 'circle': ctx.arc(0, 0, r, 0, Math.PI * 2); break;
    case 'square': {
      const s = r * 0.85, q = s * 0.25;
      ctx.moveTo(-s + q, -s); ctx.lineTo(s - q, -s); ctx.quadraticCurveTo(s, -s, s, -s + q);
      ctx.lineTo(s, s - q); ctx.quadraticCurveTo(s, s, s - q, s); ctx.lineTo(-s + q, s);
      ctx.quadraticCurveTo(-s, s, -s, s - q); ctx.lineTo(-s, -s + q); ctx.quadraticCurveTo(-s, -s, -s + q, -s);
      break;
    }
    case 'triangle':
      for (let k = 0; k < 3; k++) {
        const a = -Math.PI / 2 + k * (Math.PI * 2 / 3);
        if (k === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      break;
    case 'star':
      for (let k = 0; k < 10; k++) {
        const a = -Math.PI / 2 + k * (Math.PI / 5), rr = k % 2 === 0 ? r : r * 0.48;
        if (k === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      break;
  }
  ctx.closePath();
}

function drawShape(ctx, s, t) {
  const grow = s.state === Shape.POPPING ? 1 + s.clock * 1.5 : clamp(s.born / 0.3, 0.5, 1);
  const alpha = s.state === Shape.POPPING ? clamp(1 - s.clock / 0.3, 0, 1) : 1;
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(s.a + Math.sin(t * 0.8 + s.phase) * 0.08);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = `hsl(${s.hue}, 80%, 60%)`;
  path(ctx, s.kind, s.r * grow);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  path(ctx, s.kind, s.r * grow * 0.55);
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
}

export default {
  id: 'shapes',
  colors: ['#ff70a6', '#70d6ff'],

  icon(ctx, size, t) {
    ctx.fillStyle = '#0e1030';
    ctx.fillRect(0, 0, size, size);
    const gap = Math.abs(Math.sin(t * 1.5)) * size * 0.12;
    drawShape(ctx, { x: size * 0.5 - gap, y: size * 0.5, r: size * 0.22, a: 0, phase: 0, kind: 'circle', hue: 330, state: Shape.FLOATING, born: 1, clock: 0 }, t);
    drawShape(ctx, { x: size * 0.5 + gap, y: size * 0.5, r: size * 0.22, a: 0, phase: 1, kind: 'circle', hue: 200, state: Shape.FLOATING, born: 1, clock: 0 }, t);
  },

  start(stage) {
    const ctx = stage.ctx;
    const shapes = [];
    const sparks = [];
    let stopped = false;
    let sinceTouch = 0;
    const short = () => Math.min(stage.width, stage.height);

    function make(r, x, y, vx, vy, state) {
      const kind = KINDS[Math.floor(stage.rand() * KINDS.length) % KINDS.length];
      return {
        x, y, vx, vy, r, kind, hue: HUES[Math.floor(stage.rand() * HUES.length) % HUES.length],
        a: stage.rand() * Math.PI * 2, va: (stage.rand() - 0.5) * 0.6, phase: stage.rand() * 6,
        state, born: state === Shape.ENTERING ? 0.3 : 0, clock: 0,
      };
    }

    // A new big shape floats in from a side (ENTERING), and becomes FLOATING once inside.
    function enter() {
      const r = short() * (0.14 + stage.rand() * 0.04);
      const fromLeft = stage.rand() < 0.5;
      const x = fromLeft ? -r : stage.width + r, y = stage.height * (0.25 + stage.rand() * 0.5);
      const v = short() * 0.25;
      shapes.push(make(r, x, y, fromLeft ? v : -v, (stage.rand() - 0.5) * v * 0.4, Shape.ENTERING));
    }
    for (let k = 0; k < 3; k++) {
      const s = make(short() * 0.15, stage.width * (0.25 + 0.25 * k), stage.height * 0.5, 0, 0, Shape.FLOATING);
      s.born = 0.3;
      shapes.push(s);
    }

    function burst(x, y, hue, n) {
      for (let k = 0; k < n && sparks.length < MAX_SPARKS; k++) {
        const a = stage.rand() * Math.PI * 2, v = short() * (0.2 + stage.rand() * 0.4);
        sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.8, hue });
      }
    }

    // FLOATING -> two smaller FLOATING shapes, or -> POPPING when it is already small.
    function tap(s) {
      if (s.r < short() * MIN_SPLIT || shapes.length >= MAX_SHAPES) {
        s.state = Shape.POPPING; s.clock = 0;
        burst(s.x, s.y, s.hue, 14);
        stage.audio.pop();
        return;
      }
      const i = shapes.indexOf(s);
      shapes.splice(i, 1);
      const r = s.r * 0.7, v = short() * 0.35, a = stage.rand() * Math.PI;
      for (const side of [-1, 1]) {
        const c = make(r, s.x + Math.cos(a) * side * r * 0.5, s.y + Math.sin(a) * side * r * 0.5,
                       Math.cos(a) * side * v + s.vx, Math.sin(a) * side * v + s.vy, Shape.FLOATING);
        c.kind = s.kind;   // both halves are the same kind as the whole
        shapes.push(c);
      }
      burst(s.x, s.y, s.hue, 6);
      stage.audio.note(220 + 900 * (s.r / short()), 0.3);
    }

    function step(s, dt) {
      s.born += dt; s.clock += dt;
      switch (s.state) {
        case Shape.ENTERING:
          s.x += s.vx * dt; s.y += s.vy * dt;
          if (s.x > s.r && s.x < stage.width - s.r) s.state = Shape.FLOATING;
          break;
        case Shape.FLOATING: {
          s.vx *= Math.exp(-dt * 0.6); s.vy *= Math.exp(-dt * 0.6);
          // A slow drift so nothing is ever still.
          s.vx += Math.cos(s.phase + s.clock * 0.3) * short() * 0.02 * dt;
          s.vy += Math.sin(s.phase + s.clock * 0.25) * short() * 0.02 * dt;
          s.x += s.vx * dt; s.y += s.vy * dt; s.a += s.va * dt;
          // Bounce softly off the edges.
          if (s.x < s.r) { s.x = s.r; s.vx = Math.abs(s.vx); }
          if (s.x > stage.width - s.r) { s.x = stage.width - s.r; s.vx = -Math.abs(s.vx); }
          if (s.y < s.r) { s.y = s.r; s.vy = Math.abs(s.vy); }
          if (s.y > stage.height - s.r) { s.y = stage.height - s.r; s.vy = -Math.abs(s.vy); }
          break;
        }
        case Shape.POPPING:
          break;
      }
    }

    const offFrame = stage.onFrame((dt, t) => {
      if (stopped) return;
      sinceTouch += dt;
      for (const s of shapes) step(s, dt);
      for (let i = shapes.length - 1; i >= 0; i--) if (shapes[i].state === Shape.POPPING && shapes[i].clock > 0.3) shapes.splice(i, 1);
      const big = shapes.filter(s => s.state !== Shape.POPPING && s.r > short() * 0.1).length;
      if (shapes.length < 4 || (big === 0 && shapes.length < MAX_SHAPES - 2)) enter();
      for (let i = sparks.length - 1; i >= 0; i--) {
        const k = sparks[i];
        k.x += k.vx * dt; k.y += k.vy * dt; k.vx *= 0.95; k.vy *= 0.95; k.life -= dt;
        if (k.life <= 0) sparks.splice(i, 1);
      }

      ctx.fillStyle = '#0b0d28';
      ctx.fillRect(0, 0, stage.width, stage.height);
      for (const s of shapes) drawShape(ctx, s, t);
      for (const k of sparks) {
        ctx.globalAlpha = clamp(k.life / 0.8, 0, 1);
        ctx.fillStyle = `hsl(${k.hue}, 90%, 70%)`;
        ctx.beginPath();
        ctx.arc(k.x, k.y, short() * 0.007, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    });

    const offPointer = stage.onPointer({
      down(p) {
        if (stopped) return;
        sinceTouch = 0;
        // The topmost shape under the finger (drawn last = on top), with a little slack for small fingers.
        let hit = null;
        for (let i = shapes.length - 1; i >= 0; i--) {
          const s = shapes[i];
          if (s.state === Shape.POPPING) continue;
          if (Math.hypot(p.x - s.x, p.y - s.y) <= s.r * 1.15) { hit = s; break; }
        }
        if (hit) tap(hit);
        else burst(p.x, p.y, 50, 5);   // every touch answers, even on the background
      },
      move() {},
      up() {},
    });

    return {
      stop() {
        stopped = true;
        if (typeof offFrame === 'function') offFrame();
        if (typeof offPointer === 'function') offPointer();
      },
      debug: () => ({ entities: shapes.length + sparks.length, states: shapes.map(s => s.state) }),
    };
  },
};
