// submarine - a little yellow sub follows your finger through the reef, blowing bubbles everywhere.
export default {
  id: "submarine",
  colors: ["#facc15", "#0ea5e9"],

  icon(ctx, size, t) {
    // hull
    ctx.fillStyle = this.colors[0];
    ctx.beginPath(); ctx.ellipse(size * 0.46, size * 0.58, size * 0.3, size * 0.17, 0, 0, 7); ctx.fill();
    // tower + periscope
    ctx.fillRect(size * 0.44, size * 0.34, size * 0.14, size * 0.14);
    ctx.fillRect(size * 0.55, size * 0.24, size * 0.03, size * 0.12);
    // window
    ctx.fillStyle = "#bae6fd";
    ctx.beginPath(); ctx.arc(size * 0.62, size * 0.58, size * 0.06, 0, 7); ctx.fill();
    // propeller
    ctx.fillStyle = "#94a3b8";
    const spin = Math.sin(t * 6) * size * 0.07;
    ctx.beginPath(); ctx.ellipse(size * 0.15, size * 0.58, size * 0.02, size * 0.09 + Math.abs(spin) * 0.3, 0, 0, 7); ctx.fill();
    // bubbles rising on a loop
    for (let i = 0; i < 3; i++) {
      const b = (t * 0.5 + i * 0.33) % 1;
      ctx.strokeStyle = "rgba(186,230,253,0.9)";
      ctx.lineWidth = size * 0.02;
      ctx.beginPath(); ctx.arc(size * 0.2, size * (0.42 - b * 0.3), size * (0.03 + 0.02 * b), 0, 7); ctx.stroke();
    }
  },

  start(stage) {
    const rand = stage.rand;
    let stopped = false;
    let idle = 0, lastPing = -9, lastWhoosh = -9, prop = 0, bubbleTick = 0;
    const sub = { x: 0, y: 0, vx: 0, vy: 0, heading: 1 };
    let target = null;
    const held = new Set();
    const bubbles = [];
    const fish = [];

    function spawnBubble(x, y, big) {
      bubbles.push({ x, y, r: (big ? 4 : 2) + rand() * 4, wob: rand() * 7, rise: 26 + rand() * 40, life: 0, max: 2 + rand() * 2 });
      while (bubbles.length > 220) bubbles.shift();
    }

    stage.onPointer({
      down(p) {
        idle = 0; held.add(p.id); target = { x: p.x, y: p.y };
        for (let i = 0; i < 12; i++) spawnBubble(p.x + (rand() - 0.5) * 30, p.y + (rand() - 0.5) * 30, true);
        stage.audio.pop();
      },
      move(p) { idle = 0; if (held.size) target = { x: p.x, y: p.y }; },
      up(p) { held.delete(p.id); },
    });

    stage.onFrame((dt, t) => {
      if (stopped) return;
      idle += dt;
      const { ctx, width: W, height: H } = stage;
      const m = Math.min(W, H);
      if (!sub.x) { sub.x = W * 0.5; sub.y = H * 0.4; }

      // fish are always on the move - the reef never sleeps
      if (fish.length < 6 && rand() < 0.02) {
        const dir = rand() < 0.5 ? 1 : -1;
        fish.push({ x: dir > 0 ? -60 : W + 60, y: H * (0.2 + rand() * 0.5), dir, sp: 30 + rand() * 50, col: rand() < 0.5 ? "#fb923c" : "#f472b6", ph: rand() * 7 });
      }

      // where to: the finger, or a lazy wander when nobody plays
      let wx = W * (0.5 + 0.32 * Math.sin(t * 0.18)), wy = H * (0.4 + 0.2 * Math.sin(t * 0.11 + 2));
      if (target && (idle <= 2.5 || held.size > 0)) { wx = target.x; wy = target.y; }

      const dx = wx - sub.x, dy = wy - sub.y;
      sub.vx += dx * 2.4 * dt - sub.vx * Math.min(1, dt * 1.6);
      sub.vy += dy * 2.4 * dt - sub.vy * Math.min(1, dt * 1.6);
      sub.x += sub.vx * dt; sub.y += sub.vy * dt;
      sub.x = Math.max(m * 0.12, Math.min(W - m * 0.12, sub.x));
      sub.y = Math.max(H * 0.08, Math.min(H * 0.88, sub.y));
      const speed = Math.hypot(sub.vx, sub.vy);
      if (speed > 8) sub.heading = sub.vx >= 0 ? 1 : -1;
      // blades turn up to 6 rad/s: two blades make under 2 passes a second, no strobe
      prop += Math.min(6, speed * 0.04 + 1.2) * dt;
      if (speed > 140 && t - lastWhoosh > 1.2) { stage.audio.whoosh(); lastWhoosh = t; }

      // exhaust trail while cruising, and a sonar ping every few seconds
      bubbleTick += dt * (1 + speed * 0.02);
      while (bubbleTick > 0.08) { bubbleTick -= 0.08; spawnBubble(sub.x - sub.heading * m * 0.11, sub.y + m * 0.02, false); }
      if (t - lastPing > 3.2 && speed < 40) { stage.audio.note(880, 0.05); lastPing = t; }

      // ---- water ----
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#38bdf8");
      g.addColorStop(1, "#075985");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      // sunbeams: two wide translucent slabs swaying
      ctx.fillStyle = "rgba(224,242,254,0.12)";
      for (let k = 0; k < 2; k++) {
        const sway = Math.sin(t * 0.3 + k * 2) * W * 0.05;
        ctx.beginPath();
        ctx.moveTo(W * (0.25 + k * 0.4) + sway, 0);
        ctx.lineTo(W * (0.4 + k * 0.4) + sway, 0);
        ctx.lineTo(W * (0.55 + k * 0.4) + sway * 2, H);
        ctx.lineTo(W * (0.2 + k * 0.4) + sway * 2, H);
        ctx.closePath(); ctx.fill();
      }
      // seabed + rocks + waving weed
      ctx.fillStyle = "#d6b374";
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let i = 0; i <= 8; i++) ctx.lineTo((i / 8) * W, H - H * 0.05 - Math.sin(i * 1.9) * H * 0.014);
      ctx.lineTo(W, H);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#64748b";
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.ellipse(W * (0.12 + k * 0.26), H * 0.955, m * (0.03 + (k % 2) * 0.014), m * 0.02, 0, 0, 7);
        ctx.fill();
      }
      ctx.strokeStyle = "#16a34a";
      ctx.lineWidth = Math.max(2.5, m * 0.008);
      ctx.lineCap = "round";
      for (let k = 0; k < 4; k++) {
        const x0 = W * (0.06 + k * 0.3);
        ctx.beginPath();
        ctx.moveTo(x0, H * 0.96);
        ctx.quadraticCurveTo(x0 + Math.sin(t * 1.3 + k) * m * 0.03, H * 0.88, x0 + Math.sin(t * 1.1 + k) * m * 0.05, H * 0.82);
        ctx.stroke();
      }

      // fish
      for (let i = fish.length - 1; i >= 0; i--) {
        const f = fish[i];
        f.x += f.dir * f.sp * dt;
        const fy = f.y + Math.sin(t * 2 + f.ph) * H * 0.01;
        if (f.x < -80 || f.x > W + 80) { fish.splice(i, 1); continue; }
        const fs = m * 0.03;
        ctx.save();
        ctx.translate(f.x, fy);
        ctx.scale(f.dir, 1);
        ctx.fillStyle = f.col;
        ctx.beginPath(); ctx.ellipse(0, 0, fs, fs * 0.6, 0, 0, 7); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-fs * 0.9, 0);
        ctx.lineTo(-fs * 1.5, -fs * 0.5 + Math.sin(t * 8 + f.ph) * fs * 0.15);
        ctx.lineTo(-fs * 1.5, fs * 0.5 + Math.sin(t * 8 + f.ph) * fs * 0.15);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#0f172a";
        ctx.beginPath(); ctx.arc(fs * 0.5, -fs * 0.1, fs * 0.1, 0, 7); ctx.fill();
        ctx.restore();
      }

      // bubbles
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        b.life += dt;
        if (b.life > b.max || b.y < -10) { bubbles.splice(i, 1); continue; }
        b.y -= b.rise * dt;
        b.x += Math.sin(t * 3 + b.wob) * 12 * dt;
        ctx.strokeStyle = "rgba(224,242,254,0.75)";
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.stroke();
      }

      // ---- submarine ----
      const r = m * 0.085;
      ctx.save();
      ctx.translate(sub.x, sub.y);
      ctx.scale(sub.heading, 1);
      ctx.rotate(Math.max(-0.4, Math.min(0.4, sub.vy * 0.002)) * sub.heading);
      // headlight cone in the direction of travel
      ctx.fillStyle = "rgba(253,224,71,0.14)";
      ctx.beginPath();
      ctx.moveTo(r * 0.9, 0);
      ctx.lineTo(r * 4.2, -r * 1.6);
      ctx.lineTo(r * 4.2, r * 1.6);
      ctx.closePath(); ctx.fill();
      // propeller: two blades turning as lines, not a flickering disc
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = Math.max(2, r * 0.1);
      ctx.beginPath();
      ctx.moveTo(-r * 1.05, 0);
      ctx.lineTo(-r * 1.05 + Math.cos(prop) * r * 0.4, Math.sin(prop) * r * 0.4);
      ctx.moveTo(-r * 1.05, 0);
      ctx.lineTo(-r * 1.05 - Math.cos(prop) * r * 0.4, -Math.sin(prop) * r * 0.4);
      ctx.stroke();
      // tail fin
      ctx.fillStyle = "#eab308";
      ctx.beginPath();
      ctx.moveTo(-r * 0.8, 0);
      ctx.lineTo(-r * 1.35, -r * 0.5);
      ctx.lineTo(-r * 1.35, r * 0.5);
      ctx.closePath(); ctx.fill();
      // hull + stripe
      ctx.fillStyle = this.colors[0];
      ctx.beginPath(); ctx.ellipse(0, 0, r * 1.15, r * 0.66, 0, 0, 7); ctx.fill();
      ctx.fillStyle = this.colors[1];
      ctx.fillRect(-r * 1.1, -r * 0.12, r * 2.2, r * 0.2);
      // tower, periscope, portholes
      ctx.fillStyle = "#eab308";
      ctx.fillRect(-r * 0.25, -r * 1.15, r * 0.6, r * 0.55);
      ctx.fillRect(r * 0.25, -r * 1.5, r * 0.08, r * 0.4);
      ctx.fillStyle = "#bae6fd";
      ctx.beginPath(); ctx.arc(r * 0.62, 0, r * 0.24, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(-r * 0.2, r * 0.05, r * 0.16, 0, 7); ctx.fill();
      ctx.restore();
    });

    return { stop() { stopped = true; } };
  },
};
