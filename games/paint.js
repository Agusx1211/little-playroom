// paint - thick ribbons of colour under every finger, fading after a few seconds.
export default {
  id: "paint",
  colors: ["#ff5a7a", "#4fd0a0"],

  icon(ctx, size, t) {
    ctx.lineCap = "round";
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = i === 1 ? this.colors[1] : this.colors[0];
      ctx.globalAlpha = 0.85 - i * 0.2;
      ctx.lineWidth = size * (0.16 - i * 0.03);
      ctx.beginPath();
      ctx.moveTo(size * 0.18, size * (0.75 - i * 0.06));
      ctx.quadraticCurveTo(size * 0.5, size * (0.2 + Math.sin(t + i) * 0.05), size * 0.82, size * (0.6 - i * 0.05));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  },

  start(stage) {
    const rand = stage.rand;
    let stopped = false;
    let idle = 0;
    const strokes = []; // one dab per move sample {x, y, r, hue, life}
    const trails = new Map(); // pointerId -> last point {x, y}

    const TAU = Math.PI * 2;
    let lastT = 0;

    stage.onPointer({
      down(p) { idle = 0; trails.set(p.id, { x: p.x, y: p.y }); dab(p.x, p.y, 0); stage.audio.note(180 + p.y * 0.6, 0.05); },
      move(p) {
        idle = 0;
        const prev = trails.get(p.id) || { x: p.x, y: p.y };
        const dx = p.x - prev.x, dy = p.y - prev.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 1) return;
        const steps = Math.min(6, Math.max(1, (dist / 9) | 0));
        for (let i = 1; i <= steps; i++)
          dab(prev.x + (dx * i) / steps, prev.y + (dy * i) / steps, dist * 12);
        trails.set(p.id, { x: p.x, y: p.y });
      },
      up(p) { trails.delete(p.id); },
    });

    function dab(x, y, speed) {
      strokes.push({
        x, y,
        r: Math.max(13, 34 - speed * 0.07) * (0.85 + rand() * 0.3), // fat enough for a far-away eye
        hue: (lastT * 26 + speed * 0.4 + x * 0.15) % 360,
        life: 1,
      });
      while (strokes.length > 260) strokes.shift();
    }

    stage.onFrame((dt, t) => {
      if (stopped) return;
      lastT = t;
      idle += dt;
      // idle: a slow ghost finger paints lazy loops on its own
      if (idle > 5) {
        const k = t * 0.6;
        dab(stage.width / 2 + Math.sin(k) * stage.width * 0.3,
            stage.height / 2 + Math.sin(k * 1.7) * stage.height * 0.26, 40);
      }
      for (let i = strokes.length - 1; i >= 0; i--) {
        strokes[i].life -= dt / 4; // ribbons linger four seconds
        if (strokes[i].life <= 0) strokes.splice(i, 1);
      }

      const { ctx, width: W, height: H } = stage;
      ctx.fillStyle = "#120d1a";
      ctx.fillRect(0, 0, W, H);
      ctx.lineCap = "round";
      for (const s of strokes) {
        ctx.globalAlpha = Math.min(1, s.life * 1.4) * 0.9;
        ctx.fillStyle = `hsl(${s.hue} 85% 62%)`;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
        ctx.globalAlpha = Math.min(1, s.life * 1.4) * 0.5;
        ctx.fillStyle = `hsl(${s.hue} 90% 78%)`;
        ctx.beginPath(); ctx.arc(s.x - s.r * 0.2, s.y - s.r * 0.2, s.r * 0.45, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    });

    return { stop() { stopped = true; } };
  },
};
