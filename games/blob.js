// blob: one big jelly in the middle of the screen. A poke dents it and it wobbles back; a drag
// pulls it out of shape; every touch eases it to a new colour. Its eyes follow the nearest finger.

const RIM = 32;
const MAX_RIPPLES = 30;

// The eyes, as explicit states: open, or blinking (lids close and open over 0.3 s).
const Eyes = Object.freeze({ OPEN: 'open', BLINKING: 'blinking' });

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function drawJelly(ctx, pts, hue, light) {
  ctx.fillStyle = `hsl(${hue}, 75%, ${48 + light}%)`;
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    if (i === 0) ctx.moveTo(mx, my); else ctx.quadraticCurveTo(a.x, a.y, mx, my);
  }
  const a = pts[0], b = pts[1];
  ctx.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
  ctx.closePath();
  ctx.fill();
}

export default {
  id: 'blob',
  colors: ['#7cf29c', '#ff8fd1'],

  icon(ctx, size, t) {
    ctx.fillStyle = '#0d0a26';
    ctx.fillRect(0, 0, size, size);
    const pts = Array.from({ length: 16 }, (_, i) => {
      const a = i / 16 * Math.PI * 2, r = size * (0.3 + 0.03 * Math.sin(a * 3 + t * 3));
      return { x: size / 2 + Math.cos(a) * r, y: size * 0.52 + Math.sin(a) * r * 0.9 };
    });
    drawJelly(ctx, pts, (140 + t * 30) % 360, 0);
    ctx.fillStyle = '#ffffff';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(size / 2 + s * size * 0.1, size * 0.45, size * 0.06, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = '#1b1b3a';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(size / 2 + s * size * 0.1, size * 0.46, size * 0.03, 0, Math.PI * 2); ctx.fill(); }
  },

  start(stage) {
    const ctx = stage.ctx;
    let stopped = false;
    let sinceTouch = 0;
    let hue = 140, targetHue = 140;
    let eyes = Eyes.OPEN, eyeClock = 0, nextBlink = 4;
    let lookX = 0, lookY = 0;
    const fingers = new Map();   // pointer id -> {x, y}
    const ripples = [];
    const radius = () => Math.min(stage.width, stage.height) * 0.3;
    const centre = { x: stage.width / 2, y: stage.height / 2, vx: 0, vy: 0 };
    const rim = Array.from({ length: RIM }, (_, i) => {
      const a = i / RIM * Math.PI * 2;
      return { a, x: centre.x + Math.cos(a) * radius(), y: centre.y + Math.sin(a) * radius(), vx: 0, vy: 0 };
    });

    function poke(x, y) {
      targetHue = (targetHue + 40 + stage.rand() * 40) % 360;
      stage.audio.note(clamp(700 - 400 * (y / Math.max(1, stage.height)), 200, 900), 0.3);
      if (ripples.length < MAX_RIPPLES) ripples.push({ x, y, r: 0, life: 0.6 });
      // Dent: the rim near the finger is pushed away from it.
      for (const p of rim) {
        const dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy) || 1;
        const reach = radius() * 0.9;
        if (d < reach) {
          const k = (1 - d / reach) * radius() * 6;
          p.vx += dx / d * k; p.vy += dy / d * k;
        }
      }
    }

    function stepEyes(dt) {
      eyeClock += dt;
      switch (eyes) {
        case Eyes.OPEN: if (eyeClock > nextBlink) { eyes = Eyes.BLINKING; eyeClock = 0; } break;
        case Eyes.BLINKING: if (eyeClock > 0.3) { eyes = Eyes.OPEN; eyeClock = 0; nextBlink = 4 + stage.rand() * 2; } break;
      }
    }

    const offFrame = stage.onFrame((dt, t) => {
      if (stopped) return;
      sinceTouch += dt;
      stepEyes(dt);
      // The colour eases towards the last one asked for, the short way round the wheel.
      let dh = ((targetHue - hue + 540) % 360) - 180;
      hue = (hue + dh * Math.min(1, dt * 3) + 360) % 360;
      const R = radius() * (sinceTouch > 5 ? 1 + 0.03 * Math.sin(t * 1.4) : 1);
      // The centre settles back to the middle of the screen.
      centre.vx = (centre.vx + (stage.width / 2 - centre.x) * 6 * dt) * Math.exp(-dt * 3);
      centre.vy = (centre.vy + (stage.height / 2 - centre.y) * 6 * dt) * Math.exp(-dt * 3);
      centre.x += centre.vx * dt; centre.y += centre.vy * dt;
      for (const p of rim) {
        // Spring to its place on the rim, plus a pull from any finger close by (a drag stretches it).
        let ax = (centre.x + Math.cos(p.a) * R - p.x) * 60, ay = (centre.y + Math.sin(p.a) * R * 0.92 - p.y) * 60;
        for (const [, f] of fingers) {
          const dx = f.x - p.x, dy = f.y - p.y, d = Math.hypot(dx, dy);
          if (d < R * 0.8) { ax += dx * 80 * (1 - d / (R * 0.8)); ay += dy * 80 * (1 - d / (R * 0.8)); }
        }
        p.vx = (p.vx + ax * dt) * Math.exp(-dt * 4);
        p.vy = (p.vy + ay * dt) * Math.exp(-dt * 4);
      }
      // Neighbours pull each other along, so a dent spreads as a wobble.
      for (let i = 0; i < RIM; i++) {
        const a = rim[i], b = rim[(i + 1) % RIM];
        const mvx = (a.vx + b.vx) / 2, mvy = (a.vy + b.vy) / 2;
        a.vx += (mvx - a.vx) * 0.15; a.vy += (mvy - a.vy) * 0.15;
        b.vx += (mvx - b.vx) * 0.15; b.vy += (mvy - b.vy) * 0.15;
      }
      for (const p of rim) { p.x += p.vx * dt; p.y += p.vy * dt; }
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.r += dt * radius() * 1.2; r.life -= dt;
        if (r.life <= 0) ripples.splice(i, 1);
      }
      // The eyes look at the nearest finger, or wander slowly.
      let tx = centre.x + Math.cos(t * 0.5) * R, ty = centre.y + Math.sin(t * 0.37) * R;
      let best = Infinity;
      for (const [, f] of fingers) { const d = Math.hypot(f.x - centre.x, f.y - centre.y); if (d < best) { best = d; tx = f.x; ty = f.y; } }
      lookX += (tx - lookX) * Math.min(1, dt * 10); lookY += (ty - lookY) * Math.min(1, dt * 10);

      ctx.fillStyle = '#0c0a24';
      ctx.fillRect(0, 0, stage.width, stage.height);
      for (const r of ripples) {
        ctx.globalAlpha = clamp(r.life / 0.6, 0, 1) * 0.6;
        ctx.strokeStyle = `hsl(${targetHue}, 80%, 70%)`;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      drawJelly(ctx, rim, hue, 0);
      // A highlight, then the face.
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.ellipse(centre.x - R * 0.35, centre.y - R * 0.45, R * 0.22, R * 0.12, -0.5, 0, Math.PI * 2);
      ctx.fill();
      const eyeR = R * 0.17, lid = eyes === Eyes.BLINKING ? Math.sin(Math.PI * clamp(eyeClock / 0.3, 0, 1)) : 0;
      for (const s of [-1, 1]) {
        const ex = centre.x + s * R * 0.32, ey = centre.y - R * 0.12;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(ex, ey, eyeR, eyeR * (1 - lid * 0.9), 0, 0, Math.PI * 2);
        ctx.fill();
        if (lid < 0.7) {
          const a = Math.atan2(lookY - ey, lookX - ex), off = eyeR * 0.45;
          ctx.fillStyle = '#1b1b3a';
          ctx.beginPath();
          ctx.arc(ex + Math.cos(a) * off, ey + Math.sin(a) * off, eyeR * 0.45, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // A smile that grows while it is being touched.
      ctx.strokeStyle = 'rgba(20,20,50,0.7)';
      ctx.lineWidth = Math.max(3, R * 0.04);
      ctx.beginPath();
      ctx.arc(centre.x, centre.y + R * 0.12, R * 0.25, 0.15 * Math.PI, (fingers.size ? 0.85 : 0.75) * Math.PI);
      ctx.stroke();
    });

    const offPointer = stage.onPointer({
      down(p) {
        if (stopped) return;
        sinceTouch = 0;
        fingers.set(p.id, { x: p.x, y: p.y });
        lookX = p.x; lookY = p.y;   // the eyes turn at once
        poke(p.x, p.y);
      },
      move(p) {
        const f = fingers.get(p.id);
        if (stopped || !f) return;
        sinceTouch = 0;
        f.x = p.x; f.y = p.y;
      },
      up(p) { fingers.delete(p.id); },
    });

    return {
      stop() {
        stopped = true;
        for (const off of [offFrame, offPointer]) if (typeof off === 'function') off();
      },
      debug: () => {
        const ds = rim.map(p => Math.hypot(p.x - centre.x, p.y - centre.y) / radius());
        return { entities: RIM + ripples.length, eyes, finite: rim.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)),
                 spread: [Math.min(...ds), Math.max(...ds)], hue };
      },
    };
  },
};
