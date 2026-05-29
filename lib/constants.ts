/**
 * Audio analysis constants.
 *
 * AnalyserNode.frequencyBinCount === fftSize / 2. With fftSize = 512 we get 256
 * usable bins; at 44.1kHz each bin ~= 86Hz.
 */
export const FFT_SIZE = 512;
export const FREQUENCY_BIN_COUNT = FFT_SIZE / 2; // 256

// Inclusive bin ranges.
//   bass:   bins 1..8    -> ~86   – 690Hz
//   mid:    bins 9..48   -> ~690  – 4200Hz
//   treble: bins 49..140 -> ~4200 – 12000Hz
export const BASS_RANGE: readonly [number, number] = [1, 8];
export const MID_RANGE: readonly [number, number] = [9, 48];
export const TREBLE_RANGE: readonly [number, number] = [49, 140];

// Per-band gain to reach a usable 0..1 range.
export const BASS_GAIN = 1.4;
export const MID_GAIN = 2.0;
export const TREBLE_GAIN = 3.0;

export const ANALYSER_SMOOTHING = 0.72;

// Per-frame envelope release (instant attack).
export const ENV_RELEASE = 0.2;

// Beat = a sudden RISE (onset) in the pre-gain bass band.
export const BEAT_FLUX = 0.1;
export const BEAT_MIN_LEVEL = 0.12;
export const BEAT_DECAY = 0.86;
export const BEAT_COOLDOWN_FRAMES = 6;

export const SPHERE_SEGMENTS_DESKTOP = 128;
export const SPHERE_SEGMENTS_MOBILE = 64;

export const PARTICLE_COUNT = 900;
export const PARTICLE_FIELD_RADIUS = 25;

// Master deformation amount. Bump toward 1.2 for a wilder morph, drop toward
// 0.5 for a calmer one. This is the single most useful knob.
export const DEFAULT_DISTORTION = 0.85;

// Flip to true to log bass/mid/treble/beat to the browser console ~4x/sec.
// Lets you confirm the audio analysis is actually feeding real numbers.
export const DEBUG_AUDIO = false;
