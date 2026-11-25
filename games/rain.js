// rain: soft clouds drift over a night sky above the puddles. Tapping a cloud makes it rain; tapping
// the sky brings the nearest cloud over the finger, and it rains there. Every drop lands as a ripple.

const CLOUDS = 4;
const MAX_DROPS = 200;
const MAX_RIPPLES = 60;
const MAX_RINGS = 20;
const RAIN_S = 3;

// A cloud's life, as explicit states.
const Cloud = Object.freeze({ IDLE: 'idle', RAINING: 'raining' });

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function drawCloud(ctx, x, y, w, dark, squash) {
  const h = w * 0.42 * (1 - squash * 0.12);
  ctx.fillStyle = dark ? '#7f8fb8' : '#aab8de';
  for (const [dx, dy, r] of [[-0.3, 0.1, 0.24], [-0.08, -0.12, 0.3], [0.2, 0, 0.26], [0.36, 0.14, 0.17], [-0.42, 0.18, 0.15]]) {
    ctx.beginPath();
    ctx.arc(x + dx * w, y + dy * h * 1.6, r * w * (1 + squash * 0.08), 0, Math.PI * 2);
    ctx.fill();
  }
}

export default {
  id: 'rain',
  colors: ['#7fb3ff', '#2b3a73'],

  icon(ctx, size, t) {
    ctx.fillStyle = '#0a1030';
    ctx.fillRect(0, 0, size, size);
    drawCloud(ctx, size * 0.5, size * 0.3, size * 0.6, true, 0);
    ctx.strokeStyle = '#7fb3ff';
    ctx.lineWidth = size * 0.02;
    for (let i = 0; i < 5; i++) {
      const x = size * (0.3 + i * 0.1), y = size * (0.45 + ((t * 0.8 + i * 0.37) % 1) * 0.35);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - size * 0.01, y + size * 0.06); ctx.stroke();
    }
  },

  start(stage) {
    const ctx = stage.ctx;
    let stopped = false;
    let sinceTouch = 0, sincePop = 1, idleClock = 0;
    const short = () => Math.min(stage.width, stage.height);
    const groundY = () => stage.height * 0.8;
    const cloudW = () => clamp(short() * 0.34, 120, 420);
    const clouds = Array.from({ length: CLOUDS }, (_, i) => ({
      x: stage.width * (0.15 + i * 0.24), y: stage.height * (0.16 + (i % 2) * 0.1),
      drift: (i % 2 ? -1 : 1) * (0.015 + stage.rand() * 0.015), target: null,
      state: Cloud.IDLE, clock: 0, squash: 0, rate: 40,
    }));
    const drops = [], ripples = [], rings = [];

    // IDLE/RAINING -> RAINING (again from the start).
    function rain(c, rate = 40) {
      c.state = Cloud.RAINING; c.clock = 0; c.squash = 1; c.rate = rate;
      if (rate >= 40) stage.audio.note(220 + 60 * clouds.indexOf(c), 0.4);
    }

    function cloudAt(x, y) {
      const w = cloudW();
      return clouds.find(c => Math.abs(x - c.x) < w * 0.55 && Math.abs(y - c.y) < w * 0.32);
    }

    function stepCloud(c, dt) {
      c.clock += dt;
      c.squash = Math.max(0, c.squash - dt * 4);
      if (c.target !== null) {
        // Gliding over a finger that called it.
        c.x += (c.target - c.x) * Math.min(1, dt * 6);
        if (Math.abs(c.target - c.x) < 4) c.target = null;
      } else {
        c.x += c.drift * stage.width * dt;
        const w = cloudW();
        if (c.x > stage.width + w * 0.6) c.x = -w * 0.6;
        if (c.x < -w * 0.6) c.x = stage.width + w * 0.6;
      }
      switch (c.state) {
        case Cloud.IDLE: break;
        case Cloud.RAINING: {
          const w = cloudW();
          const n = Math.floor(c.rate * dt + stage.rand());
          for (let k = 0; k < n && drops.length < MAX_DROPS; k++) {
            drops.push({ x: c.x + (stage.rand() - 0.5) * w * 0.8, y: c.y + w * 0.15, vy: short() * (0.6 + stage.rand() * 0.3) });
          }
          if (c.clock > RAIN_S) c.state = Cloud.IDLE;   // RAINING -> IDLE
          break;
        }
      }
    }

    const offFrame = stage.onFrame((dt, t) => {
      if (stopped) return;
      sinceTouch += dt; sincePop += dt;
      // Idle: after 5 s a cloud drizzles lightly now and then.
      if (sinceTouch > 5) {
        idleClock += dt;
        if (idleClock > 6) { idleClock = 0; rain(clouds[Math.floor(stage.rand() * CLOUDS) % CLOUDS], 12); }
      }
      for (const c of clouds) stepCloud(c, dt);
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        d.vy += short() * 1.5 * dt;
        d.y += d.vy * dt;
        if (d.y >= groundY() + (d.x % 37) / 37 * stage.height * 0.12) {   // a drop lands: a ripple
          if (ripples.length < MAX_RIPPLES) ripples.push({ x: d.x, y: d.y, r: 2, life: 1 });
          if (sincePop > 0.12) { stage.audio.pop(); sincePop = 0; }
          drops.splice(i, 1);
        }
      }
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.r += dt * short() * 0.08; r.life -= dt;
        if (r.life <= 0) ripples.splice(i, 1);
      }
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.r += dt * short() * 0.4; r.life -= dt * 2;
        if (r.life <= 0) rings.splice(i, 1);
      }

      const sky = ctx.createLinearGradient(0, 0, 0, stage.height);
      sky.addColorStop(0, '#070b24'); sky.addColorStop(1, '#16204a');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, stage.width, stage.height);
      // Ground with puddles.
      ctx.fillStyle = '#10182e';
      ctx.fillRect(0, groundY(), stage.width, stage.height - groundY());
      ctx.fillStyle = '#1c2c5a';
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.ellipse(stage.width * (0.14 + k * 0.24), groundY() + stage.height * (0.06 + (k % 2) * 0.05), stage.width * 0.1, stage.height * 0.03, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = '#8fc1ff';
      ctx.lineWidth = 2;
      for (const r of ripples) {
        ctx.globalAlpha = clamp(r.life, 0, 1) * 0.8;
        ctx.beginPath();
        ctx.ellipse(r.x, r.y, r.r, r.r * 0.35, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#a9cdff';
      ctx.lineWidth = Math.max(2, short() * 0.004);
      for (const d of drops) {
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - 1, d.y + short() * 0.025);
        ctx.stroke();
      }
      for (const c of clouds) drawCloud(ctx, c.x, c.y + Math.sin(t * 0.6 + c.drift * 100) * 3, cloudW(), c.state === Cloud.RAINING, c.squash);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      for (const r of rings) {
        ctx.globalAlpha = clamp(r.life, 0, 1) * 0.5;
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
        if (rings.length < MAX_RINGS) rings.push({ x: p.x, y: p.y, r: short() * 0.03, life: 1 });   // every touch answers at once
        const hit = cloudAt(p.x, p.y);
        if (hit) { rain(hit); return; }
        // The sky or the ground: the nearest cloud glides over the finger and rains there.
        let best = null, bestD = Infinity;
        for (const c of clouds) { const d = Math.abs(c.x - p.x); if (d < bestD) { bestD = d; best = c; } }
        if (best) { best.target = clamp(p.x, 0, stage.width); rain(best); }
      },
      move() {},
      up() {},
    });

    return {
      stop() {
        stopped = true;
        for (const off of [offFrame, offPointer]) if (typeof off === 'function') off();
      },
      debug: () => ({ entities: drops.length + ripples.length + rings.length, drops: drops.length, ripples: ripples.length, states: clouds.map(c => c.state) }),
    };
  },
};
