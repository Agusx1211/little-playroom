// balls - plump gravity balls; grab one and fling it, tap empty sky for a new one.
export default {
  id: "balls",
  colors: ["#ffb703", "#8ecae6"],

  icon(ctx, size, t) {
    const r = size * 0.16;
    const spots = [[0.3, 0.38], [0.62, 0.55], [0.42, 0.72]];
    spots.forEach(([sx, sy], i) => {
      const y = size * (sy - 0.04 * Math.abs(Math.sin(t * 1.4 + i * 2)));
      const g = ctx.createRadialGradient(size * sx - r * 0.3, y - r * 0.3, r * 0.2, size * sx, y, r);
      g.addColorStop(0, i % 2 ? "#c9e9ff" : "#ffe1a0");
      g.addColorStop(1, i % 2 ? this.colors[1] : this.colors[0]);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(size * sx, y, r, 0, 7); ctx.fill();
    });
  },

  start(stage) {
    const rand = stage.rand;
    let stopped = false;
    let idle = 0;
    const balls = [];
    const held = new Map(); // pointerId -> {ball, samples:[{x,y,t}]}
    const TAU = Math.PI * 2;

    const pick = () => (rand() < 0.5 ? [255, 183, 3] : [142, 202, 230]);
    function add(x, y) {
      const r = 20 + rand() * 26;
      const b = { x, y, vx: (rand() - 0.5) * 120, vy: -60 - rand() * 80, r, rgb: pick(), squash: 0 };
      b.grad = ballGrad(stage.ctx, r, b.rgb); // one gradient per ball, drawn translated
      balls.push(b);
      while (balls.length > 26) balls.shift();
      return balls[balls.length - 1];
    }
    for (let i = 0; i < 7; i++) add(rand() * stage.width, rand() * stage.height * 0.6);

    stage.onPointer({
      down(p) {
        idle = 0;
        let best = null, bestD = 1e9;
        for (const b of balls) {
          if (b.grabbed) continue; // one ball, one finger; the second falls through to the spawn answer
          const dx = p.x - b.x, dy = p.y - b.y, d = dx * dx + dy * dy;
          if (d < (b.r + 22) * (b.r + 22) && d < bestD) { best = b; bestD = d; }
        }
        if (best) {
          best.grabbed = true; best.vx = best.vy = 0;
          held.set(p.id, { ball: best, samples: [{ x: p.x, y: p.y, t: performance.now() }] });
        } else {
          const b = add(p.x, p.y);
          stage.audio.note(150 + 3000 / b.r, 0.08);
        }
      },
      move(p) {
        const h = held.get(p.id);
        if (!h) return;
        h.ball.x = p.x; h.ball.y = p.y;
        h.samples.push({ x: p.x, y: p.y, t: performance.now() });
        while (h.samples.length > 6) h.samples.shift();
      },
      up(p) {
        const h = held.get(p.id);
        if (!h) return;
        const s = h.samples, n = s.length;
        if (n >= 2) { // fling with the recent average velocity
          const a = s[0], b = s[n - 1], dt = Math.max(0.001, (b.t - a.t) / 1000);
          h.ball.vx = (b.x - a.x) / dt;
          h.ball.vy = (b.y - a.y) / dt;
          const sp = Math.hypot(h.ball.vx, h.ball.vy);
          if (sp > 40) stage.audio.pop();
        }
        h.ball.grabbed = false;
        held.delete(p.id);
      },
    });

    stage.onFrame((dt) => {
      if (stopped) return;
      const { ctx, width: W, height: H } = stage;
      idle += dt;

      // idle: lazy world - gravity softens and the floor breathes a gentle tilt
      const g = idle > 5 ? 160 : 620;
      if (idle > 5 && rand() < 0.002) for (const b of balls) if (!b.grabbed) b.vy -= 140;

      for (const b of balls) {
        if (b.grabbed) { b.squash = Math.max(0, b.squash - dt * 4); continue; }
        b.vy += g * dt;
        b.x += b.vx * dt; b.y += b.vy * dt;
        // squash only for a real bounce, or a resting ball is a pancake forever (nicolas [4915] #3)
        const bounce = (v) => { if (Math.abs(v) > 60) { stage.audio.note(90 + b.r * 2 + Math.abs(v) * 0.4, 0.05); b.squash = 1; } };
        if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx) * 0.82; bounce(b.vx); }
        if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx) * 0.82; bounce(b.vx); }
        if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy) * 0.82; }
        if (b.y > H - b.r) { b.y = H - b.r; b.vy = -Math.abs(b.vy) * 0.78; b.vx *= 0.985; bounce(b.vy); }
        b.squash = Math.max(0, b.squash - dt * 5);
      }
      // soft ball-to-ball push, cheap O(n^2) at n <= 26
      for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) {
        const a = balls[i], b = balls[j];
        const dx = b.x - a.x, dy = b.y - a.y, min = a.r + b.r, d2 = dx * dx + dy * dy;
        if (d2 > min * min || d2 === 0) continue;
        const d = Math.sqrt(d2), push = (min - d) / 2, nx = dx / d, ny = dy / d;
        if (!a.grabbed) { a.x -= nx * push; a.y -= ny * push; }
        if (!b.grabbed) { b.x += nx * push; b.y += ny * push; }
        const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (rel > 0) {
          if (!a.grabbed) { a.vx -= rel * nx * 0.6; a.vy -= rel * ny * 0.6; }
          if (!b.grabbed) { b.vx += rel * nx * 0.6; b.vy += rel * ny * 0.6; }
          if (rel > 120) stage.audio.note(140 + a.r * 3, 0.05);
        }
      }

      ctx.fillStyle = "#0d1322";
      ctx.fillRect(0, 0, W, H);
      for (const b of balls) {
        const sq = b.squash * 0.22;
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.scale(1 + sq, 1 - sq);
        ctx.fillStyle = b.grad;
        ctx.beginPath(); ctx.arc(0, 0, b.r, 0, TAU); ctx.fill();
        ctx.restore();
      }
    });

    return { stop() { stopped = true; } };
  },
};

// Local-coord gradient (origin = ball centre), built once per ball and reused.
function ballGrad(ctx, r, [r0, g0, b0]) {
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.2, 0, 0, r);
  g.addColorStop(0, `rgb(${Math.min(255, r0 + 90)},${Math.min(255, g0 + 90)},${Math.min(255, b0 + 90)})`);
  g.addColorStop(1, `rgb(${r0},${g0},${b0})`);
  return g;
}
