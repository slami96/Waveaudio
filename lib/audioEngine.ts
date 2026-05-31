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
  DEBUG_AUDIO,
} from './constants';

export interface AudioBands {
  bass: number;
  mid: number;
  treble: number;
  overall: number;
  beat: number;
}

/**
 * Tiny wrapper around the Web Audio API.
 * HTMLAudioElement -> MediaElementSource -> Analyser -> Gain -> destination.
 *
 * Exposes getFrequencyData() (raw FFT bytes for the spectrum visualizer) and
 * getBands() (aggregated bass/mid/treble + beat, kept for compatibility).
 */
export class AudioEngine {
  private context: AudioContext | null = null;
  private audio: HTMLAudioElement | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;

  private frequencyData: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(0));

  private smoothed = { bass: 0, mid: 0, treble: 0, overall: 0 };
  private prevBass = 0;
  private beat = 0;
  private beatCooldown = 0;
  private lastSample = 0;
  private lastLog = 0;

  private currentBlobUrl: string | null = null;

  async init(): Promise<void> {
    if (this.context) return;

    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    this.context = new Ctor();

    this.audio = new Audio();
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
        /* ignore */
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
   * Raw FFT byte spectrum (length = frequencyBinCount, values 0..255).
   * Returns null until init() has run. The spectrum visualizer reads this
   * each frame. Low bins = bass, high bins = treble.
   */
  getFrequencyData(): Uint8Array<ArrayBuffer> | null {
    if (!this.analyser) return null;
    this.analyser.getByteFrequencyData(this.frequencyData);
    return this.frequencyData;
  }

  /** Aggregated bands + beat. Kept for compatibility; unused by the spectrum. */
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

    const bassRaw = averageRange(this.frequencyData, BASS_RANGE);
    const midRaw = averageRange(this.frequencyData, MID_RANGE);
    const trebleRaw = averageRange(this.frequencyData, TREBLE_RANGE);

    const gBass = clamp01(bassRaw * BASS_GAIN);
    const gMid = clamp01(midRaw * MID_GAIN);
    const gTreble = clamp01(trebleRaw * TREBLE_GAIN);
    const gOverall = (gBass + gMid + gTreble) / 3;

    this.smoothed.bass = envelope(this.smoothed.bass, gBass);
    this.smoothed.mid = envelope(this.smoothed.mid, gMid);
    this.smoothed.treble = envelope(this.smoothed.treble, gTreble);
    this.smoothed.overall = envelope(this.smoothed.overall, gOverall);

    const flux = bassRaw - this.prevBass;
    this.prevBass = bassRaw;
    if (this.beatCooldown <= 0 && flux > BEAT_FLUX && bassRaw > BEAT_MIN_LEVEL) {
      this.beat = 1;
      this.beatCooldown = BEAT_COOLDOWN_FRAMES;
    } else {
      this.beat *= BEAT_DECAY;
    }
    this.beatCooldown -= 1;

    if (DEBUG_AUDIO && now - this.lastLog > 250) {
      this.lastLog = now;
      // eslint-disable-next-line no-console
      console.log(
        `[waveform] bass=${this.smoothed.bass.toFixed(2)} ` +
          `mid=${this.smoothed.mid.toFixed(2)} ` +
          `treble=${this.smoothed.treble.toFixed(2)} ` +
          `beat=${this.beat.toFixed(2)}`,
      );
    }

    return {
      bass: this.smoothed.bass,
      mid: this.smoothed.mid,
      treble: this.smoothed.treble,
      overall: this.smoothed.overall,
      beat: this.beat,
    };
  }

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
  return sum / (b - a + 1) / 255;
}

function envelope(prev: number, raw: number): number {
  return raw > prev ? raw : prev + (raw - prev) * ENV_RELEASE;
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
