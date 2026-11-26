// recordplayer: a big vinyl record always spins on a dark table, the tonearm resting in its grooves.
// Touch the record and drag: you hold the disc — scratch it, the grooves slide under your finger and a
// low wobble-note bends with your speed; let go and it coasts back up to speed. Touch off the record and
// the tonearm glides to that part of the disc with a whoosh. Idle, it spins on and the arm drifts slow.

const MAX_DUST = 60;

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export default {
  id: 'recordplayer',
  colors: ['#e63946', '#f4a261'],

  icon(ctx, size, t) {
    const c = size * 0.46, R = size * 0.34;
    ctx.fillStyle = '#1d1d26';
    ctx.beginPath();
    ctx.arc(c, c, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3a3a48';
    ctx.lineWidth = size * 0.012;
    for (const f of [0.55, 0.75, 0.92]) {
      ctx.beginPath();
      ctx.arc(c, c, R * f, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#e63946';
    ctx.beginPath();
    ctx.arc(c, c, R * 0.32, 0, Math.PI * 2);
    ctx.fill();
    const a = t * 1.5;
    ctx.fillStyle = '#f4a261';
    ctx.beginPath();
    ctx.arc(c + Math.cos(a) * R * 0.62, c + Math.sin(a) * R * 0.62, size * 0.03, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#cfd8dc';
    ctx.lineWidth = size * 0.03;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(size * 0.86, size * 0.18);
    ctx.lineTo(c + Math.cos(0.6) * R * 0.8, c + Math.sin(0.6) * R * 0.8);
    ctx.stroke();
    ctx.lineCap = 'butt';
  },

  start(stage) {
    const { ctx, audio } = stage;
    const grabbers = new Map();
    let w = 0, h = 0, cx = 0, cy = 0, R = 0;
    let rot = 0, spin = 1.4, armF = 0.72, armTarget = 0.72;
    let idle = 0, idleClock = 0, scratchPace = 0, lastScratch = 0, clock = 0;
    let scratching = 0, scratchX = 0, scratchY = 0;
    const dust = Array.from({ length: MAX_DUST }, () => ({
      a: stage.rand() * Math.PI * 2, f: 0.3 + stage.rand() * 0.66, r: 1 + stage.rand() * 2.2,
    }));

    function sync() {
      if (stage.width === w && stage.height === h) return;
      w = stage.width; h = stage.height;
      cx = w * 0.46; cy = h * 0.55;
      R = Math.min(w, h) * 0.4;
    }

    const offPointer = stage.onPointer({
      down(p) {
        sync();
        idle = 0;
        const d = Math.hypot(p.x - cx, p.y - cy);
        if (d < R * 1.05) {                                 // grab the disc itself: scratch
          grabbers.set(p.id, { a: Math.atan2(p.y - cy, p.x - cx), last: clock });
          scratching = 1;
          scratchX = p.x; scratchY = p.y;
        } else {                                            // elsewhere: move the tonearm there
          armTarget = clamp(d / R, 0.4, 0.94);
          audio.whoosh();
        }
      },
      move(p) {
        const g = grabbers.get(p.id);
        if (!g) return;
        idle = 0;
        const a = Math.atan2(p.y - cy, p.x - cx);
        let d = a - g.a;
        if (d > Math.PI) d -= Math.PI * 2;
        if (d < -Math.PI) d += Math.PI * 2;
        const dt = Math.max(0.002, clock - g.last);
        g.a = a;
        g.last = clock;
        rot += d;
        spin = clamp(d / dt, -24, 24);                      // the disc goes where the finger drags it
        lastScratch = Math.abs(d / dt);
        scratchX = p.x; scratchY = p.y;
      },
      up(p) { grabbers.delete(p.id); },
    });

    const offFrame = stage.onFrame((dt, t) => {
      clock = t;
      sync();
      idle += dt;
      scratching = grabbers.size ? 1 : 0;

      if (grabbers.size === 0) spin += (1.4 - spin) * (1 - Math.exp(-0.7 * dt));   // coast back to speed
      rot += spin * dt;
      lastScratch = Math.max(0, lastScratch - dt * 8);

      if (idle > 5) {                                       // slow arm drift and a soft tick now and then
        armTarget = 0.62 + 0.2 * Math.sin(t * 0.16);
        idleClock += dt;
        if (idleClock > 2.8) {
          idleClock = 0;
          audio.note(330, 0.22);
        }
      }
      if (lastScratch > 2 && clock - scratchPace > 0.1) {   // the wobble of a moving scratch
        scratchPace = clock;
        audio.note(clamp(160 + lastScratch * 26, 75, 1400), 0.09);
      }
      armF += (armTarget - armF) * (1 - Math.exp(-5 * dt));

      ctx.fillStyle = '#17131f';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + R * 0.9, R * 1.15, R * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#1d1d26';                            // the record
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#3a3a48';
      ctx.lineWidth = 1.5;
      for (const f of [0.45, 0.58, 0.7, 0.82, 0.94]) {
        ctx.beginPath();
        ctx.arc(cx, cy, R * f, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = '#e63946';                            // the label
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.28, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f4a261';                            // groove dust, riding the spin
      for (const p of dust) {
        const a = p.a + rot;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * R * p.f, cy + Math.sin(a) * R * p.f, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (Math.abs(spin) > 3) {                             // motion sheen when it runs fast
        ctx.strokeStyle = `rgba(255,255,255,${clamp(Math.abs(spin) / 40, 0, 0.35).toFixed(3)})`;
        ctx.lineWidth = R * 0.05;
        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.86, rot, rot + 1.2);
        ctx.stroke();
      }
      if (scratching) {                                     // the scratch glow under the finger
        ctx.strokeStyle = 'rgba(244,162,97,0.5)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(scratchX, scratchY, 18 + 10 * Math.sin(t * 9), 0, Math.PI * 2);
        ctx.stroke();
      }

      // the tonearm, resting where it was sent
      const px = w * 0.94, py = h * 0.1;
      const nx = cx + Math.cos(0.66) * R * armF, ny = cy + Math.sin(0.66) * R * armF;
      ctx.strokeStyle = '#cfd8dc';
      ctx.lineWidth = Math.max(3, R * 0.045);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(nx, ny);
      ctx.stroke();
      ctx.lineCap = 'butt';
      ctx.fillStyle = '#90a4ae';
      ctx.beginPath();
      ctx.arc(px, py, R * 0.08, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f4a261';
      ctx.beginPath();
      ctx.arc(nx, ny, R * 0.035, 0, Math.PI * 2);
      ctx.fill();
    });

    return {
      stop() {
        offPointer();
        offFrame();
        grabbers.clear();
      },
    };
  },
};
