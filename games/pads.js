// pads — four huge colour pads fill the screen; every touch answers in the
// same frame with a flash and a pentatonic note. Nothing to win and nothing
// to lose: let go and a pad just dims back to waiting.

const NOTES = [261.63, 329.63, 392.0, 587.33]; // C4 E4 G4 D5
const INK = ['#ff5964', '#ffb703', '#2ec4b6', '#9b5de5'];

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export default {
  id: 'pads',
  colors: ['#ffafac', '#f6e9ae'],

  icon(ctx, size, t) {
    const gap = size * 0.09;
    const side = (size - gap) / 2;
    for (let i = 0; i < 4; i++) {
      const pulse = 0.08 * (0.5 + 0.5 * Math.sin(t * 1.5 + i * 1.7));
      const inset = side * pulse * 0.5;
      ctx.fillStyle = INK[i];
      rr(ctx, (i % 2) * (side + gap) + inset, (i >> 1) * (side + gap) + inset,
        side * (1 - pulse), side * (1 - pulse), side * 0.3);
      ctx.fill();
    }
  },

  start(stage) {
    const { ctx, audio } = stage;
    const flash = [0, 0, 0, 0]; // per-pad brightness, decays each frame
    const held = new Map();     // pointer key -> pad index
    const key = (p) => (p.id != null ? p.id : 0);
    let alive = true;
    let idle = 0; // seconds since the last touch

    const padOf = (p) => (p.y < stage.height / 2 ? 0 : 2) + (p.x < stage.width / 2 ? 0 : 1);

    stage.onPointer({
      down(p) {
        if (!alive) return;
        held.set(key(p), padOf(p));
        flash[padOf(p)] = 1;
        idle = 0;
        audio.note(NOTES[padOf(p)], 0.4);
      },
      move(p) {
        if (!alive) return;
        if (held.has(key(p))) held.set(key(p), padOf(p));
        idle = 0;
      },
      up(p) {
        if (!alive) return;
        held.delete(key(p));
      },
    });

    stage.onFrame((dt, t) => {
      if (!alive) return;
      dt = Math.min(dt, 0.05);
      idle += dt;
      for (let i = 0; i < 4; i++) flash[i] = Math.max(0, flash[i] - dt * 2.2);

      const { width, height } = stage;
      ctx.fillStyle = '#0d1426';
      ctx.fillRect(0, 0, width, height);

      const m = Math.min(width, height) * 0.05;
      const gap = m * 0.8;
      const w = (width - 2 * m - gap) / 2;
      const h = (height - 2 * m - gap) / 2;
      const r = Math.min(w, h) * 0.18;
      for (let i = 0; i < 4; i++) {
        const x = m + (i % 2) * (w + gap);
        const y = m + (i >> 1) * (h + gap);
        const f = flash[i];
        // idle breathing: a soft highlight so the screen never looks dead
        const breathe = idle > 5 ? 0.10 * (0.5 + 0.5 * Math.sin(t * 0.8 + i * 1.6)) : 0;
        const grow = f * Math.min(w, h) * 0.015;
        ctx.fillStyle = INK[i];
        rr(ctx, x - grow, y - grow, w + 2 * grow, h + 2 * grow, r);
        ctx.fill();
        const lift = f * 0.5 + breathe;
        if (lift > 0.01) {
          ctx.fillStyle = `rgba(255,255,255,${lift.toFixed(3)})`;
          rr(ctx, x - grow, y - grow, w + 2 * grow, h + 2 * grow, r);
          ctx.fill();
        }
      }
    });

    return {
      stop() {
        alive = false;
        held.clear();
      },
    };
  },
};
