// snow: a snowglobe with a little house and tree. A touch (or a drag) swirls the snow around the
// finger; the flakes then drift down and settle at the bottom of the globe again. No end.

const FLAKES = 220;

// A flake's life, as explicit states.
const Flake = Object.freeze({ SETTLED: 'settled', SWIRLING: 'swirling' });

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function globe(width, height) {
  const r = Math.min(width, height) * 0.42;
  return { cx: width / 2, cy: height * 0.47, r };
}

function drawScene(ctx, g) {
  // Snow ground inside the globe.
  ctx.fillStyle = '#e8f1ff';
  ctx.beginPath();
  ctx.ellipse(g.cx, g.cy + g.r * 0.62, g.r * 0.78, g.r * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  // A tree.
  ctx.fillStyle = '#2d6a4f';
  for (let k = 0; k < 3; k++) {
    const w = g.r * (0.32 - k * 0.07), y = g.cy + g.r * (0.48 - k * 0.17);
    ctx.beginPath();
    ctx.moveTo(g.cx - g.r * 0.35 - w / 2, y);
    ctx.lineTo(g.cx - g.r * 0.35 + w / 2, y);
    ctx.lineTo(g.cx - g.r * 0.35, y - g.r * 0.22);
    ctx.closePath();
    ctx.fill();
  }
  // A house with a warm window.
  const hx = g.cx + g.r * 0.15, hy = g.cy + g.r * 0.22, hw = g.r * 0.42, hh = g.r * 0.32;
  ctx.fillStyle = '#9d4edd';
  ctx.fillRect(hx, hy, hw, hh);
  ctx.fillStyle = '#ff6b6b';
  ctx.beginPath();
  ctx.moveTo(hx - hw * 0.1, hy);
  ctx.lineTo(hx + hw * 1.1, hy);
  ctx.lineTo(hx + hw / 2, hy - hh * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(hx + hw * 0.2, hy + hh * 0.25, hw * 0.25, hh * 0.3);
}

export default {
  id: 'snow',
  colors: ['#a2d2ff', '#ffffff'],

  icon(ctx, size, t) {
    ctx.fillStyle = '#0d1b3a';
    ctx.fillRect(0, 0, size, size);
    const g = { cx: size / 2, cy: size * 0.48, r: size * 0.4 };
    ctx.fillStyle = '#1b3a6b';
    ctx.beginPath();
    ctx.arc(g.cx, g.cy, g.r, 0, Math.PI * 2);
    ctx.fill();
    drawScene(ctx, g);
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 14; i++) {
      const a = i * 2.4 + t * 0.6, d = g.r * (0.2 + (i % 5) * 0.14);
      ctx.beginPath();
      ctx.arc(g.cx + Math.cos(a) * d, g.cy + Math.sin(a) * d * 0.8, size * 0.012, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  start(stage) {
    const ctx = stage.ctx;
    const flakes = [];
    let sinceTouch = 0, sinceWhoosh = 1, shake = 0;
    let stopped = false;
    const fingers = new Map();   // pointer id -> {x, y, vx, vy}

    function seed() {
      const g = globe(stage.width, stage.height);
      flakes.length = 0;
      for (let i = 0; i < FLAKES; i++) {
        // Settled in the lower part of the globe; positions relative to the centre, in globe radii.
        const a = Math.PI * (0.15 + stage.rand() * 0.7), d = 0.55 + stage.rand() * 0.38;
        flakes.push({ u: Math.cos(a) * d, v: Math.sin(a) * d, vu: 0, vv: 0, s: 0.6 + stage.rand() * 1.0, state: Flake.SETTLED, spin: 0 });
      }
      return g;
    }
    seed();

    // A touch near flakes: SETTLED/SWIRLING -> SWIRLING with a push away from the finger and a twist.
    function stir(x, y, vx, vy, strength) {
      const g = globe(stage.width, stage.height);
      let fu = (x - g.cx) / g.r, fv = (y - g.cy) / g.r;
      // A touch outside the glass swirls the snow on the nearest side and shakes the globe a little.
      const fd = Math.hypot(fu, fv);
      if (fd > 0.9) { fu *= 0.9 / fd; fv *= 0.9 / fd; shake = Math.max(shake, 0.6 * Math.min(1, strength * 2)); }
      let moved = 0;
      for (const f of flakes) {
        const du = f.u - fu, dv = f.v - fv, d2 = du * du + dv * dv;
        if (d2 > 0.5) continue;
        const k = strength * (1 - d2 / 0.5);
        f.state = Flake.SWIRLING;
        f.vu += (du * 1.2 - dv * 1.5) * k + (vx / g.r) * 0.25 * k;
        f.vv += (dv * 1.2 + du * 1.5) * k - 0.6 * k + (vy / g.r) * 0.25 * k;
        f.spin = 1;
        moved++;
      }
      if (moved > 0 && sinceWhoosh > 0.4) { stage.audio.whoosh(); sinceWhoosh = 0; }
    }

    function step(f, dt) {
      switch (f.state) {
        case Flake.SETTLED:
          break;
        case Flake.SWIRLING: {
          const drag = Math.exp(-dt * 1.4);
          f.vu *= drag; f.vv = f.vv * drag + dt * 0.18;   // a slow fall inside the water
          f.u += f.vu * dt; f.v += f.vv * dt;
          // Stay inside the glass.
          const d = Math.hypot(f.u, f.v);
          if (d > 0.93) {
            f.u *= 0.93 / d; f.v *= 0.93 / d;
            const nu = f.u / 0.93, nv = f.v / 0.93, dot = f.vu * nu + f.vv * nv;
            if (dot > 0) { f.vu -= 1.6 * dot * nu; f.vv -= 1.6 * dot * nv; }
          }
          // Back on the snow at the bottom and nearly still: SWIRLING -> SETTLED.
          if (f.v > 0.55 && Math.hypot(f.vu, f.vv) < 0.05) { f.state = Flake.SETTLED; f.vu = f.vv = 0; }
          break;
        }
      }
      f.spin = Math.max(0, f.spin - dt);
    }

    const offFrame = stage.onFrame((dt, t) => {
      if (stopped) return;
      sinceTouch += dt; sinceWhoosh += dt;
      for (const [, p] of fingers) stir(p.x, p.y, p.vx, p.vy, dt * 6);
      // Idle: after 5 s a few flakes lift and drift, so the globe is never still.
      if (sinceTouch > 5) {
        for (const f of flakes) {
          if (f.state === Flake.SETTLED && stage.rand() < dt * 0.04) { f.state = Flake.SWIRLING; f.vv = -0.25 - stage.rand() * 0.2; f.vu = (stage.rand() - 0.5) * 0.2; }
        }
      }
      for (const f of flakes) step(f, dt);
      shake = Math.max(0, shake - dt * 1.5);

      const g0 = globe(stage.width, stage.height);
      const g = { cx: g0.cx + Math.sin(t * 18) * shake * g0.r * 0.03, cy: g0.cy, r: g0.r };
      ctx.fillStyle = '#070d1f';
      ctx.fillRect(0, 0, stage.width, stage.height);
      // Base of the globe.
      ctx.fillStyle = '#5a3e2b';
      ctx.beginPath();
      ctx.ellipse(g.cx, g.cy + g.r * 1.02, g.r * 0.72, g.r * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(g.cx - g.r * 0.72, g.cy + g.r * 0.88, g.r * 1.44, g.r * 0.14);
      // The glass with its water.
      const water = ctx.createRadialGradient(g.cx - g.r * 0.3, g.cy - g.r * 0.4, g.r * 0.1, g.cx, g.cy, g.r);
      water.addColorStop(0, '#2a4d8f'); water.addColorStop(1, '#13264d');
      ctx.fillStyle = water;
      ctx.beginPath();
      ctx.arc(g.cx, g.cy, g.r, 0, Math.PI * 2);
      ctx.fill();
      drawScene(ctx, g);
      ctx.fillStyle = '#ffffff';
      for (const f of flakes) {
        const size = clamp(g.r * 0.012 * f.s, 1.2, 6) * (1 + f.spin * 0.3);
        ctx.beginPath();
        ctx.arc(g.cx + f.u * g.r, g.cy + f.v * g.r, size, 0, Math.PI * 2);
        ctx.fill();
      }
      // A soft highlight on the glass.
      ctx.globalAlpha = 0.14 + 0.04 * Math.sin(t * 0.7);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(g.cx - g.r * 0.45, g.cy - g.r * 0.45, g.r * 0.18, g.r * 0.32, -0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    const offPointer = stage.onPointer({
      down(p) {
        if (stopped) return;
        sinceTouch = 0;
        fingers.set(p.id, { x: p.x, y: p.y, vx: 0, vy: 0 });
        stir(p.x, p.y, 0, 0, 0.9);
      },
      move(p) {
        const f = fingers.get(p.id);
        if (stopped || !f) return;
        sinceTouch = 0;
        f.vx = (p.x - f.x) * 30; f.vy = (p.y - f.y) * 30;
        f.x = p.x; f.y = p.y;
      },
      up(p) { fingers.delete(p.id); },
    });

    return {
      stop() {
        stopped = true;
        if (typeof offFrame === 'function') offFrame();
        if (typeof offPointer === 'function') offPointer();
      },
      debug: () => ({ entities: flakes.length, states: flakes.map(f => f.state) }),
    };
  },
};
