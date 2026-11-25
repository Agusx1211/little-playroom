// butterflies: a dusk garden. Butterflies drift in wandering loops; every touch calls the nearest ones
// over and they start wheeling in a spiral around the finger while it is held — move the finger and
// the whole whirl follows. Let go and they scatter back to drifting. When nobody touches, they wander
// on and a wing now and then shakes loose some scales.
//
// A butterfly's mind, as explicit states:
//   DRIFTING -(a finger called, within earshot)-> COMING -(reached the ring)-> ORBITING
//   ORBITING -(finger up, or held over 12 s)-> DRIFTING. COMING gives up after 4 s.

const MAX_BUTTERFLIES = 12;
const MAX_SCALES = 120;
const MAX_RINGS = 20;

const Wing = Object.freeze({ DRIFTING: 'drifting', COMING: 'coming', ORBITING: 'orbiting' });

const KINDS = [
  ['#c77dff', '#7f4fd1', '#fff1e0'], ['#ffb347', '#e07a1f', '#fff1e0'],
  ['#7fd1ff', '#2f7ec2', '#eafcff'], ['#ff8fa3', '#c23b5e', '#ffe9f0'],
];

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export default {
  id: 'butterflies',
  colors: ['#c77dff', '#2f2a55'],

  icon(ctx, size, t) {
    ctx.fillStyle = '#2f2a55';
    ctx.fillRect(0, 0, size, size);
    const x = size * (0.35 + 0.2 * Math.sin(t * 0.9)), y = size * (0.5 + 0.14 * Math.sin(t * 1.7));
    const flap = 0.35 + 0.65 * Math.abs(Math.sin(t * 5));
    ctx.fillStyle = '#c77dff';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(x + side * size * 0.14 * flap, y - size * 0.08, size * 0.16 * flap, size * 0.13, side * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x + side * size * 0.11 * flap, y + size * 0.09, size * 0.12 * flap, size * 0.1, side * -0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#fff1e0';
    ctx.beginPath();
    ctx.ellipse(x, y, size * 0.03, size * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
  },

  start(stage) {
    const ctx = stage.ctx;
    let stopped = false;
    let sinceTouch = 0, idleClock = 0, sinceNote = 0;
    const short = () => Math.min(stage.width, stage.height);
    const wingspan = () => clamp(short() * 0.09, 30, 90);
    const fingers = new Map();     // id -> {id, x, y, taken: how many ride this finger}
    const scales = [];
    const rings = [];
    const flies = Array.from({ length: MAX_BUTTERFLIES }, (_, i) => ({
      x: stage.width * (0.1 + 0.8 * stage.rand()), y: stage.height * (0.1 + 0.8 * stage.rand()),
      heading: stage.rand() * Math.PI * 2, speed: short() * (0.1 + stage.rand() * 0.08),
      flap: stage.rand() * 10, state: Wing.DRIFTING, clock: 0,
      fingerId: null, orbitR: 0, orbitA: 0, orbitDir: 1, orbitS: 0,
      kind: KINDS[i % KINDS.length], seed: stage.rand(),
    }));

    function callFlies(x, y) {
      const by = flies.map(f => ({ f, d: Math.hypot(f.x - x, f.y - y) })).sort((a, b) => a.d - b.d);
      for (const { f } of by.slice(0, 3)) {          // the three nearest come when called
        if (f.state !== Wing.ORBITING) { f.state = Wing.COMING; f.clock = 0; f.caller = { x, y }; }
      }
      if (scales.length < MAX_SCALES) {
        for (const { f } of by.slice(0, 1)) {
          for (let k = 0; k < 6; k++) {
            scales.push({
              x: f.x, y: f.y, vx: (stage.rand() - 0.5) * short() * 0.3, vy: (stage.rand() - 0.6) * short() * 0.2,
              life: 1, color: f.kind[stage.rand() < 0.5 ? 0 : 2],
            });
          }
        }
      }
    }

    function release(f) {
      f.state = Wing.DRIFTING; f.fingerId = null; f.clock = 0;
      f.heading = f.orbitA + (f.orbitDir * Math.PI) / 2;   // it flies off along its last tangent
      if (scales.length < MAX_SCALES) {
        for (let k = 0; k < 4; k++) {
          scales.push({
            x: f.x, y: f.y, vx: (stage.rand() - 0.5) * short() * 0.4, vy: (stage.rand() - 0.5) * short() * 0.4,
            life: 1, color: f.kind[2],
          });
        }
      }
    }

    function stepFly(f, dt, t) {
      f.clock += dt;
      f.flap += dt * (f.state === Wing.ORBITING ? 13 : 9);
      if (f.state === Wing.ORBITING) {
        const p = fingers.get(f.fingerId);
        if (!p) { release(f); return; }               // finger up -> DRIFTING
        f.orbitS += dt;
        f.orbitA += f.orbitDir * dt * (2.2 + f.orbitS * 0.25);   // the whirl winds up the longer it's held
        f.orbitR += (wingspan() * 1.3 + Math.sin(f.orbitS * 2 + f.seed * 9) * wingspan() * 0.35 - f.orbitR) * Math.min(1, dt * 5);
        const tx = p.x + Math.cos(f.orbitA) * f.orbitR;
        const ty = p.y + Math.sin(f.orbitA) * f.orbitR * 0.7 - wingspan() * 0.4;
        f.x += (tx - f.x) * Math.min(1, dt * 8);
        f.y += (ty - f.y) * Math.min(1, dt * 8);
        f.heading = Math.atan2(ty - f.y, tx - f.x);
        if (f.clock > 12) release(f);                 // nobody spins forever
        return;
      }
      let desired;
      if (f.state === Wing.COMING && f.caller) {
        desired = Math.atan2(f.caller.y - f.y, f.caller.x - f.x);
        const d = Math.hypot(f.caller.x - f.x, f.caller.y - f.y);
        if (d < wingspan() * 1.6) {                   // COMING -> ORBITING at the ring
          f.state = Wing.ORBITING; f.clock = 0; f.orbitS = 0;
          f.orbitA = Math.atan2(f.y - f.caller.y, f.x - f.caller.x);
          f.orbitR = d; f.orbitDir = f.seed < 0.5 ? 1 : -1;
          // claim the live finger nearest the caller point, if one is down
          let bestId = null, bestD = Infinity;
          for (const [id, p] of fingers) {
            const pd = Math.hypot(p.x - f.caller.x, p.y - f.caller.y);
            if (pd < bestD) { bestD = pd; bestId = id; }
          }
          f.fingerId = bestId;
          if (bestId !== null && sinceNote > 0.12) { stage.audio.note(620 + f.seed * 260, 0.14); sinceNote = 0; }
          return;
        }
        if (f.clock > 4) { f.state = Wing.DRIFTING; f.caller = null; f.clock = 0; }   // gave up
      } else {
        // wandering: the heading wanders, and the edges pull it back
        f.heading += Math.sin(t * 0.9 + f.seed * 9) * dt * 1.4;
        desired = f.heading;
        if (f.x < stage.width * 0.08) desired = 0;
        if (f.x > stage.width * 0.92) desired = Math.PI;
        if (f.y < stage.height * 0.08) desired = Math.PI / 2;
        if (f.y > stage.height * 0.92) desired = -Math.PI / 2;
      }
      let turn = ((desired - f.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      f.heading += clamp(turn, -dt * 5, dt * 5);
      const v = f.speed * (f.state === Wing.COMING ? 2.4 : 1);
      f.x += Math.cos(f.heading) * v * dt;
      f.y += Math.sin(f.heading) * v * dt;
      f.x = clamp(f.x, -short() * 0.1, stage.width + short() * 0.1);
      f.y = clamp(f.y, -short() * 0.1, stage.height + short() * 0.1);
    }

    const offFrame = stage.onFrame((dt, t) => {
      if (stopped) return;
      sinceTouch += dt; sinceNote += dt;
      // Idle: after 5 s one of them picks a new heading on its own.
      if (sinceTouch > 5) {
        idleClock += dt;
        if (idleClock > 4) {
          idleClock = 0;
          const f = flies[Math.floor(stage.rand() * flies.length)];
          if (f.state === Wing.DRIFTING) f.heading = stage.rand() * Math.PI * 2;
        }
      }
      for (const f of flies) stepFly(f, dt, t);
      for (let i = scales.length - 1; i >= 0; i--) {
        const s = scales[i];
        s.x += s.vx * dt; s.y += s.vy * dt; s.vy += short() * 0.2 * dt; s.life -= dt * 0.7;
        if (s.life <= 0) scales.splice(i, 1);
      }
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.r += dt * short() * 0.35; r.life -= dt * 2;
        if (r.life <= 0) rings.splice(i, 1);
      }

      const sky = ctx.createLinearGradient(0, 0, 0, stage.height);
      sky.addColorStop(0, '#3c2a63'); sky.addColorStop(1, '#8a5aa8');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, stage.width, stage.height);
      ctx.fillStyle = '#33224a';
      ctx.beginPath();
      ctx.ellipse(stage.width * 0.5, stage.height * 1.02, stage.width * 0.7, stage.height * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      for (const f of flies) {
        const w = wingspan();
        const flap = 0.3 + 0.7 * Math.abs(Math.sin(f.flap * Math.PI));
        ctx.save();
        ctx.translate(f.x, f.y);
        const [top, edge, dot] = f.kind;
        for (const side of [-1, 1]) {
          ctx.fillStyle = top;
          ctx.beginPath();
          ctx.ellipse(side * w * 0.45 * flap, -w * 0.28, w * 0.48 * flap, w * 0.36, side * 0.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = edge;
          ctx.beginPath();
          ctx.ellipse(side * w * 0.32 * flap, w * 0.3, w * 0.34 * flap, w * 0.28, side * -0.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = dot;
          ctx.beginPath();
          ctx.arc(side * w * 0.5 * flap, -w * 0.3, w * 0.06, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#241a33';
        ctx.beginPath();
        ctx.ellipse(0, 0, w * 0.08, w * 0.34, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      for (const s of scales) {
        ctx.globalAlpha = clamp(s.life, 0, 1);
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, short() * 0.005 + 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#e7d3ff';
      ctx.lineWidth = 3;
      for (const r of rings) {
        ctx.globalAlpha = clamp(r.life, 0, 1) * 0.7;
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
        fingers.set(p.id, { id: p.id, x: p.x, y: p.y });
        if (rings.length < MAX_RINGS) rings.push({ x: p.x, y: p.y, r: short() * 0.03, life: 1 });
        callFlies(p.x, p.y);
      },
      move(p) {
        const f = fingers.get(p.id);
        if (!f) return;
        f.x = p.x; f.y = p.y;
      },
      up(p) {
        fingers.delete(p.id);
      },
    });

    return {
      stop() {
        stopped = true;
        for (const off of [offFrame, offPointer]) if (typeof off === 'function') off();
      },
      debug: () => ({ entities: flies.length + scales.length + rings.length, orbiting: flies.filter(f => f.state === Wing.ORBITING).length, states: flies.map(f => f.state) }),
    };
  },
};
