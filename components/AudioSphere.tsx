'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { sphereVertexShader } from '@/shaders/sphere.vert';
import { sphereFragmentShader } from '@/shaders/sphere.frag';
import type { AudioEngine } from '@/lib/audioEngine';
import type { Theme } from '@/lib/themes';
import {
  SPHERE_SEGMENTS_DESKTOP,
  SPHERE_SEGMENTS_MOBILE,
  DEFAULT_DISTORTION,
} from '@/lib/constants';

interface AudioSphereProps {
  engineRef: React.RefObject<AudioEngine | null>;
  theme: Theme;
  isPlaying: boolean;
  isMobile: boolean;
}

const BASE_SPIN = 0.12; // rad/s, steady idle rotation

export function AudioSphere({
  engineRef,
  theme,
  isPlaying,
  isMobile,
}: AudioSphereProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const segments = isMobile ? SPHERE_SEGMENTS_MOBILE : SPHERE_SEGMENTS_DESKTOP;

  // Built once. Uniform values get mutated in-place each frame.
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uBass: { value: 0 },
      uMid: { value: 0 },
      uTreble: { value: 0 },
      uAudioLevel: { value: 0 },
      uBeat: { value: 0 },
      uDistortion: { value: DEFAULT_DISTORTION },
      uColor: { value: new THREE.Color() },
      uGlowColor: { value: new THREE.Color() },
    }),
    [],
  );

  // Theme colour updates are a SIDE EFFECT, so they belong in useEffect.
  useEffect(() => {
    uniforms.uColor.value.copy(theme.sphereColor);
    uniforms.uGlowColor.value.copy(theme.glowColor);
  }, [theme, uniforms]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    uniforms.uTime.value = t;

    const bands = engineRef.current?.getBands();
    let beat = 0;

    if (bands && isPlaying) {
      uniforms.uBass.value = bands.bass;
      uniforms.uMid.value = bands.mid;
      uniforms.uTreble.value = bands.treble;
      uniforms.uAudioLevel.value = bands.overall;
      uniforms.uBeat.value = bands.beat;
      beat = bands.beat;
    } else {
      // Calm "breathing" while idle so the surface stays alive in silence.
      const breath = (Math.sin(t * 0.6) + 1) * 0.5;
      uniforms.uBass.value = 0.1 + breath * 0.06;
      uniforms.uMid.value = 0.06 + Math.sin(t * 0.9) * 0.03;
      uniforms.uTreble.value = 0.04;
      uniforms.uAudioLevel.value = 0.08;
      uniforms.uBeat.value = 0;
    }

    if (meshRef.current) {
      // Instantaneous spin: base rate + a brief nudge that lasts only as long
      // as the beat pulse. No accumulation, so it can never run away.
      const spin = BASE_SPIN + beat * 0.4;
      meshRef.current.rotation.y += spin * delta;
      meshRef.current.rotation.x += delta * 0.04;

      // Gentle scale pump — the displacement carries the real energy now.
      const target = 1 + beat * 0.05 + uniforms.uBass.value * 0.03;
      const cur = meshRef.current.scale.x;
      meshRef.current.scale.setScalar(cur + (target - cur) * 0.2);
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1.6, segments, segments]} />
      <shaderMaterial
        vertexShader={sphereVertexShader}
        fragmentShader={sphereFragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
}
