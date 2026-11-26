// cymbals: two golden cymbals face each other across the dark stage. Touch one and it tilts and pings,
// a shimmer of light rolling over it; touch between them and they CLASH — they leap together, flash, and
// spray golden sparks with a crash. Idle, they float, and every few seconds they clap once, softly.

const MAX_SPARKS = 240;

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export default {
  id: 'cymbals',
  colors: ['#ffbf69', '#e76f51'],

  icon(ctx, size, t) {
    const phase = (t % 2.6) / 2.6;
    const gap = 0.24 + 0.16 * Math.cos(phase * Math.PI * 2);   // one slow clap per cycle
    const flash = Math.max(0, 1 - phase * 6);
    for (const side of [-1, 1]) {
      const cx = size * (0.5 + side * gap);
      ctx.fillStyle = '#ffbf69';
      ctx.beginPath();
      ctx.ellipse(cx, size * 0.52, size * 0.17, size * 0.14, side * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#c98a2e';
      ctx.beginPath();
      ctx.arc(cx, size * 0.52, size * 0.045, 0, Math.PI * 2);
      ctx.fill();
    }
    if (flash > 0.01) {
      ctx.strokeStyle = `rgba(255,255,255,${(flash * 0.8).toFixed(3)})`;
      ctx.lineWidth = size * 0.04;
      ctx.beginPath();
      ctx.arc(size * 0.5, size * 0.52, size * (0.2 + 0.2 * (1 - flash)), 0, Math.PI * 2);
      ctx.stroke();
    }
  },

  start(stage) {
    const { ctx, audio } = stage;
    const sparks = [];
    const cymbals = [{ s: -1, tilt: 0, tiltV: 0, flash: 0, roll: 0 }, { s: 1, tilt: 0, tiltV: 0, flash: 0, roll: 0 }];
    let w = 0, h = 0, cx = 0, cy = 0, r = 0, clash = 0, idle = 0, clapClock = 0;

    function sync() {
      if (stage.width === w && stage.height === h) return;
      w = stage.width; h = stage.height;
      cx = w / 2; cy = h * 0.56;
      r = Math.min(w, h) * 0.24;
    }

    function center(c) {
      const squeeze = clash * r * 0.42;
      return { x: cx + c.s * (r * 1.28 - squeeze), y: cy };
    }

    function burst(x, y, n, power, hue) {
      for (let i = 0; i < n; i++) {
        const a = stage.rand() * Math.PI * 2;
        const sp = (60 + stage.rand() * 330) * (0.4 + power);
        sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 90,
          a: 0.95, r: 2 + stage.rand() * 4, color: hue });
        if (sparks.length > MAX_SPARKS) sparks.shift();
      }
    }

    function strike(c, x, strength) {
      c.tiltV += -c.s * (3 + 6 * strength);
      c.flash = Math.max(c.flash, strength);
      c.roll = 1;
      audio.note(c.s < 0 ? 990 : 1175, 0.55);
      const p = center(c);
      burst(p.x + (x - p.x) * 0.4, p.y, Math.round(4 + 8 * strength), 0.5 * strength, '#ffe08a');
    }

    function clashHit(x, strength) {
      clash = Math.max(clash, strength);
      for (const c of cymbals) { c.flash = Math.max(c.flash, strength); c.tiltV += -c.s * 4 * strength; }
      audio.note(880, 0.7);
      audio.note(1175, 0.5);
      audio.whoosh();
      burst(x ?? cx, cy, Math.round(14 + 22 * strength), 1, '#ffd166');
      burst(cx, cy, 8, 0.6, '#fff3b0');
    }

    const offPointer = stage.onPointer({
      down(p) {
        idle = 0; clapClock = 0;
        sync();
        const dl = Math.hypot(p.x - center(cymbals[0]).x, p.y - cy);
        const dr = Math.hypot(p.x - center(cymbals[1]).x, p.y - cy);
        const near = Math.min(dl, dr);
        if (near < r * 1.25) strike(dl < dr ? cymbals[0] : cymbals[1], p.x, clamp(1 - near / (r * 1.25), 0.4, 1));
        else if (Math.abs(p.x - cx) < r * 1.9 && Math.abs(p.y - cy) < r * 2) clashHit(p.x, 0.9);
        else {                                          // anywhere else: the nearer one answers
          strike(dl < dr ? cymbals[0] : cymbals[1], p.x, 0.45);
          audio.pop();
        }
      },
    });

    const offFrame = stage.onFrame((dt, t) => {
      sync();
      idle += dt;
      clash = Math.max(0, clash - dt * 3);
      if (idle > 5) {                                   // a soft self-clap every few seconds
        clapClock += dt;
        if (clapClock > 3.4) { clapClock = 0; clashHit(cx, 0.5); }
      }

      ctx.fillStyle = '#120f22';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.beginPath();
      ctx.ellipse(cx, h * 0.9, w * 0.4, h * 0.04, 0, 0, Math.PI * 2);
      ctx.fill();

      for (const c of cymbals) {                        // springy tilt, damped
        c.tiltV += (-14 * c.tilt - 3.2 * c.tiltV) * dt;
        c.tilt += c.tiltV * dt;
        c.flash = Math.max(0, c.flash - dt * 2.2);
        c.roll = Math.max(0, c.roll - dt * 1.4);
        const p = center(c);
        const bob = Math.sin(t * 0.9 + c.s) * r * 0.04;
        const squash = 0.55 + 0.45 * Math.abs(Math.cos(c.tilt));
        ctx.save();
        ctx.translate(p.x, p.y + bob);
        ctx.rotate(c.s * clamp(c.tilt, -1.2, 1.2) * 0.18);
        ctx.fillStyle = '#ffbf69';
        ctx.beginPath();
        ctx.ellipse(0, 0, r, r * squash, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(120,70,10,0.5)';        // lathe grooves
        ctx.lineWidth = 2;
        for (const f of [0.35, 0.6, 0.85]) {
          ctx.beginPath();
          ctx.ellipse(0, 0, r * f, r * squash * f, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.fillStyle = '#c98a2e';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.17, 0, Math.PI * 2);
        ctx.fill();
        if (c.roll > 0.01) {                            // shimmer rolling over the face
          const a = -1.1 + (1 - c.roll) * 2.2;
          ctx.strokeStyle = `rgba(255,255,255,${(0.5 * c.roll).toFixed(3)})`;
          ctx.lineWidth = r * 0.14;
          ctx.beginPath();
          ctx.ellipse(0, 0, r * 0.72, r * squash * 0.72, 0, a, a + 0.9);
          ctx.stroke();
        }
        if (c.flash > 0.01) {
          ctx.fillStyle = `rgba(255,255,255,${(0.4 * c.flash).toFixed(3)})`;
          ctx.beginPath();
          ctx.ellipse(0, 0, r * 0.9, r * squash * 0.9, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.vy += 560 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.a -= dt * 1.2;
        if (s.a <= 0 || s.y > h + 16) { sparks.splice(i, 1); continue; }
        ctx.fillStyle = s.color;
        ctx.globalAlpha = clamp(s.a, 0, 1);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
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
