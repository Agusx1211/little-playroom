// hotair - a hot-air balloon; tap anywhere for a coloured puff and a burner boost that lifts it skyward.
export default {
  id: "hotair",
  colors: ["#fb7185", "#fde68a"],

  icon(ctx, size, t) {
    const bob = Math.sin(t * 1.8) * size * 0.03;
    const cx = size / 2, cy = size * 0.4 + bob, r = size * 0.26;
    // envelope: three gores
    ctx.fillStyle = this.colors[0];
    ctx.beginPath(); ctx.ellipse(cx, cy, r, r * 1.08, 0, 0, 7); ctx.fill();
    ctx.fillStyle = this.colors[1];
    ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.62, r * 1.05, 0, 0, 7); ctx.fill();
    ctx.fillStyle = this.colors[0];
    ctx.beginPath(); ctx.ellipse(cx, cy, r * 0.28, r * 1.02, 0, 0, 7); ctx.fill();
    // skirt + basket
    ctx.fillStyle = "#e2c193";
    ctx.fillRect(cx - r * 0.3, cy + r * 1.02, r * 0.6, size * 0.05);
    ctx.strokeStyle = "#8a6a45";
    ctx.lineWidth = size * 0.015;
    ctx.beginPath(); ctx.moveTo(cx - r * 0.24, cy + r * 1.06); ctx.lineTo(cx - r * 0.18, cy + r * 1.5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + r * 0.24, cy + r * 1.06); ctx.lineTo(cx + r * 0.18, cy + r * 1.5); ctx.stroke();
    ctx.fillStyle = "#a16207";
    ctx.fillRect(cx - size * 0.075, cy + r * 1.5, size * 0.15, size * 0.1);
    // flame flicker (~1.4 Hz)
    const f = 0.7 + 0.3 * Math.sin(t * 8.8);
    ctx.fillStyle = "#fb923c";
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 1.2 - size * 0.02 * f, size * 0.022, size * 0.05 * f, 0, 0, 7);
    ctx.fill();
  },

  start(stage) {
    const rand = stage.rand;
    let stopped = false;
    let idle = 0, lastPuff = -9, heat = 0, comboT = -9, combo = 0, lastSound = -9;
    const PUFFY = ["#fb7185", "#fde68a", "#7dd3fc", "#a7f3d0", "#f9a8d4", "#fdba74"];
    let pIx = 0;
    const balloon = { x: 0.5, y: 0.45, vx: 0, vy: 0, tilt: 0 }; // x,y in stage fractions
    const puffs = [];

    stage.onPointer({
      down(p) {
        idle = 0;
        const W = stage.width, H = stage.height;
        // coloured puff right under the finger
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI * 2;
          puffs.push({
            x: p.x, y: p.y, vx: Math.cos(a) * 40 * (0.6 + rand()), vy: Math.sin(a) * 40 * (0.6 + rand()) - 30,
            r: 6 + rand() * 8, rv: 26 + rand() * 30, life: 0, max: 0.9 + rand() * 0.5, col: PUFFY[pIx++ % PUFFY.length],
          });
        }
        while (puffs.length > 150) puffs.shift();
        // burner boost: lift toward the tap
        heat = Math.min(180, heat + 90);
        const dx = p.x - balloon.x * W;
        balloon.vx += Math.max(-90, Math.min(90, dx * 0.4));
        balloon.vy -= 110;
        // rising arpeggio while taps keep coming
        const now = tClock;
        combo = now - comboT < 1.5 ? combo + 1 : 0;
        comboT = now;
        stage.audio.note(330 * Math.pow(1.122, combo % 6), 0.14);
        if (now - lastSound > 0.2) { stage.audio.whoosh(); lastSound = now; }
      },
      move() { idle = 0; },
    });

    let tClock = 0;
    stage.onFrame((dt, t) => {
      if (stopped) return;
      tClock = t;
      idle += dt;
      const { ctx, width: W, height: H } = stage;
      const m = Math.min(W, H);

      // gentle idle life: the balloon drifts on its own and vents a puff now and then
      if (idle > 2.5 && t - lastPuff > 2.5) {
        lastPuff = t;
        puffs.push({
          x: balloon.x * W + m * 0.05, y: balloon.y * H, vx: 30, vy: -10, r: 5, rv: 24,
          life: 0, max: 1.2, col: PUFFY[pIx++ % PUFFY.length],
        });
        heat = Math.min(180, heat + 30);
      }

      // physics: heat rises, weight sinks, air drags
      heat = Math.max(0, heat - 40 * dt);
      balloon.vy += (26 - heat * 0.55) * dt;
      balloon.vx += Math.sin(t * 0.21) * 9 * dt;
      balloon.vx *= 1 - Math.min(1, dt * 0.7);
      balloon.vy *= 1 - Math.min(1, dt * 0.55);
      balloon.x += (balloon.vx * dt) / W;
      balloon.y += (balloon.vy * dt) / H;
      balloon.tilt += ((balloon.vx * 0.0009) - balloon.tilt) * Math.min(1, dt * 3);
      if (balloon.y < 0.14) { balloon.y = 0.14; balloon.vy = Math.abs(balloon.vy) * 0.35; }
      if (balloon.y > 0.62) { balloon.y = 0.62; balloon.vy = -Math.abs(balloon.vy) * 0.3; }
      if (balloon.x < 0.12) { balloon.x = 0.12; balloon.vx = Math.abs(balloon.vx); }
      if (balloon.x > 0.88) { balloon.x = 0.88; balloon.vx = -Math.abs(balloon.vx); }

      // ---- sky ----
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, "#7dd3fc");
      sky.addColorStop(1, "#e0f2fe");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#fde047";
      ctx.beginPath(); ctx.arc(W * 0.12, H * 0.13, m * 0.06, 0, 7); ctx.fill();
      // hills
      ctx.fillStyle = "#86efac";
      ctx.beginPath(); ctx.ellipse(W * 0.25, H * 1.06, W * 0.55, H * 0.22, 0, 0, 7); ctx.fill();
      ctx.fillStyle = "#4ade80";
      ctx.beginPath(); ctx.ellipse(W * 0.85, H * 1.08, W * 0.5, H * 0.18, 0, 0, 7); ctx.fill();
      // clouds drift across forever
      for (let c = 0; c < 5; c++) {
        const speed = 10 + c * 5;
        const cx = ((t * speed + c * W * 0.27 + W * 0.1) % (W + 300)) - 150;
        const cyy = H * (0.1 + 0.09 * ((c * 37) % 5));
        ctx.fillStyle = "rgba(255,255,255,0.92)";
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          ctx.arc(cx + k * m * 0.05, cyy + (k % 2) * m * 0.012, m * (0.038 - k * 0.007), 0, 7);
          ctx.fill();
        }
      }

      // ---- balloon ----
      const bx = balloon.x * W, by = balloon.y * H, r = m * 0.16;
      ctx.save();
      ctx.translate(bx, by);
      ctx.rotate(balloon.tilt);
      // envelope gores
      ctx.fillStyle = this.colors[0];
      ctx.beginPath(); ctx.ellipse(0, 0, r, r * 1.1, 0, 0, 7); ctx.fill();
      ctx.fillStyle = this.colors[1];
      ctx.beginPath(); ctx.ellipse(0, 0, r * 0.62, r * 1.06, 0, 0, 7); ctx.fill();
      ctx.fillStyle = this.colors[0];
      ctx.beginPath(); ctx.ellipse(0, 0, r * 0.3, r * 1.02, 0, 0, 7); ctx.fill();
      // skirt
      ctx.fillStyle = "#e2c193";
      ctx.fillRect(-r * 0.3, r * 1.04, r * 0.6, m * 0.014);
      // ropes
      ctx.strokeStyle = "#8a6a45";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-r * 0.26, r * 1.12); ctx.lineTo(-r * 0.16, r * 1.52); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(r * 0.26, r * 1.12); ctx.lineTo(r * 0.16, r * 1.52); ctx.stroke();
      // basket
      ctx.fillStyle = "#a16207";
      ctx.fillRect(-m * 0.045, r * 1.5, m * 0.09, m * 0.06);
      ctx.strokeStyle = "#78350f";
      ctx.beginPath(); ctx.moveTo(-m * 0.045, r * 1.53); ctx.lineTo(m * 0.045, r * 1.53); ctx.stroke();
      // burner flame while heat is on
      if (heat > 1) {
        const f = (0.7 + 0.3 * Math.sin(t * 8.8)) * Math.min(1, heat / 60);
        ctx.fillStyle = "#fb923c";
        ctx.beginPath(); ctx.ellipse(0, r * 1.36, m * 0.014, m * 0.03 * f + 2, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "#fde047";
        ctx.beginPath(); ctx.ellipse(0, r * 1.38, m * 0.007, m * 0.016 * f + 1, 0, 0, 7); ctx.fill();
      }
      ctx.restore();

      // ---- puffs over everything ----
      for (let i = puffs.length - 1; i >= 0; i--) {
        const p = puffs[i];
        p.life += dt;
        if (p.life > p.max) { puffs.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy -= 8 * dt; p.r += p.rv * dt;
        ctx.globalAlpha = Math.max(0, 0.85 * (1 - p.life / p.max));
        ctx.fillStyle = p.col;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
    });

    return { stop() { stopped = true; } };
  },
};
