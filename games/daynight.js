// daynight: drag the sun. High up it is (a soft, dim) day; pull it down past the hills and the sky
// turns to night, the moon comes up and the stars and fireflies come out. Other fingers sparkle.

const STARS = 90;
const FIREFLIES = 18;
const MAX_SPARKS = 60;

// The sky's phase, as explicit states with hysteresis (no flicker at a boundary).
const Sky = Object.freeze({ DAY: 'day', DUSK: 'dusk', NIGHT: 'night' });

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function mix(a, b, k) { return a + (b - a) * k; }
function rgb(c1, c2, k) { return `rgb(${Math.round(mix(c1[0], c2[0], k))}, ${Math.round(mix(c1[1], c2[1], k))}, ${Math.round(mix(c1[2], c2[2], k))})`; }

// Night and (muted, for a dark cabin) day colours of the sky, top and bottom, and of the hills.
const NIGHT_TOP = [7, 10, 34], DAY_TOP = [52, 98, 150];
const NIGHT_LOW = [22, 28, 66], DAY_LOW = [120, 160, 190];
const HILL_NIGHT = [10, 22, 24], HILL_DAY = [46, 112, 72];

export default {
  id: 'daynight',
  colors: ['#ffd166', '#1d2b64'],

  icon(ctx, size, t) {
    const k = (Math.sin(t * 0.8) + 1) / 2;   // 1 = day
    ctx.fillStyle = rgb(NIGHT_TOP, DAY_TOP, k);
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(size * 0.5, size * mix(0.85, 0.25, k), size * 0.13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = rgb(HILL_NIGHT, HILL_DAY, k);
    ctx.beginPath();
    ctx.ellipse(size * 0.5, size * 1.05, size * 0.8, size * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
  },

  start(stage) {
    const ctx = stage.ctx;
    let stopped = false;
    let sinceTouch = 0, idleClock = 0;
    let sky = Sky.DAY;
    const short = () => Math.min(stage.width, stage.height);
    const horizon = () => stage.height * 0.72;
    const sunR = () => short() * 0.09;
    const sun = { x: stage.width * 0.3, y: stage.height * 0.25, tx: stage.width * 0.3, ty: stage.height * 0.25 };
    let leader = null;   // the finger the sun follows
    const fingers = new Map();
    const stars = Array.from({ length: STARS }, () => ({ x: stage.rand(), y: stage.rand() * 0.65, r: 0.6 + stage.rand() * 1.5, p: stage.rand() * 6 }));
    const flies = Array.from({ length: FIREFLIES }, () => ({ x: stage.rand(), y: 0.72 + stage.rand() * 0.25, p: stage.rand() * 6 }));
    const sparks = [];

    /** 1 = full day (sun high), 0 = night (sun at or below the horizon). */
    function daylight() { return clamp((horizon() - sun.y) / (horizon() - stage.height * 0.12), 0, 1); }

    // DAY <-> DUSK <-> NIGHT on the daylight level, with a margin so a sun held on a boundary
    // does not flip back and forth; each change plays a soft chime.
    function stepSky() {
      const k = daylight();
      const before = sky;
      switch (sky) {
        case Sky.DAY: if (k < 0.45) sky = Sky.DUSK; break;
        case Sky.DUSK: if (k > 0.55) sky = Sky.DAY; else if (k < 0.12) sky = Sky.NIGHT; break;
        case Sky.NIGHT: if (k > 0.2) sky = Sky.DUSK; break;
      }
      if (sky !== before) stage.audio.note(sky === Sky.NIGHT ? 392 : sky === Sky.DAY ? 784 : 523.25, 0.6);
    }

    function sparkle(x, y) {
      for (let k = 0; k < 6 && sparks.length < MAX_SPARKS; k++) {
        const a = stage.rand() * Math.PI * 2, v = short() * (0.1 + stage.rand() * 0.15);
        sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.8 });
      }
    }

    const offFrame = stage.onFrame((dt, t) => {
      if (stopped) return;
      sinceTouch += dt;
      if (leader === null && sinceTouch > 5) {
        // Idle: the sun travels a slow arc, rising and setting, about a minute a day.
        idleClock += dt;
        const a = (idleClock / 60) * Math.PI * 2 + Math.PI;
        sun.tx = stage.width * (0.5 + 0.38 * Math.cos(a));
        sun.ty = horizon() + Math.sin(a) * stage.height * 0.55;
      }
      sun.tx = clamp(sun.tx, sunR(), stage.width - sunR());
      sun.ty = clamp(sun.ty, stage.height * 0.1, horizon() + sunR() * 1.6);
      const ease = Math.min(1, dt * (leader === null ? 2 : 14));
      sun.x += (sun.tx - sun.x) * ease; sun.y += (sun.ty - sun.y) * ease;
      stepSky();
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= 0.95; s.vy *= 0.95; s.life -= dt;
        if (s.life <= 0) sparks.splice(i, 1);
      }

      const k = daylight();
      const g = ctx.createLinearGradient(0, 0, 0, horizon());
      g.addColorStop(0, rgb(NIGHT_TOP, DAY_TOP, k)); g.addColorStop(1, rgb(NIGHT_LOW, DAY_LOW, k));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, stage.width, stage.height);
      // Stars and the moon come out as the light goes.
      const night = 1 - clamp(k * 1.8, 0, 1);
      if (night > 0) {
        ctx.fillStyle = '#ffffff';
        for (const s of stars) {
          ctx.globalAlpha = night * clamp(0.45 + 0.3 * Math.sin(t * 0.8 + s.p), 0, 1);
          ctx.beginPath();
          ctx.arc(s.x * stage.width, s.y * stage.height, s.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = night;
        const mx = stage.width - sun.x, my = mix(horizon(), stage.height * 0.2, night);
        ctx.fillStyle = '#f2f0d4';
        ctx.beginPath();
        ctx.arc(mx, my, sunR() * 0.75, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = rgb(NIGHT_TOP, DAY_TOP, k);
        ctx.beginPath();
        ctx.arc(mx + sunR() * 0.3, my - sunR() * 0.15, sunR() * 0.62, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      // The sun, with slow turning rays.
      ctx.save();
      ctx.translate(sun.x, sun.y);
      ctx.rotate(t * 0.2);
      ctx.fillStyle = 'rgba(255, 209, 102, 0.35)';
      for (let r = 0; r < 10; r++) {
        ctx.rotate(Math.PI / 5);
        ctx.beginPath();
        ctx.moveTo(sunR() * 1.15, -sunR() * 0.12);
        ctx.lineTo(sunR() * 1.6, 0);
        ctx.lineTo(sunR() * 1.15, sunR() * 0.12);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(sun.x, sun.y, sunR(), 0, Math.PI * 2);
      ctx.fill();
      // Hills in front of the sun, so it sets behind them.
      ctx.fillStyle = rgb(HILL_NIGHT, HILL_DAY, k);
      ctx.beginPath();
      ctx.moveTo(0, stage.height);
      ctx.lineTo(0, horizon());
      for (let x = 0; x <= stage.width; x += stage.width / 24) {
        ctx.lineTo(x, horizon() - Math.sin(x / stage.width * Math.PI * 2.5) * stage.height * 0.035);
      }
      ctx.lineTo(stage.width, stage.height);
      ctx.closePath();
      ctx.fill();
      if (night > 0.3) {
        ctx.fillStyle = '#e9ff8a';
        for (const f of flies) {
          ctx.globalAlpha = (night - 0.3) * clamp(0.5 + 0.5 * Math.sin(t * 1.3 + f.p), 0, 1);
          ctx.beginPath();
          ctx.arc((f.x + Math.sin(t * 0.3 + f.p) * 0.02) * stage.width, (f.y + Math.cos(t * 0.4 + f.p) * 0.01) * stage.height, short() * 0.006, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = '#fff3c4';
      for (const s of sparks) {
        ctx.globalAlpha = clamp(s.life / 0.8, 0, 1);
        ctx.beginPath();
        ctx.arc(s.x, s.y, short() * 0.007, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    });

    const offPointer = stage.onPointer({
      down(p) {
        if (stopped) return;
        sinceTouch = 0; idleClock = 0;
        fingers.set(p.id, p);
        if (leader === null) {
          // The first finger takes the sun: it moves at once towards the finger.
          leader = p.id; sun.tx = p.x; sun.ty = p.y;
          sun.x += (p.x - sun.x) * 0.25; sun.y += (p.y - sun.y) * 0.25;
        } else {
          sparkle(p.x, p.y);   // other fingers sparkle (stars at night, glints by day)
        }
      },
      move(p) {
        if (stopped || !fingers.has(p.id)) return;
        sinceTouch = 0;
        fingers.set(p.id, p);
        if (p.id === leader) { sun.tx = p.x; sun.ty = p.y; }
      },
      up(p) {
        fingers.delete(p.id);
        if (p.id === leader) leader = fingers.size ? fingers.keys().next().value : null;
      },
    });

    return {
      stop() {
        stopped = true;
        for (const off of [offFrame, offPointer]) if (typeof off === 'function') off();
      },
      debug: () => ({ entities: STARS + FIREFLIES + sparks.length, sky, daylight: daylight() }),
    };
  },
};
