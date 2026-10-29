/**
 * Original, fully synthesised sound design (Web Audio). No samples, no
 * licensed audio. Silent until the player explicitly turns sound on, and the
 * AudioContext is only created/resumed inside a user gesture.
 */
export type Cue = 'kick' | 'net' | 'post' | 'glove' | 'catch' | 'goal' | 'groan' | 'tick';

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private crowdGain: GainNode | null = null;
  private crowdFilter: BiquadFilterNode | null = null;
  private noise: AudioBuffer | null = null;
  private enabled = false;
  private volume = 0.8;

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.enabled) this.fade(this.master, 0.9 * this.volume, 0.1);
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  /** Must be called from a user gesture handler. */
  enable(): void {
    this.enabled = true;
    try {
      if (!this.ctx) this.init();
      void this.ctx?.resume();
      this.fade(this.master, 0.9 * this.volume, 0.25);
    } catch {
      this.enabled = false;
    }
  }

  disable(): void {
    this.enabled = false;
    this.fade(this.master, 0, 0.15);
  }

  /** Re-resume after the browser suspended the context (tab switch, iOS). */
  unlock(): void {
    if (this.enabled && this.ctx && this.ctx.state !== 'running') void this.ctx.resume();
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  private init(): void {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) throw new Error('Web Audio unsupported');
    const ctx = new Ctor();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);
    // Shared pink-ish noise buffer.
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + white * 0.029591;
      b1 = 0.985 * b1 + white * 0.032534;
      b2 = 0.95 * b2 + white * 0.048056;
      data[i] = (b0 + b1 + b2 + white * 0.05) * 2.2;
    }
    this.noise = buf;
    // Ambient crowd bed: looping filtered noise with slow swells.
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    this.crowdFilter = ctx.createBiquadFilter();
    this.crowdFilter.type = 'bandpass';
    this.crowdFilter.frequency.value = 700;
    this.crowdFilter.Q.value = 0.6;
    this.crowdGain = ctx.createGain();
    this.crowdGain.gain.value = 0.05;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.13;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.015;
    lfo.connect(lfoGain).connect(this.crowdGain.gain);
    src.connect(this.crowdFilter).connect(this.crowdGain).connect(this.master);
    src.start();
    lfo.start();
  }

  private fade(node: GainNode | null, to: number, secs: number): void {
    if (!node || !this.ctx) return;
    const t = this.ctx.currentTime;
    node.gain.cancelScheduledValues(t);
    node.gain.setValueAtTime(node.gain.value, t);
    node.gain.linearRampToValueAtTime(to, t + secs);
  }

  /** Crowd intensity 0..1 (goal = 1, near miss ≈ 0.5). */
  crowd(level: number): void {
    if (!this.ctx || !this.crowdGain || !this.crowdFilter || !this.enabled) return;
    const t = this.ctx.currentTime;
    const g = this.crowdGain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0.05 + level * 0.32, t + 0.12);
    g.linearRampToValueAtTime(0.05 + level * 0.18, t + 1.6);
    g.linearRampToValueAtTime(0.05, t + 4.5);
    const f = this.crowdFilter.frequency;
    f.cancelScheduledValues(t);
    f.setValueAtTime(f.value, t);
    f.linearRampToValueAtTime(700 + level * 600, t + 0.15);
    f.linearRampToValueAtTime(700, t + 4);
  }

  play(cue: Cue, intensity = 1): void {
    if (!this.enabled || !this.ctx || !this.master || this.ctx.state !== 'running') return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const out = this.master;
    const env = (gain: number, attack: number, decay: number) => {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(gain, 0.0002), t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
      g.connect(out);
      return g;
    };
    const noiseBurst = (gain: number, decay: number, type: BiquadFilterType, freq: number, q = 1, rate = 1) => {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.playbackRate.value = rate;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      src.connect(f).connect(env(gain, 0.004, decay));
      src.start(t, Math.random() * 1.5);
      src.stop(t + decay + 0.05);
    };
    const tone = (freq: number, gain: number, decay: number, type: OscillatorType = 'sine', toFreq?: number, delay = 0) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(freq, t + delay);
      if (toFreq) o.frequency.exponentialRampToValueAtTime(toFreq, t + delay + decay);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + delay);
      g.gain.exponentialRampToValueAtTime(gain, t + delay + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + delay + decay);
      o.connect(g).connect(out);
      o.start(t + delay);
      o.stop(t + delay + decay + 0.05);
    };
    switch (cue) {
      case 'kick':
        tone(150, 0.9 * intensity, 0.16, 'sine', 45);
        noiseBurst(0.5 * intensity, 0.05, 'highpass', 1800, 0.7);
        break;
      case 'net':
        noiseBurst(0.45, 0.45, 'bandpass', 2600, 0.8, 0.9);
        noiseBurst(0.25, 0.25, 'lowpass', 600, 0.7);
        break;
      case 'post':
        for (const [f, g] of [[523, 0.3], [1307, 0.18], [2210, 0.1], [3420, 0.06]] as const) tone(f, g, 1.1, 'sine');
        noiseBurst(0.4, 0.04, 'highpass', 3000);
        break;
      case 'glove':
        tone(110, 0.6, 0.12, 'sine', 60);
        noiseBurst(0.5, 0.08, 'bandpass', 900, 1.2);
        break;
      case 'catch':
        tone(90, 0.55, 0.18, 'sine', 50);
        noiseBurst(0.35, 0.12, 'lowpass', 700);
        break;
      case 'goal':
        // Short original brass-like sting: rising gold triad.
        [392, 494, 587, 784].forEach((f, i) => {
          tone(f, 0.16, 0.7 - i * 0.08, 'sawtooth', undefined, i * 0.07);
          tone(f * 2, 0.05, 0.5, 'triangle', undefined, i * 0.07);
        });
        this.crowd(1);
        break;
      case 'groan':
        noiseBurst(0.3, 0.9, 'bandpass', 420, 1.4, 0.7);
        this.crowd(0.45);
        break;
      case 'tick':
        tone(880, 0.06, 0.05, 'triangle');
        break;
    }
  }
}
