const SKY = '#263c55';
const TURN = Math.PI * 2;
const BLOOMS = ['#ffcb66', '#ff99ac', '#efb3f9', '#c8f489', '#ff9d72'];
const ROWS = [0.54, 0.64, 0.76, 0.90];
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

function circle(ctx, x, y, r, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TURN);
  ctx.fill();
}

function box(ctx, x, y, w, h, radius, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();
}

function tractor(ctx, x, y, size, direction, spin) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size * direction, size);
  box(ctx, -0.19, -0.58, 0.34, 0.43, 0.048, '#9ad881');
  box(ctx, -0.146, -0.535, 0.236, 0.188, 0.043, '#263d50');
  box(ctx, -0.23, -0.64, 0.43, 0.073, 0.037, '#c2ed91');
  box(ctx, -0.23, -0.33, 0.77, 0.236, 0.09, '#7fc765');
  box(ctx, 0.317, -0.44, 0.064, 0.14, 0.024, '#edb265');
  circle(ctx, 0.48, -0.249, 0.049, '#fff1b5');
  for (const [cx, r] of [[-0.21, 0.182], [0.38, 0.133]]) {
    circle(ctx, cx, -r, r, '#16283e');
    circle(ctx, cx, -r, r * 0.71, '#43886e');
    for (let i = 0; i < 4; i++) {
      const angle = spin + i * TURN / 4;
      circle(ctx, cx + Math.cos(angle) * r * 0.41, -r + Math.sin(angle) * r * 0.41, r * 0.12, '#d1ec9d');
    }
  }
  ctx.restore();
}

function sprout(ctx, x, y, size, bend, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(bend);
  box(ctx, -size * 0.06, -size * 0.69, size * 0.12, size * 0.69, size * 0.06, '#81ca77');
  ctx.fillStyle = '#a4dd79';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * size * 0.16, -size * (0.3 + side * 0.074), size * 0.23, size * 0.107, side * -0.52, 0, TURN);
    ctx.fill();
  }
  circle(ctx, -size * 0.17, -size * 0.68, size * 0.19, color);
  circle(ctx, size * 0.17, -size * 0.68, size * 0.19, color);
  circle(ctx, 0, -size * 0.85, size * 0.19, color);
  circle(ctx, 0, -size * 0.7, size * 0.118, '#fff4b9');
  ctx.restore();
}

export default {
  id: 'tractors',
  colors: ['#a3df79', '#ffcb66'],
  icon(ctx, size, t) {
    ctx.fillStyle = SKY;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#426e54';
    ctx.fillRect(0, size * 0.59, size, size * 0.41);
    tractor(ctx, size * (0.52 + 0.095 * Math.sin(t * 2)), size * 0.71, size * 0.72, 1, t * 5);
    sprout(ctx, size * 0.22, size * 0.87, size * 0.18, Math.sin(t * 2) * 0.22, BLOOMS[1]);
  },
  start(stage) {
    const { ctx, audio } = stage;
    const petals = [];
    const field = Array.from({ length: 11 }, (_, i) => ({
      x: 0.09 + ((i * 0.31) % 0.82), y: ROWS[i % ROWS.length],
      color: BLOOMS[i % BLOOMS.length], age: 1, phase: stage.rand() * TURN,
    }));
    let lastX = 0.48;
    let lastY = ROWS[1];
    let x = lastX;
    let y = lastY;
    let steer = 0;
    let direction = 1;
    let spin = 0;
    let nextColor = 0;
    let cooldown = 0;

    const offPointer = stage.onPointer({
      down(p) {
        const u = clamp(p.x / stage.width, 0.048, 0.952);
        const v = clamp(p.y / stage.height, 0.035, 0.965);
        const row = ROWS.reduce((near, row) => Math.abs(row - v) < Math.abs(near - v) ? row : near);
        const color = BLOOMS[nextColor++ % BLOOMS.length];
        if (field.length === 40) field.shift();
        field.push({ x: u, y: row, color, age: 0, phase: stage.rand() * TURN });
        if (petals.length === 20) petals.shift();
        petals.push({ x: u, y: v, color, age: 0 });
        lastX = clamp(u, 0.17, 0.83);
        lastY = row;
        steer = 1;
        if (cooldown <= 0) {
          audio.note(280 + u * 200, 0.25);
          cooldown = 0.17;
        }
      },
    });

    const offFrame = stage.onFrame((dt, t) => {
      const { width: w, height: h } = stage;
      const short = Math.min(w, h);
      cooldown -= dt;
      steer = Math.max(0, steer - dt * 0.39);
      const travel = (lastX * steer + (0.50 + Math.sin(t * 0.65) * 0.32) * (1 - steer) - x) * (1 - Math.exp(-dt * 3));
      if (Math.abs(travel) > 0.0002) direction = Math.sign(travel);
      spin += Math.abs(travel) * w / (short * 0.036);
      x += travel;
      y += (lastY * steer + ROWS[1] * (1 - steer) - y) * (1 - Math.exp(-dt * 4));
      ctx.fillStyle = SKY;
      ctx.fillRect(0, 0, w, h);
      circle(ctx, w * 0.74, h * 0.21, short * 0.08, '#f5bd72');
      ctx.fillStyle = '#385e5d';
      ctx.beginPath();
      ctx.moveTo(0, h * 0.46);
      ctx.quadraticCurveTo(w * 0.29, h * 0.198, w * 0.65, h * 0.46);
      ctx.quadraticCurveTo(w * 0.84, h * 0.32, w, h * 0.41);
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fill();
      for (const [i, row] of ROWS.entries()) {
        ctx.fillStyle = i % 2 === 0 ? '#477c59' : '#426f53';
        ctx.fillRect(0, h * row, w, h * (0.046 + i * 0.009));
        ctx.fillStyle = '#569065';
        ctx.fillRect(0, h * row, w, Math.max(1, short * 0.005));
      }
      for (const f of field) {
        const size = short * (0.043 + f.y * 0.033) * Math.min(1, 0.56 + f.age * 1.35);
        sprout(ctx, f.x * w, f.y * h, size, Math.sin(t * 1.7 + f.phase) * 0.18, f.color);
        f.age = Math.min(1, f.age + dt);
      }
      tractor(ctx, x * w, y * h, short * 0.27, direction, spin);
      for (const p of petals) {
        ctx.globalAlpha = Math.max(0, 1 - p.age / 0.76);
        const radius = short * (0.027 + p.age * 0.055);
        for (let i = 0; i < 5; i++) {
          const a = i * TURN / 5;
          circle(ctx, p.x * w + Math.cos(a) * radius, p.y * h + Math.sin(a) * radius, short * 0.012, p.color);
        }
        p.age += dt;
      }
      ctx.globalAlpha = 1;
      while (petals.length && petals[0].age >= 0.76) petals.shift();
    });
    return { stop() { offFrame(); offPointer(); field.length = 0; petals.length = 0; } };
  },
};
