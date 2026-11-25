// garden: a warm soil bed seen from above. Every touch plants a seed right there — it sprouts,
// grows leaves, and ripens into a tomato, a carrot or a sunflower. Tap a ripe one and it pops out of
// the ground in a shower of soil; tap a green one and it only wobbles: good things take a moment.
// When nobody touches, the bed keeps growing, and now and then a volunteer seed lands on its own.
//
// A plant's life, as explicit states:
//   SEEDED (0.9 s, a curl of sprout) -> LEAFY (5-8 s of growing) -> RIPE (ready, gentle bob)
//   -> picked: gone, particles only; the plot is empty again.

const MAX_PLANTS = 26;
const MAX_SOIL = 90;
const MAX_RINGS = 24;

const Phase = Object.freeze({ SEEDED: 'seeded', LEAFY: 'leafy', RIPE: 'ripe' });
const CROPS = ['tomato', 'carrot', 'sunflower'];

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export default {
  id: 'garden',
  colors: ['#8fe08a', '#a06a3c'],

  icon(ctx, size, t) {
    ctx.fillStyle = '#8a5a33';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#6b4526';
    for (let k = 0; k < 4; k++) ctx.fillRect(0, size * (0.25 + k * 0.22), size, size * 0.05);
    const grow = 0.6 + 0.4 * Math.min(1, (t % 3) / 2.2);
    const x = size * 0.5, y = size * 0.62;
    ctx.strokeStyle = '#4da253';
    ctx.lineWidth = size * 0.03;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + size * 0.04, y - size * 0.12 * grow, x, y - size * 0.24 * grow);
    ctx.stroke();
    ctx.fillStyle = '#d62839';
    for (const [dx, dy] of [[-0.08, -0.22], [0.07, -0.28], [0.02, -0.14]]) {
      ctx.beginPath();
      ctx.arc(x + size * dx * grow, y + size * dy * grow, size * 0.06 * grow, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  start(stage) {
    const ctx = stage.ctx;
    let stopped = false;
    let sinceTouch = 0, idleClock = 0, sinceSound = 0, cropPick = 0;
    const short = () => Math.min(stage.width, stage.height);
    const plantR = () => clamp(short() * 0.07, 22, 66);
    const soilY = () => stage.height * 0.3;
    const soil = [], rings = [];
    const plants = [];

    function plant(x, y) {
      if (plants.length >= MAX_PLANTS) return null;
      const p = {
        x, y, phase: Phase.SEEDED, clock: 0, crop: CROPS[cropPick++ % CROPS.length],
        wobble: 0, seed: stage.rand(),
      };
      plants.push(p);
      if (soil.length < MAX_SOIL) {
        for (let k = 0; k < 4; k++) {
          soil.push({ x, y, vx: (stage.rand() - 0.5) * short() * 0.25, vy: -short() * (0.1 + stage.rand() * 0.2), life: 1 });
        }
      }
      if (rings.length < MAX_RINGS) rings.push({ x, y, r: short() * 0.03, life: 1, color: '#e8d5a0' });
      if (sinceSound > 0.14) { stage.audio.note(330 + stage.rand() * 80, 0.14); sinceSound = 0; }
      return p;
    }

    function harvest(p) {
      const r = plantR();
      for (let k = 0; k < 8 && soil.length < MAX_SOIL; k++) {
        const a = stage.rand() * Math.PI * 2;
        soil.push({ x: p.x, y: p.y, vx: Math.cos(a) * short() * 0.3, vy: -short() * (0.15 + stage.rand() * 0.3), life: 1 });
      }
      if (rings.length < MAX_RINGS) rings.push({ x: p.x, y: p.y - r * 0.6, r: r * 0.5, life: 1, color: '#ffe066' });
      stage.audio.pop();
      plants.splice(plants.indexOf(p), 1);
    }

    function plantAt(x, y) {
      let best = null, bestD = plantR() * 1.4;
      for (const p of plants) {
        const d = Math.hypot(p.x - x, (p.y - plantR() * 0.6) - y);
        if (d < bestD) { bestD = d; best = p; }
      }
      return best;
    }

    function drawPlant(p, t) {
      const r = plantR();
      const grow = p.phase === Phase.SEEDED ? clamp(p.clock / 0.9, 0.1, 1)
        : p.phase === Phase.LEAFY ? 1 + clamp(p.clock / 6, 0, 1) * 0.35
        : 1.35;
      const sway = p.wobble * Math.sin(t * 20 + p.seed * 7) * 0.3 + Math.sin(t * 1.1 + p.seed * 5) * 0.05;
      const bob = p.phase === Phase.RIPE ? Math.sin(t * 3 + p.seed * 6) * r * 0.04 : 0;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(sway * 0.2);
      // shadow of the plant on the soil
      ctx.fillStyle = 'rgba(40,20,10,0.25)';
      ctx.beginPath();
      ctx.ellipse(0, r * 0.12, r * 0.6 * grow, r * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();
      if (p.phase === Phase.SEEDED) {
        ctx.strokeStyle = '#7fbf5f';
        ctx.lineWidth = r * 0.1;
        ctx.beginPath();
        ctx.arc(0, -r * 0.08, r * 0.18 * grow, -0.4, Math.PI * 1.2);
        ctx.stroke();
      } else {
        // stem and leaves
        ctx.strokeStyle = '#3f8f4f';
        ctx.lineWidth = r * 0.1;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(r * 0.1, -r * 0.5 * grow, 0, -r * 0.85 * grow + bob);
        ctx.stroke();
        ctx.fillStyle = '#4da253';
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.ellipse(s * r * 0.34, -r * 0.45 * grow, r * 0.3 * grow, r * 0.13 * grow, s * -0.6 + sway, 0, Math.PI * 2);
          ctx.fill();
        }
        if (p.phase === Phase.RIPE) {
          const top = -r * 0.85 * grow + bob;
          if (p.crop === 'tomato') {
            ctx.fillStyle = '#d62839';
            for (const [dx, dy] of [[-0.28, 0.1], [0.24, 0.02], [0.02, 0.26]]) {
              ctx.beginPath();
              ctx.arc(dx * r, top + dy * r, r * 0.24, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            for (const [dx, dy] of [[-0.34, 0.02], [0.18, -0.06]]) {
              ctx.beginPath();
              ctx.arc(dx * r, top + dy * r, r * 0.06, 0, Math.PI * 2);
              ctx.fill();
            }
          } else if (p.crop === 'carrot') {
            ctx.fillStyle = '#e07a1f';
            ctx.beginPath();
            ctx.moveTo(-r * 0.22, top + r * 0.18);
            ctx.quadraticCurveTo(0, top - r * 0.1, r * 0.22, top + r * 0.18);
            ctx.quadraticCurveTo(0, top + r * 0.6, -r * 0.22, top + r * 0.18);
            ctx.fill();
            ctx.strokeStyle = '#c25e10';
            ctx.lineWidth = 1.5;
            for (let k = 0; k < 3; k++) {
              ctx.beginPath();
              ctx.moveTo(-r * 0.16 + k * r * 0.13, top + r * 0.2 + k * r * 0.06);
              ctx.lineTo(-r * 0.02 + k * r * 0.1, top + r * 0.3 + k * r * 0.07);
              ctx.stroke();
            }
          } else {   // sunflower
            const cx = 0, cy = top - r * 0.1;
            ctx.fillStyle = '#ffd25c';
            for (let k = 0; k < 10; k++) {
              const a = (k / 10) * Math.PI * 2 + sway;
              ctx.beginPath();
              ctx.ellipse(cx + Math.cos(a) * r * 0.38, cy + Math.sin(a) * r * 0.38, r * 0.2, r * 0.09, a, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.fillStyle = '#6b4526';
            ctx.beginPath();
            ctx.arc(cx, cy, r * 0.26, 0, Math.PI * 2);
            ctx.fill();
          }
        } else {   // leafy but not ripe: a little green bud shows the promise
          ctx.fillStyle = '#8fae5a';
          ctx.beginPath();
          ctx.arc(0, -r * 0.85 * grow, r * 0.13, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }

    const offFrame = stage.onFrame((dt, t) => {
      if (stopped) return;
      sinceTouch += dt; sinceSound += dt;
      // Idle: after 5 s a volunteer seed lands now and then, and the beds breathe.
      if (sinceTouch > 5) {
        idleClock += dt;
        if (idleClock > 6) {
          idleClock = 0;
          if (plants.length < MAX_PLANTS - 3) {
            plant(stage.width * (0.1 + stage.rand() * 0.8), stage.height * (0.4 + stage.rand() * 0.5));
          }
        }
      }
      for (const p of plants) {
        p.clock += dt;
        p.wobble = Math.max(0, p.wobble - dt * 2);
        if (p.phase === Phase.SEEDED && p.clock > 0.9) { p.phase = Phase.LEAFY; p.clock = 0; }   // SEEDED -> LEAFY
        else if (p.phase === Phase.LEAFY && p.clock > 5 + p.seed * 3) { p.phase = Phase.RIPE; p.clock = 0; }   // LEAFY -> RIPE
      }
      for (let i = soil.length - 1; i >= 0; i--) {
        const s = soil[i];
        s.vy += short() * 1.6 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt * 1.2;
        if (s.life <= 0) soil.splice(i, 1);
      }
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.r += dt * short() * 0.3; r.life -= dt * 1.8;
        if (r.life <= 0) rings.splice(i, 1);
      }

      // sky above the bed, wooden frame, soil rows
      const sky = ctx.createLinearGradient(0, 0, 0, soilY());
      sky.addColorStop(0, '#eafcff'); sky.addColorStop(1, '#d3f0c8');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, stage.width, soilY());
      ctx.fillStyle = '#9a6b3f';
      ctx.fillRect(0, soilY() - short() * 0.02, stage.width, short() * 0.03);   // the bed's back board
      ctx.fillStyle = '#8a5a33';
      ctx.fillRect(0, soilY(), stage.width, stage.height - soilY());
      ctx.fillStyle = '#6b4526';
      const rows = 4;
      for (let k = 1; k < rows; k++) {
        const y = soilY() + (stage.height - soilY()) * (k / rows);
        ctx.beginPath();
        for (let x = 0; x <= stage.width; x += 24) {
          ctx.lineTo(x, y + Math.sin(x * 0.05 + k) * short() * 0.006);
        }
        ctx.lineWidth = short() * 0.012;
        ctx.strokeStyle = '#6b4526';
        ctx.stroke();
      }
      for (const p of plants) drawPlant(p, t);
      // soil clods and rings
      for (const s of soil) {
        ctx.globalAlpha = clamp(s.life, 0, 1);
        ctx.fillStyle = '#5d4228';
        ctx.beginPath();
        ctx.arc(s.x, s.y, short() * 0.006 + 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      for (const r of rings) {
        ctx.globalAlpha = clamp(r.life, 0, 1) * 0.7;
        ctx.strokeStyle = r.color;
        ctx.lineWidth = 3;
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
        if (rings.length < MAX_RINGS) rings.push({ x: p.x, y: p.y, r: short() * 0.03, life: 1, color: '#fff6df' });
        const hit = plantAt(p.x, p.y);
        if (!hit) {
          if (p.y > soilY() - short() * 0.04) plant(p.x, clamp(p.y, soilY() + short() * 0.05, stage.height * 0.95));
          return;
        }
        if (hit.phase === Phase.RIPE) harvest(hit);
        else {
          hit.wobble = 1;
          if (sinceSound > 0.25) { stage.audio.note(220, 0.12); sinceSound = 0; }
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
      debug: () => ({ entities: plants.length + soil.length + rings.length, phases: plants.map(p => p.phase) }),
    };
  },
};
