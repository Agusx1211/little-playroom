// fireflies: a summer night. Fireflies drift low over the grass, each blinking on its own slow beat.
// Every touch answers with a bright answering-flash, and the nearest fireflies come to see the
// finger; hold still and one lands on it and glows steady until you move. When nobody touches, the
// meadow keeps blinking its slow rhythm.
//
// A firefly's mind, as explicit states:
//   WANDERING -(called)-> COMING -(still finger close by)-> RESTING -(finger moves or lifts,
//   or 8 s)-> WANDERING. COMING gives up after 4 s.

const MAX_FLIES = 26;
const MAX_RINGS = 24;
const MAX_SPARKS = 80;

const Mood = Object.freeze({ WANDERING: 'wandering', COMING: 'coming', RESTING: 'resting' });

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export default {
  id: 'fireflies',
  colors: ['#3ad1a1', '#0a1330'],

  icon(ctx, size, t) {
    ctx.fillStyle = '#0a1330';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#062018';
    ctx.fillRect(0, size * 0.72, size, size * 0.28);
    for (let k = 0; k < 5; k++) {
      const x = size * (0.15 + k * 0.17), y = size * (0.25 + (k % 3) * 0.14);
      const glow = 0.4 + 0.6 * Math.max(0, Math.sin(t * 2 + k * 1.7));
      ctx.fillStyle = `rgba(160,255,120,${(0.15 * glow).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(x, y, size * 0.09 * glow + 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(220,255,150,${glow.toFixed(3)})`;
      ctx.beginPath(); ctx.arc(x, y, size * 0.022, 0, Math.PI * 2); ctx.fill();
    }
  },

  start(stage) {
    const ctx = stage.ctx;
    let stopped = false;
    let sinceTouch = 0, idleClock = 0, sinceNote = 0;
    const short = () => Math.min(stage.width, stage.height);
    const grassY = () => stage.height * 0.78;
    const flies = [];
    const rings = [], sparks = [];
    const fingers = new Map();     // id -> {id, x, y, still}
    for (let i = 0; i < MAX_FLIES; i++) {
      flies.push({
        x: stage.width * stage.rand(), y: stage.height * (0.2 + stage.rand() * 0.68),
        heading: stage.rand() * Math.PI * 2, speed: short() * (0.04 + stage.rand() * 0.05),
        mood: Mood.WANDERING, clock: 0, blink: stage.rand() * 4, beat: 2.2 + stage.rand() * 1.6,
        glow: 0, caller: null, fingerId: null, seed: stage.rand(),
      });
    }

    function flash(f) { f.glow = 1; }

    function answer(p) {
      if (rings.length < MAX_RINGS) rings.push({ x: p.x, y: p.y, r: short() * 0.03, life: 1 });
      // the visible answering-flash, then the nearest wanderers come to look
      for (const f of flies) {
        const d = Math.hypot(f.x - p.x, f.y - p.y);
        if (d < short() * 0.35) flash(f);
        if (d < short() * 0.55 && f.mood === Mood.WANDERING) { f.mood = Mood.COMING; f.clock = 0; f.caller = { x: p.x, y: p.y, id: p.id }; }
      }
      if (sinceNote > 0.2) { stage.audio.note(880 + stage.rand() * 300, 0.1); sinceNote = 0; }
    }

    function land(f, p) {
      f.mood = Mood.RESTING; f.fingerId = p.id; f.clock = 0;
      flash(f);
      if (sparks.length < MAX_SPARKS) {
        for (let k = 0; k < 5; k++) {
          sparks.push({ x: f.x, y: f.y, vx: (stage.rand() - 0.5) * short() * 0.15, vy: -stage.rand() * short() * 0.12, life: 1 });
        }
      }
      if (sinceNote > 0.2) { stage.audio.note(1040 + f.seed * 260, 0.2); sinceNote = 0; }
    }

    function step(f, dt, t) {
      f.clock += dt;
      f.blink += dt;
      const beating = Math.max(0, Math.sin((f.blink / f.beat) * Math.PI * 2));
      f.glow = Math.max(f.glow - dt * 2.5, f.mood === Mood.RESTING ? 0.9 : beating * 0.8);
      if (f.mood === Mood.RESTING) {
        const p = fingers.get(f.fingerId);
        if (!p || p.still < 0.08 || f.clock > 8) { f.mood = Mood.WANDERING; f.fingerId = null; f.clock = 0; return; }
        f.x += (p.x - f.x) * Math.min(1, dt * 6);
        f.y += (p.y - short() * 0.04 - f.y) * Math.min(1, dt * 6);
        return;
      }
      let desired;
      if (f.mood === Mood.COMING && f.caller) {
        const p = fingers.get(f.caller.id) || f.caller;   // follow the finger once it is down
        desired = Math.atan2(p.y - f.y, p.x - f.x);
        const d = Math.hypot(p.x - f.x, p.y - f.y);
        if (p.id !== undefined && p.still > 0.5 && d < short() * 0.09) { land(f, p); return; }   // COMING -> RESTING
        if (f.clock > 4) { f.mood = Mood.WANDERING; f.clock = 0; f.caller = null; }             // gave up
        f.heading += clamp(((desired - f.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI, -dt * 4, dt * 4);
        f.x += Math.cos(f.heading) * f.speed * 3 * dt;
        f.y += Math.sin(f.heading) * f.speed * 3 * dt;
        return;
      }
      // WANDERING: a lazy loop with a bob
      f.heading += Math.sin(t * 0.7 + f.seed * 12) * dt * 1.1;
      f.x += Math.cos(f.heading) * f.speed * dt;
      f.y += Math.sin(f.heading) * f.speed * dt + Math.sin(t * 2 + f.seed * 8) * short() * 0.01 * dt;
      if (f.x < stage.width * 0.05) f.heading = 0;
      if (f.x > stage.width * 0.95) f.heading = Math.PI;
      if (f.y < stage.height * 0.15) f.heading = Math.PI / 2;
      if (f.y > grassY()) f.heading = -Math.PI / 2;
    }

    const offFrame = stage.onFrame((dt, t) => {
      if (stopped) return;
      sinceTouch += dt; sinceNote += dt;
      for (const [, p] of fingers) p.still = p.movedSince ? 0 : p.still + dt;
      for (const [, p] of fingers) p.movedSince = false;
      // Idle: after 5 s the rhythm resets — a wave of blinking crosses the meadow.
      if (sinceTouch > 5) {
        idleClock += dt;
        if (idleClock > 6) {
          idleClock = 0;
          const waveX = stage.width * stage.rand();
          for (const f of flies) if (f.mood === Mood.WANDERING) f.blink = f.seed * 0.6 + Math.hypot(f.x - waveX, 0) / (short() * 2);
        }
      }
      for (const f of flies) step(f, dt, t);
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt * 0.8;
        if (s.life <= 0) sparks.splice(i, 1);
      }
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.r += dt * short() * 0.3; r.life -= dt * 1.8;
        if (r.life <= 0) rings.splice(i, 1);
      }

      const sky = ctx.createLinearGradient(0, 0, 0, stage.height);
      sky.addColorStop(0, '#050a20'); sky.addColorStop(1, '#0e2038');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, stage.width, stage.height);
      // moon
      ctx.fillStyle = '#e8e6c9';
      ctx.beginPath();
      ctx.arc(stage.width * 0.85, stage.height * 0.14, short() * 0.055, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#050a20';
      ctx.beginPath();
      ctx.arc(stage.width * 0.85 - short() * 0.028, stage.height * 0.14 - short() * 0.01, short() * 0.05, 0, Math.PI * 2);
      ctx.fill();
      // grass hills
      ctx.fillStyle = '#062018';
      ctx.beginPath();
      ctx.moveTo(0, stage.height);
      ctx.lineTo(0, grassY());
      ctx.quadraticCurveTo(stage.width * 0.3, grassY() - short() * 0.05, stage.width * 0.6, grassY() + short() * 0.01);
      ctx.quadraticCurveTo(stage.width * 0.85, grassY() + short() * 0.04, stage.width, grassY() - short() * 0.02);
      ctx.lineTo(stage.width, stage.height);
      ctx.closePath();
      ctx.fill();
      // glow halos then cores
      for (const f of flies) {
        if (f.glow <= 0.02) continue;
        const g = clamp(f.glow, 0, 1);
        ctx.fillStyle = `rgba(150,255,110,${(0.16 * g).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(f.x, f.y, short() * 0.03 * g + 3, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const f of flies) {
        if (f.glow <= 0.02) continue;
        const g = clamp(f.glow, 0, 1);
        ctx.fillStyle = `rgba(225,255,160,${(0.35 + 0.65 * g).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(f.x, f.y, short() * 0.007 + 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `rgba(60,90,70,${(0.5 * g).toFixed(3)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(f.x - short() * 0.008, f.y - short() * 0.008, short() * 0.012, short() * 0.005, -0.6 + Math.sin(f.blink * 20) * 0.4, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = '#c8ffa0';
      for (const s of sparks) {
        ctx.globalAlpha = clamp(s.life, 0, 1) * 0.8;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#bfffc8';
      ctx.lineWidth = 2.5;
      for (const r of rings) {
        ctx.globalAlpha = clamp(r.life, 0, 1) * 0.5;
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
        fingers.set(p.id, { id: p.id, x: p.x, y: p.y, still: 0, movedSince: false });
        answer(p);
      },
      move(p) {
        const f = fingers.get(p.id);
        if (!f) return;
        f.movedSince = true;
        f.x = p.x; f.y = p.y;
      },
      up(p) { fingers.delete(p.id); },
    });

    return {
      stop() {
        stopped = true;
        for (const off of [offFrame, offPointer]) if (typeof off === 'function') off();
      },
      debug: () => ({ entities: flies.length + rings.length + sparks.length, resting: flies.filter(f => f.mood === Mood.RESTING).length, states: flies.map(f => f.mood) }),
    };
  },
};
