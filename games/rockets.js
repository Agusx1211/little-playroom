const NIGHT = '#181938';
const TURN = Math.PI * 2;
const PALETTES = [
  ['#ffd28f', '#ff8779', '#f59bb0'],
  ['#9ce9e0', '#52c5ba', '#b3edfb'],
  ['#e5c2ff', '#af8ef7', '#ffc9e0'],
  ['#ffcecf', '#ed83b0', '#fff0ad'],
];
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

function oval(ctx, x, y, rx, ry, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TURN);
  ctx.fill();
}

function rocket(ctx, x, y, size, tilt, palette, flame) {
  const [hull, trim] = palette;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  ctx.scale(size, size);
  oval(ctx, 0, 0.40 + flame * 0.10, 0.115, 0.21 + flame * 0.12, '#ffae77');
  oval(ctx, 0, 0.34 + flame * 0.08, 0.061, 0.16 + flame * 0.1, '#ffe99e');
  ctx.fillStyle = trim;
  ctx.beginPath();
  ctx.moveTo(-0.14, 0.02);
  ctx.quadraticCurveTo(-0.34, 0.15, -0.33, 0.40);
  ctx.lineTo(-0.13, 0.28);
  ctx.lineTo(0.13, 0.28);
  ctx.lineTo(0.33, 0.40);
  ctx.quadraticCurveTo(0.34, 0.15, 0.14, 0.02);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = hull;
  ctx.beginPath();
  ctx.moveTo(0, -0.61);
  ctx.bezierCurveTo(0.32, -0.41, 0.25, 0.07, 0.13, 0.28);
  ctx.quadraticCurveTo(0, 0.34, -0.13, 0.28);
  ctx.bezierCurveTo(-0.25, 0.07, -0.32, -0.41, 0, -0.61);
  ctx.fill();
  oval(ctx, 0, -0.23, 0.126, 0.132, '#f9e9d2');
  oval(ctx, 0, -0.23, 0.095, 0.10, '#374e7f');
  oval(ctx, -0.027, -0.265, 0.031, 0.022, '#9cdbeb');
  ctx.restore();
}

function planet(ctx, x, y, size, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  oval(ctx, 0, 0, size, size, '#b99fcf');
  oval(ctx, size * 0.18, -size * 0.34, size * 0.58, size * 0.15, '#d5b5d4');
  ctx.strokeStyle = '#ead3ac';
  ctx.lineWidth = size * 0.15;
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 1.68, size * 0.38, 0, -0.13, Math.PI + 0.13);
  ctx.stroke();
  ctx.restore();
}

export default {
  id: 'rockets',
  colors: ['#e5c2ff', '#ffad83'],
  icon(ctx, size, t) {
    ctx.fillStyle = NIGHT;
    ctx.fillRect(0, 0, size, size);
    planet(ctx, size * 0.70, size * 0.27, size * 0.13, -0.4);
    for (const [x, y] of [[0.18, 0.22], [0.22, 0.75], [0.79, 0.74]]) {
      oval(ctx, size * x, size * y, size * 0.025, size * 0.025, '#f4d3ad');
    }
    rocket(ctx, size * 0.44, size * (0.56 + 0.08 * Math.sin(t * 2)), size * 0.58, 0.36, PALETTES[1], 0.5 + Math.sin(t * 3) * 0.22);
  },
  start(stage) {
    const { ctx, audio } = stage;
    const flights = [];
    const pads = [];
    const stars = Array.from({ length: 41 }, () => ({
      x: stage.rand(), y: stage.rand(), r: 0.002 + stage.rand() * 0.0038,
    }));
    let nextColor = 0;
    let cooldown = 0;
    let idleLaunch = 2.2;

    function launch(x, y) {
      if (flights.length === 14) flights.shift();
      const flight = {
        x: clamp(x, 0.06, 0.94), y: clamp(y, 0.24, 0.87), age: 0,
        drift: (0.5 - x) * 0.26,
        palette: PALETTES[nextColor++ % PALETTES.length],
      };
      flights.push(flight);
      return flight;
    }
    launch(0.48, 0.82);
    const offPointer = stage.onPointer({
      down({ x, y }) {
        const u = x / stage.width;
        const v = y / stage.height;
        const flight = launch(u, v);
        if (pads.length === 20) pads.shift();
        pads.push({
          x: clamp(u, 0.035, 0.965), y: clamp(v, 0.035, 0.965),
          color: flight.palette[2], age: 0,
        });
        idleLaunch = 5;
        if (cooldown <= 0) {
          audio.whoosh();
          cooldown = 0.18;
        }
      },
    });

    const offFrame = stage.onFrame((dt, t) => {
      const { width: w, height: h } = stage;
      const short = Math.min(w, h);
      cooldown -= dt;
      idleLaunch -= dt;
      if (idleLaunch <= 0) {
        launch(0.24 + stage.rand() * 0.52, 0.78);
        idleLaunch = 4;
      }

      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#14162f');
      sky.addColorStop(1, '#31294d');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);
      for (const s of stars) oval(ctx, s.x * w, s.y * h, short * s.r, short * s.r, '#9c9bc1');
      planet(ctx, w * 0.74, h * 0.27, short * 0.108, -0.37 + 0.08 * Math.sin(t * 0.6));
      oval(ctx, w * (0.16 + Math.sin(t * 0.51) * 0.05), h * 0.16, short * 0.033, short * 0.033, '#eac4b4');

      for (const f of flights) {
        const progress = f.age / 2.5;
        const climb = progress * (0.4 + 0.6 * progress);
        const px = w * (f.x + f.drift * progress);
        const py = h * (f.y - (f.y + 0.19) * climb);
        const size = short * (0.145 + 0.018 * Math.sin(Math.PI * progress));
        ctx.globalAlpha = Math.min(1, (1 - progress) * 5);
        for (let i = 1; i <= 5; i++) {
          const trail = i * (0.16 + progress * 0.14);
          oval(ctx, px - f.drift * short * trail, py + size * (0.5 + trail),
            size * (0.09 + trail * 0.03), size * (0.068 + trail * 0.023), i % 2 ? '#aa9cc5' : f.palette[2]);
        }
        rocket(ctx, px, py, size, f.drift * 0.8, f.palette, 0.53 + 0.2 * Math.sin(t * 4 + f.x * 6));
        f.age += dt;
      }
      for (const pad of pads) {
        ctx.globalAlpha = 1 - pad.age / 0.78;
        const r = short * (0.036 + pad.age * 0.09);
        for (let i = 0; i < 6; i++) {
          const a = i * TURN / 6;
          oval(ctx, pad.x * w + r * Math.cos(a), pad.y * h + r * Math.sin(a), short * 0.015, short * 0.015, pad.color);
        }
        pad.age += dt;
      }
      ctx.globalAlpha = 1;
      while (flights.length && flights[0].age >= 2.5) flights.shift();
      while (pads.length && pads[0].age >= 0.78) pads.shift();
    });
    return { stop() { offFrame(); offPointer(); flights.length = 0; pads.length = 0; } };
  },
};
