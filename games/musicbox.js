// musicbox: a wooden music box on a dark table, a steel comb of twelve teeth and a pinned cylinder
// turning beside it. Every tap winds the spring — the cylinder speeds up and the pins walk their little
// melody, plucking the teeth, which keep wobbling as the sound fades out. Touch a tooth directly and it
// rings on its own. Idle and wound down, the box starts itself up again and plays a bar, soft and slow.

const TEETH = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
const MELODY = [0, null, 4, 5, null, 3, null, 2, 0, null, 2, 4, null, 3, null, null];
const STEPS = MELODY.length;
const MAX_RINGS = 16;

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export default {
  id: 'musicbox',
  colors: ['#d4a373', '#e9c46a'],

  icon(ctx, size, t) {
    const bx = size * 0.18, by = size * 0.62, bw = size * 0.64, bh = size * 0.22;
    ctx.fillStyle = '#8d6e63';
    ctx.beginPath();
    ctx.roundRect(bx, by, bw, bh, size * 0.03);
    ctx.fill();
    for (let i = 0; i < 7; i++) {
      const wob = 0.08 * size * Math.sin(t * 6 + i * 1.3) * Math.max(0, Math.sin(t * 1.7 - i * 0.6));
      ctx.strokeStyle = i % 2 ? '#e9c46a' : '#cfcfcf';
      ctx.lineWidth = size * 0.022;
      ctx.beginPath();
      ctx.moveTo(bx + size * 0.07 + i * size * 0.08, by);
      ctx.lineTo(bx + size * 0.07 + i * size * 0.08 + wob, by - size * (0.16 + 0.05 * (i % 3)));
      ctx.stroke();
    }
    const cx = bx + bw * 0.78, cy = by - size * 0.02, cr = size * 0.1;
    ctx.strokeStyle = '#a1887f';
    ctx.lineWidth = size * 0.02;
    ctx.beginPath();
    ctx.ellipse(cx, cy, cr, cr * 0.45, 0, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const a = t * 2 + (i / 5) * Math.PI * 2;
      if (Math.cos(a) < 0) continue;
      ctx.fillStyle = '#fff8e1';
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * cr * 0.75, cy + Math.sin(a) * cr * 0.35, size * 0.016, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  start(stage) {
    const { ctx, audio } = stage;
    const rings = [];
    const teeth = TEETH.map((freq, i) => ({ freq, amp: 0, phase: 0, i }));
    let w = 0, h = 0, boxX = 0, boxY = 0, boxW = 0, boxH = 0, cylX = 0, cylY = 0, cylR = 0;
    let spin = 0, theta = 0, stepMark = 0, stepIndex = 0;
    let idle = 0;

    function sync() {
      if (stage.width === w && stage.height === h) return;
      w = stage.width; h = stage.height;
      boxW = Math.min(w * 0.8, h * 1.5);
      boxH = Math.min(w, h) * 0.22;
      boxX = (w - boxW) / 2;
      boxY = h * 0.66;
      cylX = boxX + boxW * 0.76;
      cylY = boxY - boxH * 0.1;
      cylR = boxH * 0.55;
    }

    function pluck(j, strength) {
      const tooth = teeth[j % teeth.length];
      tooth.amp = Math.max(tooth.amp, strength);
      tooth.phase = stage.rand() * Math.PI * 2;
      audio.note(tooth.freq, 0.4 + 0.4 * strength);
    }

    function wind(power) {
      spin = clamp(spin + 3.2 * power, 0, 9);
      audio.pop();
      if (rings.length >= MAX_RINGS) rings.shift();
    }

    const toothX = (j) => boxX + boxW * (0.08 + 0.42 * (j / (teeth.length - 1)));

    const offPointer = stage.onPointer({
      down(p) {
        sync();
        idle = 0;
        const combY = boxY - boxH * 0.1;
        let best = 0, bd = Infinity;
        for (let j = 0; j < teeth.length; j++) {
          const d = Math.hypot(p.x - toothX(j), p.y - combY);
          if (d < bd) { bd = d; best = j; }
        }
        if (bd < Math.min(w, h) * 0.09) {
          pluck(best, 1);                                   // a tooth plucked by hand
        } else {
          wind(1);                                          // anywhere else: wind it up
          rings.push({ x: p.x, y: p.y, r: 8, v: 220, a: 0.5 });
        }
      },
    });

    const offFrame = stage.onFrame((dt, t) => {
      sync();
      idle += dt;
      if (idle > 5 && spin < 0.6) spin += 0.4 * dt;         // the spring starts itself back up
      spin *= Math.exp(-0.16 * dt);
      theta += spin * dt;

      while (theta - stepMark >= (Math.PI * 2) / STEPS) {   // pins pass the comb
        stepMark += (Math.PI * 2) / STEPS;
        const note = MELODY[stepIndex++ % STEPS];
        if (note !== null) pluck(note, clamp(0.35 + spin / 12, 0.35, 1));
      }

      ctx.fillStyle = '#131022';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.beginPath();
      ctx.ellipse(w / 2, h * 0.92, w * 0.42, h * 0.04, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#8d6e63';                            // the wooden box
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, boxH * 0.14);
      ctx.fill();
      ctx.fillStyle = '#6d4c41';
      ctx.beginPath();
      ctx.roundRect(boxX, boxY + boxH * 0.62, boxW, boxH * 0.38, boxH * 0.14);
      ctx.fill();

      const combY = boxY - boxH * 0.1;                      // the comb, teeth wobbling after a pluck
      ctx.fillStyle = '#a1887f';
      ctx.beginPath();
      ctx.roundRect(boxX + boxW * 0.04, combY, boxW * 0.48, boxH * 0.16, boxH * 0.06);
      ctx.fill();
      for (let j = 0; j < teeth.length; j++) {
        const tooth = teeth[j];
        tooth.amp = Math.max(0, tooth.amp - dt * (0.8 + tooth.amp));
        const len = Math.min(w, h) * (0.15 + 0.012 * ((teeth.length - j) % 4));
        const wob = tooth.amp * Math.min(w, h) * 0.03 * Math.sin(t * 15 + tooth.phase);
        ctx.strokeStyle = tooth.amp > 0.03 ? '#fff8e1' : '#cfcfcf';
        ctx.lineWidth = Math.max(2, boxW * 0.012);
        ctx.beginPath();
        ctx.moveTo(toothX(j), combY);
        ctx.quadraticCurveTo(toothX(j) + wob * 0.5, combY - len * 0.5, toothX(j) + wob, combY - len);
        ctx.stroke();
      }

      ctx.save();                                           // the pinned cylinder, turning
      ctx.translate(cylX, cylY);
      ctx.strokeStyle = '#a1887f';
      ctx.lineWidth = Math.max(3, boxH * 0.08);
      ctx.beginPath();
      ctx.ellipse(0, 0, cylR, cylR * 0.42, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#5d4037';
      ctx.beginPath();
      ctx.ellipse(0, 0, cylR * 0.86, cylR * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff8e1';
      for (let i = 0; i < 10; i++) {
        const a = theta + (i / 10) * Math.PI * 2;
        if (Math.cos(a) > 0) {
          ctx.beginPath();
          ctx.arc(Math.cos(a) * cylR * 0.72, Math.sin(a) * cylR * 0.28, Math.max(2, boxW * 0.008), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      for (let i = rings.length - 1; i >= 0; i--) {         // the winding clicks
        const r = rings[i];
        r.r += r.v * dt;
        r.a -= dt * 1.4;
        if (r.a <= 0) { rings.splice(i, 1); continue; }
        ctx.strokeStyle = '#e9c46a';
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
      },
    };
  },
};
