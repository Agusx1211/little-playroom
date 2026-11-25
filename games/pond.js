// pond: a dark pond seen from above, with koi and lily pads. Every touch drops a ripple on the
// water; the fish turn and swim to it, and a finger held still keeps them gathered round it.
// Lily pads bob when a ripple passes. When nobody touches, a fish now and then nudges the surface.

const FISH = 9;
const PADS = 5;
const MAX_RIPPLES = 48;
const SEGMENTS = 7;
const KOI = [['#ff7a3d', '#fff1e0'], ['#ffd25c', '#ff7a3d'], ['#fff1e0', '#ff5a5a'], ['#ff9f5a', '#20202a']];

// A fish's mind, as explicit states:
//   WANDERING -(a ripple or finger nearby)-> COMING -(close)-> NIBBLING -(1.2 s, finger gone)-> WANDERING
//   NIBBLING stays while the finger it came for is still down. COMING gives up after 4 s.
const Fish = Object.freeze({ WANDERING: 'wandering', COMING: 'coming', NIBBLING: 'nibbling' });

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function angleTo(a, b) { return ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI; }

export default {
  id: 'pond',
  colors: ['#73d4c2', '#d5f7b4'],

  icon(ctx, size, t) {
    ctx.fillStyle = '#06222c';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(160,230,220,0.6)';
    ctx.lineWidth = size * 0.02;
    const r = size * (0.1 + ((t * 0.5) % 1) * 0.3);
    ctx.beginPath(); ctx.arc(size * 0.5, size * 0.5, r, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ff7a3d';
    const a = t * 1.2;
    ctx.beginPath();
    ctx.ellipse(size * 0.5 + Math.cos(a) * size * 0.25, size * 0.5 + Math.sin(a) * size * 0.25, size * 0.1, size * 0.045, a + Math.PI / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3f8f4f';
    ctx.beginPath(); ctx.arc(size * 0.28, size * 0.3, size * 0.1, 0.3, Math.PI * 2 - 0.3); ctx.lineTo(size * 0.28, size * 0.3); ctx.fill();
  },

  start(stage) {
    const ctx = stage.ctx;
    let stopped = false;
    let sinceTouch = 0, sinceDrop = 1, idleClock = 0;
    const short = () => Math.min(stage.width, stage.height);
    const fishLen = () => clamp(short() * 0.11, 50, 150);
    const fingers = new Map();   // pointer id -> {x, y}
    const ripples = [];
    const fish = Array.from({ length: FISH }, (_, i) => {
      const x = stage.rand() * stage.width, y = stage.rand() * stage.height, heading = stage.rand() * Math.PI * 2;
      return {
        state: Fish.WANDERING, clock: 0, x, y, heading, speed: 0, wiggle: stage.rand() * 6,
        colors: KOI[i % KOI.length], size: 0.8 + stage.rand() * 0.4, target: null, finger: null,
        trail: Array.from({ length: SEGMENTS }, () => ({ x, y })), turn: (stage.rand() - 0.5) * 0.6,
      };
    });
    const pads = Array.from({ length: PADS }, (_, i) => ({
      x: (0.15 + 0.7 * ((i * 0.618) % 1)), y: (0.15 + 0.7 * ((i * 0.37 + 0.2) % 1)),
      r: 0.06 + stage.rand() * 0.03, a: stage.rand() * Math.PI * 2, bob: 0, flower: i % 2 === 0,
    }));

    function drop(x, y, big) {
      if (ripples.length >= MAX_RIPPLES) ripples.shift();
      ripples.push({ x, y, r: big ? short() * 0.03 : short() * 0.01, life: big ? 1.6 : 1, w: big ? 5 : 3 });
      if (big && sinceDrop > 0.08) { stage.audio.note(clamp(900 - 500 * (y / Math.max(1, stage.height)), 300, 1200), 0.25); sinceDrop = 0; }
    }

    // A ripple calls the fish close to it (the nearer half of them, at most five).
    function call(x, y, fingerId) {
      const near = fish.slice().sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y)).slice(0, 5);
      for (const f of near) {
        if (f.state === Fish.NIBBLING && f.finger !== null && fingers.has(f.finger)) continue;   // busy with its own finger
        f.state = Fish.COMING; f.clock = 0; f.finger = fingerId;
        // Each comes to its own spot round the ripple, so they gather in a ring and do not pile up.
        const a = stage.rand() * Math.PI * 2, d = fishLen() * (0.6 + stage.rand() * 0.5);
        f.target = { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, cx: x, cy: y };
      }
    }

    function stepFish(f, dt, t) {
      f.clock += dt;
      let want = f.heading, speed = short() * 0.06;
      switch (f.state) {
        case Fish.WANDERING: {
          f.turn += (stage.rand() - 0.5) * dt * 2;
          f.turn = clamp(f.turn, -0.8, 0.8);
          want = f.heading + f.turn;
          // Turn back from the banks.
          const m = fishLen();
          if (f.x < m) want = 0; else if (f.x > stage.width - m) want = Math.PI;
          if (f.y < m) want = Math.PI / 2; else if (f.y > stage.height - m) want = -Math.PI / 2;
          speed = short() * (sinceTouch > 5 ? 0.04 : 0.06);
          break;
        }
        case Fish.COMING: {
          const dx = f.target.x - f.x, dy = f.target.y - f.y, d = Math.hypot(dx, dy);
          want = Math.atan2(dy, dx);
          speed = clamp(d * 2, short() * 0.1, short() * 0.4);
          if (d < fishLen() * 0.3) { f.state = Fish.NIBBLING; f.clock = 0; }
          else if (f.clock > 4) { f.state = Fish.WANDERING; f.clock = 0; f.target = null; f.finger = null; }
          break;
        }
        case Fish.NIBBLING: {
          // Face the centre and hover, with small nudges.
          want = Math.atan2(f.target.cy - f.y, f.target.cx - f.x);
          speed = short() * 0.01 * (1 + Math.sin(t * 6 + f.wiggle));
          const held = f.finger !== null && fingers.has(f.finger);
          if (!held && f.clock > 1.2) { f.state = Fish.WANDERING; f.clock = 0; f.target = null; f.finger = null; f.heading += Math.PI * 0.6; }
          break;
        }
      }
      f.heading += clamp(angleTo(f.heading, want), -dt * 4, dt * 4);
      f.speed += (speed - f.speed) * Math.min(1, dt * 3);
      f.x += Math.cos(f.heading) * f.speed * dt;
      f.y += Math.sin(f.heading) * f.speed * dt;
      f.x = clamp(f.x, 0, stage.width); f.y = clamp(f.y, 0, stage.height);
      // The body follows the head, one segment at a time.
      f.trail[0].x = f.x; f.trail[0].y = f.y;
      const seg = fishLen() * f.size / SEGMENTS;
      for (let i = 1; i < SEGMENTS; i++) {
        const a = f.trail[i - 1], b = f.trail[i];
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
        b.x = a.x + dx / d * seg; b.y = a.y + dy / d * seg;
      }
    }

    function drawFish(f, t) {
      const L = fishLen() * f.size;
      ctx.fillStyle = f.colors[0];
      for (let i = SEGMENTS - 1; i >= 0; i--) {
        const p = f.trail[i];
        const w = L * 0.16 * Math.sin(Math.PI * (0.25 + 0.75 * (1 - i / SEGMENTS)));
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(2, w), 0, Math.PI * 2);
        ctx.fill();
      }
      // A tail that flicks with the speed, and a patch of the second colour.
      const tail = f.trail[SEGMENTS - 1], before = f.trail[SEGMENTS - 2];
      const ta = Math.atan2(tail.y - before.y, tail.x - before.x) + Math.sin(t * 8 + f.wiggle) * 0.4;
      ctx.beginPath();
      ctx.moveTo(tail.x, tail.y);
      ctx.lineTo(tail.x + Math.cos(ta - 0.5) * L * 0.25, tail.y + Math.sin(ta - 0.5) * L * 0.25);
      ctx.lineTo(tail.x + Math.cos(ta + 0.5) * L * 0.25, tail.y + Math.sin(ta + 0.5) * L * 0.25);
      ctx.closePath();
      ctx.fill();
      const mid = f.trail[2];
      ctx.fillStyle = f.colors[1];
      ctx.beginPath();
      ctx.arc(mid.x, mid.y, L * 0.09, 0, Math.PI * 2);
      ctx.fill();
    }

    const offFrame = stage.onFrame((dt, t) => {
      if (stopped) return;
      sinceTouch += dt; sinceDrop += dt;
      if (sinceTouch > 5) {
        idleClock += dt;
        if (idleClock > 2.5) {   // a fish nudges the surface: a small ripple over its head
          idleClock = 0;
          const f = fish[Math.floor(stage.rand() * FISH) % FISH];
          drop(f.x, f.y, false);
        }
      }
      // A held finger keeps dropping slow ripples, and keeps its fish.
      for (const [id, p] of fingers) {
        p.age += dt;
        if (p.age > 0.7) { p.age = 0; drop(p.x, p.y, false); }
        for (const f of fish) if (f.finger === id && f.target) {
          f.target.x += p.x - f.target.cx; f.target.y += p.y - f.target.cy; f.target.cx = p.x; f.target.cy = p.y;
        }
      }
      for (const f of fish) stepFish(f, dt, t);
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.r += dt * short() * 0.16; r.life -= dt * 0.7;
        if (r.life <= 0) { ripples.splice(i, 1); continue; }
        for (const pad of pads) {
          const d = Math.hypot(pad.x * stage.width - r.x, pad.y * stage.height - r.y);
          if (Math.abs(d - r.r) < short() * 0.02) pad.bob = Math.max(pad.bob, r.life);
        }
      }
      for (const pad of pads) pad.bob = Math.max(0, pad.bob - dt * 1.5);

      ctx.fillStyle = '#062630';
      ctx.fillRect(0, 0, stage.width, stage.height);
      // Soft light patches on the water.
      ctx.fillStyle = 'rgba(40,110,120,0.18)';
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.ellipse(stage.width * (0.2 + k * 0.22), stage.height * (0.3 + 0.4 * ((k * 0.7) % 1)) + Math.sin(t * 0.3 + k) * 10, short() * 0.22, short() * 0.12, k, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const f of fish) drawFish(f, t);
      ctx.lineWidth = 3;
      for (const r of ripples) {
        ctx.strokeStyle = `rgba(170,235,225,${(clamp(r.life, 0, 1) * 0.7).toFixed(3)})`;
        ctx.lineWidth = r.w;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
        ctx.stroke();
      }
      for (const pad of pads) {
        const x = pad.x * stage.width, y = pad.y * stage.height, r = pad.r * short() * (1 + 0.08 * Math.sin(pad.bob * 10));
        ctx.fillStyle = '#2f7f45';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.arc(x, y, r, pad.a + 0.35, pad.a + Math.PI * 2 - 0.35);
        ctx.closePath();
        ctx.fill();
        if (pad.flower) {
          ctx.fillStyle = '#f7b6d2';
          for (let k = 0; k < 6; k++) {
            const a = k / 6 * Math.PI * 2 + t * 0.1;
            ctx.beginPath();
            ctx.arc(x + Math.cos(a) * r * 0.22, y + Math.sin(a) * r * 0.22, r * 0.17, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = '#ffe27a';
          ctx.beginPath(); ctx.arc(x, y, r * 0.12, 0, Math.PI * 2); ctx.fill();
        }
      }
    });

    const offPointer = stage.onPointer({
      down(p) {
        if (stopped) return;
        sinceTouch = 0; idleClock = 0;
        fingers.set(p.id, { x: p.x, y: p.y, age: 0 });
        drop(p.x, p.y, true);   // the ripple is on screen the frame the finger lands
        call(p.x, p.y, p.id);
      },
      move(p) {
        const f = fingers.get(p.id);
        if (stopped || !f) return;
        sinceTouch = 0;
        f.x = p.x; f.y = p.y;
      },
      up(p) { fingers.delete(p.id); },
    });

    return {
      stop() {
        stopped = true;
        for (const off of [offFrame, offPointer]) if (typeof off === 'function') off();
      },
      debug: (x = 0, y = 0, r = 0) => ({
        entities: FISH + PADS + ripples.length,
        states: fish.map(f => f.state),
        near: fish.filter(f => Math.hypot(f.x - x, f.y - y) <= r).length,
        finite: fish.every(f => Number.isFinite(f.x) && Number.isFinite(f.y)),
      }),
    };
  },
};
