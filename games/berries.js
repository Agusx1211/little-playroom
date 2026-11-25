// berries: a sunny berry hedge. Every touch anywhere answers at once with a ring; a berry that is
// RIGID RED is ready — pick it and it bursts into juice and seeds and a new blossom takes its place.
// A green berry wobbles and says "not yet", and a ripe one nobody picks swells dark, drops with a
// splat, and leaves a bud. Blossoms ripen slowly on their own, so the hedge always has a next berry.
//
// A berry's life, as explicit states:
//   BLOSSOM (3-5 s) -> GREEN (5-8 s) -> RIPE (wobbles) -> picked: BURST (particle only, gone)
//   RIPE after 6 s alone -> OVER (dark) (3 s) -> drops, bud back to BLOSSOM.

const BERRIES = 18;
const MAX_JUICE = 90;
const MAX_RINGS = 24;

const StageName = Object.freeze({ BLOSSOM: 'blossom', GREEN: 'green', RIPE: 'ripe', OVER: 'over' });
const KINDS = [
  { ripe: '#d62839', juice: '#ff5a70', leaf: '#4da253' },   // strawberry red
  { ripe: '#5a2e8c', juice: '#8e5ad1', leaf: '#3f8f4f' },   // blackcurrant purple
  { ripe: '#e05a2b', juice: '#ff9257', leaf: '#57a05f' },   // gooseberry orange
];

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export default {
  id: 'berries',
  colors: ['#ff6b81', '#ffe3c2'],

  icon(ctx, size, t) {
    ctx.fillStyle = '#ffe3c2';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = '#6b4a2f';
    ctx.lineWidth = size * 0.045;
    ctx.beginPath();
    ctx.moveTo(size * 0.2, size * 0.9);
    ctx.quadraticCurveTo(size * 0.5, size * 0.45, size * 0.8, size * 0.2);
    ctx.stroke();
    const bob = Math.sin(t * 2) * size * 0.01;
    for (const [kx, ky, r] of [[0.38, 0.62, 0.11], [0.58, 0.46, 0.09], [0.68, 0.66, 0.1]]) {
      const glow = kx > 0.6 ? 1 : 0.55;
      ctx.fillStyle = glow > 0.8 ? '#d62839' : '#8fae5a';
      ctx.beginPath();
      ctx.arc(size * kx, size * ky + bob, size * r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.arc(size * (kx - 0.03), size * (ky - 0.03) + bob, size * r * 0.28, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  start(stage) {
    const ctx = stage.ctx;
    let stopped = false;
    let sinceTouch = 0, idleClock = 0, sinceSound = 0;
    const short = () => Math.min(stage.width, stage.height);
    const berryR = () => clamp(short() * 0.055, 16, 52);
    const juice = [], rings = [];

    // one branch across the middle of the screen, berries on short stalks off it
    const branchPts = (t) => ({ y: stage.height * 0.52 + Math.sin(t * 0.7) * short() * 0.004 });
    const berries = Array.from({ length: BERRIES }, (_, i) => {
      const kind = KINDS[i % KINDS.length];
      return {
        u: (i + 0.5) / BERRIES,                                  // place along the branch (0..1)
        side: i % 3 === 0 ? -1 : 1, hang: short() * (0.06 + stage.rand() * 0.12),
        stage: StageName.BLOSSOM, clock: stage.rand() * 4, wobble: 0, kind, seed: stage.rand(),
      };
    });

    function berryPos(b, t) {
      const g = branchPts(t);
      return {
        x: stage.width * (0.06 + 0.88 * b.u) + Math.sin(t * 0.9 + b.u * 8) * short() * 0.004,
        y: g.y + b.side * (berryR() * 0.6 + b.hang),
      };
    }

    function pick(b, t) {
      const p = berryPos(b, t);
      for (let k = 0; k < 7 && juice.length < MAX_JUICE; k++) {
        juice.push({
          x: p.x, y: p.y, vx: (stage.rand() - 0.5) * short() * 0.6, vy: -stage.rand() * short() * 0.5,
          life: 1, color: b.kind.juice, r: berryR() * (0.12 + stage.rand() * 0.16),
        });
      }
      if (rings.length < MAX_RINGS) rings.push({ x: p.x, y: p.y, r: berryR(), life: 1, color: b.kind.juice });
      stage.audio.pop();
      b.stage = StageName.BLOSSOM;   // BURST is the particles; the berry itself returns to blossom
      b.clock = 0;
    }

    function ripen(b) {
      // RIPE -> OVER (swollen and dark, waiting to drop)
      if (b.stage === StageName.RIPE && b.clock > 6) b.stage = StageName.OVER;
    }

    const offFrame = stage.onFrame((dt, t) => {
      if (stopped) return;
      sinceTouch += dt; sinceSound += dt;
      // Idle: after 5 s a breeze passes — every berry sways a little.
      if (sinceTouch > 5) {
        idleClock += dt;
        if (idleClock > 6) {
          idleClock = 0;
          for (const b of berries) b.wobble = Math.min(1, b.wobble + 0.5);
        }
      }
      for (const b of berries) {
        b.clock += dt;
        b.wobble = Math.max(0, b.wobble - dt * 1.6);
        switch (b.stage) {
          case StageName.BLOSSOM: if (b.clock > 3.5 + b.seed * 1.5) { b.stage = StageName.GREEN; b.clock = 0; } break;
          case StageName.GREEN: if (b.clock > 5 + b.seed * 3) { b.stage = StageName.RIPE; b.clock = 0; } break;
          case StageName.RIPE: ripen(b); break;
          case StageName.OVER: {
            if (b.clock > 3) {          // it drops on its own
              const p = berryPos(b, t);
              for (let k = 0; k < 5 && juice.length < MAX_JUICE; k++) {
                juice.push({ x: p.x, y: p.y, vx: (stage.rand() - 0.5) * short() * 0.2, vy: -short() * 0.1, life: 1, color: b.kind.juice, r: berryR() * 0.14 });
              }
              if (sinceSound > 0.3) { stage.audio.note(180, 0.14); sinceSound = 0; }
              b.stage = StageName.BLOSSOM; b.clock = 0;   // OVER -> BLOSSOM (a new bud)
            }
            break;
          }
        }
      }
      for (let i = juice.length - 1; i >= 0; i--) {
        const j = juice[i];
        j.vy += short() * 1.8 * dt; j.x += j.vx * dt; j.y += j.vy * dt; j.life -= dt * 1.1;
        if (j.life <= 0 || j.y > stage.height) juice.splice(i, 1);
      }
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.r += dt * short() * 0.3; r.life -= dt * 1.8;
        if (r.life <= 0) rings.splice(i, 1);
      }

      const sky = ctx.createLinearGradient(0, 0, 0, stage.height);
      sky.addColorStop(0, '#fff3d6'); sky.addColorStop(1, '#ffd9a0');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, stage.width, stage.height);
      // hedge behind
      ctx.fillStyle = '#2f7a3d';
      ctx.beginPath();
      ctx.moveTo(0, stage.height);
      for (let k = 0; k <= 8; k++) {
        const x = stage.width * (k / 8);
        ctx.quadraticCurveTo(x + stage.width * 0.06, stage.height * 0.62 + Math.sin(k * 2.7) * short() * 0.02, x + stage.width * 0.125, stage.height * 0.74);
      }
      ctx.lineTo(stage.width, stage.height);
      ctx.closePath();
      ctx.fill();
      // the branch
      const g = branchPts(t);
      ctx.strokeStyle = '#6b4a2f';
      ctx.lineWidth = Math.max(3, short() * 0.012);
      ctx.beginPath();
      ctx.moveTo(-short() * 0.02, g.y - short() * 0.04);
      ctx.quadraticCurveTo(stage.width * 0.5, g.y + short() * 0.03, stage.width * 1.02, g.y - short() * 0.05);
      ctx.stroke();
      // leaves on the branch
      ctx.fillStyle = '#57a05f';
      for (let k = 0; k < 9; k++) {
        const u = (k + 0.2) / 9;
        const x = stage.width * u, y = g.y + (0.03 * (1 - Math.abs(0.5 - u) * 2) - 0.02) * stage.height * 0.35;
        ctx.beginPath();
        ctx.ellipse(x, y, short() * 0.026, short() * 0.012, 0.7 + Math.sin(t + k) * 0.06, 0, Math.PI * 2);
        ctx.fill();
      }
      // the berries
      for (const b of berries) {
        const p = berryPos(b, t);
        const sway = b.wobble * Math.sin(t * 22 + b.seed * 8) * berryR() * 0.25;
        const x = p.x + sway;
        ctx.strokeStyle = '#4a6b2f';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x, g.y + b.side * short() * 0.008);
        ctx.lineTo(x, y0(b, p));
        ctx.stroke();
        if (b.stage === StageName.BLOSSOM) {
          ctx.fillStyle = '#fff8e8';
          for (let k = 0; k < 5; k++) {
            const a = (k / 5) * Math.PI * 2 + b.seed * 4;
            ctx.beginPath();
            ctx.ellipse(x + Math.cos(a) * berryR() * 0.34, p.y + Math.sin(a) * berryR() * 0.34, berryR() * 0.26, berryR() * 0.15, a, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = '#ffd25c';
          ctx.beginPath();
          ctx.arc(x, p.y, berryR() * 0.18, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const ripe = b.stage === StageName.RIPE || b.stage === StageName.OVER;
          const pulse = ripe && b.stage === StageName.RIPE ? 1 + Math.sin(t * 3 + b.seed * 6) * 0.05 : 1;
          const dark = b.stage === StageName.OVER ? 0.55 : 1;
          const size = berryR() * (b.stage === StageName.GREEN ? 0.62 : pulse) * (dark === 1 ? 1 : 1.08);
          ctx.fillStyle = b.stage === StageName.GREEN ? '#8fae5a' : b.kind.ripe;
          ctx.globalAlpha = dark;
          ctx.beginPath();
          ctx.arc(x, p.y, size, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.fillStyle = 'rgba(255,255,255,0.55)';
          ctx.beginPath();
          ctx.arc(x - size * 0.3, p.y - size * 0.32, size * 0.22, 0, Math.PI * 2);
          ctx.fill();
          if (ripe) {   // a tiny star of green on top: "ready"
            ctx.strokeStyle = '#3f6b2f';
            ctx.lineWidth = 2;
            for (let k = 0; k < 4; k++) {
              const a = (k / 4) * Math.PI * 2 + 0.6;
              ctx.beginPath();
              ctx.moveTo(x, p.y - size);
              ctx.lineTo(x + Math.cos(a) * size * 0.3, p.y - size - Math.abs(Math.sin(a)) * size * 0.24 - 2);
              ctx.stroke();
            }
          }
        }
      }
      // juice drops and rings
      for (const j of juice) {
        ctx.globalAlpha = clamp(j.life, 0, 1);
        ctx.fillStyle = j.color;
        ctx.beginPath();
        ctx.arc(j.x, j.y, j.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      for (const r of rings) {
        ctx.globalAlpha = clamp(r.life, 0, 1) * 0.7;
        ctx.strokeStyle = r.color || '#ffffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    });

    function y0(b, p) { return p.y; }

    const offPointer = stage.onPointer({
      down(p) {
        if (stopped) return;
        sinceTouch = 0;
        if (rings.length < MAX_RINGS) rings.push({ x: p.x, y: p.y, r: short() * 0.03, life: 1, color: '#fff6df' });
        // a berry within reach: ripe is picked, unripe only wobbles
        let best = null, bestD = berryR() * 1.7;
        for (const b of berries) {
          const bp = berryPos(b, 0);   // branch bob is tiny; ignore t here
          const d = Math.hypot(bp.x - p.x, bp.y - p.y);
          if (d < bestD) { bestD = d; best = b; }
        }
        if (!best) return;
        if (best.stage === StageName.RIPE || best.stage === StageName.OVER) pick(best, 0);
        else {
          best.wobble = 1;
          if (sinceSound > 0.25) { stage.audio.note(200, 0.12); sinceSound = 0; }
        }
      },
      move() {},
      up() {},
    });

    return {
      stop() {
        stopped = true;
        for (const off of [offFrame, offPointer]) if (typeof off === 'function') off();
      },
      debug: () => ({ entities: berries.length + juice.length + rings.length, states: berries.map(b => b.stage) }),
    };
  },
};
