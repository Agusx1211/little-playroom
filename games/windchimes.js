// windchimes: five tubes of different lengths hang from a driftwood bar, with a round clapper on a
// longer string among them. Touch anywhere and a gust swirls out from the finger: the near tubes swing
// with it, and when a tube swings into the clapper it rings, each tube its own bell note. Idle, a soft
// breeze wanders across the bar and the chimes play themselves, gently.

const TUBES = [523.25, 659.25, 783.99, 880.0, 1046.5];
const MAX_SWIRLS = 120;

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export default {
  id: 'windchimes',
  colors: ['#8ecae6', '#ffb703'],

  icon(ctx, size, t) {
    ctx.strokeStyle = '#7a5b3a';
    ctx.lineWidth = size * 0.05;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(size * 0.14, size * 0.16);
    ctx.quadraticCurveTo(size * 0.5, size * 0.1, size * 0.86, size * 0.16);
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const a = 0.3 * Math.sin(t * 1.4 + i * 1.6);
      const ax = size * (0.24 + 0.17 * i), ay = size * 0.15;
      const L = size * (0.3 + 0.1 * Math.abs(Math.sin(i * 2.3)));
      const bx = ax + Math.sin(a) * L, by = ay + Math.cos(a) * L;
      ctx.strokeStyle = '#cfd8dc';
      ctx.lineWidth = size * 0.014;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
      ctx.strokeStyle = i === 3 ? '#ffb703' : '#8ecae6';
      ctx.lineWidth = size * 0.05;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + Math.sin(a) * size * 0.16, by + Math.cos(a) * size * 0.16);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
  },

  start(stage) {
    const { ctx, audio } = stage;
    const swirls = [];
    const held = new Set();
    let w = 0, h = 0, idle = 0, breezeClock = 0;
    const clapper = { theta: 0, omega: 0, flash: 0 };

    const tubes = TUBES.map((freq, i) => ({ fx: 0.16 + 0.17 * i, freq,
      lenF: 0.24 + 0.055 * ((i * 7) % 4), L: 0, theta: 0, omega: 0, glow: 0, cool: 0 }));

    function sync() {
      if (stage.width === w && stage.height === h) return;
      w = stage.width; h = stage.height;
      for (const tb of tubes) tb.L = h * tb.lenF;
    }
    const anchor = (tb) => ({ x: w * tb.fx, y: h * 0.1 });
    const tip = (tb) => {
      const a = anchor(tb);
      return { x: a.x + Math.sin(tb.theta) * tb.L, y: a.y + Math.cos(tb.theta) * tb.L };
    };
    const clapperPos = () => ({ x: w * 0.5 + Math.sin(clapper.theta) * h * 0.42, y: h * 0.1 + Math.cos(clapper.theta) * h * 0.42 });

    function gust(x, y, power) {
      for (let i = 0; i < Math.round(3 + 5 * power); i++) {
        const a = stage.rand() * Math.PI * 2;
        swirls.push({ x, y, vx: Math.cos(a) * 120 * power, vy: Math.sin(a) * 120 * power - 30,
          r: 6 + stage.rand() * 16, a: 0.6, spin: (stage.rand() - 0.5) * 10 });
        if (swirls.length > MAX_SWIRLS) swirls.shift();
      }
      for (const tb of tubes) {
        const p = tip(tb);
        const d = Math.hypot(p.x - x, p.y - y);
        if (d < h * 0.6) tb.omega += clamp((p.x - x) / 90, -1.5, 1.5) * power * (1 - d / (h * 0.6)) * 2.4;
      }
      const c = clapperPos();
      const dc = Math.hypot(c.x - x, c.y - y);
      if (dc < h * 0.6) clapper.omega += clamp((c.x - x) / 120, -1, 1) * power * 1.4;
    }

    function ring(tb) {
      tb.glow = 1;
      tb.cool = 0.18;
      audio.note(tb.freq, 0.6);
      clapper.flash = 1;
      const p = tip(tb);
      swirls.push({ x: p.x, y: p.y, vx: 0, vy: -20, r: 20, a: 0.5, spin: 3 });
      if (swirls.length > MAX_SWIRLS) swirls.shift();
    }

    const offPointer = stage.onPointer({
      down(p) {
        sync();
        idle = 0; breezeClock = 0;
        held.add(p.id);
        gust(p.x, p.y, 1);
        audio.whoosh();
      },
      move(p) {
        if (!held.has(p.id)) return;
        idle = 0; breezeClock = 0;
        gust(p.x, p.y, 0.4);
      },
      up(p) { held.delete(p.id); },
    });

    const offFrame = stage.onFrame((dt, t) => {
      sync();
      idle += dt;
      if (idle > 5) {                                       // the wandering house breeze
        breezeClock += dt;
        if (breezeClock > 2.6) {
          breezeClock = 0;
          gust(w * (0.2 + stage.rand() * 0.6), h * (0.3 + stage.rand() * 0.3), 0.55);
          audio.whoosh();
        }
      }

      ctx.fillStyle = '#0f1a2b';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = '#7a5b3a';                          // the driftwood bar
      ctx.lineWidth = Math.max(4, h * 0.014);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(w * 0.08, h * 0.1);
      ctx.quadraticCurveTo(w * 0.5, h * 0.06, w * 0.92, h * 0.1);
      ctx.stroke();
      ctx.lineCap = 'butt';

      clapper.omega += (-9.5 / (h * 0.42) * 22 * Math.sin(clapper.theta) - 0.9 * clapper.omega) * dt;
      clapper.theta += clapper.omega * dt;
      clapper.flash = Math.max(0, clapper.flash - dt * 3);
      const c = clapperPos();
      const cR = Math.min(w, h) * 0.055;
      {
        const a = anchor(tubes[2]);
        ctx.strokeStyle = '#90a4ae';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(w * 0.5, a.y);
        ctx.lineTo(c.x, c.y);
        ctx.stroke();
        ctx.fillStyle = '#ffb703';
        ctx.globalAlpha = 0.85 + 0.15 * clapper.flash;
        ctx.beginPath();
        ctx.arc(c.x, c.y, cR * (1 + 0.35 * clapper.flash), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      for (const tb of tubes) {                             // swinging pendulums
        tb.omega += (-7.6 * Math.sin(tb.theta) - 1.05 * tb.omega) * dt;
        tb.theta += tb.omega * dt;
        tb.glow = Math.max(0, tb.glow - dt * 1.8);
        tb.cool = Math.max(0, tb.cool - dt);
        const a = anchor(tb), p = tip(tb);
        ctx.strokeStyle = '#cfd8dc';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        const tubeR = Math.min(w, h) * 0.02;
        const tx = p.x + Math.sin(tb.theta) * tb.L * 0.28, ty = p.y + Math.cos(tb.theta) * tb.L * 0.28;
        ctx.strokeStyle = tb.glow > 0.02 ? '#e0f7fa' : '#8ecae6';
        ctx.lineWidth = tubeR * 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.lineCap = 'butt';
        // A resting tube may already touch the clapper. Sound requires an impact.
        const moving = Math.abs(tb.omega - clapper.omega) > 0.05;
        if (moving && tb.cool === 0 && Math.hypot(tx - c.x, ty - c.y) < cR + tubeR * 1.6) {
          const away = Math.sign(tb.theta || stage.rand() - 0.5) || 1;
          tb.omega += away * 1.2;                           // the tube bounces off the clapper
          clapper.omega -= away * 0.5;
          ring(tb);
        }
      }

      for (let i = swirls.length - 1; i >= 0; i--) {        // visible gust air
        const s = swirls[i];
        s.a -= dt * 0.8;
        if (s.a <= 0) { swirls.splice(i, 1); continue; }
        ctx.strokeStyle = '#b3e5fc';
        ctx.globalAlpha = clamp(s.a, 0, 1) * 0.5;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, s.spin * s.a * 4, s.spin * s.a * 4 + 2.1);
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
