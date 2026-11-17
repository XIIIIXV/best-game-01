// All sound is synthesized with WebAudio: no audio files, no network. The context is made
// on the first user gesture (browsers block audio before one) and every call is a no-op
// until then, so the screenshot scenes stay silent and the game never crashes on audio.
export function createAudio() {
  let context = null;
  let muted = false;
  let noiseBuffer = null;

  function ensure() {
    if (context) return context;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
      const length = Math.floor(context.sampleRate * 0.4);
      noiseBuffer = context.createBuffer(1, length, context.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    } catch {
      context = null;
    }
    return context;
  }

  /** Call from any user gesture so later sounds are allowed to play. */
  function unlock() {
    const ctx = ensure();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function tone(freq, endFreq, seconds, type, volume, delay = 0) {
    if (muted) return;
    const ctx = ensure();
    if (!ctx) return;
    try {
      const start = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      if (endFreq !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), start + seconds);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(volume, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + seconds + 0.05);
    } catch {
      // Sound is garnish: a failed note never stops the game.
    }
  }

  function noise(seconds, volume, lowpass, delay = 0) {
    if (muted) return;
    const ctx = ensure();
    if (!ctx || !noiseBuffer) return;
    try {
      const start = ctx.currentTime + delay;
      const source = ctx.createBufferSource();
      source.buffer = noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volume, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
      source.connect(filter).connect(gain).connect(ctx.destination);
      source.start(start);
      source.stop(start + seconds + 0.05);
    } catch {
      // Sound is garnish: a failed note never stops the game.
    }
  }

  return {
    unlock,
    get muted() {
      return muted;
    },
    toggleMuted() {
      muted = !muted;
      return muted;
    },
    /** The flare's whoosh: a falling tone under filtered noise. */
    flare() {
      tone(520, 140, 0.22, 'sine', 0.22);
      noise(0.25, 0.16, 1800);
    },
    /** A wisp burning out: pitch climbs with the combo. */
    burn(combo) {
      const base = 420 + Math.min(combo, 8) * 55;
      tone(base, base * 1.6, 0.12, 'triangle', 0.16);
    },
    /** An ember picked up: a bright ping. */
    pickup() {
      tone(880, 1320, 0.09, 'sine', 0.1);
    },
    /** A wisp reaching the lantern: a low thud and a falling tone. */
    hit() {
      tone(160, 60, 0.3, 'sawtooth', 0.22);
      noise(0.2, 0.2, 500);
    },
    /** A night survived: two rising notes. */
    nightClear() {
      tone(523, 523, 0.14, 'triangle', 0.16);
      tone(784, 784, 0.22, 'triangle', 0.16, 0.13);
    },
    /** Dawn breaking: a small rising arpeggio. */
    dawn() {
      [523, 659, 784, 1047].forEach((freq, i) => tone(freq, freq, 0.3, 'triangle', 0.15, i * 0.11));
    },
    /** A button or card picked: a short click. */
    click() {
      tone(660, 660, 0.06, 'square', 0.08);
    },
  };
}
