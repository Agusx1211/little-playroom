// bubbles - rising wobbling bubbles; every touch pops all the ones it covers.
export default {
  id: "bubbles",
  colors: ["#4fd0e0", "#7a4fd0"],

  icon(ctx, size, t) {
    for (let i = 0; i < 4; i++) {
      const x = size * (0.26 + (i % 2) * 0.46);
      const y = size * (0.72 - i * 0.16 + Math.sin(t + i * 1.3) * 0.03);
      drawBubble(ctx, { x, y, r: size * (0.11 + i * 0.02) });
    }
  },

  start(stage) {
    const rand = stage.rand;
    let stopped = false;
    let spawnTimer = 0;
    let idle = 0;
    const bubbles = [];
    const drops = [];

    const spawn = (x, y, r) => {
      while (bubbles.length >= 26) bubbles.shift(); // the guaranteed touch answer never breeds soup
      const b = {
        x: x ?? rand() * stage.width, y: y ?? stage.height + r + 8, r,
        wob: rand() * 6.28, ws: 0.6 + rand() * 1.2,
        vy: -(24 + rand() * 34 + r * 2.2),
      };
      b.grad = bubbleGrad(stage.ctx, r); // built once, drawn translated (nicolas [4915] #2)
      bubbles.push(b);
    };

    const pop = (b, i) => {
      bubbles.splice(i, 1);
      const n = Math.max(4, Math.min(9, (b.r / 5) | 0));
      for (let k = 0; k < n && drops.length < 260; k++) {
        const a = (k / n) * 6.28 + rand() * 0.6;
        const sp = 60 + rand() * 90 + b.r;
        drops.push({ x: b.x, y: b.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, life: 1 });
      }
      stage.audio.note(320 + 5200 / b.r, 0.07); // bigger bubble, lower pop
    };

    for (let i = 0; i < 9; i++) spawn(undefined, rand() * stage.height, 14 + rand() * 20);

    stage.onPointer({
      down(p) {
        idle = 0;
        let popped = false;
        for (let i = bubbles.length - 1; i >= 0; i--) {
          const b = bubbles[i];
          const dx = p.x - b.x, dy = p.y - b.y;
          const hit = Math.max(b.r + 16, 40); // small bubbles stay hittable for a clumsy thumb
          if (dx * dx + dy * dy < hit * hit) { pop(b, i); popped = true; }
        }
        if (!popped) spawn(p.x, p.y + 46, 16 + rand() * 8); // touch always answers
      },
    });

    stage.onFrame((dt, t) => {
      if (stopped) return;
      const W = stage.width, H = stage.height;
      idle += dt;

      spawnTimer += dt;
      if (spawnTimer > (idle > 5 ? 0.4 : 0.8) && bubbles.length < 26) {
        spawnTimer = 0; spawn(undefined, undefined, 12 + rand() * 24);
      }
      for (const b of bubbles) {
        b.y += b.vy * dt;
        b.wob += b.ws * dt;
        b.x += Math.sin(b.wob) * 20 * dt;
        if (b.y < -b.r - 10) { b.y = H + b.r + 8; b.x = rand() * W; }
      }
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        d.vy += 330 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.life -= dt * 1.5;
        if (d.life <= 0) drops.splice(i, 1);
      }

      ctxFill(stage, "#0a0e1c");
      for (const b of bubbles) drawBubble(stage.ctx, b);
      const ctx = stage.ctx;
      ctx.fillStyle = "#bfeaff";
      for (const d of drops) {
        ctx.globalAlpha = Math.max(0, d.life) * 0.9;
        ctx.beginPath(); ctx.arc(d.x, d.y, 2.3, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
    });

    return { stop() { stopped = true; } };
  },
};

function ctxFill(stage, color) { stage.ctx.fillStyle = color; stage.ctx.fillRect(0, 0, stage.width, stage.height); }

function bubbleGrad(ctx, r) {
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.15, 0, 0, r);
  g.addColorStop(0, "rgba(255,255,255,0.32)");
  g.addColorStop(0.7, "rgba(120,200,235,0.10)");
  g.addColorStop(1, "rgba(150,170,255,0.28)");
  return g;
}

// One bubble, drawn in local coords so a cached gradient can be reused every frame.
function drawBubble(ctx, b) {
  const r = b.r;
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.fillStyle = b.grad || bubbleGrad(ctx, r);
  ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
  ctx.strokeStyle = "rgba(190,235,255,0.7)";
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath(); ctx.arc(-r * 0.4, -r * 0.45, Math.max(1.5, r * 0.16), 0, 7); ctx.fill();
  ctx.restore();
}
