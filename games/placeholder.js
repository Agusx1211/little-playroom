export function placeholder(id, colors) {
  function icon(ctx, size, t) {
    const radius = size * (0.24 + 0.012 * Math.sin(t));
    ctx.fillStyle = colors[0];
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = colors[1];
    ctx.beginPath();
    ctx.arc(size * 0.43, size * 0.42, radius * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }
  return {
    id, colors, icon,
    start(stage) {
      let point = null;
      stage.onPointer({ down(p) { point = p; stage.audio.pop(); }, move(p) { point = p; } });
      stage.onFrame((_dt, t) => {
        const { ctx, width, height } = stage;
        ctx.fillStyle = '#10182c';
        ctx.fillRect(0, 0, width, height);
        const size = Math.min(width, height) * 0.55;
        ctx.save();
        ctx.translate((point?.x ?? width / 2) - size / 2,
          (point?.y ?? height / 2) - size / 2 + 7 * Math.sin(t * 0.7));
        icon(ctx, size, t);
        ctx.restore();
      });
      return { stop() {} };
    },
  };
}
