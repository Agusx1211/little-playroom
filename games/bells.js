// bells: five golden handbells hang from a rail on quiet ropes. Touch a bell and it swings like a
// pendulum, glows, and sends out wide rings of sound; each bell is a different note, rising left to
// right. A touch between the bells pops a small sparkle ring where the finger is. Idle, a soft breeze
// rocks them and one chimes now and then.

const BELLS = [523.25, 587.33, 659.25, 783.99, 880.0];
const MAX_RINGS = 30;

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function build(width, height) {
  const L = Math.min(width, height) * 0.38;
  const r = Math.min(width, height) * 0.085;
  return BELLS.map((freq, i) => ({
    ax: width * (0.14 + 0.18 * i), ay: height * 0.07 + Math.abs(i - 2) * height * 0.015,
    L, r, freq, theta: 0, omega: 0, glow: 0, tint: i % 2 ? '#ffd166' : '#ffb703',
  }));
}

export default {
  id: 'bells',
  colors: ['#ffd166', '#3a86ff'],

  icon(ctx, size, t) {
    ctx.strokeStyle = '#8a6d3b';
    ctx.lineWidth = size * 0.05;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(size * 0.16, size * 0.16);
    ctx.lineTo(size * 0.84, size * 0.16);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      const a = 0.34 * Math.sin(t * 1.7 + i * 1.9);
      const ax = size * (0.28 + 0.22 * i), ay = size * 0.16, L = size * 0.36;
      const bx = ax + Math.sin(a) * L, by = ay + Math.cos(a) * L;
      ctx.strokeStyle = '#c9b28a';
      ctx.lineWidth = size * 0.02;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.fillStyle = i === 1 ? '#ffd166' : '#ffb703';
      ctx.beginPath();
      ctx.arc(bx, by, size * 0.11, Math.PI, 0);
      ctx.lineTo(bx + size * 0.14, by + size * 0.06);
      ctx.lineTo(bx - size * 0.14, by + size * 0.06);
      ctx.closePath();
      ctx.fill();
    }
    ctx.lineCap = 'butt';
  },

  start(stage) {
    const { ctx, audio } = stage;
    let w = 0, h = 0, bells = [];
    const rings = [];
    const held = new Set();
    let idle = 0, chimeClock = 0, chimeStep = 0;

    function sync() {
      if (stage.width === w && stage.height === h) return;
      w = stage.width; h = stage.height;
      bells = build(w, h);
    }
    const pos = (b) => ({ x: b.ax + Math.sin(b.theta) * b.L, y: b.ay + Math.cos(b.theta) * b.L });

    function strike(b, x, strength) {
      b.omega += clamp((x - pos(b).x) / b.r, -2, 2) * (1.4 + 2.2 * strength);
      b.glow = Math.max(b.glow, strength);
      audio.note(b.freq, 0.5 + 0.2 * strength);
      const p = pos(b);
      rings.push({ x: p.x, y: p.y, r: b.r, v: b.r * 3.2, a: 0.5 * strength, color: b.tint });
      if (rings.length > MAX_RINGS) rings.shift();
    }

    function tap(x, y) {
      idle = 0; chimeClock = 0;
      let best = null, bestD = Infinity;
      for (const b of bells) {
        const p = pos(b);
        const d = Math.hypot(x - p.x, y - p.y);
        if (d < bestD) { bestD = d; best = b; }
      }
      if (best && bestD < best.r * 1.7) strike(best, x, clamp(1 - bestD / (best.r * 1.7), 0.4, 1));
      else {
        audio.pop();
        rings.push({ x, y, r: 5, v: 110, a: 0.4, color: '#8ea6ff' });
        if (rings.length > MAX_RINGS) rings.shift();
      }
    }

    const offPointer = stage.onPointer({
      down(p) { held.add(p.id); tap(p.x, p.y); },
      up(p) { held.delete(p.id); },
    });

    const offFrame = stage.onFrame((dt, t) => {
      sync();
      idle += dt;
      if (idle > 5) {                                  // breeze and an occasional self-chime
        for (const b of bells) b.omega += (stage.rand() - 0.5) * 0.5 * dt;
        chimeClock += dt;
        if (chimeClock > 2.4) {
          chimeClock = 0;
          const b = bells[(chimeStep++ % bells.length)];
          b.omega += 0.9;
          b.glow = Math.max(b.glow, 0.4);
          audio.note(b.freq, 0.6);
          const p = pos(b);
          rings.push({ x: p.x, y: p.y, r: b.r, v: b.r * 2, a: 0.28, color: b.tint });
          if (rings.length > MAX_RINGS) rings.shift();
        }
      }

      ctx.fillStyle = '#101830';
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = '#43331f';                       // the rail
      ctx.beginPath();
      ctx.roundRect(w * 0.06, h * 0.04, w * 0.88, h * 0.035, h * 0.02);
      ctx.fill();

      for (const b of bells) {                         // pendulum physics, damped
        b.omega += (-22 / b.L * Math.sin(b.theta) - 1.15 * b.omega) * dt;
        b.theta += b.omega * dt;
        b.glow = Math.max(0, b.glow - dt * 1.6);
        const p = pos(b);
        ctx.strokeStyle = '#c9b28a';
        ctx.lineWidth = Math.max(1.5, b.r * 0.06);
        ctx.beginPath();
        ctx.moveTo(b.ax, b.ay);
        ctx.lineTo(p.x, p.y - b.r * 0.8);
        ctx.stroke();
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(b.theta * 0.55);
        ctx.fillStyle = b.tint;                        // the bell body
        ctx.beginPath();
        ctx.arc(0, -b.r * 0.2, b.r * 0.92, Math.PI, 0);
        ctx.lineTo(b.r * 1.12, b.r * 0.55);
        ctx.quadraticCurveTo(0, b.r * 0.86, -b.r * 1.12, b.r * 0.55);
        ctx.closePath();
        ctx.fill();
        if (b.glow > 0.01) {
          ctx.fillStyle = `rgba(255,255,255,${(0.45 * b.glow).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(-b.r * 0.34, -b.r * 0.42, b.r * 0.26, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#6d5124';
        ctx.beginPath();                               // the clapper
        ctx.arc(0, b.r * 0.8, b.r * 0.17, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.r += r.v * dt;
        r.a -= dt * 1.1;
        if (r.a <= 0) { rings.splice(i, 1); continue; }
        ctx.strokeStyle = r.color;
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
