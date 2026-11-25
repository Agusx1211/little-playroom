// turtles: a warm pond with a log. Turtles sun themselves on the log with heads out. Tapping a turtle
// startles it: plop — it slides in, sinks, and cruises under the surface leaving a bubble trail;
// ripples made on the water draw the nearest diver up to peek at them. Then it climbs back on the
// log, shakes the water off in a spray, and settles. A tap on the log makes every turtle on it duck
// its head in, then peek again.
//
// A turtle's mind, as explicit states:
//   BASKING -(tapped)-> PLOP (0.4 s slide) -> DIVING -> CRUISING -(3-6 s, or ripple called it
//   and it looked -> RIPPLE -> CRUISING) -> CLIMB (to the log) -> SHAKING (1 s) -> BASKING.

const TURTLES = 5;
const MAX_BUBBLES = 90;
const MAX_DROPS = 60;
const MAX_RINGS = 20;

const Mood = Object.freeze({ BASKING: 'basking', PLOP: 'plop', CRUISING: 'cruising', CLIMB: 'climb', SHAKING: 'shaking' });

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function lerp(a, b, k) { return a + (b - a) * k; }

export default {
  id: 'turtles',
  colors: ['#6fd3c8', '#3a7d44'],

  icon(ctx, size, t) {
    ctx.fillStyle = '#3a8d88';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#7a5a38';
    ctx.fillRect(size * 0.1, size * 0.66, size * 0.8, size * 0.14);
    const bob = Math.sin(t * 2) * size * 0.012;
    const x = size * 0.5, y = size * 0.6 + bob;
    ctx.fillStyle = '#3a7d44';
    ctx.beginPath();
    ctx.ellipse(x, y, size * 0.26, size * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#27562f';
    ctx.lineWidth = size * 0.015;
    for (let k = -1; k <= 1; k++) {
      ctx.beginPath();
      ctx.moveTo(x + k * size * 0.11, y - size * 0.15);
      ctx.lineTo(x + k * size * 0.14, y + size * 0.14);
      ctx.stroke();
    }
    const peek = 0.6 + 0.4 * Math.max(0, Math.sin(t * 1.6));
    ctx.fillStyle = '#5a9a5f';
    ctx.beginPath();
    ctx.arc(x + size * 0.3 * peek, y - size * 0.05, size * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#182b18';
    ctx.beginPath();
    ctx.arc(x + size * 0.34 * peek, y - size * 0.07, size * 0.016, 0, Math.PI * 2);
    ctx.fill();
  },

  start(stage) {
    const ctx = stage.ctx;
    let stopped = false;
    let sinceTouch = 0, idleClock = 0, sinceSound = 0;
    const short = () => Math.min(stage.width, stage.height);
    const shellR = () => clamp(short() * 0.075, 24, 72);
    const log = () => ({ x: stage.width * 0.5, y: stage.height * 0.42, w: stage.width * 0.62, h: short() * 0.085 });
    const surfaceY = () => stage.height * 0.3;
    const bubbles = [], drops = [], rings = [];
    const turtles = Array.from({ length: TURTLES }, (_, i) => ({
      slot: (i + 0.5) / TURTLES,
      x: 0, y: 0, mood: Mood.BASKING, clock: stage.rand() * 3, heading: 0,
      head: 1, headTimer: 0, diveTo: null, look: null, seed: stage.rand(), flip: 1,
    }));
    for (const tr of turtles) placeOnLog(tr);

    function placeOnLog(tr) {
      const L = log();
      tr.x = L.x + (tr.slot - 0.5) * L.w * 0.86;
      tr.y = L.y - L.h * 0.55;
    }

    function plop(tr) {
      tr.mood = Mood.PLOP; tr.clock = 0; tr.head = 0.2;
      const L = log();
      tr.slideFrom = { x: tr.x, y: tr.y };
      tr.slideTo = { x: tr.x + (stage.rand() - 0.5) * short() * 0.2, y: surfaceY() + short() * (0.12 + stage.rand() * 0.18) };
      if (sinceSound > 0.2) { stage.audio.note(230, 0.1); stage.audio.whoosh(); sinceSound = 0; }
      if (rings.length < MAX_RINGS) rings.push({ x: tr.slideTo.x, y: tr.slideTo.y, r: shellR(), life: 1 });
    }

    function startleLog() {
      let any = false;
      for (const tr of turtles) {
        if (tr.mood === Mood.BASKING) { tr.head = 0; tr.headTimer = 1.1 + stage.rand() * 0.8; any = true; }   // head in
      }
      if (any && sinceSound > 0.3) { stage.audio.note(320, 0.16); sinceSound = 0; }
    }

    function shake(tr) {
      const r = shellR();
      for (let k = 0; k < 8 && drops.length < MAX_DROPS; k++) {
        const a = stage.rand() * Math.PI * 2;
        drops.push({ x: tr.x, y: tr.y, vx: Math.cos(a) * short() * (0.15 + stage.rand() * 0.2), vy: Math.sin(a) * short() * 0.2 - short() * 0.1, life: 1 });
      }
      if (sinceSound > 0.25) { stage.audio.pop(); sinceSound = 0; }
    }

    function turtleAt(x, y) {
      let best = null, bestD = shellR() * 1.3;
      for (const tr of turtles) {
        const d = Math.hypot(tr.x - x, tr.y - y);
        if (d < bestD) { bestD = d; best = tr; }
      }
      return best;
    }

    function stepTurtle(tr, dt) {
      tr.clock += dt;
      const r = shellR();
      // head in-and-peek timer (only meaningful on the log)
      if (tr.mood === Mood.BASKING) {
        if (tr.headTimer > 0) {
          tr.headTimer -= dt;
          tr.head = lerp(tr.head, tr.headTimer > 0 ? 0.15 : 1, Math.min(1, dt * 6));
        } else tr.head = lerp(tr.head, 1, Math.min(1, dt * 3));
      }
      switch (tr.mood) {
        case Mood.BASKING:
          tr.y = log().y - log().h * 0.55 + Math.sin(tr.clock * 1.2 + tr.seed * 7) * short() * 0.004;
          break;
        case Mood.PLOP: {
          const k = clamp(tr.clock / 0.4, 0, 1);
          tr.x = lerp(tr.slideFrom.x, tr.slideTo.x, k);
          tr.y = lerp(tr.slideFrom.y, tr.slideTo.y, k) - Math.sin(k * Math.PI) * short() * 0.06;
          if (k >= 1) { tr.mood = Mood.CRUISING; tr.clock = 0; tr.heading = tr.seed < 0.5 ? 0 : Math.PI; }   // PLOP -> CRUISING
          break;
        }
        case Mood.CRUISING: {
          // steady cruise; a ripple it decided to look at pulls it there
          const target = tr.look;
          const desired = target
            ? Math.atan2(target.y - tr.y, target.x - tr.x)
            : tr.heading;
          const turn = ((desired - tr.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
          tr.heading += clamp(turn, -dt * 2.5, dt * 2.5);
          const v = short() * (target ? 0.14 : 0.07);
          tr.x += Math.cos(tr.heading) * v * dt;
          tr.y += Math.sin(tr.heading) * v * dt * 0.6;
          tr.flip = Math.cos(tr.heading) >= 0 ? 1 : -1;
          tr.y = clamp(tr.y, surfaceY() + r * 0.8, stage.height * 0.94);
          if (tr.look && Math.hypot(tr.look.x - tr.x, tr.look.y - tr.y) < r) {
            tr.look = null; tr.headTimer = 1.2;            // surface peek: head up a while, back down
            tr.head = 0.8;
            if (rings.length < MAX_RINGS) rings.push({ x: tr.x, y: tr.y, r: r * 0.7, life: 1 });
          }
          if (tr.headTimer > 0 && tr.mood === Mood.CRUISING) { tr.headTimer -= dt; tr.head = lerp(tr.head, tr.headTimer > 0 ? 0.75 : 0, Math.min(1, dt * 5)); }
          else if (tr.mood === Mood.CRUISING) tr.head = lerp(tr.head, 0, Math.min(1, dt * 3));
          // bubbles trail
          if (bubbles.length < MAX_BUBBLES && stage.rand() < dt * 6) {
            bubbles.push({ x: tr.x - tr.flip * r * 0.8, y: tr.y, r: short() * (0.004 + stage.rand() * 0.004), life: 1 });
          }
          if (tr.clock > 3 + tr.seed * 3 && !tr.look) {    // time to climb out
            tr.mood = Mood.CLIMB; tr.clock = 0;
            const slot = tr.slot;
            const L = log();
            tr.climbTo = { x: L.x + (slot - 0.5) * L.w * 0.86, y: L.y - L.h * 0.55 };
            tr.riseFrom = tr.y;
            if (rings.length < MAX_RINGS) rings.push({ x: tr.x, y: tr.y, r: r, life: 1 });
          }
          break;
        }
        case Mood.CLIMB: {
          const k = clamp(tr.clock / 1.4, 0, 1);
          tr.x = lerp(tr.x, tr.climbTo.x, Math.min(1, dt * 3));
          tr.y = lerp(tr.y, tr.climbTo.y, Math.min(1, dt * 2.5));
          tr.head = lerp(tr.head, 1, Math.min(1, dt * 4));
          if (Math.hypot(tr.x - tr.climbTo.x, tr.y - tr.climbTo.y) < short() * 0.015) {
            tr.mood = Mood.SHAKING; tr.clock = 0;          // CLIMB -> SHAKING
            tr.x = tr.climbTo.x; tr.y = tr.climbTo.y;
            shake(tr);
          }
          break;
        }
        case Mood.SHAKING:
          if (tr.clock > 1) { tr.mood = Mood.BASKING; tr.clock = 0; }   // SHAKING -> BASKING
          break;
      }
    }

    const offFrame = stage.onFrame((dt, t) => {
      if (stopped) return;
      sinceTouch += dt; sinceSound += dt;
      // Idle: after 5 s a basking turtle stretches and one bobs its head; now and then one plops in by itself.
      if (sinceTouch > 5) {
        idleClock += dt;
        if (idleClock > 7) {
          idleClock = 0;
          const tr = turtles.find(x => x.mood === Mood.BASKING);
          if (tr) plop(tr);
        }
      }
      for (const tr of turtles) stepTurtle(tr, dt);
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        b.y -= short() * 0.05 * dt; b.life -= dt * 0.5;
        if (b.life <= 0 || b.y < surfaceY()) bubbles.splice(i, 1);
      }
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        d.vy += short() * 2 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.life -= dt * 1.4;
        if (d.life <= 0) drops.splice(i, 1);
      }
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.r += dt * short() * 0.28; r.life -= dt * 1.5;
        if (r.life <= 0) rings.splice(i, 1);
      }

      // water, then the log, then the turtles
      const water = ctx.createLinearGradient(0, 0, 0, stage.height);
      water.addColorStop(0, '#66c2bb'); water.addColorStop(1, '#2e6f77');
      ctx.fillStyle = water;
      ctx.fillRect(0, 0, stage.width, stage.height);
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      for (let k = 0; k < 4; k++) {
        const y = stage.height * (0.2 + k * 0.22);
        const x = ((t * 26 + k * 220) % (stage.width + 200)) - 100;
        ctx.beginPath();
        ctx.ellipse(x, y, short() * 0.11, short() * 0.01, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // sun
      ctx.fillStyle = '#fff3b0';
      ctx.beginPath();
      ctx.arc(stage.width * 0.12, stage.height * 0.1, short() * 0.05, 0, Math.PI * 2);
      ctx.fill();
      // the log
      const L = log();
      ctx.fillStyle = '#7a5a38';
      ctx.beginPath();
      ctx.ellipse(L.x, L.y, L.w * 0.5, L.h * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#5d4228';
      ctx.lineWidth = 2;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.ellipse(L.x, L.y, L.w * 0.16 * (1 - k * 0.28), L.h * 0.32 * (1 - k * 0.28), 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      // ripples
      ctx.strokeStyle = '#eafcff';
      ctx.lineWidth = 2.5;
      for (const r of rings) {
        ctx.globalAlpha = clamp(r.life, 0, 1) * 0.6;
        ctx.beginPath();
        ctx.ellipse(r.x, r.y, r.r, r.r * 0.42, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // turtles: submerged ones as a dark blur under a shimmer; surface ones solid
      for (const tr of turtles) {
        const r = shellR();
        const deep = tr.mood === Mood.CRUISING;
        const sinking = tr.mood === Mood.PLOP;
        const k = sinking ? clamp(tr.clock / 0.4, 0, 1) : 1;
        const fade = deep ? 0.4 : sinking ? lerp(1, 0.55, k) : 1;
        ctx.globalAlpha = fade;
        // legs
        ctx.fillStyle = '#5a9a5f';
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.ellipse(tr.x + s * r * 0.85 * tr.flip, tr.y + r * 0.35, r * 0.3, r * 0.16, s * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
        // shell
        ctx.fillStyle = '#3a7d44';
        ctx.beginPath();
        ctx.ellipse(tr.x, tr.y, r, r * 0.75, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#27562f';
        ctx.lineWidth = 2;
        for (let c = -1; c <= 1; c++) {
          ctx.beginPath();
          ctx.moveTo(tr.x + c * r * 0.45, tr.y - r * 0.6);
          ctx.lineTo(tr.x + c * r * 0.6, tr.y + r * 0.6);
          ctx.stroke();
        }
        // head: tr.head 0 = hidden, 1 = out
        if (tr.head > 0.05) {
          ctx.fillStyle = '#5a9a5f';
          ctx.beginPath();
          ctx.arc(tr.x + tr.flip * r * (0.9 + tr.head * 0.35), tr.y - r * 0.15 - tr.head * r * 0.2, r * 0.3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#182b18';
          ctx.beginPath();
          ctx.arc(tr.x + tr.flip * r * (1.02 + tr.head * 0.4), tr.y - r * 0.24 - tr.head * r * 0.22, r * 0.05, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      // bubbles under water, spray drops above
      ctx.strokeStyle = '#eafcff';
      for (const b of bubbles) {
        ctx.globalAlpha = clamp(b.life, 0, 1) * 0.5;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = '#eafcff';
      for (const d of drops) {
        ctx.globalAlpha = clamp(d.life, 0, 1);
        ctx.beginPath();
        ctx.arc(d.x, d.y, short() * 0.005 + 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    });

    const offPointer = stage.onPointer({
      down(p) {
        if (stopped) return;
        sinceTouch = 0;
        if (rings.length < MAX_RINGS) rings.push({ x: p.x, y: p.y, r: short() * 0.03, life: 1 });
        const tr = turtleAt(p.x, p.y);
        if (tr) {
          if (tr.mood === Mood.BASKING || tr.mood === Mood.SHAKING) { plop(tr); return; }
          if (tr.mood === Mood.CRUISING) {           // poke a diver: it plops deeper and changes course
            tr.heading = tr.heading + Math.PI;
            tr.clock = Math.max(0, tr.clock - 1);
            if (bubbles.length + 6 < MAX_BUBBLES) {
              for (let k = 0; k < 6; k++) bubbles.push({ x: tr.x, y: tr.y, r: short() * (0.005 + stage.rand() * 0.006), life: 1 });
            }
            if (sinceSound > 0.2) { stage.audio.note(190, 0.12); sinceSound = 0; }
            return;
          }
        }
        const L = log();
        if (Math.abs(p.x - L.x) < L.w * 0.55 && Math.abs(p.y - L.y) < L.h * 1.2) { startleLog(); return; }
        if (p.y > surfaceY()) {                       // a ripple on the water: nearest diver swims to look
          const diver = turtles.filter(t => t.mood === Mood.CRUISING)
            .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
          if (diver) diver.look = { x: p.x, y: p.y };
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
      debug: () => ({ entities: turtles.length + bubbles.length + drops.length + rings.length, states: turtles.map(t => t.mood) }),
    };
  },
};
