import {
  FFT_SIZE,
  BASS_RANGE,
  MID_RANGE,
  TREBLE_RANGE,
  BASS_GAIN,
  MID_GAIN,
  TREBLE_GAIN,
  ANALYSER_SMOOTHING,
  ENV_RELEASE,
  BEAT_FLUX,
  BEAT_MIN_LEVEL,
  BEAT_DECAY,
  BEAT_COOLDOWN_FRAMES,
} from './constants';

export interface AudioBands {
  bass: number;
  mid: number;
  treble: number;
  overall: number;
  /** 0..1 transient pulse that spikes on a detected beat and decays. */
  beat: number;
}

/**
 * Tiny wrapper around the Web Audio API.
 *
 * HTMLAudioElement -> MediaElementSource -> Analyser -> Gain -> destination.
 * Splits the FFT into bass/mid/treble, runs a fast-attack/slow-release envelope
 * for punch, and detects beats as onsets (sudden rises) in the bass band.
 *
 * AudioContext is lazily created on first init() so it satisfies the browser's
 * autoplay policy (must be called from a user gesture).
 */
export class AudioEngine {
  private context: AudioContext | null = null;
  private audio: HTMLAudioElement | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;

  private frequencyData: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(0));

  // Enveloped band readings (fast attack, slow release).
  private smoothed = { bass: 0, mid: 0, treble: 0, overall: 0 };

  // Beat (onset) detection state.
  private prevBass = 0; // previous-frame PRE-GAIN bass, for flux
  private beat = 0;
  private beatCooldown = 0;

  // Both the sphere and particle field call getBands() each frame; do the real
  // DSP work once per frame and serve a cached value to the second caller.
  private lastSample = 0;

  private currentBlobUrl: string | null = null;

  /** Lazily create the AudioContext. MUST be called from a user gesture. */
  async init(): Promise<void> {
    if (this.context) return;

    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    this.context = new Ctor();

    this.audio = new Audio();
    // No crossOrigin: all sources are same-origin (blob URLs / /demo.mp3).
    this.audio.preload = 'auto';

    this.source = this.context.createMediaElementSource(this.audio);

    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = FFT_SIZE;
    this.analyser.smoothingTimeConstant = ANALYSER_SMOOTHING;

    this.gainNode = this.context.createGain();
    this.gainNode.gain.value = 1.0;

    this.source.connect(this.analyser);
    this.analyser.connect(this.gainNode);
    this.gainNode.connect(this.context.destination);

    this.frequencyData = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));

    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
  }

  /** Load a file (uploaded) or URL (e.g. /demo.mp3). */
  async load(src: File | string): Promise<void> {
    if (!this.audio) throw new Error('AudioEngine not initialized');

    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }

    let url: string;
    if (typeof src === 'string') {
      url = src;
    } else {
      url = URL.createObjectURL(src);
      this.currentBlobUrl = url;
    }

    this.audio.src = url;

    await new Promise<void>((resolve, reject) => {
      if (!this.audio) return reject(new Error('no audio'));
      const onLoaded = () => {
        this.audio?.removeEventListener('loadedmetadata', onLoaded);
        this.audio?.removeEventListener('error', onError);
        resolve();
      };
      const onError = () => {
        this.audio?.removeEventListener('loadedmetadata', onLoaded);
        this.audio?.removeEventListener('error', onError);
        reject(new Error('Failed to load audio'));
      };
      this.audio.addEventListener('loadedmetadata', onLoaded);
      this.audio.addEventListener('error', onError);
      this.audio.load();
    });
  }

  async play(): Promise<void> {
    if (!this.audio || !this.context) return;
    if (this.context.state !== 'running') {
      try {
        await this.context.resume();
      } catch {
        /* resume can reject if called outside a gesture; ignore */
      }
    }
    await this.audio.play();
    if (this.context.state !== 'running') {
      try {
        await this.context.resume();
      } catch {
        /* ignore */
      }
    }
  }

  pause(): void {
    this.audio?.pause();
  }

  seek(time: number): void {
    if (this.audio) this.audio.currentTime = time;
  }

  setVolume(v: number): void {
    if (this.gainNode) this.gainNode.gain.value = Math.max(0, Math.min(1, v));
  }

  get currentTime(): number {
    return this.audio?.currentTime ?? 0;
  }

  get duration(): number {
    const d = this.audio?.duration ?? 0;
    return Number.isFinite(d) ? d : 0;
  }

  get isPlaying(): boolean {
    return !!this.audio && !this.audio.paused && !this.audio.ended;
  }

  get htmlAudio(): HTMLAudioElement | null {
    return this.audio;
  }

  /**
   * Sample the analyser and return normalised 0..1 band readings plus a beat
   * pulse. Work is throttled to once per ~frame; the cached value is returned
   * in between.
   */
  getBands(): AudioBands {
    if (!this.analyser) {
      return { ...this.smoothed, beat: this.beat };
    }

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - this.lastSample < 8) {
      return { ...this.smoothed, beat: this.beat };
    }
    this.lastSample = now;

    this.analyser.getByteFrequencyData(this.frequencyData);

    // Pre-gain (0..1) readings — kept un-clamped/un-gained so they retain
    // headroom for the onset detector.
    const bassRaw = averageRange(this.frequencyData, BASS_RANGE);
    const midRaw = averageRange(this.frequencyData, MID_RANGE);
    const trebleRaw = averageRange(this.frequencyData, TREBLE_RANGE);

    // Gained + clamped — what the shader sees.
    const gBass = clamp01(bassRaw * BASS_GAIN);
    const gMid = clamp01(midRaw * MID_GAIN);
    const gTreble = clamp01(trebleRaw * TREBLE_GAIN);
    const gOverall = (gBass + gMid + gTreble) / 3;

    // Fast attack, slow release -> transients punch, then ease out.
    this.smoothed.bass = envelope(this.smoothed.bass, gBass);
    this.smoothed.mid = envelope(this.smoothed.mid, gMid);
    this.smoothed.treble = envelope(this.smoothed.treble, gTreble);
    this.smoothed.overall = envelope(this.smoothed.overall, gOverall);

    // Onset detection: a sudden RISE in (pre-gain) bass energy = a beat.
    const flux = bassRaw - this.prevBass;
    this.prevBass = bassRaw;
    if (this.beatCooldown <= 0 && flux > BEAT_FLUX && bassRaw > BEAT_MIN_LEVEL) {
      this.beat = 1;
      this.beatCooldown = BEAT_COOLDOWN_FRAMES;
    } else {
      this.beat *= BEAT_DECAY;
    }
    this.beatCooldown -= 1;

    return {
      bass: this.smoothed.bass,
      mid: this.smoothed.mid,
      treble: this.smoothed.treble,
      overall: this.smoothed.overall,
      beat: this.beat,
    };
  }

  /** Tear down everything. Safe to call from a useEffect cleanup. */
  async dispose(): Promise<void> {
    try {
      this.audio?.pause();
    } catch {
      /* noop */
    }
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }
    try {
      this.source?.disconnect();
      this.analyser?.disconnect();
      this.gainNode?.disconnect();
    } catch {
      /* noop */
    }
    if (this.context && this.context.state !== 'closed') {
      try {
        await this.context.close();
      } catch {
        /* noop */
      }
    }
    this.context = null;
    this.audio = null;
    this.source = null;
    this.analyser = null;
    this.gainNode = null;
  }
}

/** Average a [lo, hi] inclusive range of a Uint8Array, normalised to 0..1. */
function averageRange(
  data: Uint8Array<ArrayBuffer>,
  range: readonly [number, number],
): number {
  const [lo, hi] = range;
  const a = Math.max(0, lo);
  const b = Math.min(data.length - 1, hi);
  if (b < a) return 0;
  let sum = 0;
  for (let i = a; i <= b; i++) sum += data[i];
  const avg = sum / (b - a + 1);
  return avg / 255;
}

/** Peak follower: jump to raw on attack, ease toward raw on release. */
function envelope(prev: number, raw: number): number {
  return raw > prev ? raw : prev + (raw - prev) * ENV_RELEASE;
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
