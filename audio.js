export function createAudio() {
  let context;
  let master;
  let noise;
  let muted = true;
  let group;
  function setMuted(value) {
    muted = value;
    if (!muted && !context) {
      const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Audio) return;
      try {
        context = new Audio();
        master = context.createGain();
        master.gain.value = 0;
        master.connect(context.destination);
      } catch { context = null; return; }
    }
    if (!context) return;
    master.gain.setTargetAtTime(muted ? 0 : 0.18, context.currentTime, 0.015);
    if (!muted) void context.resume().catch(() => {});
  }
  function play(source, seconds, level, filter) {
    if (!group) {
      const output = context.createGain();
      output.connect(master);
      group = { output, voices: new Set() };
    }
    const { output, voices } = group;
    const volume = context.createGain();
    const time = context.currentTime;
    const end = time + seconds;
    volume.gain.setValueAtTime(0.0001, time);
    volume.gain.exponentialRampToValueAtTime(level, time + Math.min(0.024, seconds / 4));
    volume.gain.exponentialRampToValueAtTime(0.0001, end);
    if (filter) source.connect(filter).connect(volume);
    else source.connect(volume);
    volume.connect(output);
    voices.add(source);
    source.onended = () => {
      voices.delete(source);
      source.disconnect();
      filter?.disconnect();
      volume.disconnect();
      if (!voices.size) {
        output.disconnect();
        if (group?.output === output) group = null;
      }
    };
    source.start(time);
    source.stop(end + 0.01);
  }
  function stopAll() {
    if (!group) return;
    const { output, voices } = group;
    group = null;
    const now = context.currentTime;
    const end = now + 0.01;
    output.gain.setValueAtTime(1, now);
    output.gain.linearRampToValueAtTime(0, end);
    for (const source of voices) source.stop(end);
  }
  function canPlay() { return !muted && context?.state === 'running' && (group?.voices.size ?? 0) < 8; }
  function note(freq = 330, duration = 0.18) {
    if (!canPlay() || !Number.isFinite(freq) || !Number.isFinite(duration)) return;
    const oscillator = context.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.value = Math.max(75, Math.min(1700, freq));
    play(oscillator, Math.max(0.04, Math.min(1.5, duration)), 0.20);
  }
  function whoosh() {
    if (!canPlay()) return;
    if (!noise) {
      noise = context.createBuffer(1, Math.ceil(context.sampleRate * 0.32), context.sampleRate);
      const samples = noise.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    }
    const source = context.createBufferSource();
    source.buffer = noise;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 780;
    play(source, 0.30, 0.23, filter);
  }
  return { get muted() { return muted; }, setMuted, stopAll, note, pop() { note(575, 0.085); }, whoosh };
}
