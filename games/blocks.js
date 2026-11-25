// blocks: every touch drops a block that lands on the floor or on the stack; when the stack
// grows tall it tumbles down gently and the floor is free again. No end, no fail.

const MAX_BLOCKS = 48;
const MAX_MARKS = 40;      // touch marks on screen at once
const MARK_S = 0.6;        // a mark lives this long
const PALETTE = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#c77dff', '#ff9f45'];

// A block's life, as explicit states.
const Block = Object.freeze({ FALLING: 'falling', RESTING: 'resting', TUMBLING: 'tumbling' });

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function drawBlock(ctx, b, breathe) {
  const w = b.w * (1 + b.squash * 0.18) * breathe;
  const h = b.h * (1 - b.squash * 0.18) * breathe;
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.a);
  ctx.fillStyle = b.color;
  roundRect(ctx, -w / 2, -h / 2, w, h, Math.min(w, h) * 0.18);
  ctx.fill();
  // A lighter top face and two friendly eyes.
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  roundRect(ctx, -w / 2 + w * 0.08, -h / 2 + h * 0.08, w * 0.84, h * 0.22, h * 0.1);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,20,40,0.75)';
  const eye = Math.min(w, h) * 0.07;
  ctx.beginPath();
  ctx.arc(-w * 0.16, h * 0.05, eye, 0, Math.PI * 2);
  ctx.arc(w * 0.16, h * 0.05, eye, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export default {
  id: 'blocks',
  colors: ['#4d96ff', '#ffd93d'],

  icon(ctx, size, t) {
    ctx.fillStyle = '#10163a';
    ctx.fillRect(0, 0, size, size);
    const s = size * 0.3;
    const wobble = Math.sin(t * 2) * 0.05;
    [[0.5, 0.78, '#4d96ff', 0], [0.42, 0.5, '#ffd93d', wobble], [0.56, 0.24, '#ff6b6b', -wobble]].forEach(([x, y, color, a]) => {
      drawBlock(ctx, { x: x * size, y: y * size, w: s * 1.2, h: s * 0.85, a, squash: 0, color }, 1);
    });
  },

  start(stage) {
    const ctx = stage.ctx;
    const blocks = [];
    // Every tap shows where it landed on the very next frame (aurora [4817]): a soft ring in the
    // colour of the block it drops, even when the stack is full and the tap only tumbles it.
    const marks = [];
    const dust = Array.from({ length: 24 }, () => ({ x: stage.rand(), y: stage.rand(), r: 0.5 + stage.rand() * 1.5, p: stage.rand() * 6 }));
    let sinceTouch = 0;
    let sincePop = 1;
    let stopped = false;
    const gravity = () => stage.height * 2.4;
    // Big for a one-year-old's eye at tablet distance (antony [4824]): about a quarter of the short side.
    const blockSize = () => clamp(Math.min(stage.width, stage.height) * 0.26, 72, 280);
    const floorY = () => stage.height * 0.93;

    function mark(x, y, color) {
      if (marks.length >= MAX_MARKS) marks.shift();
      marks.push({ x, y, color, age: 0 });
    }

    function spawn(x, y) {
      const color = PALETTE[Math.floor(stage.rand() * PALETTE.length) % PALETTE.length];
      mark(x, y, color);
      if (blocks.length >= MAX_BLOCKS) { tumble(); return; }
      const s = blockSize() * (0.8 + stage.rand() * 0.45);
      const w = s * (1 + stage.rand() * 0.5), h = s * (0.65 + stage.rand() * 0.35);
      blocks.push({
        x: clamp(x, w / 2, stage.width - w / 2), y: -h, w, h, vx: 0, vy: 0, a: 0, va: 0, squash: 0,
        color, state: Block.FALLING,
      });
    }

    /** Where a falling block comes to rest: the floor, or the top of the highest resting block under it. */
    function restingCentreY(b) {
      let top = floorY();
      for (const o of blocks) {
        if (o === b || o.state !== Block.RESTING) continue;
        if (Math.abs(o.x - b.x) < (o.w + b.w) / 2 * 0.85) top = Math.min(top, o.y - o.h / 2);
      }
      return top - b.h / 2;
    }

    // RESTING -> TUMBLING for the whole stack (when it grows tall, or the block budget is used up).
    function tumble() {
      let any = false;
      for (const b of blocks) {
        if (b.state !== Block.RESTING) continue;
        b.state = Block.TUMBLING;
        b.vx = (stage.rand() - 0.5) * stage.width * 0.9;
        b.vy = -stage.rand() * stage.height * 0.5;
        b.va = (stage.rand() - 0.5) * 5;
        any = true;
      }
      if (any) stage.audio.whoosh();
    }

    function step(b, dt) {
      switch (b.state) {
        case Block.FALLING: {
          b.vy += gravity() * dt;
          b.y += b.vy * dt;
          const rest = restingCentreY(b);
          if (b.y >= rest) {   // FALLING -> RESTING
            b.y = rest; b.vy = 0; b.squash = 1; b.state = Block.RESTING;
            if (sincePop > 0.08) { stage.audio.pop(); sincePop = 0; }
          }
          break;
        }
        case Block.RESTING:
          b.squash = Math.max(0, b.squash - dt * 5);
          break;
        case Block.TUMBLING:
          b.vy += gravity() * dt;
          b.x += b.vx * dt; b.y += b.vy * dt; b.a += b.va * dt;
          break;
      }
    }

    const offFrame = stage.onFrame((dt, t) => {
      if (stopped) return;
      sinceTouch += dt; sincePop += dt;
      for (const b of blocks) step(b, dt);
      for (let i = marks.length - 1; i >= 0; i--) { marks[i].age += dt; if (marks[i].age > MARK_S) marks.splice(i, 1); }
      // TUMBLING blocks leave through the bottom of the screen; then they are gone.
      for (let i = blocks.length - 1; i >= 0; i--) {
        const b = blocks[i];
        if (b.state === Block.TUMBLING && b.y - Math.max(b.w, b.h) > stage.height) blocks.splice(i, 1);
      }
      const tallest = blocks.reduce((top, b) => b.state === Block.RESTING ? Math.min(top, b.y - b.h / 2) : top, Infinity);
      if (tallest < stage.height * 0.22) tumble();

      const g = ctx.createLinearGradient(0, 0, 0, stage.height);
      g.addColorStop(0, '#0b1026'); g.addColorStop(1, '#1d2552');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, stage.width, stage.height);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      for (const d of dust) {
        const tw = 0.35 + 0.35 * Math.sin(t * 0.8 + d.p);
        ctx.globalAlpha = tw;
        ctx.beginPath();
        ctx.arc(d.x * stage.width, d.y * stage.height * 0.8, d.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#2b3570';
      ctx.fillRect(0, floorY(), stage.width, stage.height - floorY());
      // Idle: after 5 s the resting blocks breathe slowly.
      const breathe = sinceTouch > 5 ? 1 + 0.025 * Math.sin(t * 1.6) : 1;
      for (const b of blocks) drawBlock(ctx, b, b.state === Block.RESTING ? breathe : 1);
      // Touch marks on top: a filled dot that grows into a ring and fades.
      const unit = blockSize();
      for (const m of marks) {
        const k = m.age / MARK_S;
        ctx.globalAlpha = 0.85 * (1 - k);
        ctx.fillStyle = m.color;
        ctx.beginPath();
        ctx.arc(m.x, m.y, unit * (0.22 + 0.1 * k), 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = m.color;
        ctx.lineWidth = Math.max(3, unit * 0.06);
        ctx.beginPath();
        ctx.arc(m.x, m.y, unit * (0.3 + 0.6 * k), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    });

    const offPointer = stage.onPointer({
      down(p) { if (stopped) return; sinceTouch = 0; spawn(p.x, p.y); },
      move() {},
      up() {},
    });

    return {
      stop() {
        stopped = true;
        if (typeof offFrame === 'function') offFrame();
        if (typeof offPointer === 'function') offPointer();
      },
      debug: () => ({ entities: blocks.length + marks.length, states: blocks.map(b => b.state), marks: marks.length }),
    };
  },
};
