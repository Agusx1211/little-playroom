// accordion: a round box accordion with two panels and pleated bellows. Push the two panels together
// (one finger on each side, or palms) and air squeezes out in puffs while a reedy note plays; let them
// spring apart and the bellows breathe in with the note a step up. Cross the line between two pleats and
// the note walks the scale — pushing walks down, pulling walks up. Tap a panel and its buttons light.
// Idle, the accordion breathes slow and quiet.

const SCALE = [220, 262, 294, 330, 392, 440, 523, 587, 659];
const MAX_PUFFS = 140;

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export default {
  id: 'accordion',
  colors: ['#ef476f', '#118ab2'],

  icon(ctx, size, t) {
    const s = size * (0.16 + 0.05 * Math.sin(t * 1.6));      // the box breathes
    const cy = size * 0.5;
    for (const side of [-1, 1]) {
      const px = size * 0.5 + side * (size * 0.26 + s);
      ctx.fillStyle = side < 0 ? '#ef476f' : '#118ab2';
      ctx.beginPath();
      ctx.roundRect(px - size * 0.09, cy - size * 0.26, size * 0.09, size * 0.52, size * 0.03);
      ctx.fill();
    }
    ctx.strokeStyle = '#f8f9fa';
    ctx.lineWidth = size * 0.02;
    const l = size * (0.5 - 0.26 - s), r = size * (0.5 + 0.26 - s) + size * 0.18;
    const n = 4;
    for (let i = 0; i <= n; i++) {
      const x = l + ((r - l + size * 0.08) * i) / n;
      ctx.beginPath();
      ctx.moveTo(x, cy - size * 0.2);
      ctx.lineTo(x - size * 0.03, cy + size * 0.2);
      ctx.stroke();
    }
  },

  start(stage) {
    const { ctx, audio } = stage;
    const puffs = [];
    const held = new Map();
    let w = 0, h = 0, cx = 0, cy = 0, half = 0, pleat = 0;
    let gap = 0, gapTarget = 0, noteStep = 4, lastStepAt = 0, idle = 0, breathe = 0;
    const panelGlow = [0, 0];

    let clock = 0;
    let squeezeAcc = 0;

    function sync() {
      if (stage.width === w && stage.height === h) return;
      w = stage.width; h = stage.height;
      cx = w / 2; cy = h * 0.55;
      half = Math.min(w, h) * 0.42;                          // rest gap from centre to panel
      pleat = Math.max(14, Math.min(w, h) * 0.06);           // one note per pleat of travel
      if (!gap) { gap = half; gapTarget = half; }
    }

    function puff(dir, power) {                              // dir: -1 out the left, +1 out the right
      const n = Math.round(2 + 4 * power);
      for (let i = 0; i < n; i++) {
        puffs.push({ x: cx + dir * (gap + pleat * 0.4), y: cy + (stage.rand() - 0.5) * half * 0.7,
          vx: dir * (90 + stage.rand() * 160) * (0.5 + power), vy: (stage.rand() - 0.5) * 60,
          r: 5 + stage.rand() * 12, a: 0.5 });
        if (puffs.length > MAX_PUFFS) puffs.shift();
      }
    }

    const offPointer = stage.onPointer({
      down(p) {
        sync();
        idle = 0; breathe = 0;
        panelGlow[p.x < cx ? 0 : 1] = 1;                     // the nearer panel answers, here and now
        held.set(p.id, { grabbed: Math.abs(Math.abs(p.x - cx) - gap) < pleat * 2.4 });
        audio.pop();
      },
      move(p) {
        const f = held.get(p.id);
        if (!f) return;
        idle = 0; breathe = 0;
        const d = Math.abs(p.x - cx);
        if (!f.grabbed && Math.abs(d - gap) < pleat * 2.4) f.grabbed = true;
        f.dist = Math.abs(p.x - cx) < half ? Math.max(d, pleat * 1.6) : null;
      },
      up(p) { held.delete(p.id); },
    });

    function walkedScale(dg) {                               // one note per pleat of travel
      squeezeAcc += dg;
      while (Math.abs(squeezeAcc) >= pleat) {
        const closing = squeezeAcc > 0;
        squeezeAcc += closing ? -pleat : pleat;
        noteStep = clamp(noteStep + (closing ? -1 : 1), 0, SCALE.length - 1);
        if (clock - lastStepAt >= 0.08) {
          lastStepAt = clock;
          audio.note(SCALE[noteStep], closing ? 0.34 : 0.26);
          panelGlow[noteStep % 2] = 1;
          puff(closing ? 1 : -1, 0.6);
        }
      }
    }

    const offFrame = stage.onFrame((dt, t) => {
      clock = t;
      sync();
      idle += dt;
      if (idle > 5) {                                        // the bellows breathe on their own
        breathe += dt;
        gapTarget = half * (0.72 + 0.16 * Math.sin(breathe * 1.1));
        if (Math.sin(breathe * 1.1) > 0.985 && clock - lastStepAt > 1.1) {
          lastStepAt = clock;
          noteStep = 3 + Math.round(2 + 2 * Math.sin(breathe * 0.37));
          audio.note(SCALE[noteStep], 0.5);
          puff(1, 0.4);
          panelGlow[0] = 1;
        }
      } else {
        const pulls = [...held.values()].map((f) => f.dist).filter((d) => typeof d === 'number');
        gapTarget = pulls.length ? Math.min(...pulls, half) : half;   // held fingers hold; else rest
      }
      const before = gap;
      gap += (gapTarget - gap) * (1 - Math.exp(-14 * dt));   // springy return
      if (idle <= 5) walkedScale(before - gap);

      ctx.fillStyle = '#141026';
      ctx.fillRect(0, 0, w, h);

      // bellows pleats between the panels
      const pleats = 6;
      ctx.strokeStyle = '#e5e5e5';
      for (let i = 0; i <= pleats; i++) {
        const x = cx - gap + (2 * gap * i) / pleats;
        ctx.globalAlpha = 0.75;
        ctx.lineWidth = Math.max(2, pleat * 0.22);
        ctx.beginPath();
        ctx.moveTo(x, cy - half * 0.5);
        ctx.lineTo(x - pleat * 0.3, cy + half * 0.5);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      for (const [i, dir] of [[0, -1], [1, 1]]) {            // the two panels
        panelGlow[i] = Math.max(0, panelGlow[i] - dt * 2.4);
        const px = cx + dir * gap;
        ctx.fillStyle = i ? '#118ab2' : '#ef476f';
        ctx.beginPath();
        ctx.roundRect(px - pleat * 0.75, cy - half * 0.62, pleat * 1.5, half * 1.24, pleat * 0.4);
        ctx.fill();
        ctx.fillStyle = `rgba(255,255,255,${(0.25 + 0.5 * panelGlow[i]).toFixed(3)})`;
        for (let b = 0; b < 4; b++) {                        // buttons
          ctx.beginPath();
          ctx.arc(px, cy + (b - 1.5) * half * 0.3, pleat * 0.24, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      for (let i = puffs.length - 1; i >= 0; i--) {          // the escaping air
        const q = puffs[i];
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        q.r += 26 * dt;
        q.a -= dt * 1.1;
        if (q.a <= 0) { puffs.splice(i, 1); continue; }
        ctx.fillStyle = '#cfe8ff';
        ctx.globalAlpha = clamp(q.a, 0, 1) * 0.5;
        ctx.beginPath();
        ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2);
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
