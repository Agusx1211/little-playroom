// balloons: big balloons float up from the bottom of a night sky. Tap one and it pops into confetti;
// tap the empty sky and a new balloon blows up under the finger and floats away. Never ends.

const MAX_BALLOONS = 14;
const AMBIENT = 6;           // balloons kept in the sky without any touch
const MAX_BURSTS = 8;        // popping balloons on screen at once; the oldest burst ends early
const MAX_CONFETTI = 220;
const MAX_RINGS = 20;
const HUES = [350, 25, 50, 140, 195, 220, 280, 320];

// A balloon's life, as explicit states: INFLATING (under a finger) -> RISING -> POPPING -> gone.
// A RISING balloon that leaves the top is gone too (and an ambient one comes up from below).
const Balloon = Object.freeze({ INFLATING: 'inflating', RISING: 'rising', POPPING: 'popping' });
const INFLATE_S = 0.3;
const POP_S = 0.18;

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function drawBalloon(ctx, x, y, r, hue, wobble) {
  // The string, then the body, a knot and a shine.
  ctx.strokeStyle = 'rgba(230,230,255,0.55)';
  ctx.lineWidth = Math.max(1.5, r * 0.03);
  ctx.beginPath();
  ctx.moveTo(x, y + r * 1.15);
  ctx.quadraticCurveTo(x + Math.sin(wobble) * r * 0.4, y + r * 1.7, x, y + r * 2.3);
  ctx.stroke();
  ctx.fillStyle = `hsl(${hue}, 80%, 58%)`;
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.86, r, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - r * 0.12, y + r * 1.12);
  ctx.lineTo(x + r * 0.12, y + r * 1.12);
  ctx.lineTo(x, y + r * 0.96);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.32, y - r * 0.38, r * 0.16, r * 0.26, -0.5, 0, Math.PI * 2);
  ctx.fill();
}

