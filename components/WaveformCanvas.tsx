'use client';

import { Canvas } from '@react-three/fiber';
import {
  EffectComposer,
  Bloom,
  ToneMapping,
  Vignette,
  ChromaticAberration,
} from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { useEffect, useState } from 'react';
import { ACESFilmicToneMapping, Vector2 } from 'three';
import { AudioSphere } from './AudioSphere';
import { ParticleField } from './ParticleField';
import type { AudioEngine } from '@/lib/audioEngine';
import type { Theme } from '@/lib/themes';

interface WaveformCanvasProps {
  engineRef: React.RefObject<AudioEngine | null>;
  theme: Theme;
  isPlaying: boolean;
}

// Frozen at module load — never re-allocated on render.
const CAMERA = { position: [0, 0, 6.2] as [number, number, number], fov: 50 };
const GL = {
  antialias: true,
  toneMapping: ACESFilmicToneMapping,
  toneMappingExposure: 1.0,
  powerPreference: 'high-performance' as const,
};
const DPR: [number, number] = [1, 2];

// Tiny, fixed RGB split for a lens-like edge fringe.
const CA_OFFSET = new Vector2(0.0007, 0.0007);

export default function WaveformCanvas({
  engineRef,
  theme,
  isPlaying,
}: WaveformCanvasProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.matchMedia('(max-width: 768px)').matches);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return (
    <Canvas camera={CAMERA} gl={GL} dpr={DPR}>
      <ambientLight intensity={0.4} />
      <pointLight position={[5, 5, 5]} intensity={1} />

      <AudioSphere
        engineRef={engineRef}
        theme={theme}
        isPlaying={isPlaying}
        isMobile={isMobile}
      />
      <ParticleField engineRef={engineRef} theme={theme} isPlaying={isPlaying} />

      {/* Static post chain. The sphere shader carries the audio reactivity, so
          nothing here mutates per-frame (which was fragile on Safari w/ R3F 9).
          Bloom is now tuned to kiss the bright crests/rim rather than flood the
          whole ball — the higher threshold is the key change. */}
      <EffectComposer>
        <Bloom
          intensity={0.85}
          luminanceThreshold={0.5}
          luminanceSmoothing={0.85}
          mipmapBlur
          radius={0.55}
        />
        <ChromaticAberration
          blendFunction={BlendFunction.NORMAL}
          offset={CA_OFFSET}
          radialModulation={false}
          modulationOffset={0}
        />
        <Vignette eskil={false} offset={0.25} darkness={0.75} />
        <ToneMapping />
      </EffectComposer>
    </Canvas>
  );
}
