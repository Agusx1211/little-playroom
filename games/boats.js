const WATER = '#13596d';
const DEEP = '#123654';
const SAILS = ['#ffb68a', '#fae0a4', '#83e7d3', '#d5b1ff', '#f6a8c9'];
const TURN = Math.PI * 2;

function polygon(ctx, color, points) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.closePath();
  ctx.fill();
}

function drawBoat(ctx, x, y, size, angle, sail) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(size, size);
  polygon(ctx, '#ffce72', [[-0.55, 0], [0.56, 0], [0.35, 0.23], [-0.39, 0.23]]);
  polygon(ctx, '#e78570', [[-0.49, 0.075], [0.49, 0.075], [0.35, 0.23], [-0.39, 0.23]]);
  ctx.fillStyle = '#fff3cf';
  ctx.fillRect(-0.029, -0.8, 0.058, 0.81);
  polygon(ctx, sail, [[-0.052, -0.76], [-0.052, -0.073], [-0.48, -0.073]]);
  polygon(ctx, '#fff4d7', [[0.057, -0.56], [0.43, -0.073], [0.057, -0.073]]);
  polygon(ctx, '#ff8776', [[0, -0.8], [0.28, -0.73], [0, -0.66]]);
  ctx.restore();
}

function swell(ctx, width, y, amplitude, drift) {
  ctx.beginPath();
  for (let i = 0; i <= 32; i++) {
    const x = i / 32;
    const point = y + Math.sin(TURN * (x * 1.85 + drift)) * amplitude;
    if (i === 0) ctx.moveTo(0, point);
    else ctx.lineTo(x * width, point);
  }
}

export default {
  id: 'boats',
  colors: ['#83e7d3', '#ffb68a'],
  icon(ctx, size, t) {
    ctx.fillStyle = DEEP;
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = '#45a4ac';
    ctx.lineWidth = size * 0.025;
    for (const y of [0.69, 0.82, 0.93]) {
      swell(ctx, size, size * y, size * 0.027, t * 0.2 + y);
      ctx.stroke();
    }
    drawBoat(ctx, size * 0.51, size * (0.62 + 0.023 * Math.sin(t * 2.6)), size * 0.59, Math.sin(t * 2.6) * 0.1, SAILS[0]);
  },
  start(stage) {
    const { ctx, audio } = stage;
    const boats = [];
    const splashes = [];
    let hue = 0;
    let cooldown = 0;

    function launch(x, y, size, speed) {
      if (boats.length === 14) boats.shift();
      boats.push({ x, y, size, speed, sail: SAILS[hue++ % SAILS.length], phase: stage.rand() * TURN });
    }
    launch(0.20, 0.42, 0.14, 0.045);
    launch(0.61, 0.65, 0.22, 0.036);
    launch(0.86, 0.30, 0.105, 0.059);

    const offPointer = stage.onPointer({
      down({ x, y }) {
        const size = 0.135 + stage.rand() * 0.065;
        const margin = Math.min(stage.width, stage.height) * size * 0.6 / stage.width;
        const u = Math.max(margin, Math.min(1 - margin, x / stage.width));
        const v = Math.max(0.18, Math.min(0.94, y / stage.height));
        launch(u, v, size, 0.03 + stage.rand() * 0.022);
        if (splashes.length === 24) splashes.shift();
        splashes.push({ x: x / stage.width, y: y / stage.height, age: 0 });
        if (cooldown <= 0) {
          audio.note(420 + 190 * u, 0.21);
          cooldown = 0.14;
        }
      },
    });
    const offFrame = stage.onFrame((dt, t) => {
      const { width: w, height: h } = stage;
      const shortest = Math.min(w, h);
      cooldown -= dt;
      const water = ctx.createLinearGradient(0, 0, 0, h);
      water.addColorStop(0, WATER);
      water.addColorStop(1, DEEP);
      ctx.fillStyle = water;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#398997';
      ctx.lineWidth = Math.max(1, shortest * 0.0045);
      for (let i = 1; i <= 8; i++) {
        swell(ctx, w, h * i / 9, shortest * (0.008 + i * 0.0015), t * 0.16 + 0.32 * i);
        ctx.stroke();
      }

      for (const boat of boats) {
        const size = shortest * boat.size;
        boat.x += dt * boat.speed;
        if (boat.x > 1 + size / w) boat.x = -size / w;
        const tilt = Math.sin(t * 2.2 + boat.phase);
        const x = boat.x * w;
        const y = boat.y * h + tilt * size * 0.11;
        ctx.strokeStyle = '#9ddbd1';
        ctx.lineWidth = Math.max(1, size * 0.025);
        ctx.beginPath();
        ctx.ellipse(x - size * 0.22, y + size * 0.22, size * 0.66, size * 0.13, 0, 0.14, Math.PI - 0.22);
        ctx.stroke();
        drawBoat(ctx, x, y, size, tilt * 0.1, boat.sail);
      }
      for (const splash of splashes) {
        const r = shortest * (0.035 + splash.age * 0.14);
        ctx.globalAlpha = Math.max(0, 1 - splash.age / 0.85);
        ctx.strokeStyle = '#d2fff0';
        ctx.lineWidth = Math.max(2, shortest * 0.01);
        ctx.beginPath();
        ctx.ellipse(splash.x * w, splash.y * h, r, r * 0.62, 0, 0, TURN);
        ctx.stroke();
        splash.age += dt;
      }
      ctx.globalAlpha = 1;
      while (splashes.length && splashes[0].age >= 0.85) splashes.shift();
    });
    return { stop() { offFrame(); offPointer(); boats.length = 0; splashes.length = 0; } };
  },
};
