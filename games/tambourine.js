// tambourine: one big tambourine floats on a dark stage, eight golden jingles around its rim. Touch a
// jingle and it flips with a bright tinkle; touch the skin and it thumps, sending a ring across the
// hide. Drag in a circle and the whole instrument spins, the jingles chiming as they pass. Idle, it
// sways and ticks a jingle now and then.

const JINGLES = 8;
const MAX_RINGS = 20;

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export default {
  id: 'tambourine',
  colors: ['#ff9f1c', '#e76f51'],

  icon(ctx, size, t) {
    const c = size / 2, R = size * 0.34;
    ctx.strokeStyle = '#c98a2e';
    ctx.lineWidth = size * 0.09;
    ctx.beginPath();
    ctx.arc(c, c, R, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#f4e3c6';
    ctx.beginPath();
    ctx.arc(c, c, R * 0.72, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < JINGLES; i++) {
      const a = (i / JINGLES) * Math.PI * 2 - Math.PI / 2;
      const lit = Math.max(0, Math.cos(t * 1.8 - a));      // one highlight circles the rim
      ctx.fillStyle = '#ffd166';
      ctx.globalAlpha = 0.5 + 0.5 * lit;
      ctx.beginPath();
      ctx.arc(c + Math.cos(a) * R, c + Math.sin(a) * R, size * 0.045 * (1 + 0.5 * lit), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  },

  start(stage) {
    const { ctx, audio } = stage;
    const rings = [];
    const held = new Map();
    let w = 0, h = 0, cx = 0, cy = 0, R = 0;
    let spin = 0, spinV = 0, idle = 0, tickClock = 0, tickStep = 0, wind = 0;
    const jingles = Array.from({ length: JINGLES }, (_, i) => ({ flip: 0, flipV: 0 }));

    function sync() {
      if (stage.width === w && stage.height === h) return;
      w = stage.width; h = stage.height;
      cx = w / 2; cy = h * 0.54;
      R = Math.min(w, h) * 0.36;
    }
    const jpos = (i, rot) => {
      const a = (i / JINGLES) * Math.PI * 2 - Math.PI / 2 + rot;
      return { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R, a };
    };

    function tinkle(i, strength) {
      jingles[i].flipV += 10 + 16 * strength;
      audio.note(990 + i * 60, 0.28 + 0.2 * strength);
      const p = jpos(i, spin);
      rings.push({ x: p.x, y: p.y, r: R * 0.08, v: 190, a: 0.5 * strength, c: '#ffd166' });
      if (rings.length > MAX_RINGS) rings.shift();
    }

    function thump(x, y, strength) {
      audio.note(170, 0.35);
      rings.push({ x, y, r: 8, v: R * 1.6, a: 0.75 * strength, c: '#a84727' });
      if (rings.length > MAX_RINGS) rings.shift();
    }

    const offPointer = stage.onPointer({
      down(p) {
        sync();
        idle = 0; tickClock = 0;
        held.set(p.id, { x: p.x, y: p.y, a: Math.atan2(p.y - cy, p.x - cx) });
        const d = Math.hypot(p.x - cx, p.y - cy);
        if (d < R * 0.72) { thump(p.x, p.y, 1); return; }
        let best = 0, bd = Infinity;
        for (let i = 0; i < JINGLES; i++) {
          const q = jpos(i, spin);
          const dd = Math.hypot(p.x - q.x, p.y - q.y);
          if (dd < bd) { bd = dd; best = i; }
        }
        tinkle(best, clamp(1 - bd / (R * 0.9), 0.35, 1));
      },
      move(p) {
        const prev = held.get(p.id);
        if (!prev) return;
        idle = 0; tickClock = 0;
        const a = Math.atan2(p.y - cy, p.x - cx);
        let d = a - prev.a;
        if (d > Math.PI) d -= Math.PI * 2;
        if (d < -Math.PI) d += Math.PI * 2;
        spinV += d * 2.4;                                  // circular drags wind the spin
        const speed = Math.hypot(p.x - prev.x, p.y - prev.y);
        if (speed > 14) {
          wind = 1;
          let best = 0, bd = Infinity;
          for (let i = 0; i < JINGLES; i++) {
            const q = jpos(i, spin);
            const dd = Math.hypot(p.x - q.x, p.y - q.y);
            if (dd < bd) { bd = dd; best = i; }
          }
          if (bd < R * 0.45 && jingles[best].flip < 0.25) tinkle(best, 0.5);
        }
        prev.x = p.x; prev.y = p.y; prev.a = a;
      },
      up(p) { held.delete(p.id); },
    });

    const offFrame = stage.onFrame((dt, t) => {
      sync();
      idle += dt;
      wind = Math.max(0, wind - dt * 2);
      spinV *= Math.exp(-1.4 * dt);                       // the spin eases out
      if (idle > 5) {
        spinV += Math.sin(t * 0.8) * 0.05 * dt;           // a lazy idle turn
        tickClock += dt;
        if (tickClock > 2.3) {
          tickClock = 0;
          tinkle(tickStep++ % JINGLES, 0.35);
        }
      }
      spin += spinV * dt;

      ctx.fillStyle = '#101b2a';
      ctx.fillRect(0, 0, w, h);
      const bob = Math.sin(t * 0.8) * R * 0.02;

      ctx.save();                                          // the body, gently turning
      ctx.translate(cx, cy + bob);
      ctx.rotate(Math.sin(spin) * 0.06);
      ctx.fillStyle = '#c98a2e';
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f4e3c6';
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.74, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(120,70,10,0.35)';
      for (const f of [0.3, 0.52]) {
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, R * f, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      for (let i = 0; i < JINGLES; i++) {                  // jingles on the rim
        const j = jingles[i];
        j.flipV += (-60 * j.flip - 7 * j.flipV) * dt;
        j.flip += j.flipV * dt;
        const p = jpos(i, spin);
        const size = R * 0.11 * (1 + 0.6 * Math.abs(j.flip));
        ctx.fillStyle = '#ffd166';
        ctx.globalAlpha = 0.85 + 0.15 * Math.min(1, Math.abs(j.flip));
        ctx.beginPath();
        ctx.arc(p.x, p.y + bob, size, 0, Math.PI * 2);
        ctx.fill();
        if (Math.abs(j.flip) > 0.05) {                     // the flipped second disc, edge-on
          ctx.fillStyle = '#c98a2e';
          ctx.beginPath();
          ctx.ellipse(p.x, p.y + bob, size, size * clamp(1 - Math.abs(j.flip), 0.15, 1) * 0.6, j.flip, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      if (wind > 0.02) {                                   // a wind sheen circling the rim
        ctx.strokeStyle = `rgba(255,209,102,${(0.4 * wind).toFixed(3)})`;
        ctx.lineWidth = R * 0.06;
        ctx.beginPath();
        ctx.arc(cx, cy + bob, R * 1.08, spin * 2, spin * 2 + 1.4);
        ctx.stroke();
      }

      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.r += r.v * dt;
        r.a -= dt * 1.3;
        if (r.a <= 0) { rings.splice(i, 1); continue; }
        ctx.strokeStyle = r.c;
        ctx.globalAlpha = clamp(r.a, 0, 1);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    });

    return {
      stop() {
        offPointer();
        offFrame();
        held.clear();
      },
    };
  },
};
