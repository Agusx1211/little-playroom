// harp: a great golden harp fills the dark stage, thirteen strings from the curved neck to the base.
// A finger running across them glissandos; a touch plucks the nearest string and it visibly vibrates,
// damping out, with sparks where it was touched. Idle, a slow hand plays the strings one after another.

const NOTES = [261.6, 293.7, 329.6, 392.0, 440.0, 523.3, 587.3, 659.3, 784.0, 880.0, 1046.5, 1174.7, 1318.5];
const MAX_SPARKS = 220;
const SEGMENTS = 8;

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function build(width, height) {
  const n = NOTES.length;
  return NOTES.map((freq, i) => {
    const x = width * (0.08 + (0.84 * i) / (n - 1));
    return { x, freq, topY: height * (0.3 - 0.16 * (i / (n - 1))) + height * 0.06,
      botY: height * 0.9, amp: 0, phase: 0, flash: 0, lastPluck: -10 };
  });
}

export default {
  id: 'harp',
  colors: ['#ffd60a', '#9d4edd'],

  icon(ctx, size, t) {
    ctx.strokeStyle = '#8c5a2b';
    ctx.lineWidth = size * 0.06;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(size * 0.22, size * 0.86);
    ctx.quadraticCurveTo(size * 0.16, size * 0.3, size * 0.78, size * 0.2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(size * 0.22, size * 0.86);
    ctx.lineTo(size * 0.68, size * 0.86);
    ctx.stroke();
    ctx.lineWidth = size * 0.016;
    for (let i = 0; i < 5; i++) {
      const f = i / 4;
      const x = size * (0.3 + 0.32 * f);
      const top = size * (0.62 - 0.4 * f);
      const wob = 0.16 * size * Math.sin(t * 5 + i) * Math.exp(-((t * 0.9 + i * 0.4) % 2.4) * 1.2)
        * (i === 1 ? 1 : 0.18);
      ctx.strokeStyle = i === 1 ? '#ffd60a' : '#c9a86b';
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.quadraticCurveTo(x + wob, (top + size * 0.86) / 2, x, size * 0.86);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
  },

  start(stage) {
    const { ctx, audio } = stage;
    let w = 0, h = 0, strings = [];
    const sparks = [];
    const held = new Map();
    let idle = 0, playClock = 0, playStep = 0, clock = 0;

    function sync() {
      if (stage.width === w && stage.height === h) return;
      w = stage.width; h = stage.height;
      strings = build(w, h);
    }

    function pluck(s, y, strength, t) {
      s.amp = Math.max(s.amp, strength);
      s.phase = stage.rand() * Math.PI * 2;
      s.flash = 1;
      s.lastPluck = t;
      audio.note(s.freq, 0.3 + 0.5 * strength);
      const n = 4 + Math.round(6 * strength);
      for (let i = 0; i < n; i++) {
        const a = stage.rand() * Math.PI * 2;
        const sp = (30 + stage.rand() * 140) * (0.5 + strength);
        sparks.push({ x: s.x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
          a: 0.9, r: 2 + stage.rand() * 3.4, color: stage.rand() < 0.6 ? '#ffd60a' : '#fff3b0' });
        if (sparks.length > MAX_SPARKS) sparks.shift();
      }
    }

    function nearest(x) {
      let best = strings[0], bd = Infinity;
      for (const s of strings) {
        const d = Math.abs(x - s.x);
        if (d < bd) { bd = d; best = s; }
      }
      return best;
    }
    const spacing = () => (w * 0.84) / (NOTES.length - 1);

    const offPointer = stage.onPointer({
      down(p) {
        idle = 0; playClock = 0;
        held.set(p.id, { x: p.x, y: p.y, t: clock });
        const s = nearest(p.x);
        pluck(s, clamp(p.y, s.topY, s.botY), clamp(1 - Math.abs(p.x - s.x) / spacing(), 0.35, 1), clock);
      },
      move(p) {
        const prev = held.get(p.id);
        if (!prev) return;
        idle = 0; playClock = 0;
        const t = clock;
        for (const s of strings) {                    // glissando: crossing a string's x plucks it
          if ((prev.x - s.x) * (p.x - s.x) < 0 && p.y > s.topY - 30 && p.y < s.botY + 30
            && t - s.lastPluck > 0.09) pluck(s, p.y, 0.5, t);
        }
        prev.x = p.x; prev.y = p.y;
      },
      up(p) { held.delete(p.id); },
    });

    const offFrame = stage.onFrame((dt, t) => {
      clock = t;
      sync();
      idle += dt;
      if (idle > 5) {                                // a slow hand travels the strings
        playClock += dt;
        if (playClock > 0.85) {
          playClock = 0;
          const s = strings[playStep++ % strings.length];
          pluck(s, (s.topY + s.botY) / 2, 0.35, t);
        }
      }

      ctx.fillStyle = '#14122a';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = '#8c5a2b';                   // the neck, curved
      ctx.lineWidth = Math.max(6, w * 0.018);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(w * 0.05, h * 0.38);
      ctx.quadraticCurveTo(w * 0.04, h * 0.08, w * 0.95, h * 0.12);
      ctx.stroke();
      ctx.fillStyle = '#6f4318';                     // the soundbox base
      ctx.beginPath();
      ctx.roundRect(w * 0.05, h * 0.9, w * 0.9, h * 0.05, h * 0.025);
      ctx.fill();
      ctx.lineCap = 'butt';

      for (const s of strings) {                     // the strings, vibrating where plucked
        s.amp = Math.max(0, s.amp - dt * (0.9 + s.amp));
        s.flash = Math.max(0, s.flash - dt * 2.5);
        const sway = s.amp * (w * 0.018) * Math.sin(t * (7 + s.freq / 260) + s.phase);
        ctx.strokeStyle = s.amp > 0.02 ? '#ffe066' : '#b99a63';
        ctx.globalAlpha = 0.75 + 0.25 * s.flash;
        ctx.lineWidth = Math.max(1, 1.5 + 3 * s.amp);
        ctx.beginPath();
        ctx.moveTo(s.x, s.topY);
        for (let k = 1; k <= SEGMENTS; k++) {
          const f = k / SEGMENTS;
          ctx.lineTo(s.x + sway * Math.sin(Math.PI * f), s.topY + (s.botY - s.topY) * f);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i];
        p.vy += 260 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.a -= dt * 1.5;
        if (p.a <= 0) { sparks.splice(i, 1); continue; }
        ctx.fillStyle = p.color;
        ctx.globalAlpha = clamp(p.a, 0, 1);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
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
