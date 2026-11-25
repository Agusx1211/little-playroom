// rainbows: a wet sky after rain. Every touch raises a rainbow right under the finger — drag and the
// whole arc slides along with the finger, its colours running after it. Let go and it hangs there,
// shimmers a while, and fades away so the sky is empty again for the next one. When nobody touches,
// a shy rainbow now and then rises on its own, and the drizzle keeps falling.
//
// A rainbow's life, as explicit states:
//   RISING (0.35 s) -> HELD (finger down, it follows) -> shimmer after release (3 s) -> FADING (2 s) -> gone.

const MAX_BOWS = 3;
const MAX_RINGS = 20;
const MAX_DRIPS = 70;
const BANDS = ['#ff6b6b', '#ffb347', '#ffe066', '#7fd17f', '#7fb3ff', '#b28ee0'];

const Phase = Object.freeze({ RISING: 'rising', HELD: 'held', SHIMMER: 'shimmer', FADING: 'fading' });

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export default {
  id: 'rainbows',
  colors: ['#ff9ec4', '#8ec9ff'],

  icon(ctx, size, t) {
    ctx.fillStyle = '#5f7fae';
    ctx.fillRect(0, 0, size, size);
    const cx = size * 0.5, cy = size * 0.86;
    const grow = 0.7 + 0.3 * Math.sin(t * 1.2);
    for (let k = 0; k < 6; k++) {
      ctx.strokeStyle = BANDS[k];
      ctx.lineWidth = size * 0.05;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(cx, cy, size * (0.2 + k * 0.062) * grow, Math.PI * 1.05, Math.PI * 1.95);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#dfe9f7';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + s * size * 0.34, size * 0.74, size * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  start(stage) {
    const ctx = stage.ctx;
    let stopped = false;
    let sinceTouch = 0, idleClock = 0, sinceSound = 0;
    const short = () => Math.min(stage.width, stage.height);
    const drips = [], rings = [];
    const bows = [];     // {phase, clock, cx, cy, base, fingerId, seed}
    const fingers = new Map();
    const baseR = () => short() * 0.42;

    function raise(x, y, fingerId) {
      if (bows.length >= MAX_BOWS) bows.shift();   // the oldest makes room
      bows.push({ phase: Phase.RISING, clock: 0, cx: x, cy: y + baseR() * 0.55, base: baseR(), fingerId, seed: stage.rand() });
      if (rings.length < MAX_RINGS) rings.push({ x, y, r: short() * 0.03, life: 1 });
      // one rising chime per bow, higher the newer it is
      if (sinceSound > 0.18) { stage.audio.note(520 + bows.length * 90, 0.3); sinceSound = 0; }
    }

    const offFrame = stage.onFrame((dt, t) => {
      if (stopped) return;
      sinceTouch += dt; sinceSound += dt;
      // Idle: after 5 s the drizzle thickens; now and then a shy bow rises on its own.
      if (sinceTouch > 5) {
        idleClock += dt;
        if (idleClock > 8) {
          idleClock = 0;
          if (!bows.some(b => b.fingerId !== null)) raise(stage.width * (0.2 + stage.rand() * 0.6), stage.height * (0.3 + stage.rand() * 0.2), null);
        }
      }
      for (let i = bows.length - 1; i >= 0; i--) {
        const b = bows[i];
        b.clock += dt;
        switch (b.phase) {
          case Phase.RISING: {
          const f = b.fingerId !== null ? fingers.get(b.fingerId) : null;
          if (f) { b.cx += (f.x - b.cx) * Math.min(1, dt * 8); b.cy += (f.y + baseR() * 0.55 - b.cy) * Math.min(1, dt * 8); }
            if (b.clock > 0.35) b.phase = Phase.HELD;   // RISING -> HELD
            break;
          }
          case Phase.HELD: {
            const f = b.fingerId !== null ? fingers.get(b.fingerId) : null;
            if (f) { b.cx += (f.x - b.cx) * Math.min(1, dt * 10); b.cy += (f.y + baseR() * 0.55 - b.cy) * Math.min(1, dt * 10); }
            else { b.phase = Phase.SHIMMER; b.clock = 0; b.fingerId = null; }   // HELD -> SHIMMER on release
            break;
          }
          case Phase.SHIMMER:
            if (b.clock > 3) b.phase = Phase.FADING;   // SHIMMER -> FADING
            break;
          case Phase.FADING:
            if (b.clock > 2) bows.splice(i, 1);        // FADING -> gone
            break;
        }
      }
      // drizzle: light and constant, each drop lands as a tiny ring
      if (drips.length < MAX_DRIPS && stage.rand() < dt * 22) {
        drips.push({ x: stage.rand() * stage.width, y: -10, vy: short() * (0.5 + stage.rand() * 0.3) });
      }
      for (let i = drips.length - 1; i >= 0; i--) {
        const d = drips[i];
        d.vy += short() * 1.2 * dt; d.y += d.vy * dt;
        if (d.y > stage.height * 0.97) {
          if (rings.length < MAX_RINGS && stage.rand() < 0.4) rings.push({ x: d.x, y: stage.height * (0.95 + stage.rand() * 0.04), r: 2, life: 0.7 });
          drips.splice(i, 1);
        }
      }
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.r += dt * short() * 0.22; r.life -= dt * 1.2;
        if (r.life <= 0) rings.splice(i, 1);
      }

      const sky = ctx.createLinearGradient(0, 0, 0, stage.height);
      sky.addColorStop(0, '#6f8fbf'); sky.addColorStop(1, '#b8d3ea');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, stage.width, stage.height);
      // clouds low on the horizon
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      for (const [kx, ky, kr] of [[0.16, 0.86, 0.1], [0.3, 0.9, 0.07], [0.68, 0.88, 0.11], [0.85, 0.84, 0.07], [0.5, 0.92, 0.08]]) {
        ctx.beginPath();
        ctx.arc(stage.width * kx, stage.height * ky + Math.sin(t * 0.5 + kx * 9) * 3, short() * kr, 0, Math.PI * 2);
        ctx.fill();
      }
      // the bows: six bands, drawn as arcs centred on the touch point
      for (const b of bows) {
        const grow = b.phase === Phase.RISING ? clamp(b.clock / 0.35, 0.05, 1) : 1;
        let alpha = 0.85;
        if (b.phase === Phase.SHIMMER) alpha = 0.75 + Math.sin(t * 6 + b.seed * 9) * 0.15;
        if (b.phase === Phase.FADING) alpha = 0.85 * clamp(1 - b.clock / 2, 0, 1);
        const shimmerWobble = b.phase === Phase.SHIMMER ? Math.sin(t * 3 + b.seed * 6) * short() * 0.004 : 0;
        for (let k = 0; k < 6; k++) {
          ctx.strokeStyle = BANDS[k];
          ctx.lineWidth = short() * 0.028 * grow;
          ctx.globalAlpha = alpha * (0.75 + 0.25 * Math.sin(k * 1.3 + t));
          ctx.beginPath();
          ctx.arc(b.cx + shimmerWobble, b.cy, (b.base - k * short() * 0.03) * grow, Math.PI * 1.02, Math.PI * 1.98);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      // drizzle lines and landing rings
      ctx.strokeStyle = '#dfe9f7';
      ctx.lineWidth = 2;
      for (const d of drips) {
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - 1.5, d.y + short() * 0.03);
        ctx.stroke();
      }
      ctx.strokeStyle = '#ffffff';
      for (const r of rings) {
        ctx.globalAlpha = clamp(r.life, 0, 1) * 0.45;
        ctx.beginPath();
        ctx.ellipse(r.x, r.y, r.r, r.r * 0.35, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    });

    const offPointer = stage.onPointer({
      down(p) {
        if (stopped) return;
        sinceTouch = 0;
        fingers.set(p.id, { x: p.x, y: p.y });
        // a bow per finger; on an already-held spot the bow just slides, it does not double up
        const held = bows.find(b => b.fingerId === null || !fingers.has(b.fingerId));
        if (held && held.phase !== Phase.RISING) { held.fingerId = p.id; held.phase = Phase.HELD; held.clock = 0; if (rings.length < MAX_RINGS) rings.push({ x: p.x, y: p.y, r: short() * 0.03, life: 1 }); return; }
        raise(p.x, p.y, p.id);
      },
      move(p) {
        if (fingers.has(p.id)) fingers.set(p.id, { x: p.x, y: p.y });
      },
      up(p) { fingers.delete(p.id); },
    });

    return {
      stop() {
        stopped = true;
        for (const off of [offFrame, offPointer]) if (typeof off === 'function') off();
      },
      debug: () => ({ entities: bows.length + drips.length + rings.length, phases: bows.map(b => b.phase) }),
    };
  },
};
