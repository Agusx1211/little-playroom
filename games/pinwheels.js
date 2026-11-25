// pinwheels - meadow pinwheels; sweep a finger for wind, tap to grow a new one where you touched.
export default {
  id: "pinwheels",
  colors: ["#22d3ee", "#a3e635"],

  icon(ctx, size, t) {
    const cx = size * 0.5, cy = size * 0.38, r = size * 0.3;
    // stick
    ctx.strokeStyle = "#a16207";
    ctx.lineWidth = size * 0.04;
    ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, size * 0.86); ctx.stroke();
    // four blades spinning (~0.5 Hz turn at the slow end, never a strobe)
    const a0 = t * 3.2;
    for (let k = 0; k < 4; k++) {
      const a = a0 + (k * Math.PI) / 2;
      ctx.fillStyle = k % 2 ? this.colors[0] : this.colors[1];
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.quadraticCurveTo(cx + Math.cos(a + 0.5) * r * 1.25, cy + Math.sin(a + 0.5) * r * 1.25,
        cx + Math.cos(a) * r * 1.35, cy + Math.sin(a) * r * 1.35);
      ctx.quadraticCurveTo(cx + Math.cos(a - 0.2) * r * 0.5, cy + Math.sin(a - 0.2) * r * 0.5, cx, cy);
      ctx.fill();
    }
    ctx.fillStyle = "#f59e0b";
    ctx.beginPath(); ctx.arc(cx, cy, size * 0.045, 0, 7); ctx.fill();
  },

  start(stage) {
    const rand = stage.rand;
    const WHEEL_COLORS = [["#22d3ee", "#f472b6"], ["#a3e635", "#facc15"], ["#f97316", "#38bdf8"], ["#c084fc", "#fb7185"], ["#34d399", "#fde047"]];
    let stopped = false;
    let idle = 0, wind = 0, lastGust = -9, lastSound = -9, noteIx = 0;
    const PENTA = [659, 784, 880, 988, 1175];
    let wheels = [];
    const streaks = [];
    let lastMove = null;
    const held = new Set();

    function addWheel(x, y, r, born) {
      wheels.push({ x, y, r, ang: rand() * 7, w: 1.2, cols: WHEEL_COLORS[wheels.length % WHEEL_COLORS.length], born, life: born ? 18 : Infinity });
      while (wheels.length > 11) wheels.shift(); // three base + eight at most, oldest small one goes
    }
    function seedBase() {
      wheels = [];
      const W = stage.width, H = stage.height, m = Math.min(W, H);
      for (const f of [0.25, 0.5, 0.75]) addWheel(W * f, H * 0.42, m * 0.13, 0);
    }
    seedBase();
    let baseW = stage.width;

    stage.onPointer({
      down(p) {
        idle = 0;
        held.add(p.id);
        lastMove = { x: p.x, y: p.y };
        const m = Math.min(stage.width, stage.height);
        const hit = wheels.find((w) => Math.hypot(p.x - w.x, p.y - w.y) < w.r * 1.35);
        if (hit) {
          hit.w = Math.min(9.2, hit.w + 6);
          stage.audio.note(PENTA[(wheels.indexOf(hit)) % PENTA.length], 0.14);
        } else {
          addWheel(p.x, p.y, m * 0.06 + rand() * m * 0.03, true);
          stage.audio.pop();
        }
        wind = Math.min(9, wind + 3);
      },
      move(p) {
        idle = 0;
        if (lastMove) {
          const step = Math.hypot(p.x - lastMove.x, p.y - lastMove.y);
          wind = Math.min(9, wind + step * 0.012);
          if (step > 18 && tNow - lastGust > 0.08) { // wind streak follows the sweep
            lastGust = tNow;
            streaks.push({ x: p.x, y: p.y, vx: (p.x - lastMove.x) * 4, vy: (p.y - lastMove.y) * 4, life: 0, max: 0.5 + rand() * 0.4 });
            while (streaks.length > 40) streaks.shift();
          }
        }
        lastMove = { x: p.x, y: p.y };
      },
      up(p) { held.delete(p.id); if (!held.size) lastMove = null; },
    });

    let tNow = 0;
    stage.onFrame((dt, t) => {
      if (stopped) return;
      tNow = t;
      idle += dt;
      const { ctx, width: W, height: H } = stage;
      const m = Math.min(W, H);
      if (baseW !== W) { baseW = W; seedBase(); } // the tablet turned

      wind *= 1 - Math.min(1, dt * 1.3);
      // idle breeze: a gust walks past every couple of seconds
      if (idle > 2 && t - lastGust > 2.4) {
        lastGust = t;
        wind = Math.min(9, wind + 2.5);
        streaks.push({ x: -40, y: H * (0.15 + rand() * 0.3), vx: 260 + rand() * 160, vy: 0, life: 0, max: 1.6 });
        if (t - lastSound > 1.8) { stage.audio.note(PENTA[noteIx++ % PENTA.length], 0.2); lastSound = t; }
      }

      // meadow
      const sky = ctx.createLinearGradient(0, 0, 0, H * 0.78);
      sky.addColorStop(0, "#bae6fd");
      sky.addColorStop(1, "#e0f2fe");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#bef264";
      ctx.fillRect(0, H * 0.76, W, H * 0.24);
      ctx.fillStyle = "#a3e635";
      ctx.beginPath(); ctx.ellipse(W * 0.5, H * 0.78, W * 0.7, H * 0.05, 0, 0, 7); ctx.fill();
      // swaying flowers
      for (let k = 0; k < 7; k++) {
        const fx = W * (0.08 + k * 0.14), fy = H * (0.84 + (k % 3) * 0.045);
        const sway = Math.sin(t * 1.2 + k * 2.1) * m * 0.006;
        ctx.strokeStyle = "#65a30d";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(fx, fy + H * 0.03); ctx.lineTo(fx + sway, fy); ctx.stroke();
        ctx.fillStyle = k % 2 ? "#f472b6" : "#fde047";
        ctx.beginPath(); ctx.arc(fx + sway, fy, m * 0.011, 0, 7); ctx.fill();
      }

      // wind streaks
      for (let i = streaks.length - 1; i >= 0; i--) {
        const s = streaks[i];
        s.life += dt;
        if (s.life > s.max) { streaks.splice(i, 1); continue; }
        s.x += s.vx * dt; s.y += s.vy * dt;
        ctx.strokeStyle = `rgba(255,255,255,${Math.max(0, 0.65 * (1 - s.life / s.max)).toFixed(3)})`;
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.quadraticCurveTo(s.x - s.vx * 0.06, s.y + Math.sin(t * 6 + i) * 4 - s.vy * 0.06, s.x - s.vx * 0.13, s.y - s.vy * 0.13);
        ctx.stroke();
      }

      // wheels: wind plus their own spin, capped so blades never strobe
      for (let i = wheels.length - 1; i >= 0; i--) {
        const w = wheels[i];
        if (w.life !== Infinity) {
          w.life -= dt;
          if (w.life <= 0) { wheels.splice(i, 1); continue; }
        }
        w.w += ((1.2 + wind * 1.1) - w.w) * Math.min(1, dt * 1.8);
        // cap at 9.2 rad/s: with two alternating colours that is under 3 colour changes a second
        w.w = Math.min(9.2, w.w);
        w.ang += w.w * dt;

        const fade = w.life === Infinity ? 1 : Math.min(1, w.life / 1.2, (18 - w.life) / 0.4);
        ctx.globalAlpha = Math.max(0.05, Math.min(1, fade));
        // stick
        ctx.strokeStyle = "#a16207";
        ctx.lineWidth = Math.max(3, w.r * 0.09);
        ctx.beginPath(); ctx.moveTo(w.x, w.y); ctx.lineTo(w.x, H * 0.9); ctx.stroke();
        // blades
        for (let k = 0; k < 4; k++) {
          const a = w.ang + (k * Math.PI) / 2;
          ctx.fillStyle = k % 2 ? w.cols[0] : w.cols[1];
          ctx.beginPath();
          ctx.moveTo(w.x, w.y);
          ctx.quadraticCurveTo(w.x + Math.cos(a + 0.5) * w.r * 1.25, w.y + Math.sin(a + 0.5) * w.r * 1.25,
            w.x + Math.cos(a) * w.r * 1.35, w.y + Math.sin(a) * w.r * 1.35);
          ctx.quadraticCurveTo(w.x + Math.cos(a - 0.2) * w.r * 0.5, w.y + Math.sin(a - 0.2) * w.r * 0.5, w.x, w.y);
          ctx.fill();
        }
        ctx.fillStyle = "#f59e0b";
        ctx.beginPath(); ctx.arc(w.x, w.y, Math.max(3, w.r * 0.14), 0, 7); ctx.fill();
        ctx.globalAlpha = 1;
      }
    });

    return { stop() { stopped = true; } };
  },
};
