'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PARTICLE_COUNT, PARTICLE_FIELD_RADIUS } from '@/lib/constants';
import type { AudioEngine } from '@/lib/audioEngine';
import type { Theme } from '@/lib/themes';

interface ParticleFieldProps {
  engineRef: React.RefObject<AudioEngine | null>;
  theme: Theme;
  isPlaying: boolean;
}

export function ParticleField({ engineRef, theme, isPlaying }: ParticleFieldProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.PointsMaterial>(null);
  // Outward "burst" value: jumps on a beat, settles back.
  const burstRef = useRef(0);

  const geometry = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const r = PARTICLE_FIELD_RADIUS * (0.4 + Math.random() * 0.6);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  // Theme colour is a mutation, not a remount.
  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.color.copy(theme.particleColor);
    }
  }, [theme]);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;
    const mat = materialRef.current;

    const bands = engineRef.current?.getBands();
    let overall = 0.1;
    let treble = 0.04;
    let beat = 0;
    if (bands && isPlaying) {
      overall = bands.overall;
      treble = bands.treble;
      beat = bands.beat;
    }

    // Beat -> outward pulse that decays (frame-rate-independent).
    const decay = Math.min(1, delta * 3);
    burstRef.current = Math.max(burstRef.current * (1 - decay), beat);
    const burst = burstRef.current;

    pointsRef.current.rotation.y += delta * (0.02 + overall * 0.05);
    pointsRef.current.rotation.x += delta * 0.005;

    // Expand the field outward on hits.
    pointsRef.current.scale.setScalar(1 + burst * 0.1);

    if (mat) {
      if (bands && isPlaying) {
        mat.opacity = 0.4 + overall * 0.45 + burst * 0.3;
        mat.size = 0.035 + treble * 0.06 + burst * 0.04;
      } else {
        const t = state.clock.elapsedTime;
        mat.opacity = 0.45 + Math.sin(t * 0.5) * 0.1;
        mat.size = 0.04;
      }
    }
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        ref={materialRef}
        size={0.04}
        sizeAttenuation
        transparent
        opacity={0.7}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}
