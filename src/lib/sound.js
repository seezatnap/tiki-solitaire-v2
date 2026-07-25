/**
 * A tiny synthesised sound kit — no audio files, just oscillators.
 * Warm marimba-ish tones for the good moves, a dull knock for the refusals.
 */

let ctx = null;
let master = null;
let enabled = true;

const ensureContext = () => {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!ctx) {
    ctx = new AudioCtx();
    master = ctx.createGain();
    master.gain.value = 0.16;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
};

const tone = ({ freq, to, type = 'sine', dur = 0.18, delay = 0, gain = 1, curve = 3 }) => {
  const audio = ensureContext();
  if (!audio) return;
  const t0 = audio.currentTime + delay;

  const osc = audio.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);

  const env = audio.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  const shaper = audio.createBiquadFilter();
  shaper.type = 'lowpass';
  shaper.frequency.setValueAtTime(freq * curve + 400, t0);

  osc.connect(env).connect(shaper).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.04);
};

const noise = ({ dur = 0.06, delay = 0, gain = 0.35, freq = 2400 }) => {
  const audio = ensureContext();
  if (!audio) return;
  const t0 = audio.currentTime + delay;
  const frames = Math.floor(audio.sampleRate * dur);
  const buffer = audio.createBuffer(1, frames, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 2;
  }
  const src = audio.createBufferSource();
  src.buffer = buffer;

  const band = audio.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = freq;

  const env = audio.createGain();
  env.gain.value = gain;

  src.connect(band).connect(env).connect(master);
  src.start(t0);
};

// Pentatonic — nothing you can play here sounds wrong.
const SCALE = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51];

const voices = {
  lift: () => {
    tone({ freq: 520, to: 700, type: 'sine', dur: 0.07, gain: 0.35 });
  },
  place: () => {
    noise({ dur: 0.05, gain: 0.3, freq: 1800 });
    tone({ freq: 220, to: 150, type: 'triangle', dur: 0.11, gain: 0.5 });
  },
  pair: () => {
    tone({ freq: SCALE[2], type: 'sine', dur: 0.3, gain: 0.6 });
    tone({ freq: SCALE[4], type: 'sine', dur: 0.34, gain: 0.45, delay: 0.05 });
    noise({ dur: 0.12, gain: 0.12, freq: 5200, delay: 0.02 });
  },
  domino: () => {
    tone({ freq: 180, to: 110, type: 'square', dur: 0.09, gain: 0.35, curve: 2 });
    tone({ freq: SCALE[5], type: 'triangle', dur: 0.28, gain: 0.4, delay: 0.04 });
  },
  chain: () => {
    tone({ freq: SCALE[3], type: 'sine', dur: 0.4, gain: 0.5 });
    tone({ freq: SCALE[6], type: 'sine', dur: 0.5, gain: 0.3, delay: 0.06 });
  },
  join: () => {
    [0, 2, 4].forEach((step, i) =>
      tone({ freq: SCALE[step], type: 'sine', dur: 0.3, gain: 0.4, delay: i * 0.07 })
    );
  },
  loop: () => {
    [4, 5, 7].forEach((step, i) =>
      tone({ freq: SCALE[step], type: 'sine', dur: 0.6, gain: 0.45, delay: i * 0.09 })
    );
  },
  deny: () => {
    tone({ freq: 110, to: 78, type: 'sawtooth', dur: 0.12, gain: 0.22, curve: 1 });
  },
  shuffle: () => {
    for (let i = 0; i < 7; i += 1) {
      noise({ dur: 0.05, gain: 0.16, freq: 1200 + i * 260, delay: i * 0.035 });
    }
  },
  win: () => {
    [0, 1, 2, 3, 4, 5, 7].forEach((step, i) =>
      tone({ freq: SCALE[step], type: 'sine', dur: 0.7, gain: 0.5, delay: i * 0.1 })
    );
    tone({ freq: SCALE[0] / 2, type: 'triangle', dur: 1.6, gain: 0.3, delay: 0.1 });
  }
};

export const playSound = (name) => {
  if (!enabled) return;
  voices[name]?.();
};

export const setSoundEnabled = (value) => {
  enabled = value;
  if (value) ensureContext();
};