export default {
  id: 'balloons',
  colors: ['#f38cad', '#ffd2bd'],

  icon(ctx, size, t) {
    ctx.fillStyle = '#100c2c';
    ctx.fillRect(0, 0, size, size);
    drawBalloon(ctx, size * 0.36, size * (0.4 + 0.03 * Math.sin(t * 2)), size * 0.17, 350, t * 2);
    drawBalloon(ctx, size * 0.64, size * (0.34 + 0.03 * Math.sin(t * 2 + 1)), size * 0.15, 195, t * 2 + 1);
  },

  start(stage) {
    const ctx = stage.ctx;
    let stopped = false;
    let sinceTouch = 0, sincePop = 1;
    const short = () => Math.min(stage.width, stage.height);
    const radius = () => clamp(short() * 0.1, 40, 130);
    const balloons = [], confetti = [], rings = [];
    let nextHue = 0;

    function add(state, x, y, scale) {
      let live = 0;
      for (const b of balloons) if (b.state !== Balloon.POPPING) live++;
      if (live >= MAX_BALLOONS) {
        // Make room: the highest rising balloon pops (so a new touch always gets its balloon).
        let top = null;
        for (const b of balloons) if (b.state === Balloon.RISING && (!top || b.y < top.y)) top = b;
        if (!top) return null;
        pop(top, false);
      }
      const b = {
        state, clock: 0, x, y, size: scale, grow: state === Balloon.INFLATING ? 0.45 : 1,
        hue: HUES[nextHue++ % HUES.length], speed: 0.07 + stage.rand() * 0.05,
        phase: stage.rand() * Math.PI * 2, finger: null,
      };
      balloons.push(b);
      return b;
    }

    function ambient() {
      add(Balloon.RISING, stage.width * (0.1 + stage.rand() * 0.8), stage.height + radius() * (1.2 + stage.rand() * 2), 0.85 + stage.rand() * 0.3);
    }

    // INFLATING/RISING -> POPPING: a burst ring now, confetti when it ends.
    function pop(b, sound = true) {
      if (b.state === Balloon.POPPING) return;
      b.state = Balloon.POPPING; b.clock = 0;
      const bursts = balloons.filter(q => q.state === Balloon.POPPING);
      if (bursts.length > MAX_BURSTS) balloons.splice(balloons.indexOf(bursts[0]), 1);
      if (sound && sincePop > 0.06) { stage.audio.pop(); sincePop = 0; }
      const r = radius() * b.size * b.grow;
      for (let k = 0; k < 18 && confetti.length < MAX_CONFETTI; k++) {
        const a = stage.rand() * Math.PI * 2, v = short() * (0.25 + stage.rand() * 0.35);
        confetti.push({ x: b.x + Math.cos(a) * r * 0.5, y: b.y + Math.sin(a) * r * 0.5, vx: Math.cos(a) * v, vy: Math.sin(a) * v - short() * 0.1,
                        hue: (b.hue + (k % 3) * 40) % 360, spin: stage.rand() * 6, life: 1.6 + stage.rand() * 0.6 });
      }
    }

    function balloonAt(x, y) {
      // The nearest balloon whose body (with a generous margin for small fingers) holds the point.
      let hit = null, best = Infinity;
      for (const b of balloons) {
        if (b.state === Balloon.POPPING) continue;
        const r = radius() * b.size * b.grow * 1.2;
        const d = Math.hypot((x - b.x) / 0.86, y - b.y);
        if (d < r && d < best) { best = d; hit = b; }
      }
      return hit;
    }

    function step(b, dt, t) {
      b.clock += dt;
      switch (b.state) {
        case Balloon.INFLATING:
          b.grow = Math.min(1, 0.45 + 0.55 * b.clock / INFLATE_S);
          if (b.clock >= INFLATE_S) { b.state = Balloon.RISING; b.clock = 0; b.finger = null; stage.audio.whoosh(); }
          return true;
        case Balloon.RISING:
          b.y -= short() * b.speed * dt * (sinceTouch > 5 ? 0.8 : 1);
          b.x += Math.sin(t * 0.9 + b.phase) * short() * 0.02 * dt;
          b.x = clamp(b.x, radius() * 0.5, stage.width - radius() * 0.5);
          return b.y > -radius() * 3.5;   // gone off the top
        case Balloon.POPPING:
          return b.clock < POP_S;
      }
      return false;
    }

    for (let i = 0; i < AMBIENT; i++) {
      add(Balloon.RISING, stage.width * (0.1 + 0.8 * (i + 0.5) / AMBIENT), stage.height * (0.25 + stage.rand() * 0.7), 0.85 + stage.rand() * 0.3);
    }

    const offFrame = stage.onFrame((dt, t) => {
      if (stopped) return;
      sinceTouch += dt; sincePop += dt;
      for (let i = balloons.length - 1; i >= 0; i--) if (!step(balloons[i], dt, t)) balloons.splice(i, 1);
      let rising = 0;
      for (const b of balloons) if (b.state === Balloon.RISING) rising++;
      if (rising < AMBIENT && stage.rand() < dt * 1.2) ambient();
      for (let i = confetti.length - 1; i >= 0; i--) {
        const c = confetti[i];
        c.vy += short() * 0.5 * dt; c.vx *= Math.exp(-dt * 1.5); c.vy *= Math.exp(-dt * 1.5);
        c.x += c.vx * dt; c.y += c.vy * dt; c.spin += dt * 5; c.life -= dt;
        if (c.life <= 0 || c.y > stage.height + 20) confetti.splice(i, 1);
      }
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.r += dt * short() * 0.45; r.life -= dt * 2.2;
        if (r.life <= 0) rings.splice(i, 1);
      }

      const sky = ctx.createLinearGradient(0, 0, 0, stage.height);
      sky.addColorStop(0, '#0b0a26'); sky.addColorStop(1, '#241a4a');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, stage.width, stage.height);
      for (const b of balloons) {
        const r = radius() * b.size * b.grow;
        if (b.state === Balloon.POPPING) {
          // A burst: a bright ring that grows and fades.
          const k = b.clock / POP_S;
          ctx.globalAlpha = 1 - k;
          ctx.strokeStyle = `hsl(${b.hue}, 90%, 75%)`;
          ctx.lineWidth = Math.max(3, r * 0.12);
          ctx.beginPath();
          ctx.arc(b.x, b.y, r * (1 + k * 0.8), 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        } else {
          drawBalloon(ctx, b.x, b.y, r, b.hue, t * 2 + b.phase);
        }
      }
      for (const c of confetti) {
        ctx.globalAlpha = clamp(c.life, 0, 1);
        ctx.fillStyle = `hsl(${c.hue}, 85%, 65%)`;
        const w = short() * 0.012;
        ctx.fillRect(c.x - w / 2, c.y - w * Math.abs(Math.cos(c.spin)) / 2, w, w * Math.abs(Math.cos(c.spin)) + 1);
      }
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      for (const r of rings) {
        ctx.globalAlpha = clamp(r.life, 0, 1) * 0.5;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    });

    const offPointer = stage.onPointer({
      down(p) {
        if (stopped) return;
        sinceTouch = 0;
        const hit = balloonAt(p.x, p.y);
        if (hit) { pop(hit); return; }
        // The empty sky: a balloon blows up under the finger, with a rising note.
        if (rings.length < MAX_RINGS) rings.push({ x: p.x, y: p.y, r: short() * 0.02, life: 1 });
        const b = add(Balloon.INFLATING, p.x, p.y, 0.9 + stage.rand() * 0.25);
        if (b) { b.finger = p.id; stage.audio.note(clamp(260 + 500 * (1 - p.y / Math.max(1, stage.height)), 200, 900), 0.3); }
      },
      move(p) {
        if (stopped) return;
        // A balloon still blowing up follows its finger.
        for (const b of balloons) if (b.finger === p.id && b.state === Balloon.INFLATING) { b.x = p.x; b.y = p.y; }
      },
      up(p) {
        for (const b of balloons) if (b.finger === p.id) b.finger = null;
      },
    });

    return {
      stop() {
        stopped = true;
        for (const off of [offFrame, offPointer]) if (typeof off === 'function') off();
      },
      debug: () => ({
        entities: balloons.length + confetti.length + rings.length,
        balloons: balloons.map(b => ({ state: b.state, x: b.x, y: b.y })),
        confetti: confetti.length,
      }),
    };
  },
};
