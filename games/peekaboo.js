// peekaboo: three round bushes. Tap a bush and a friendly face pops up from behind it, eyes wide,
// with a happy little tune; it ducks back after a moment. Tap a face that is up and it giggles and
// bounces. When nobody touches for a while, a face peeks out by itself, just a little.

const BUSHES = 3;
const MAX_SPARKS = 90;

// One hider per bush, as explicit states:
//   HIDDEN -(tap)-> RISING -> SHOWN -(2.2 s)-> SINKING -> HIDDEN
//   SHOWN -(tap)-> SHOWN again (giggle, timer restarts); SINKING -(tap)-> RISING
//   HIDDEN -(idle tease)-> TEASING (half up and back) -> HIDDEN; TEASING -(tap)-> RISING
const Hider = Object.freeze({ HIDDEN: 'hidden', RISING: 'rising', SHOWN: 'shown', SINKING: 'sinking', TEASING: 'teasing' });
const RISE_S = 0.25, SHOW_S = 2.2, SINK_S = 0.45, TEASE_S = 1.6;

// Faces: plain round animals (bear, cat, bunny, chick), each an ear style and a colour.
const FACES = [
  { ears: 'round', fur: '#c8956a', inner: '#f0c9a4' },
  { ears: 'pointy', fur: '#9aa6b8', inner: '#f2c6d0' },
  { ears: 'long', fur: '#e9e4f2', inner: '#f5b8c9' },
  { ears: 'none', fur: '#ffd45c', inner: '#ff9f43' },
];
const TUNE = [523.25, 659.25, 783.99];   // C E G: a little "boo!"

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function drawFace(ctx, x, y, r, face, smile, look) {
  ctx.fillStyle = face.fur;
  if (face.ears === 'round') {
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(x + s * r * 0.72, y - r * 0.72, r * 0.32, 0, Math.PI * 2); ctx.fill(); }
  } else if (face.ears === 'pointy') {
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + s * r * 0.85, y - r * 0.2); ctx.lineTo(x + s * r * 0.7, y - r * 1.15); ctx.lineTo(x + s * r * 0.2, y - r * 0.8);
      ctx.closePath(); ctx.fill();
    }
  } else if (face.ears === 'long') {
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + s * r * 0.4, y - r * 1.15, r * 0.2, r * 0.6, s * 0.15, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = face.inner;
  ctx.beginPath();
  ctx.ellipse(x, y + r * 0.35, r * 0.42, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  // Eyes (wide when it has just popped up), a nose and a smile.
  const eyeR = r * (0.13 + 0.05 * smile);
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(x + s * r * 0.36, y - r * 0.12, eyeR, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#20203a';
    ctx.beginPath(); ctx.arc(x + s * r * 0.36 + look * eyeR * 0.35, y - r * 0.1, eyeR * 0.6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#3a2a2a';
  ctx.beginPath(); ctx.ellipse(x, y + r * 0.22, r * 0.11, r * 0.08, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#3a2a2a';
  ctx.lineWidth = Math.max(2, r * 0.06);
  ctx.beginPath();
  ctx.arc(x, y + r * 0.3, r * (0.18 + 0.1 * smile), 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
}

function drawBush(ctx, x, y, w, sway) {
  ctx.fillStyle = '#1f5f3a';
  for (const [dx, dy, r] of [[-0.32, 0.05, 0.3], [0, -0.1, 0.36], [0.32, 0.05, 0.3], [-0.15, 0.12, 0.3], [0.15, 0.12, 0.3]]) {
    ctx.beginPath();
    ctx.arc(x + dx * w + sway * w * 0.02 * (dy < 0 ? 1 : 0.5), y + dy * w, r * w, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#2e7d4c';
  for (const [dx, dy, r] of [[-0.2, -0.05, 0.12], [0.18, -0.12, 0.1], [0.02, 0.08, 0.09]]) {
    ctx.beginPath();
    ctx.arc(x + dx * w + sway * w * 0.02, y + dy * w, r * w, 0, Math.PI * 2);
    ctx.fill();
  }
}

export default {
  id: 'peekaboo',
  colors: ['#9fe2a8', '#ffd89d'],

  icon(ctx, size, t) {
    ctx.fillStyle = '#0c1a2a';
    ctx.fillRect(0, 0, size, size);
    const up = clamp(Math.sin(t * 1.5) * 1.4, 0, 1);
    drawFace(ctx, size * 0.5, size * (0.72 - 0.3 * up), size * 0.2, FACES[0], up, 0);
    drawBush(ctx, size * 0.5, size * 0.78, size * 0.6, 0);
  },

  start(stage) {
    const ctx = stage.ctx;
    let stopped = false;
    let sinceTouch = 0, idleClock = 0;
    const sparks = [];
    const hiders = Array.from({ length: BUSHES }, (_, i) => ({
      state: Hider.HIDDEN, clock: 0, face: FACES[i % FACES.length], up: 0, bounce: 0, giggles: 0, sway: 0,
    }));
    let faceTurn = BUSHES;   // the next face to use, so each pop can bring a different friend

    // Where everything sits, from the current size (portrait or landscape).
    function layout() {
      const w = stage.width, h = stage.height;
      const bushW = Math.min(w / BUSHES * 0.9, h * 0.42);
      const y = h * 0.7;
      return {
        bushW, faceR: bushW * 0.3,
        spots: Array.from({ length: BUSHES }, (_, i) => ({ x: w * (i + 0.5) / BUSHES, y })),
      };
    }

    function chime(i, n = 3) {
      for (let k = 0; k < n; k++) stage.audio.note(TUNE[k % TUNE.length] * (1 + i * 0.125), 0.22 + k * 0.08);
    }

    function sparkle(x, y, n = 8) {
      for (let k = 0; k < n && sparks.length < MAX_SPARKS; k++) {
        const a = stage.rand() * Math.PI * 2, v = stage.height * (0.15 + stage.rand() * 0.2);
        sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.7, hue: 40 + stage.rand() * 60 });
      }
    }

    function tap(i) {
      const h = hiders[i];
      switch (h.state) {
        case Hider.HIDDEN:
          h.face = FACES[faceTurn++ % FACES.length];
          // fall through: a hidden or half-hidden friend pops up
        case Hider.SINKING:
        case Hider.TEASING:
          h.state = Hider.RISING; h.clock = 0; h.sway = 1;
          chime(i);
          break;
        case Hider.RISING:
          break;
        case Hider.SHOWN:
          h.clock = 0; h.bounce = 1; h.giggles++;   // a giggle and a bounce
          stage.audio.note(880 + (h.giggles % 3) * 110, 0.15);
          break;
      }
    }

    function step(h, dt) {
      h.clock += dt;
      h.bounce = Math.max(0, h.bounce - dt * 3);
      h.sway = Math.max(0, h.sway - dt * 2);
      switch (h.state) {
        case Hider.HIDDEN: h.up = 0; break;
        case Hider.RISING:
          h.up = Math.min(1, h.up + dt / RISE_S);
          if (h.up >= 1) { h.state = Hider.SHOWN; h.clock = 0; }
          break;
        case Hider.SHOWN:
          h.up = 1;
          if (h.clock > SHOW_S) { h.state = Hider.SINKING; h.clock = 0; }
          break;
        case Hider.SINKING:
          h.up = Math.max(0, h.up - dt / SINK_S);
          if (h.up <= 0) { h.state = Hider.HIDDEN; h.clock = 0; }
          break;
        case Hider.TEASING:
          h.up = 0.4 * Math.sin(Math.PI * clamp(h.clock / TEASE_S, 0, 1));
          if (h.clock > TEASE_S) { h.state = Hider.HIDDEN; h.clock = 0; h.up = 0; }
          break;
      }
    }

    const offFrame = stage.onFrame((dt, t) => {
      if (stopped) return;
      sinceTouch += dt;
      if (sinceTouch > 5) {
        idleClock += dt;
        if (idleClock > 3) {
          idleClock = 0;
          const i = Math.floor(stage.rand() * BUSHES) % BUSHES;
          if (hiders[i].state === Hider.HIDDEN) { hiders[i].state = Hider.TEASING; hiders[i].clock = 0; hiders[i].face = FACES[faceTurn++ % FACES.length]; }
        }
      }
      for (const h of hiders) step(h, dt);
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= 0.94; s.vy *= 0.94; s.life -= dt;
        if (s.life <= 0) sparks.splice(i, 1);
      }

      const L = layout();
      const sky = ctx.createLinearGradient(0, 0, 0, stage.height);
      sky.addColorStop(0, '#0b1430'); sky.addColorStop(1, '#14324a');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, stage.width, stage.height);
      ctx.fillStyle = '#0f2a22';
      ctx.fillRect(0, L.spots[0].y + L.bushW * 0.15, stage.width, stage.height);
      for (let i = 0; i < BUSHES; i++) {
        const h = hiders[i], s = L.spots[i];
        // The face rises from behind the bush: drawn first, so the bush covers what is still hidden.
        if (h.up > 0) {
          const ease = 1 - Math.pow(1 - h.up, 3);
          const y = s.y + L.faceR * 0.6 - ease * L.faceR * 1.75 - Math.sin(h.bounce * Math.PI) * L.faceR * 0.25;
          drawFace(ctx, s.x, y, L.faceR, h.face, h.state === Hider.SHOWN ? 1 : ease * 0.6, Math.sin(t * 1.5 + i));
        }
        drawBush(ctx, s.x, s.y, L.bushW, Math.sin(t * 20) * h.sway);
      }
      for (const s of sparks) {
        ctx.globalAlpha = clamp(s.life / 0.7, 0, 1);
        ctx.fillStyle = `hsl(${s.hue}, 95%, 70%)`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, stage.height * 0.008, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    });

    const offPointer = stage.onPointer({
      down(p) {
        if (stopped) return;
        sinceTouch = 0; idleClock = 0;
        sparkle(p.x, p.y);   // every touch answers at once
        // The nearest bush whose column the finger is in (a generous target: the whole column).
        const L = layout();
        let best = -1, bestD = Infinity;
        for (let i = 0; i < BUSHES; i++) {
          const d = Math.abs(p.x - L.spots[i].x);
          if (d < bestD) { bestD = d; best = i; }
        }
        if (best >= 0 && bestD < L.bushW * 0.75) tap(best);
      },
      move() {},
      up() {},
    });

    return {
      stop() {
        stopped = true;
        for (const off of [offFrame, offPointer]) if (typeof off === 'function') off();
      },
      debug: () => ({ entities: BUSHES + sparks.length, states: hiders.map(h => h.state) }),
    };
  },
};
