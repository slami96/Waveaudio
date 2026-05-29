import {
  FFT_SIZE,
  BASS_RANGE,
  MID_RANGE,
  TREBLE_RANGE,
  BAND_SMOOTHING,
  ANALYSER_SMOOTHING,
} from './constants';

export interface AudioBands {
  bass: number;
  mid: number;
  treble: number;
  overall: number;
}

/**
 * Tiny wrapper around the Web Audio API.
 *
 * Wraps an HTMLAudioElement so we get free play/pause/seek/duration/time
 * and route the audio through an AnalyserNode for FFT data on every frame.
 *
 * AudioContext is lazily created on first init() call -- you must call this
 * from a user gesture (e.g. play-button click) to satisfy the browser's
 * autoplay policy.
 */
export class AudioEngine {
  private context: AudioContext | null = null;
  private audio: HTMLAudioElement | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;

  private frequencyData: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(0));

  // Smoothed band readings (we exponential-smooth them ourselves on top of
  // the AnalyserNode's internal smoothing for an extra-creamy feel).
  private smoothed: AudioBands = { bass: 0, mid: 0, treble: 0, overall: 0 };

  // Track the current blob URL so we can revoke it on next load.
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
    // No crossOrigin: all our sources are same-origin (blob URLs from
    // uploads, or /demo.mp3 served by Vercel). Setting crossOrigin on a
    // same-origin element makes Safari taint the stream and the analyser
    // returns all-zeros — audio plays but the visualizer sees silence.
    this.audio.preload = 'auto';

    this.source = this.context.createMediaElementSource(this.audio);

    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = FFT_SIZE;
    this.analyser.smoothingTimeConstant = ANALYSER_SMOOTHING;

    this.gainNode = this.context.createGain();
    this.gainNode.gain.value = 1.0;

    // source -> analyser -> gain -> destination
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

    // Free previous blob URL if any
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

    // Wait until enough has loaded to know the duration.
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
    // Safari frequently leaves the context 'suspended' or 'interrupted'
    // even after init(). Resume right before playback, every time.
    if (this.context.state !== 'running') {
      try {
        await this.context.resume();
      } catch {
        /* resume can reject if called outside a gesture; ignore */
      }
    }
    await this.audio.play();
    // One more nudge: on iOS/Safari the context can re-suspend the instant
    // playback starts. Resuming again after play() reliably unsticks it.
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
   * Sample the analyser and return normalised 0..1 band readings.
   * Returns a stable {bass:0, ...} object if not initialised yet.
   */
  getBands(): AudioBands {
    if (!this.analyser) return { ...this.smoothed };

    this.analyser.getByteFrequencyData(this.frequencyData);

    const rawBass = averageRange(this.frequencyData, BASS_RANGE);
    const rawMid = averageRange(this.frequencyData, MID_RANGE);
    const rawTreble = averageRange(this.frequencyData, TREBLE_RANGE);
    const rawOverall = (rawBass + rawMid + rawTreble) / 3;

    // Exponential smoothing on top of AnalyserNode's smoothing.
    const k = BAND_SMOOTHING;
    this.smoothed.bass = lerp(this.smoothed.bass, rawBass, 1 - k);
    this.smoothed.mid = lerp(this.smoothed.mid, rawMid, 1 - k);
    this.smoothed.treble = lerp(this.smoothed.treble, rawTreble, 1 - k);
    this.smoothed.overall = lerp(this.smoothed.overall, rawOverall, 1 - k);

    return { ...this.smoothed };
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

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
