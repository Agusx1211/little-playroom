// lights: a house at night. Tapping a dark window lights it (with a little round figure inside);
// tapping a lit one turns it off. When every window is lit the house glows and the stars brighten
// for a while, then the windows go dark slowly, one by one, and it begins again. No end.

const ROWS = 3, COLS = 3;
const FADE_S = 0.5;                 // a light takes half a second to come on or go off: never a flash
const CELEBRATE_S = 6;
const NOTES = [392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66];
const FIGURE_HUES = [0, 30, 200, 280, 120, 330, 50, 180, 260];

// A window's life, as explicit states.
const Win = Object.freeze({ DARK: 'dark', LIGHTING: 'lighting', LIT: 'lit', DIMMING: 'dimming' });
// The house as a whole.
const House = Object.freeze({ PLAYING: 'playing', CELEBRATING: 'celebrating', SETTLING: 'settling' });

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function layout(width, height) {
  // Walls 0.85 x the width tall, the roof another 0.45 of that: the whole house fits in 88 % of the height.
  const hw = Math.min(width * 0.7, height * 0.88 / (0.85 * 1.45)), hh = hw * 0.85;
  const x = (width - hw) / 2, y = height * 0.95 - hh;
  const pad = hw * 0.08, gap = hw * 0.06;
  const ww = (hw - pad * 2 - gap * (COLS - 1)) / COLS, wh = (hh - pad * 2 - gap * (ROWS - 1)) / ROWS;
  const windows = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    windows.push({ x: x + pad + c * (ww + gap), y: y + pad + r * (wh + gap), w: ww, h: wh });
  }
  return { x, y, w: hw, h: hh, windows };
}

function drawFigure(ctx, w, hue, k, t) {
  // A round little face peeking in the window.
  const cx = w.x + w.w / 2, cy = w.y + w.h * 0.62 - Math.sin(t * 2 + hue) * w.h * 0.03;
  const r = Math.min(w.w, w.h) * 0.22 * k;
  ctx.fillStyle = `hsl(${hue}, 70%, 45%)`;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx - r * 0.35, cy - r * 0.15, r * 0.18, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.35, cy - r * 0.15, r * 0.18, 0, Math.PI * 2);
  ctx.fill();
}

