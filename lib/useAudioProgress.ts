'use client';

import { useEffect, useState } from 'react';
import type { AudioEngine } from './audioEngine';

/**
 * Polls the AudioEngine for time/duration/playing state at ~5Hz.
 *
 * Lives in whichever component renders progress UI (e.g. BottomControls)
 * so it doesn't force the WebGL Canvas to re-render every poll tick.
 */
export function useAudioProgress(
  engineRef: React.RefObject<AudioEngine | null>,
  onPlayingChange?: (playing: boolean) => void,
): { currentTime: number; duration: number; isPlaying: boolean } {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      const eng = engineRef.current;
      if (!eng) return;

      const t = eng.currentTime;
      const d = eng.duration;
      const p = eng.isPlaying;

      setCurrentTime(t);
      setDuration((prev) => (prev !== d ? d : prev));
      setIsPlaying((prev) => {
        if (prev !== p) {
          onPlayingChange?.(p);
          return p;
        }
        return prev;
      });
    }, 200);
    return () => clearInterval(id);
  }, [engineRef, onPlayingChange]);

  return { currentTime, duration, isPlaying };
}
