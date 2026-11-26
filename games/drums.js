// drums: three round drums on a dark stage. Anywhere you tap, the nearest drum answers — it takes the
// hit, dips and springs back, a ring of light spreads and wood chips jump. A tap far from every drum
// still taps it "from afar": a faint ripple under the finger and a soft tick. Idle, the kit plays
// itself a quiet little beat.

const HEADS = [
  { fx: 0.5, fy: 0.74, rf: 0.26, note: 98, dur: 0.5 },    // bass drum, low and slow
  { fx: 0.25, fy: 0.5, rf: 0.16, note: 165, dur: 0.3 },   // left tom
  { fx: 0.75, fy: 0.5, rf: 0.16, note: 208, dur: 0.3 },   // right tom
];
const MAX_CHIPS = 210;
const MAX_RINGS = 26;

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function layout(width, height) {
  const base = Math.min(width, height);
  return HEADS.map(h => ({
    ...h, x: width * h.fx, y: height * h.fy, r: base * h.rf,
    press: 0, glow: 0,
  }));
}

export default {
  id: 'drums',
  colors: ['#ff9f1c', '#7b2d8b'],

  icon(ctx, size, t) {
    const beat = Math.max(0, Math.sin(t * 2.4));            // one gentle bounce
    const kit = [
      { cx: 0.32, cy: 0.68, r: 0.17, lit: Math.max(0, Math.sin(t * 2.4)) },
      { cx: 0.68, cy: 0.62, r: 0.13, lit: Math.max(0, Math.sin(t * 2.4 - 1.7)) },
    ];
    for (const d of kit) {
      ctx.fillStyle = '#3a2c50';
      ctx.beginPath();
      ctx.arc(size * d.cx, size * (d.cy + 0.05), size * d.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#241b38';
      ctx.beginPath();
      ctx.arc(size * d.cx, size * d.cy, size * d.r * 0.86, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ff9f1c';
      ctx.lineWidth = size * 0.035;
      ctx.globalAlpha = 0.35 + 0.55 * d.lit;
      ctx.beginPath();
      ctx.arc(size * d.cx, size * d.cy, size * d.r * (0.9 + 0.12 * d.lit), 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    const stickTipY = size * (0.42 - 0.1 * beat);
    ctx.strokeStyle = '#f4e3c6';
    ctx.lineWidth = size * 0.035;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(size * 0.5, size * 0.16);
    ctx.lineTo(size * 0.34, stickTipY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(size * 0.52, size * 0.16);
    ctx.lineTo(size * 0.66, size * (0.38 + 0.08 * beat));
    ctx.stroke();
    ctx.lineCap = 'butt';
  },

  start(stage) {
    const { ctx, audio } = stage;
    let w = 0, h = 0, drums = [];
    const rings = [];     // { x, y, r, v, a, color }
    const chips = [];     // { x, y, vx, vy, r, a, color }
    const held = new Map();
    let idle = 0, beatStep = 0, beatClock = 0;

    function sync() {
      if (stage.width === w && stage.height === h) return;
      w = stage.width; h = stage.height;
      drums = layout(w, h);
    }

    function hit(drum, x, y, strength) {
      drum.press = Math.max(drum.press, 0.85 * strength);
      drum.glow = Math.max(drum.glow, strength);
      audio.note(drum.note, drum.dur * (0.7 + 0.3 * strength));
      rings.push({ x: drum.x, y: drum.y, r: drum.r * 0.9, v: drum.r * (2.4 + 2 * strength),
        a: 0.55 * strength, color: strength > 0.6 ? '#ffca6b' : '#ff9f1c' });
      if (rings.length > MAX_RINGS) rings.shift();
      const n = Math.round(4 + 9 * strength);
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + (stage.rand() - 0.5) * 2.2;
        const sp = drum.r * (1.1 + stage.rand() * 2.6) * strength;
        chips.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          r: drum.r * (0.03 + stage.rand() * 0.05), a: 0.9,
          color: stage.rand() < 0.5 ? '#f4e3c6' : '#c98a4b' });
        if (chips.length > MAX_CHIPS) chips.shift();
      }
    }

    function tap(x, y) {
      idle = 0; beatClock = 0;
      let best = null, bestD = Infinity;
      for (const d of drums) {
        const d0 = Math.hypot(x - d.x, y - d.y);
        if (d0 < bestD) { bestD = d0; best = d; }
      }
      if (best && bestD < best.r * 1.15) {
        hit(best, x, y, clamp(1 - bestD / (best.r * 1.15), 0.45, 1));
      } else if (best) {                       // far tap: answer from afar, softly
        best.glow = Math.max(best.glow, 0.25);
        audio.pop();
        rings.push({ x, y, r: 6, v: 90, a: 0.35, color: '#8ea6ff' });
        if (rings.length > MAX_RINGS) rings.shift();
      }
    }

    const offPointer = stage.onPointer({
      down(p) { held.set(p.id, p); tap(p.x, p.y); },
      up(p) { held.delete(p.id); },
    });

    const offFrame = stage.onFrame((dt, t) => {
      sync();
      idle += dt;
      if (idle > 5) {                          // a quiet self-played beat, under 2 hits a second
        beatClock += dt;
        if (beatClock > 0.62) {
          beatClock = 0;
          const d = drums[beatStep % 3 === 2 ? 0 : (beatStep % 3) + 1] ?? drums[0];
          hit(d, d.x, d.y - d.r * 0.2, 0.3);
          beatStep++;
        }
      }

      ctx.fillStyle = '#131024';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.beginPath();
      ctx.ellipse(w / 2, h * 0.92, w * 0.46, h * 0.05, 0, 0, Math.PI * 2);
      ctx.fill();

      for (const d of drums) {
        d.press = Math.max(0, d.press - dt * 3.2);
        d.glow = Math.max(0, d.glow - dt * 2.2);
        const dip = 1 - 0.09 * d.press;
        const sway = 2 * Math.sin(t * 0.7 + d.fx * 4) * (1 + d.glow * 3);
        ctx.fillStyle = '#31264a';                          // shell
        ctx.beginPath();
        ctx.arc(d.x, d.y + d.r * 0.18 + sway * 0.3, d.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#221a37';                          // head
        ctx.beginPath();
        ctx.ellipse(d.x, d.y + sway * 0.3, d.r * 0.9, d.r * 0.9 * dip, 0, 0, Math.PI * 2);
        ctx.fill();
        if (d.glow > 0.01) {                                // head sheen, fading smooth
          ctx.fillStyle = `rgba(255,159,28,${(0.3 * d.glow).toFixed(3)})`;
          ctx.beginPath();
          ctx.ellipse(d.x, d.y + sway * 0.3, d.r * 0.72, d.r * 0.72 * dip, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.strokeStyle = '#ff9f1c';                        // rim
        ctx.globalAlpha = 0.7;
        ctx.lineWidth = Math.max(2, d.r * 0.07);
        ctx.beginPath();
        ctx.ellipse(d.x, d.y + sway * 0.3, d.r, d.r * dip, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.r += r.v * dt;
        r.a -= dt * 1.4;
        if (r.a <= 0) { rings.splice(i, 1); continue; }
        ctx.strokeStyle = r.color;
        ctx.globalAlpha = clamp(r.a, 0, 1);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      for (let i = chips.length - 1; i >= 0; i--) {
        const c = chips[i];
        c.vy += 620 * dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.a -= dt * 1.1;
        if (c.a <= 0 || c.y > h + 20) { chips.splice(i, 1); continue; }
        ctx.fillStyle = c.color;
        ctx.globalAlpha = clamp(c.a, 0, 1);
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
        ctx.fill();
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
