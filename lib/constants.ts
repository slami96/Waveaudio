/**
 * Audio analysis constants.
 *
 * NOTE on FFT sizing:
 *   AnalyserNode.frequencyBinCount === fftSize / 2.
 *   With fftSize = 512 we get 256 usable frequency bins.
 *   At 44.1kHz, each bin ~= 86Hz.
 */
export const FFT_SIZE = 512;
export const FREQUENCY_BIN_COUNT = FFT_SIZE / 2; // 256

// Inclusive bin ranges.
//   bass:   bins 1..8    -> ~86   – 690Hz   (kick / bass body)
//   mid:    bins 9..48   -> ~690  – 4200Hz  (vocals / instruments)
//   treble: bins 49..140 -> ~4200 – 12000Hz (hats / air / shimmer)
export const BASS_RANGE: readonly [number, number] = [1, 8];
export const MID_RANGE: readonly [number, number] = [9, 48];
export const TREBLE_RANGE: readonly [number, number] = [49, 140];

// Per-band gain to land in a usable 0..1 range. Kept modest so loud tracks
// don't pin every band at 1.0 (which would flatten all dynamics).
export const BASS_GAIN = 1.4;
export const MID_GAIN = 2.0;
export const TREBLE_GAIN = 3.0;

// Browser AnalyserNode internal smoothing (0 = none, 1 = frozen).
export const ANALYSER_SMOOTHING = 0.72;

// Per-frame envelope release. Attack is INSTANT; release eases the band back
// down so there's a real "rest" state between hits (= visible pulsing).
export const ENV_RELEASE = 0.2;

// ── Beat detection (ONSET / spectral-flux on the bass band) ──
// A beat = a sudden RISE in bass energy from one frame to the next. This is
// robust to overall loudness, so it keeps firing on real kicks and can't
// runaway at startup the way an adaptive-average threshold did.
export const BEAT_FLUX = 0.1; // min frame-to-frame rise in (pre-gain) bass
export const BEAT_MIN_LEVEL = 0.12; // ...and bass must be at least this loud
export const BEAT_DECAY = 0.86; // how fast the beat pulse value falls per frame
export const BEAT_COOLDOWN_FRAMES = 6; // min frames between beats

// Sphere geometry — lower on mobile for perf (vertex shader samples noise 3x
// per vertex for recomputed normals).
export const SPHERE_SEGMENTS_DESKTOP = 128;
export const SPHERE_SEGMENTS_MOBILE = 64;

// Particle field
export const PARTICLE_COUNT = 900;
export const PARTICLE_FIELD_RADIUS = 25;

// Master displacement amount for the sphere shader. Crank toward 1.2–1.4 for
// more violent morphing; drop toward 0.6 for a calmer surface.
export const DEFAULT_DISTORTION = 0.9;
