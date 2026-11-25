// kaleido - every stroke is mirrored into eight slices; slow rotation when still.
export default {
  id: "kaleido",
  colors: ["#c77dff", "#4cc9f0"],

  icon(ctx, size, t) {
    const cx = size / 2, cy = size / 2;
    ctx.lineCap = "round";
    ctx.lineWidth = size * 0.05;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + t * 0.4;
      ctx.strokeStyle = i % 2 ? this.colors[0] : this.colors[1];
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * size * 0.1, cy + Math.sin(a) * size * 0.1);
      ctx.quadraticCurveTo(
        cx + Math.cos(a + 0.5) * size * 0.32, cy + Math.sin(a + 0.5) * size * 0.32,
        cx + Math.cos(a) * size * 0.42, cy + Math.sin(a) * size * 0.42);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  },

  start(stage) {
    const rand = stage.rand;
    let stopped = false;
    let idle = 0;
    let spin = 0;
    const segs = []; // {rad, ca, sa, r, css, life} - polar coords, fixed at paint time
    const touches = new Map(); // pointerId -> last local point
    const N = 8;
    const TAU = Math.PI * 2;
    const MAX_SEGS = 180; // 180 dots x 16 copies: a full flower within the budget

    // screen -> local polar around the centre; a dot at (rad, ang) is drawn at
    // the same radius in eight slices, each also mirrored across the slice line.
    const toLocal = (p) => {
      const cx = stage.width / 2, cy = stage.height / 2;
      const s = Math.min(stage.width, stage.height) / 2;
      const dx = (p.x - cx) / s, dy = (p.y - cy) / s;
      return { rad: Math.hypot(dx, dy), ang: Math.atan2(dy, dx) };
    };

    let lastHue = rand() * 360;
    const add = (l, speed) => {
      const hue = (lastHue += 1.6) % 360;
      segs.push({ rad: l.rad, ca: Math.cos(l.ang), sa: Math.sin(l.ang), r: Math.max(6, 16 - speed * 0.02), css: `hsl(${hue | 0} 85% 66%)`, life: 1 });
      while (segs.length > MAX_SEGS) segs.shift();
    };

    stage.onPointer({
      down(p) { idle = 0; const l = toLocal(p); touches.set(p.id, l); add(l, 0); stage.audio.note(300 + Math.abs(l.ang) * 40, 0.05); },
      move(p) {
        idle = 0;
        const l = toLocal(p);
        const prev = touches.get(p.id);
        if (!prev) { touches.set(p.id, l); add(l, 0); return; }
        const dx = l.rad - prev.rad, da = Math.atan2(Math.sin(l.ang - prev.ang), Math.cos(l.ang - prev.ang));
        const dist = Math.hypot(dx, da * Math.max(0.1, l.rad));
        const steps = Math.min(5, Math.max(1, (dist / 0.02) | 0));
        for (let i = 1; i <= steps; i++)
          add({ rad: prev.rad + dx * (i / steps), ang: prev.ang + da * (i / steps) }, dist * 900);
        touches.set(p.id, l);
      },
      up(p) { touches.delete(p.id); },
    });

    stage.onFrame((dt, t) => {
      if (stopped) return;
      const { ctx, width: W, height: H } = stage;
      idle += dt;
      // idle: the whole flower turns slowly by itself
      spin += (idle > 5 ? 0.25 : 0.05) * dt;
      const s = Math.min(W, H) / 2;

      // slice directions rotate together: one trig table per frame, not per dot
      const C = new Float64Array(N), Sm = new Float64Array(N);
      for (let k = 0; k < N; k++) {
        const a = spin + (k * TAU) / N;
        C[k] = Math.cos(a); Sm[k] = Math.sin(a);
      }

      ctx.fillStyle = "#0b0716";
      ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.translate(W / 2, H / 2);
      for (const seg of segs) {
        seg.life -= dt / 6; // long memory: six seconds
        if (seg.life <= 0) continue;
        // one path with all 16 copies of this dot, filled once
        ctx.globalAlpha = Math.min(1, seg.life * 1.5) * 0.85;
        ctx.fillStyle = seg.css;
        ctx.beginPath();
        const R = seg.rad * s;
        for (let k = 0; k < N; k++) {
          const c = C[k], sn = Sm[k];
          // rotated copy: ang + slice; mirrored copy: -ang + slice
          let x = R * (c * seg.ca - sn * seg.sa), y = R * (sn * seg.ca + c * seg.sa);
          ctx.moveTo(x + seg.r, y); ctx.arc(x, y, seg.r, 0, TAU);
          x = R * (c * seg.ca + sn * seg.sa); y = R * (sn * seg.ca - c * seg.sa);
          ctx.moveTo(x + seg.r, y); ctx.arc(x, y, seg.r, 0, TAU);
        }
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // faint guide: eight soft rays show the symmetry even with nothing drawn
      const pulse = 0.05 + 0.02 * Math.sin(t * 1.2);
      ctx.strokeStyle = `rgba(150,120,255,${pulse.toFixed(3)})`;
      ctx.lineWidth = 1.5;
      for (let k = 0; k < N; k++) {
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(C[k] * s, Sm[k] * s); ctx.stroke();
      }
      ctx.restore();
    });

    return { stop() { stopped = true; } };
  },
};
