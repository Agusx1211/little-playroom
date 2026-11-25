// xylophone: eight rainbow bars, each a note of a major pentatonic scale (no two clash). A touch,
// or a finger sliding across, plays the bar and makes it bounce; a ring of light spreads from it.

const COLORS = ['#ff595e', '#ff924c', '#ffca3a', '#8ac926', '#52b788', '#1982c4', '#4267ac', '#6a4c93'];
// C major pentatonic from C5 up: C D E G A C D E.
const NOTES = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51];
const MAX_RINGS = 40;

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function barRects(width, height) {
  const n = COLORS.length;
  const margin = width * 0.04;
  const gap = width * 0.015;
  const w = (width - margin * 2 - gap * (n - 1)) / n;
  return COLORS.map((color, i) => {
    // Longer bars for lower notes, like a real xylophone.
    const h = height * (0.78 - i * 0.045);
    return { x: margin + i * (w + gap), y: (height - h) / 2, w, h, color };
  });
}

function drawBar(ctx, r, lift, glow) {
  ctx.save();
  ctx.translate(0, -lift);
  if (glow > 0) {
    ctx.globalAlpha = 0.35 * glow;
    ctx.fillStyle = r.color;
    ctx.fillRect(r.x - r.w * 0.12, r.y - r.w * 0.12, r.w * 1.24, r.h + r.w * 0.24);
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = r.color;
  const rad = Math.min(r.w * 0.3, 18);
  ctx.beginPath();
  ctx.moveTo(r.x + rad, r.y);
  ctx.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + r.h, rad);
  ctx.arcTo(r.x + r.w, r.y + r.h, r.x, r.y + r.h, rad);
  ctx.arcTo(r.x, r.y + r.h, r.x, r.y, rad);
  ctx.arcTo(r.x, r.y, r.x + r.w, r.y, rad);
  ctx.closePath();
  ctx.fill();
  // Two pins, as on a real one.
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (const f of [0.12, 0.88]) {
    ctx.beginPath();
    ctx.arc(r.x + r.w / 2, r.y + r.h * f, Math.min(r.w * 0.12, 7), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export default {
  id: 'xylophone',
  colors: ['#ff595e', '#1982c4'],

  icon(ctx, size, t) {
    ctx.fillStyle = '#121433';
    ctx.fillRect(0, 0, size, size);
    const rects = barRects(size, size);
    rects.forEach((r, i) => drawBar(ctx, r, Math.max(0, Math.sin(t * 3 - i * 0.6)) * size * 0.03, 0));
  },

  start(stage) {
    const ctx = stage.ctx;
    const n = COLORS.length;
    const bounce = new Array(n).fill(0);   // 0..1, decays
    const rings = [];
    const fingerBar = new Map();           // pointer id -> bar it is on (to play only on entering a bar)
    let sinceTouch = 0;
    let idleBar = 0, idleClock = 0;
    let stopped = false;

    function barAt(x, y) {
      const rects = barRects(stage.width, stage.height);
      for (let i = 0; i < n; i++) {
        const r = rects[i];
        if (x >= r.x - 6 && x <= r.x + r.w + 6 && y >= r.y - 20 && y <= r.y + r.h + 20) return i;
      }
      return -1;
    }

    function strike(i, x, y, strength = 1) {
      bounce[i] = 1;
      stage.audio.note(NOTES[i], 0.6);
      if (rings.length < MAX_RINGS) rings.push({ x, y, r: 10, a: 0.8 * strength, color: COLORS[i] });
    }

    const offFrame = stage.onFrame((dt, t) => {
      if (stopped) return;
      sinceTouch += dt;
      for (let i = 0; i < n; i++) bounce[i] = Math.max(0, bounce[i] - dt * 3);
      for (let i = rings.length - 1; i >= 0; i--) {
        const g = rings[i];
        g.r += dt * Math.max(stage.width, stage.height) * 0.45;
        g.a -= dt * 0.9;
        if (g.a <= 0) rings.splice(i, 1);
      }
      // Idle: after 5 s a soft glow walks slowly along the bars (one bar every 0.8 s, silent).
      let glowBar = -1, glow = 0;
      if (sinceTouch > 5) {
        idleClock += dt;
        if (idleClock > 0.8) { idleClock = 0; idleBar = (idleBar + 1) % n; }
        glowBar = idleBar;
        glow = Math.sin(Math.PI * clamp(idleClock / 0.8, 0, 1));
      }

      ctx.fillStyle = '#0c0f2a';
      ctx.fillRect(0, 0, stage.width, stage.height);
      for (const g of rings) {
        ctx.globalAlpha = Math.max(0, g.a) * 0.5;
        ctx.strokeStyle = g.color;
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      const rects = barRects(stage.width, stage.height);
      for (let i = 0; i < n; i++) {
        const lift = Math.sin(bounce[i] * Math.PI) * stage.height * 0.03;
        drawBar(ctx, rects[i], lift, i === glowBar ? glow : bounce[i] * 0.8);
      }
    });

    const offPointer = stage.onPointer({
      down(p) {
        if (stopped) return;
        sinceTouch = 0;
        const i = barAt(p.x, p.y);
        fingerBar.set(p.id, i);
        if (i >= 0) strike(i, p.x, p.y);
        else if (rings.length < MAX_RINGS) rings.push({ x: p.x, y: p.y, r: 10, a: 0.5, color: '#ffffff' });   // every touch answers
      },
      move(p) {
        if (stopped || !fingerBar.has(p.id)) return;
        sinceTouch = 0;
        const i = barAt(p.x, p.y);
        if (i !== fingerBar.get(p.id)) {   // entering a new bar plays it, like a glissando
          fingerBar.set(p.id, i);
          if (i >= 0) strike(i, p.x, p.y, 0.6);
        }
      },
      up(p) { fingerBar.delete(p.id); },
    });

    return {
      stop() {
        stopped = true;
        if (typeof offFrame === 'function') offFrame();
        if (typeof offPointer === 'function') offPointer();
      },
      debug: () => ({ entities: rings.length }),
    };
  },
};
