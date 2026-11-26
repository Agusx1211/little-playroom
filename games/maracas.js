// maracas: two maracas chase your fingers — one per hand. Shake a finger and its maraca rattles: the
// seeds inside jump and colored sparks spray out in proportion to how hard you shake. A tap (no motion)
// pops one softly on the spot. Idle, the pair drifts and shakes itself in a slow rhythm.

const SHAKE_SPEED = 240;          // px/s of finger motion that counts as a shake
const MAX_SEEDS = 150;

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export default {
  id: 'maracas',
  colors: ['#f94144', '#90be6d'],

  icon(ctx, size, t) {
    const sway = 0.16 * Math.sin(t * 3.1);
    for (const side of [-1, 1]) {
      const cx = size * (0.5 + side * 0.2), cy = size * (0.42 + 0.03 * Math.cos(t * 3.1));
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(side * (0.32 + sway * side));
      ctx.strokeStyle = '#e0c184';
      ctx.lineWidth = size * 0.055;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, size * 0.12);
      ctx.lineTo(0, size * 0.42);
      ctx.stroke();
      ctx.fillStyle = side < 0 ? '#f94144' : '#90be6d';
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      for (let i = 0; i < 3; i++) {
        const a = t * 6 + i * 2.1 + side;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * size * 0.06, Math.sin(a) * size * 0.06, size * 0.02, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.lineCap = 'butt';
  },

  start(stage) {
    const { ctx, audio } = stage;
    const seeds = [];            // { x, y, vx, vy, a, r, color }
    const maracas = [
      { x: 0, y: 0, tx: 0, ty: 0, vx: 0, vy: 0, hop: 0, rattle: 0, last: 0, color: '#f94144', ids: new Set() },
      { x: 0, y: 0, tx: 0, ty: 0, vx: 0, vy: 0, hop: 0, rattle: 0, last: 0, color: '#90be6d', ids: new Set() },
    ];
    const finger = new Map();    // pointer id -> { m, x, y }
    let w = 0, h = 0, idle = 0, danceClock = 0, dance = 0, clock = 0;

    function sync() {
      if (stage.width === w && stage.height === h) return;
      w = stage.width; h = stage.height;
      if (!maracas[0].x) {
        maracas[0].x = maracas[0].tx = w * 0.34; maracas[1].x = maracas[1].tx = w * 0.66;
        maracas[0].y = maracas[1].y = maracas[0].ty = maracas[1].ty = h * 0.55;
      }
    }

    function spray(m, power) {
      const n = Math.round(2 + 5 * power);
      for (let i = 0; i < n; i++) {
        const a = stage.rand() * Math.PI * 2;
        const sp = (40 + stage.rand() * 190) * (0.4 + power);
        seeds.push({ x: m.x, y: m.y - m.r() * 0.2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
          a: 0.95, r: 2 + stage.rand() * 3.6,
          color: ['#ffd166', '#f9f7f7', '#ff9f1c', '#fff3b0'][Math.floor(stage.rand() * 4)] });
        if (seeds.length > MAX_SEEDS) seeds.shift();
      }
    }

    for (const m of maracas) m.r = () => Math.min(w, h) * 0.11;

    const offPointer = stage.onPointer({
      down(p) {
        idle = 0; danceClock = 0;
        const m = maracas[0].ids.size <= maracas[1].ids.size ? 0 : 1;
        maracas[m].ids.add(p.id);
        finger.set(p.id, { m, x: p.x, y: p.y, t: clock });
        const mr = maracas[m];
        mr.tx = p.x; mr.ty = p.y;                      // be where the finger is, this frame
        mr.hop = 1;
        audio.pop();
        spray(mr, 0.35);
      },
      move(p) {
        const f = finger.get(p.id);
        if (!f) return;
        idle = 0; danceClock = 0;
        const mr = maracas[f.m];
        const dx = p.x - f.x, dy = p.y - f.y;
        mr.tx = p.x; mr.ty = p.y;
        const speed = Math.hypot(dx, dy) / Math.max(0.001, clock - f.t);   // px per second
        f.t = clock;
        if (speed > SHAKE_SPEED) {                     // a real shake: rattle + spray + note
          mr.rattle = 1;
          if (clock - mr.last > 0.09) {
            mr.last = clock;
            audio.note(620 + stage.rand() * 760, 0.06);
            spray(mr, clamp(speed / 1400, 0.4, 1));
          }
        }
        f.x = p.x; f.y = p.y;
      },
      up(p) {
        const f = finger.get(p.id);
        if (f) maracas[f.m].ids.delete(p.id);
        finger.delete(p.id);
      },
    });

    const offFrame = stage.onFrame((dt, t) => {
      clock = t;
      sync();
      idle += dt;
      if (idle > 5) {                                  // the pair dances on its own
        danceClock += dt;
        dance += dt;
        const beat = Math.sin(danceClock * 3.4);
        maracas[0].tx = w * (0.36 + 0.06 * beat);
        maracas[0].ty = h * (0.5 + 0.05 * Math.sin(danceClock * 2.3));
        maracas[1].tx = w * (0.64 - 0.06 * beat);
        maracas[1].ty = h * (0.58 + 0.05 * Math.cos(danceClock * 2.6));
        if (beat > 0.96 && maracas[0].rattle < 0.3) {
          for (const m of maracas) {
            m.rattle = 1;
            audio.note(620 + stage.rand() * 620, 0.055);
            spray(m, 0.5);
          }
        }
      }

      ctx.fillStyle = '#171430';
      ctx.fillRect(0, 0, w, h);

      for (const m of maracas) {
        const k = 1 - Math.exp(-16 * dt);
        const px = m.x, py = m.y;
        m.x += (m.tx - m.x) * k;
        m.y += (m.ty - m.y) * k;
        m.vx = (m.x - px) / Math.max(dt, 1e-4);
        m.vy = (m.y - py) / Math.max(dt, 1e-4);
        m.hop = Math.max(0, m.hop - dt * 3);
        m.rattle = Math.max(0, m.rattle - dt * 4);
        const r = m.r();
        const wob = 0.22 * m.rattle * Math.sin(t * 24) + 0.12 * Math.min(1, Math.hypot(m.vx, m.vy) / 900)
          * Math.sin(t * 30);
        const size = r * (1 + 0.12 * m.hop);
        ctx.save();
        ctx.translate(m.x, m.y);
        ctx.rotate(-0.45 + wob);
        ctx.strokeStyle = '#e0c184';                   // handle
        ctx.lineWidth = size * 0.3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, size * 0.75);
        ctx.lineTo(0, size * 1.9);
        ctx.stroke();
        ctx.lineCap = 'butt';
        ctx.fillStyle = m.color;                       // head
        ctx.beginPath();
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.28)';      // band
        ctx.beginPath();
        ctx.ellipse(0, size * 0.6, size * 0.62, size * 0.22, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.8)';       // seeds rattling inside
        for (let i = 0; i < 4; i++) {
          const a = t * (9 + i * 3) + i * 1.7;
          const rad = size * (0.18 + 0.22 * m.rattle + 0.12 * (i % 2));
          ctx.beginPath();
          ctx.arc(Math.cos(a) * rad, Math.sin(a * 1.3) * rad, size * 0.11, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      for (let i = seeds.length - 1; i >= 0; i--) {
        const s = seeds[i];
        s.vy += 520 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.a -= dt * 1.4;
        if (s.a <= 0 || s.y > h + 16) { seeds.splice(i, 1); continue; }
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
        finger.clear();
        for (const m of maracas) m.ids.clear();
      },
    };
  },
};
