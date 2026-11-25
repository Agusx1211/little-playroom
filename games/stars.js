// stars - a warp field; the streaming centre follows the finger, holding speeds up.
export default {
  id: "stars",
  colors: ["#e0e7ff", "#9d4edd"],

  icon(ctx, size, t) {
    const cx = size / 2, cy = size / 2;
    ctx.lineCap = "round";
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + 0.4;
      const r0 = size * (0.16 + 0.05 * Math.sin(t * 2 + i));
      const r1 = r0 + size * 0.22;
      ctx.strokeStyle = i % 3 ? this.colors[0] : this.colors[1];
      ctx.lineWidth = size * 0.035;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.stroke();
    }
  },

  start(stage) {
    const rand = stage.rand;
    let stopped = false;
    let idle = 0;
    let speed = 1;          // current warp speed
    let goal = 1;           // where speed is heading
    let cx, cy;             // warp centre, eases toward the finger
    let tx, ty;
    const held = new Set();
    const stars = [];
    const TAU = Math.PI * 2;

    cx = tx = stage.width / 2; cy = ty = stage.height / 2;
    for (let i = 0; i < 220; i++) stars.push(newStar(true));

    // 36 pre-made batches (2 hues x 6 depth bands x 3 width steps); arrays reused every frame
    const batches = Array.from({ length: 36 }, () => []);
    const cssCache = [230, 275].map((hue) =>
      Array.from({ length: 6 }, (_, kb) => {
        const k = (kb + 0.5) / 6;
        return `hsla(${hue} 70% ${(70 + k * 20) | 0}% / ${(0.15 + k * 0.8).toFixed(2)})`;
      }));

    function newStar(anywhere) {
      const a = rand() * TAU;
      const d = anywhere ? 4 + rand() * Math.max(stage.width, stage.height) * 0.5 : 2 + rand() * 6;
      return { a, d, sz: 0.6 + rand() * 1.9, hue: rand() < 0.8 ? 230 : 275 };
    }

    stage.onPointer({
      down(p) { idle = 0; held.add(p.id); tx = p.x; ty = p.y; },
      move(p) { if (held.has(p.id)) { idle = 0; tx = p.x; ty = p.y; } },
      up(p) { held.delete(p.id); },
    });

    let whooshCooldown = 0;
    stage.onFrame((dt, t) => {
      if (stopped) return;
      const { ctx, width: W, height: H } = stage;
      idle += dt;

      goal = held.size ? 6.5 : 1;
      if (idle > 5 && held.size === 0) goal = 1.6 + 0.5 * Math.sin(t * 0.5); // drift breathes, but never abandons a held finger
      speed += (goal - speed) * Math.min(1, dt * 2.2);

      // centre eases toward the finger; wanders on its own when idle
      if (idle > 5 && held.size === 0) { tx = W / 2 + Math.sin(t * 0.35) * W * 0.28; ty = H / 2 + Math.cos(t * 0.28) * H * 0.24; }
      cx += (tx - cx) * Math.min(1, dt * 5);
      cy += (ty - cy) * Math.min(1, dt * 5);

      whooshCooldown -= dt;
      if (speed > 5 && whooshCooldown <= 0) { whooshCooldown = 0.6; stage.audio.whoosh(); }

      ctx.fillStyle = "#05060f";
      ctx.fillRect(0, 0, W, H);
      const maxD = Math.hypot(W, H) * 0.62;
      // batch the field: stars sharing depth band, width step and hue stroke as one path
      const K = 6, WQ = 3;
      for (const b of batches) b.length = 0;
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        s.d += (6 + s.d * 0.55) * speed * dt;
        if (s.d > maxD) { stars[i] = newStar(false); continue; }
        const k = s.d / maxD;
        const kb = Math.min(K - 1, (k * K) | 0);
        const wq = Math.min(WQ - 1, (s.sz * (0.5 + k * 1.8)) | 0);
        const hi = s.hue === 230 ? 0 : 1;
        const b = batches[(hi * K + kb) * WQ + wq];
        // trail stretches behind the head by six frames of travel: warp look
        const stretch = (6 + s.d * 0.55) * speed * dt * 6;
        const d0 = Math.max(0, s.d - stretch);
        const x0 = cx + Math.cos(s.a) * d0, y0 = cy + Math.sin(s.a) * d0;
        b.push(x0, y0, cx + Math.cos(s.a) * s.d, cy + Math.sin(s.a) * s.d);
      }
      ctx.lineCap = "round";
      for (let bi = 0; bi < batches.length; bi++) {
        const b = batches[bi];
        if (!b.length) continue;
        const hi = (bi / (K * WQ)) | 0;
        const kb = ((bi / WQ) | 0) % K;
        const wq = bi % WQ;
        ctx.strokeStyle = cssCache[hi][kb]; // built once, reused every frame
        ctx.lineWidth = [0.8, 1.6, 2.8][wq];
        ctx.beginPath();
        for (let j = 0; j < b.length; j += 4) { ctx.moveTo(b[j], b[j + 1]); ctx.lineTo(b[j + 2], b[j + 3]); }
        ctx.stroke();
      }
      // soft core so the middle never looks dead
      const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, 46 + speed * 6);
      g.addColorStop(0, "rgba(224,231,255,0.5)");
      g.addColorStop(1, "rgba(224,231,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, 46 + speed * 6, 0, TAU); ctx.fill();
    });

    return { stop() { stopped = true; } };
  },
};