function drawHouse(ctx, L, windows, glow, t) {
  // Roof and walls.
  ctx.fillStyle = '#3a2d5c';
  ctx.beginPath();
  ctx.moveTo(L.x - L.w * 0.08, L.y);
  ctx.lineTo(L.x + L.w * 1.08, L.y);
  ctx.lineTo(L.x + L.w / 2, L.y - L.h * 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = glow > 0 ? `rgb(${42 + 30 * glow}, ${36 + 24 * glow}, ${70 + 10 * glow})` : '#2a2446';
  ctx.fillRect(L.x, L.y, L.w, L.h);
  L.windows.forEach((w, i) => {
    const win = windows[i];
    ctx.fillStyle = '#141028';
    ctx.fillRect(w.x, w.y, w.w, w.h);
    if (win.light > 0) {
      ctx.globalAlpha = win.light;
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(w.x, w.y, w.w, w.h);
      drawFigure(ctx, w, FIGURE_HUES[i], win.light, t);
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = '#6c5b9c';
    ctx.lineWidth = Math.max(2, w.w * 0.04);
    ctx.strokeRect(w.x, w.y, w.w, w.h);
  });
}

export default {
  id: 'lights',
  colors: ['#ffd166', '#3a2d5c'],

  icon(ctx, size, t) {
    ctx.fillStyle = '#0a0c22';
    ctx.fillRect(0, 0, size, size);
    const L = layout(size, size * 1.05);
    const windows = L.windows.map((_, i) => ({ light: Math.max(0, Math.sin(t * 1.2 + i * 1.1)) }));
    drawHouse(ctx, L, windows, 0, t);
  },

  start(stage) {
    const ctx = stage.ctx;
    const windows = Array.from({ length: ROWS * COLS }, () => ({ state: Win.DARK, light: 0 }));
    const stars = Array.from({ length: 50 }, () => ({ x: stage.rand(), y: stage.rand() * 0.55, r: 0.6 + stage.rand() * 1.6, p: stage.rand() * 6 }));
    const sparkles = [];   // every touch answers: a little burst where it landed
    let house = House.PLAYING, houseClock = 0;
    let sinceTouch = 0, idleClock = 0;
    let stopped = false;

    function toggle(i) {
      const w = windows[i];
      switch (w.state) {
        case Win.DARK: case Win.DIMMING: w.state = Win.LIGHTING; stage.audio.note(NOTES[i], 0.4); break;
        case Win.LIT: case Win.LIGHTING: w.state = Win.DIMMING; stage.audio.note(NOTES[i] / 2, 0.3); break;
      }
    }

    function stepWindow(w, dt) {
      switch (w.state) {
        case Win.LIGHTING: w.light = Math.min(1, w.light + dt / FADE_S); if (w.light >= 1) w.state = Win.LIT; break;
        case Win.DIMMING: w.light = Math.max(0, w.light - dt / FADE_S); if (w.light <= 0) w.state = Win.DARK; break;
        case Win.LIT: case Win.DARK: break;
      }
    }

    function stepHouse(dt) {
      houseClock += dt;
      switch (house) {
        case House.PLAYING:
          if (windows.every(w => w.state === Win.LIT)) { house = House.CELEBRATING; houseClock = 0; stage.audio.whoosh(); }
          break;
        case House.CELEBRATING:
          if (houseClock > CELEBRATE_S) { house = House.SETTLING; houseClock = 0; }
          break;
        case House.SETTLING: {
          // One window goes dark every 0.7 s; back to playing when all are dark.
          if (houseClock > 0.7) {
            houseClock = 0;
            const lit = windows.filter(w => w.state === Win.LIT);
            if (lit.length) lit[Math.floor(stage.rand() * lit.length) % lit.length].state = Win.DIMMING;
          }
          if (windows.every(w => w.state === Win.DARK)) house = House.PLAYING;
          break;
        }
      }
    }

    function sparkle(x, y) {
      for (let k = 0; k < 8 && sparkles.length < 80; k++) {
        const a = (k / 8) * Math.PI * 2 + stage.rand() * 0.4, v = Math.min(stage.width, stage.height) * (0.15 + stage.rand() * 0.15);
        sparkles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.7 });
      }
    }

    const offFrame = stage.onFrame((dt, t) => {
      if (stopped) return;
      sinceTouch += dt;
      for (let i = sparkles.length - 1; i >= 0; i--) {
        const k = sparkles[i];
        k.x += k.vx * dt; k.y += k.vy * dt; k.vx *= 0.96; k.vy *= 0.96; k.life -= dt;
        if (k.life <= 0) sparkles.splice(i, 1);
      }
      // Idle: after 5 s a window lights or dims on its own every 2.5 s, slowly.
      if (sinceTouch > 5 && house === House.PLAYING) {
        idleClock += dt;
        if (idleClock > 2.5) { idleClock = 0; toggle(Math.floor(stage.rand() * windows.length) % windows.length); }
      }
      for (const w of windows) stepWindow(w, dt);
      stepHouse(dt);

      const glow = house === House.CELEBRATING ? Math.min(1, houseClock / 1.5) : 0;
      const sky = ctx.createLinearGradient(0, 0, 0, stage.height);
      sky.addColorStop(0, '#070920'); sky.addColorStop(1, '#1a1a40');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, stage.width, stage.height);
      ctx.fillStyle = '#ffffff';
      for (const s of stars) {
        ctx.globalAlpha = clamp(0.3 + 0.25 * Math.sin(t * 0.9 + s.p) + glow * 0.4, 0, 1);
        ctx.beginPath();
        ctx.arc(s.x * stage.width, s.y * stage.height, s.r * (1 + glow * 0.6), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // A moon that drifts slowly across the sky.
      const mx = stage.width * (0.15 + 0.7 * ((t * 0.01) % 1)), my = stage.height * 0.16;
      ctx.fillStyle = '#f1f0d6';
      ctx.beginPath();
      ctx.arc(mx, my, Math.min(stage.width, stage.height) * 0.05, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#10142e';
      ctx.fillRect(0, stage.height * 0.95, stage.width, stage.height * 0.05);
      drawHouse(ctx, layout(stage.width, stage.height), windows, glow, t);
      ctx.fillStyle = '#ffe9a8';
      for (const k of sparkles) {
        ctx.globalAlpha = clamp(k.life / 0.7, 0, 1);
        ctx.beginPath();
        ctx.arc(k.x, k.y, Math.min(stage.width, stage.height) * 0.008, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    });

    const offPointer = stage.onPointer({
      down(p) {
        if (stopped) return;
        sinceTouch = 0;
        sparkle(p.x, p.y);
        if (house !== House.PLAYING) return;   // while it celebrates and settles, touches only sparkle
        const L = layout(stage.width, stage.height);
        const m = L.windows[0].w * 0.15;
        const i = L.windows.findIndex(w => p.x >= w.x - m && p.x <= w.x + w.w + m && p.y >= w.y - m && p.y <= w.y + w.h + m);
        if (i >= 0) toggle(i);
      },
      move() {},
      up() {},
    });

    return {
      stop() {
        stopped = true;
        if (typeof offFrame === 'function') offFrame();
        if (typeof offPointer === 'function') offPointer();
      },
      debug: () => ({ entities: windows.length + sparkles.length, states: windows.map(w => w.state), house }),
    };
  },
};
