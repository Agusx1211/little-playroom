const SKY = '#1d294b';
const GOLD = '#ffcf68';
const STEAM = ['#ffe8bd', '#ffb5a4', '#a8efe3', '#e3c5ff'];
const TURN = Math.PI * 2;

function box(ctx, x, y, w, h, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

function circle(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TURN);
  ctx.fill();
}

function drawTrain(ctx, x, y, size, wheelAngle, bounce) {
  ctx.save();
  ctx.translate(x, y + bounce * size);
  ctx.scale(size, size);
  box(ctx, -0.94, -0.23, 1.39, 0.12, 0.04, '#f6b36f');
  box(ctx, -0.99, -0.51, 0.43, 0.35, 0.07, '#be9eff');
  box(ctx, -0.49, -0.51, 0.43, 0.35, 0.07, '#79d9c2');
  for (const car of [-0.99, -0.49]) {
    box(ctx, car + 0.06, -0.43, 0.13, 0.134, 0.034, '#293758');
    box(ctx, car + 0.24, -0.43, 0.13, 0.134, 0.034, '#293758');
    box(ctx, car + 0.05, -0.21, 0.33, 0.068, 0.03, '#fff0c9');
  }
  box(ctx, -0.02, -0.64, 0.25, 0.49, 0.046, '#ff887b');
  box(ctx, -0.055, -0.67, 0.31, 0.095, 0.046, '#ffb6a3');
  box(ctx, 0.038, -0.538, 0.123, 0.145, 0.035, '#293758');
  box(ctx, 0.174, -0.403, 0.32, 0.259, 0.092, '#ff9b5e');
  box(ctx, 0.337, -0.577, 0.088, 0.209, 0.033, GOLD);
  box(ctx, 0.315, -0.591, 0.133, 0.05, 0.025, GOLD);
  circle(ctx, 0.464, -0.286, 0.062, '#fff4bc');
  for (const wx of [-0.9, -0.65, -0.4, -0.15, 0.105, 0.372]) {
    circle(ctx, wx, -0.106, 0.095, '#151c38');
    circle(ctx, wx, -0.106, 0.067, '#e9abc2');
    circle(ctx, wx + Math.cos(wheelAngle) * 0.035, -0.106 + Math.sin(wheelAngle) * 0.035, 0.02, '#fff0cb');
  }
  ctx.restore();
}

function hills(ctx, w, h, travel, color, ridge, amplitude, speed) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let i = 0; i <= 32; i++) {
    const x = i / 32;
    const wave = Math.sin(TURN * (x * 1.4 + travel * speed)) * amplitude;
    ctx.lineTo(x * w, h * (ridge + wave));
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
}

function drawPuff(ctx, x, y, r, alpha, color) {
  ctx.globalAlpha = alpha;
  circle(ctx, x - r * 0.51, y + r * 0.15, r * 0.58, color);
  circle(ctx, x + r * 0.51, y + r * 0.15, r * 0.56, color);
  circle(ctx, x, y - r * 0.17, r * 0.75, color);
  ctx.globalAlpha = 1;
}

export default {
  id: 'train',
  colors: [GOLD, '#be9eff'],
  icon(ctx, size, t) {
    ctx.fillStyle = SKY;
    ctx.fillRect(0, 0, size, size);
    box(ctx, size * 0.12, size * 0.72, size * 0.76, size * 0.04, size * 0.02, '#a6829d');
    drawTrain(ctx, size * 0.63, size * 0.72, size * 0.5, t * 4, 0.012 * Math.sin(t * 5));
    drawPuff(ctx, size * (0.78 - 0.04 * Math.sin(t * 2)), size * 0.32, size * 0.072, 0.8, STEAM[0]);
  },
  start(stage) {
    const { ctx, audio } = stage;
    let steam = [];
    let travel = 0;
    let boost = 0;
    let cooldown = 0;
    let chimneyTime = 0;
    let nextColor = 0;
    const addPuff = (x, y, fromChimney, color) => {
      if (steam.length === 24) steam.shift();
      steam.push({ x, y, fromChimney, color, life: fromChimney ? 1.4 : 0.85, age: 0 });
    };
    const offPointer = stage.onPointer({
      down({ x, y }) {
        const u = Math.max(0.035, Math.min(0.965, x / stage.width));
        const v = Math.max(0.035, Math.min(0.965, y / stage.height));
        addPuff(u, v, false, STEAM[nextColor++ % STEAM.length]);
        boost = 1;
        if (cooldown <= 0) {
          audio.note(349, 0.29);
          cooldown = 0.17;
        }
      },
    });
    const offFrame = stage.onFrame(dt => {
      const { width: w, height: h } = stage;
      const shortest = Math.min(w, h);
      const size = Math.min(w * 0.34, h * 0.38);
      const cx = w * 0.59;
      const rail = h * 0.72;
      const bounce = Math.sin(travel * 17) * 0.013;
      cooldown -= dt;
      boost = Math.max(0, boost - dt * 0.52);
      travel += dt * (0.17 + 0.36 * boost);
      chimneyTime -= dt;
      if (chimneyTime <= 0) {
        addPuff((cx + size * 0.38) / w, (rail + size * (bounce - 0.61)) / h, true, STEAM[0]);
        chimneyTime = 0.65 - boost * 0.32;
      }

      ctx.fillStyle = SKY;
      ctx.fillRect(0, 0, w, h);
      circle(ctx, w * 0.76, h * 0.226, shortest * 0.077, '#f6bd8c');
      hills(ctx, w, h, travel, '#42436c', 0.49, 0.10, 0.07);
      hills(ctx, w, h, travel, '#3c6871', 0.585, 0.062, 0.14);
      hills(ctx, w, h, travel, '#29514e', 0.73, 0.04, 0.4);
      const tie = Math.max(shortest * 0.065, w / 64);
      for (let x = -(travel * w % tie); x < w; x += tie) {
        box(ctx, x, rail + size * 0.017, tie * 0.53, size * 0.098, size * 0.02, '#73576d');
      }
      ctx.fillStyle = '#eab49f';
      ctx.fillRect(0, rail, w, Math.max(2, size * 0.023));
      drawTrain(ctx, cx, rail, size, travel * 22, bounce);
      for (const puff of steam) {
        const { age, life, fromChimney } = puff;
        const rise = fromChimney ? 0.12 : 0.036;
        const drift = fromChimney ? 0.13 : 0;
        const r = shortest * ((fromChimney ? 0.018 : 0.038) + 0.024 * age);
        drawPuff(ctx, (puff.x - age * drift) * w, (puff.y - age * rise) * h,
          r, (1 - age / life) * 0.9, puff.color);
        puff.age += dt;
      }
      steam = steam.filter(puff => puff.age < puff.life);
    });
    return { stop() { offFrame(); offPointer(); steam.length = 0; } };
  },
};
