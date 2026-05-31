'use client';

import { useEffect, useRef } from 'react';
import type { AudioEngine } from '@/lib/audioEngine';
import type { Theme } from '@/lib/themes';

interface WaveformCanvasProps {
  engineRef: React.RefObject<AudioEngine | null>;
  theme: Theme;
  isPlaying: boolean;
}

const BAR_COUNT = 72; // number of bars across the screen
const MAX_BIN = 128; // use the lower half of the spectrum (where music lives)

/**
 * 2D canvas spectrum visualizer.
 *
 * No WebGL, no shaders, no 3D. Each frame it reads the raw FFT bytes from the
 * audio engine and draws a row of mirrored, glowing bars. Bar height = loudness
 * at that frequency, so the left-most bars are the bass and slam on every kick.
 *
 * Same export name and props as the old R3F canvas, so it drops straight into
 * page.tsx with no other changes.
 */
export default function WaveformCanvas({
  engineRef,
  theme,
  isPlaying,
}: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Smoothed bar heights (0..1), kept across frames for a fluid feel.
  const levelsRef = useRef<number[]>(new Array(BAR_COUNT).fill(0));

  // Latest props mirrored into refs so the once-set-up RAF loop always reads
  // current values without re-subscribing.
  const themeRef = useRef(theme);
  const playingRef = useRef(isPlaying);
  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);
  useEffect(() => {
    playingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let width = 0;
    let height = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const levels = levelsRef.current;

    const draw = () => {
      raf = requestAnimationFrame(draw);
      if (width === 0 || height === 0) return;

      const data = engineRef.current?.getFrequencyData() ?? null;
      const playing = playingRef.current;
      const t = performance.now();

      // Update each bar's target height, then ease toward it (fast up, slow down).
      for (let i = 0; i < BAR_COUNT; i++) {
        let target: number;
        if (data && playing) {
          // Map bar i -> a span of FFT bins. The power curve gives the bass
          // more bars so it isn't crammed into the first pixel.
          const lo = Math.floor((i / BAR_COUNT) ** 1.6 * MAX_BIN) + 1;
          const hi = Math.max(lo, Math.floor(((i + 1) / BAR_COUNT) ** 1.6 * MAX_BIN) + 1);
          let sum = 0;
          let n = 0;
          for (let b = lo; b <= hi && b < data.length; b++) {
            sum += data[b];
            n += 1;
          }
          target = n > 0 ? sum / n / 255 : 0;
          target = Math.pow(target, 0.8); // gentle perceptual lift
        } else {
          // Calm idle shimmer when paused.
          target = 0.03 + 0.025 * (Math.sin(t * 0.002 + i * 0.35) * 0.5 + 0.5);
        }
        const cur = levels[i];
        levels[i] =
          target > cur ? cur + (target - cur) * 0.5 : cur + (target - cur) * 0.12;
      }

      // ---- draw ----
      ctx.clearRect(0, 0, width, height);

      const glow = themeRef.current.glowColor.getStyle();
      const core = themeRef.current.sphereColor.getStyle();

      const midY = height / 2;
      const gap = 3;
      const barW = Math.max(1, (width - gap * (BAR_COUNT - 1)) / BAR_COUNT);
      const maxH = height * 0.42;
      const radius = Math.min(barW / 2, 6);

      ctx.save();
      ctx.shadowBlur = 16;
      ctx.shadowColor = glow;

      for (let i = 0; i < BAR_COUNT; i++) {
        const h = Math.max(2, levels[i] * maxH);
        const x = i * (barW + gap);

        const grad = ctx.createLinearGradient(0, midY - h, 0, midY + h);
        grad.addColorStop(0, glow);
        grad.addColorStop(0.5, core);
        grad.addColorStop(1, glow);
        ctx.fillStyle = grad;

        roundRect(ctx, x, midY - h, barW, h * 2, radius);
        ctx.fill();
      }

      ctx.restore();
    };

    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [engineRef]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        display: 'block',
        pointerEvents: 'none', // never block the UI controls underneath/on top
      }}
    />
  );
}

/** Rounded-rect path (handcrafted so it works regardless of ctx.roundRect support). */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
