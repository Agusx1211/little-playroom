// carousel - a night fairground merry-go-round; any tap spins it faster and throws sparkles.
export default {
  id: "carousel",
  colors: ["#f472b6", "#2dd4bf"],

  icon(ctx, size, t) {
    // roof
    ctx.fillStyle = this.colors[0];
    ctx.beginPath();
    ctx.moveTo(size * 0.5, size * 0.16);
    ctx.lineTo(size * 0.86, size * 0.44);
    ctx.lineTo(size * 0.14, size * 0.44);
    ctx.closePath();
    ctx.fill();
    // pole
    ctx.fillStyle = this.colors[1];
    ctx.fillRect(size * 0.475, size * 0.4, size * 0.05, size * 0.34);
    // platform
    ctx.fillStyle = "#3b4a6b";
    ctx.beginPath();
    ctx.ellipse(size / 2, size * 0.78, size * 0.34, size * 0.1, 0, 0, 7);
    ctx.fill();
    // two horses going round the pole
    for (let i = 0; i < 2; i++) {
      const a = t * 1.6 + i * Math.PI;
      const x = size / 2 + Math.cos(a) * size * 0.28;
      const z = Math.sin(a); // +1 near, -1 far
      const s = 0.1 + 0.035 * z;
      ctx.fillStyle = i ? "#fde68a" : this.colors[1];
      ctx.beginPath();
      ctx.ellipse(x, size * (0.66 - 0.05 * z), size * s, size * s * 0.62, 0, 0, 7);
      ctx.fill();
    }
  },

  start(stage) {
    const rand = stage.rand;
    const TAU = Math.PI * 2;
    const PENTA = [523, 587, 659, 784, 880]; // C major pentatonic, all positive
    let stopped = false;
    let idle = 0, spin = 0, theta = 0, noteIx = 0, lastSound = -9, lastSpark = 0;
    const held = new Set();
    const sparks = [];

    function sparkle(x, y, n, boost) {
      for (let i = 0; i < n; i++) {
        const a = rand() * TAU, sp = 60 + rand() * (boost ? 240 : 120);
        sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: 0, max: 0.5 + rand() * 0.7 });
      }
      while (sparks.length > 160) sparks.shift();
    }

    stage.onPointer({
      down(p) {
        held.add(p.id);
        idle = 0;
        spin = Math.min(4.2, spin + 1.1);
        sparkle(p.x, p.y, 9, true);
        const now = frameT;
        if (now - lastSound > 0.05) {
          stage.audio.note(PENTA[noteIx++ % PENTA.length], 0.12);
          lastSound = now;
        }
      },
      move(p) {
        if (!held.has(p.id)) return;
        idle = 0;
        spin = Math.min(4.2, spin + 0.05);
        if (frameT - lastSpark > 0.05) { sparkle(p.x, p.y, 2, false); lastSpark = frameT; }
      },
      up(p) { held.delete(p.id); },
    });

    let frameT = 0;
    stage.onFrame((dt, t) => {
      if (stopped) return;
      frameT = t;
      idle += dt;
      const { ctx, width: W, height: H } = stage;

      // the ride never stands still: base spin, taps push it up, it settles back
      spin += (0.55 - spin) * Math.min(1, dt * 0.45);
      theta += spin * dt;
      // idle calliope: one lazy note every couple of seconds while nobody plays
      if (idle > 3 && t - lastSound > 2.2) { stage.audio.note(PENTA[noteIx++ % PENTA.length], 0.16); lastSound = t; }

      const cx = W / 2, cy = H * 0.58, R = Math.min(W, H) * 0.34;

      // sky
      ctx.fillStyle = "#101828";
      ctx.fillRect(0, 0, W, H);
      // moon
      ctx.fillStyle = "#e7edf7";
      ctx.beginPath(); ctx.arc(W * 0.86, H * 0.14, Math.min(W, H) * 0.05, 0, 7); ctx.fill();

      // platform: an ellipse the horses ride on
      ctx.fillStyle = "#3b4a6b";
      ctx.beginPath(); ctx.ellipse(cx, cy, R * 1.06, R * 0.3, 0, 0, 7); ctx.fill();
      ctx.fillStyle = "#22304d";
      ctx.beginPath(); ctx.ellipse(cx, cy + R * 0.1, R * 1.06, R * 0.3, 0, 0, 7); ctx.fill();

      // centre pole
      ctx.fillStyle = "#c9d4e6";
      ctx.fillRect(cx - R * 0.03, cy - R * 1.15, R * 0.06, R * 1.2);

      // roof: scalloped cone with slow-blinking bulbs (about 0.8 Hz, no strobing)
      ctx.fillStyle = this.colors[0];
      ctx.beginPath();
      ctx.moveTo(cx, cy - R * 1.5);
      ctx.lineTo(cx + R * 1.18, cy - R * 1.02);
      ctx.lineTo(cx - R * 1.18, cy - R * 1.02);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = this.colors[1];
      ctx.beginPath(); ctx.arc(cx, cy - R * 1.56, R * 0.055, 0, 7); ctx.fill();
      for (let i = 0; i < 12; i++) {
        const lx = cx - R * 1.12 + (i / 11) * R * 2.24;
        const glow = 0.55 + 0.45 * Math.sin(t * 5 + i * 1.3);
        ctx.fillStyle = `rgba(253,230,138,${glow.toFixed(3)})`;
        ctx.beginPath(); ctx.arc(lx, cy - R * 0.99, R * 0.035, 0, 7); ctx.fill();
      }

      // horses, far ones first
      const horses = [];
      for (let i = 0; i < 6; i++) {
        const a = theta + (i / 6) * TAU;
        const z = Math.sin(a); // +1 near, -1 far
        horses.push({ i, x: cx + Math.cos(a) * R * 0.78, z, bob: Math.sin(t * 2.4 + i * 1.7) });
      }
      horses.sort((h1, h2) => h1.z - h2.z);
      for (const h of horses) {
        const s = 0.72 + 0.32 * (h.z * 0.5 + 0.5);
        const hy = cy - R * 0.42 - h.bob * R * 0.07 - h.z * R * 0.05;
        const body = R * 0.14 * s, col = h.i % 2 ? "#fde68a" : this.colors[1];
        // pole
        ctx.fillStyle = "#c9d4e6";
        ctx.fillRect(h.x - R * 0.012 * s, hy - body * 1.7, R * 0.024 * s, body * 3.2);
        // body, head, ear, tail, saddle
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.ellipse(h.x, hy, body, body * 0.6, 0, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(h.x + body * 0.95, hy - body * 0.75, body * 0.38, 0, 7); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(h.x + body * 1.05, hy - body * 1.05);
        ctx.lineTo(h.x + body * 1.35, hy - body * 1.2);
        ctx.lineTo(h.x + body * 1.32, hy - body * 0.8);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = col;
        ctx.lineWidth = body * 0.16;
        ctx.beginPath();
        ctx.moveTo(h.x - body * 0.95, hy - body * 0.1);
        ctx.quadraticCurveTo(h.x - body * 1.5, hy + body * 0.2, h.x - body * 1.35, hy + body * 0.9);
        ctx.stroke();
        ctx.fillStyle = this.colors[0];
        ctx.fillRect(h.x - body * 0.4, hy - body * 0.55, body * 0.9, body * 0.34);
      }

      // sparkles last, on top of everything
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.life += dt;
        if (s.life > s.max) { sparks.splice(i, 1); continue; }
        s.vy += 160 * dt; s.x += s.vx * dt; s.y += s.vy * dt;
        ctx.globalAlpha = Math.max(0, 1 - s.life / s.max);
        ctx.fillStyle = i % 3 ? "#fde68a" : this.colors[0];
        ctx.beginPath(); ctx.arc(s.x, s.y, 3 + 2 * (1 - s.life / s.max), 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
    });

    return { stop() { stopped = true; } };
  },
};
