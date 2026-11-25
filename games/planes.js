const SKY = '#1b526f';
const TURN = Math.PI * 2;
const COLORS = ['#ffe8a6', '#ffb4be', '#b8f4e0', '#deb7ff'];

function polygon(ctx, color, points) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.closePath();
  ctx.fill();
}

function cloud(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.45, 0, 0, TURN);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x - r * 0.16, y - r * 0.3, r * 0.47, r * 0.42, 0, 0, TURN);
  ctx.fill();
}

function plane(ctx, x, y, size, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(size, size);
  polygon(ctx, '#ffd386', [[0.65, 0], [-0.59, -0.42], [-0.36, -0.035], [-0.58, 0.36]]);
  polygon(ctx, '#fff3c7', [[0.65, 0], [-0.59, -0.42], [-0.17, -0.103]]);
  polygon(ctx, '#fb8c79', [[0.65, 0], [-0.17, -0.103], [-0.39, 0.18]]);
  ctx.restore();
}

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export default {
  id: 'planes',
  colors: ['#ffd386', '#92e4f4'],
  icon(ctx, size, t) {
    ctx.fillStyle = SKY;
    ctx.fillRect(0, 0, size, size);
    cloud(ctx, size * (0.21 + 0.06 * Math.sin(t * 1.7)), size * 0.71, size * 0.14, '#93cadd');
    cloud(ctx, size * 0.82, size * 0.27, size * 0.13, '#5da5bb');
    plane(ctx, size * 0.49, size * (0.48 + 0.065 * Math.sin(t * 2)), size * 0.64, -0.41 + Math.sin(t * 2) * 0.2);
  },
  start(stage) {
    const { ctx, audio } = stage;
    const puffs = [];
    const ribbon = [];
    const fingers = new Map();
    const clouds = Array.from({ length: 8 }, (_, i) => ({
      x: (i * 0.37) % 1, y: 0.09 + (i * 0.23) % 0.81, size: 0.032 + stage.rand() * 0.059,
    }));
    let x = 0.47;
    let y = 0.46;
    let angle = -0.25;
    let flyX = x;
    let flyY = y;
    let steering = 0;
    let noteTime = 0;
    let sampleTime = 0;
    let hue = 0;

    function steer(pointer) {
      flyX = clamp(pointer.x / stage.width, 0.12, 0.88);
      flyY = clamp(pointer.y / stage.height, 0.12, 0.88);
      steering = 1;
    }

    const offPointer = stage.onPointer({
      down(pointer) {
        fingers.set(pointer.id, pointer);
        steer(pointer);
        if (puffs.length === 24) puffs.shift();
        puffs.push({ x: pointer.x / stage.width, y: pointer.y / stage.height, color: COLORS[hue++ % COLORS.length], age: 0 });
        if (noteTime <= 0) {
          audio.whoosh();
          noteTime = 0.18;
        }
      },
      move(pointer) {
        if (!fingers.has(pointer.id)) return;
        fingers.set(pointer.id, pointer);
        steer(pointer);
      },
      up({ id }) {
        fingers.delete(id);
        const remaining = [...fingers.values()].at(-1);
        if (remaining) steer(remaining);
      },
    });

    const offFrame = stage.onFrame((dt, t) => {
      const { width: w, height: h } = stage;
      const short = Math.min(w, h);
      noteTime -= dt;
      if (fingers.size === 0) steering = Math.max(0, steering - dt * 0.65);
      const orbitX = 0.5 + 0.29 * Math.cos(t * 0.8);
      const orbitY = 0.51 + 0.19 * Math.sin(t * 1.6);
      const dx = flyX * steering + orbitX * (1 - steering) - x;
      const dy = flyY * steering + orbitY * (1 - steering) - y;
      if (Math.hypot(dx * w, dy * h) > short * 0.022) {
        const turn = Math.atan2(dy * h, dx * w) - angle;
        angle += Math.atan2(Math.sin(turn), Math.cos(turn)) * Math.min(1, dt * 8);
      }
      const ease = 1 - Math.exp(-dt * 3.1);
      x += dx * ease;
      y += dy * ease;
      sampleTime -= dt;
      if (sampleTime <= 0) {
        if (ribbon.length === 25) ribbon.shift();
        ribbon.push({ x, y, age: 0 });
        sampleTime = 0.068;
      }

      ctx.fillStyle = SKY;
      ctx.fillRect(0, 0, w, h);
      for (const [i, c] of clouds.entries()) {
        const xx = ((c.x + t * (0.019 + i * 0.001)) % 1.34) - 0.17;
        cloud(ctx, xx * w, c.y * h, c.size * short, i % 2 ? '#307996' : '#4486a0');
      }
      for (const dot of ribbon) {
        ctx.globalAlpha = Math.max(0, 1 - dot.age / 1.35) * 0.62;
        cloud(ctx, dot.x * w, dot.y * h, short * (0.013 + 0.026 * dot.age), '#8bdbed');
        dot.age += dt;
      }
      ctx.globalAlpha = 1;
      plane(ctx, x * w, y * h, short * 0.25, angle);
      for (const puff of puffs) {
        ctx.globalAlpha = Math.max(0, 1 - puff.age / 0.72);
        cloud(ctx, puff.x * w, puff.y * h - puff.age * short * 0.063, short * (0.052 + puff.age * 0.073), puff.color);
        puff.age += dt;
      }
      ctx.globalAlpha = 1;
      while (ribbon.length && ribbon[0].age >= 1.35) ribbon.shift();
      while (puffs.length && puffs[0].age >= 0.72) puffs.shift();
    });
    return { stop() { offFrame(); offPointer(); fingers.clear(); ribbon.length = 0; puffs.length = 0; } };
  },
};
