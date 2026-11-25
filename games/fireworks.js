// fireworks - every tap bursts a warm flower of sparks; quiet sky otherwise.
export default {
  id: "fireworks",
  colors: ["#ffd166", "#ff5a7a"],

  icon(ctx, size, t) {
    const cx = size / 2, cy = size / 2, r = size * (0.3 + 0.02 * Math.sin(t * 2));
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      ctx.strokeStyle = i % 2 ? this.colors[0] : this.colors[1];
      ctx.lineWidth = size * 0.045;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * 0.4, cy + Math.sin(a) * r * 0.4);
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      ctx.stroke();
    }
  },

  start(stage) {
    const rand = stage.rand;
    let stopped = false;
    let idle = 0;
    let auto = 0;
    const sparks = [];
    const MAX = 280;

    const hueMix = () => (rand() < 0.5 ? 42 : rand() < 0.5 ? 350 : 18); // gold, rose, amber

    function burst(x, y, big) {
      const n = big ? 40 : 24;
      const hue = hueMix();
      for (let i = 0; i < n && sparks.length < MAX; i++) {
        const a = (i / n) * Math.PI * 2 + rand() * 0.25;
        const sp = (big ? 160 : 110) * (0.55 + rand() * 0.75);
        const h = hue + rand() * 18 - 9;
        sparks.push({
          x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
          life: 0.9 + rand() * 0.9, max: 1.8, tw: rand() * 6.28,
          css: `hsl(${h | 0} 95% 66%)`,
        });
      }
      stage.audio.whoosh();
      stage.audio.note(big ? 220 : 330 + rand() * 120, 0.12);
    }

    stage.onPointer({
      down(p) { idle = 0; burst(p.x, p.y, p.pointerType === "touch" ? true : false); },
    });

    stage.onFrame((dt, t) => {
      if (stopped) return;
      const { ctx, width: W, height: H } = stage;
      idle += dt;

      // idle: a small lazy flower rises and opens somewhere on its own
      auto -= dt;
      if (idle > 5 && auto <= 0) {
        auto = 2.5 + rand() * 2;
        const x = W * (0.2 + rand() * 0.6), y = H * (0.25 + rand() * 0.3);
        for (let i = 0; i < 10 && sparks.length < MAX; i++)
          sparks.push({ x: x + (rand() - 0.5) * 8, y: H + 10, vx: 0, vy: -(H - y) / 0.9, life: 0.9, max: 1, hue: 42, tw: 0, seed: { x, y, y0: H, big: false, went: false } });
      }

      ctx.fillStyle = "rgba(6, 8, 20, 0.34)"; // sky keeps a soft trail
      ctx.fillRect(0, 0, W, H);

      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        if (s.seed) { // the rising quiet rocket; a visible head, then burst where it stops
          s.y += s.vy * dt;
          ctx.globalAlpha = 0.9;
          ctx.fillStyle = s.css || "hsl(45 95% 70%)";
          ctx.beginPath(); ctx.arc(s.x, s.y, 2.4, 0, 7); ctx.fill();
          if (s.y <= s.seed.y) { sparks.splice(i, 1); burst(s.seed.x, s.seed.y, false); }
          continue;
        }
        s.vy += 130 * dt;
        s.vx *= 1 - 0.6 * dt; s.vy *= 1 - 0.5 * dt;
        s.x += s.vx * dt; s.y += s.vy * dt;
        s.life -= dt;
        if (s.life <= 0) { sparks.splice(i, 1); continue; }
        const twinkle = 0.75 + 0.25 * Math.sin(s.tw + t * 14); // slow shimmer, never strobing
        const k = s.life / s.max;
        ctx.globalAlpha = Math.min(1, k * 2) * twinkle;
        ctx.fillStyle = s.css; // colour built once at spawn, never re-parsed here
        const r = 2.2 + k * 3.6;
        ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
    });

    return { stop() { stopped = true; } };
  },
};
