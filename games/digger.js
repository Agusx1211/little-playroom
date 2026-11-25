// digger - a sandpit digger; press anywhere and the bucket drives there, digs, and sprays sand.
export default {
  id: "digger",
  colors: ["#fb923c", "#78350f"],

  icon(ctx, size, t) {
    const swing = Math.sin(t * 2) * 0.35; // the arm digs away in the picker
    // body on tracks
    ctx.fillStyle = this.colors[0];
    ctx.fillRect(size * 0.16, size * 0.55, size * 0.42, size * 0.2);
    ctx.fillStyle = this.colors[1];
    ctx.fillRect(size * 0.24, size * 0.36, size * 0.22, size * 0.2);
    ctx.fillStyle = "#3f3f46";
    ctx.beginPath(); ctx.ellipse(size * 0.37, size * 0.8, size * 0.26, size * 0.09, 0, 0, 7); ctx.fill();
    // arm + bucket
    ctx.save();
    ctx.translate(size * 0.55, size * 0.5);
    ctx.rotate(-0.5 + swing);
    ctx.strokeStyle = this.colors[0];
    ctx.lineWidth = size * 0.07;
    ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(size * 0.3, 0); ctx.stroke();
    ctx.rotate(0.9 - swing * 1.6);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(size * 0.24, 0); ctx.stroke();
    ctx.fillStyle = "#52525b";
    ctx.beginPath(); ctx.arc(size * 0.3, size * 0.02, size * 0.08, 0.2, Math.PI - 0.2); ctx.fill();
    ctx.restore();
  },

  start(stage) {
    const rand = stage.rand;
    let stopped = false;
    let idle = 0, lastSound = -9, cloud = 0, lastH = 0;
    const COLS = 48;
    const sand = new Array(COLS).fill(0); // sand height per column, in pixels above the floor
    const held = new Set();
    let target = null; // where the finger wants the bucket
    let tx = 0, ty = 0; // bucket position, eases toward the target
    let load = 0; // sand in the bucket, dropped when the bucket lifts
    const grains = [];

    function base() { return stage.height * 0.16; }
    function clampSand(i) { sand[i] = Math.min(stage.height * 0.3, Math.max(base(), sand[i])); }

    function spray(x, y, n, dir) {
      for (let i = 0; i < n; i++) {
        grains.push({
          x, y,
          vx: (rand() - 0.5) * 160 - dir * 60 * rand(),
          vy: -140 - rand() * 220,
          life: 0, max: 0.6 + rand() * 0.6, r: 1.5 + rand() * 2,
        });
      }
      while (grains.length > 240) grains.shift();
    }

    stage.onPointer({
      down(p) { idle = 0; held.add(p.id); target = { x: p.x, y: p.y }; },
      move(p) { idle = 0; target = { x: p.x, y: p.y }; },
      up(p) { held.delete(p.id); },
    });

    stage.onFrame((dt, t) => {
      if (stopped) return;
      idle += dt;
      const { ctx, width: W, height: H } = stage;
      const m = Math.min(W, H);
      cloud += dt;
      if (lastH && lastH !== H) for (let i = 0; i < COLS; i++) sand[i] *= H / lastH; // the tablet turned
      lastH = H;

      // sand field settles and refills slowly, so the pit survives a whole play session
      for (let i = 0; i < COLS; i++) {
        if (sand[i] === 0) sand[i] = base() + H * 0.04 * Math.sin(i * 0.6) ** 2;
        sand[i] += (base() - sand[i]) * Math.min(1, dt * 0.04);
        clampSand(i);
      }
      const colW = W / COLS;
      const top = (i) => H - Math.min(H * 0.45, sand[i]);

      // where should the bucket be? finger if there is one, else a lazy idle scoop
      let wantX, wantY;
      if (target && (idle <= 2 || held.size > 0)) { wantX = target.x; wantY = target.y; }
      else {
        target = null;
        wantX = W * (0.55 + 0.28 * Math.sin(t * 0.5));
        wantY = top(Math.max(0, Math.min(COLS - 1, Math.floor((0.55 + 0.28 * Math.sin(t * 0.5)) * COLS)))) - 6;
      }

      // body sits on the sand at the left
      const bx = W * 0.2;
      const by = top(Math.floor(bx / colW)) - m * 0.05;
      const sx = bx + m * 0.08, sy = by - m * 0.1; // shoulder

      // bucket moves toward the want with a top speed
      const dx = wantX - tx, dy = wantY - ty;
      const d = Math.hypot(dx, dy), speed = Math.min(d, m * 1.1 * dt);
      if (d > 0.001) { tx += (dx / d) * speed; ty += (dy / d) * speed; }

      // digging: the bucket is under the sand and either still travelling or held there by a finger
      const bi = Math.max(0, Math.min(COLS - 1, Math.floor(tx / colW)));
      const digging = ty > top(bi) - 4 && (d > 4 || (held.size > 0 && ty >= top(bi) - 2));
      if (digging) {
        const removed = Math.min(60 * dt, sand[bi] - base() + 30 * dt);
        sand[bi] -= Math.max(0, removed);
        clampSand(bi);
        load = Math.min(1, load + dt * 1.4);
        if (rand() < 0.9) spray(tx, ty, 2, dx > 0 ? 1 : -1);
        if (t - lastSound > 0.14) { stage.audio.note(110 + rand() * 40, 0.06); lastSound = t; }
      }
      if (load > 0.5 && ty < top(bi) - m * 0.16) { // lifted clear: pour the load out
        spray(tx, ty + m * 0.02, 14, tx > W / 2 ? -1 : 1);
        load = 0;
        if (t - lastSound > 0.2) { stage.audio.pop(); lastSound = t; }
      }

      // ---- draw ----
      ctx.fillStyle = "#bfe3f7";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#fde68a";
      ctx.beginPath(); ctx.arc(W * 0.88, H * 0.12, m * 0.06, 0, 7); ctx.fill();
      // two clouds, drifting (idle motion)
      for (let c = 0; c < 2; c++) {
        const cx = ((cloud * (7 + c * 4) + c * W * 0.5 + W * 0.2) % (W + 260)) - 130;
        const cyy = H * (0.14 + c * 0.1);
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        for (let k = 0; k < 3; k++) {
          ctx.beginPath(); ctx.arc(cx + k * m * 0.045, cyy + (k % 2) * m * 0.01, m * (0.035 - k * 0.006), 0, 7); ctx.fill();
        }
      }

      // sand
      ctx.fillStyle = "#e8c47c";
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let i = 0; i < COLS; i++) ctx.lineTo(i * colW + colW / 2, top(i));
      ctx.lineTo(W, top(COLS - 1));
      ctx.lineTo(W, H);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#c99a4e";
      for (let i = 3; i < COLS; i += 5) {
        ctx.beginPath(); ctx.arc(i * colW, top(i) + m * 0.02 + Math.sin(i * 3.7) * 4, 2.2, 0, 7); ctx.fill();
      }

      // digger: tracks, body, cab
      ctx.fillStyle = "#3f3f46";
      ctx.beginPath(); ctx.ellipse(bx, by + m * 0.02, m * 0.11, m * 0.035, 0, 0, 7); ctx.fill();
      ctx.fillStyle = this.colors[0];
      ctx.fillRect(bx - m * 0.1, by - m * 0.09, m * 0.2, m * 0.08);
      ctx.fillStyle = "#fbbf24";
      ctx.fillRect(bx - m * 0.05, by - m * 0.16, m * 0.1, m * 0.07);
      ctx.fillStyle = "#93c5fd";
      ctx.fillRect(bx - m * 0.035, by - m * 0.145, m * 0.06, m * 0.045);

      // arm: two links from shoulder to bucket, elbow up
      const L1 = m * 0.3, L2 = m * 0.26;
      const ex0 = tx - sx, ey0 = ty - sy;
      const reach = Math.max(Math.abs(L1 - L2) + 1, Math.min(L1 + L2 - 1, Math.hypot(ex0, ey0)));
      const baseA = Math.atan2(ey0, ex0);
      const elbowA = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + reach * reach - L2 * L2) / (2 * L1 * reach))));
      const a1 = baseA - elbowA - 0.35;
      const ex = sx + Math.cos(a1) * L1, ey = sy + Math.sin(a1) * L1;
      ctx.strokeStyle = this.colors[0];
      ctx.lineWidth = m * 0.035;
      ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.fillStyle = "#52525b";
      ctx.beginPath(); ctx.arc(sx, sy, m * 0.022, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(ex, ey, m * 0.018, 0, 7); ctx.fill();

      // bucket: a wedge open toward the sand, mouth angle follows travel direction
      const mouth = Math.atan2(ty - ey, tx - ex) + Math.PI / 2;
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(mouth);
      ctx.fillStyle = "#52525b";
      ctx.beginPath();
      ctx.moveTo(-m * 0.05, 0);
      ctx.lineTo(m * 0.05, 0);
      ctx.lineTo(m * 0.035, m * 0.055);
      ctx.lineTo(-m * 0.035, m * 0.055);
      ctx.closePath();
      ctx.fill();
      if (load > 0) {
        ctx.fillStyle = "#e8c47c";
        ctx.beginPath(); ctx.arc(0, m * 0.01, m * 0.03 * load, 0, 7); ctx.fill();
      }
      ctx.restore();

      // sand grains
      for (let i = grains.length - 1; i >= 0; i--) {
        const g = grains[i];
        g.life += dt;
        if (g.life > g.max) { grains.splice(i, 1); continue; }
        g.vy += 620 * dt; g.x += g.vx * dt; g.y += g.vy * dt;
        const gi = Math.max(0, Math.min(COLS - 1, Math.floor(g.x / colW)));
        if (g.y > top(gi)) { sand[gi] = Math.min(H * 0.45, sand[gi] + g.r * 0.6); grains.splice(i, 1); continue; }
        ctx.fillStyle = "#d9ab5f";
        ctx.fillRect(g.x, g.y, g.r, g.r);
      }
    });

    return { stop() { stopped = true; } };
  },
};
