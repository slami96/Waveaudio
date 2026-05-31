'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BottomControls } from '@/components/BottomControls';
import { EmptyState } from '@/components/EmptyState';
import { AudioEngine } from '@/lib/audioEngine';
import { DEFAULT_THEME_ID, getTheme } from '@/lib/themes';

// Canvas is client-only; we dynamic-import to skip SSR for WebGL.
const WaveformCanvas = dynamic(() => import('@/components/WaveformCanvas'), {
  ssr: false,
});

const DEMO_TRACK_URL = '/demo.mp3';

export default function Page() {
  const engineRef = useRef<AudioEngine | null>(null);

  // NOTE: currentTime / duration / isPlaying live INSIDE <BottomControls>
  // via useAudioProgress. We don't lift them here -- doing so would force
  // the entire page (including the WebGL Canvas) to re-render every poll
  // tick, which crashes R3F under React 19's reconciler.
  const [hasTrack, setHasTrack] = useState(false);
  const [trackName, setTrackName] = useState('');
  const [volume, setVolume] = useState(0.85);
  const [themeId, setThemeId] = useState(DEFAULT_THEME_ID);
  const [error, setError] = useState<string | null>(null);

  // We *do* need a low-frequency isPlaying flag at this level so the
  // Canvas can switch between "audio reactive" and "ambient" modes.
  // BottomControls notifies us via onPlayingChange.
  const [isPlaying, setIsPlaying] = useState(false);

  const theme = getTheme(themeId);

  const ensureEngine = useCallback(async (): Promise<AudioEngine> => {
    if (!engineRef.current) engineRef.current = new AudioEngine();
    await engineRef.current.init();
    engineRef.current.setVolume(volume);
    return engineRef.current;
  }, [volume]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  const handleUpload = useCallback(
    async (file: File) => {
      setError(null);
      try {
        const eng = await ensureEngine();
        await eng.load(file);
        setTrackName(prettifyName(file.name));
        setHasTrack(true);
        await eng.play();
        setIsPlaying(true);
      } catch (err) {
        console.error(err);
        setError('Could not load that file. Try MP3, WAV, or OGG.');
      }
    },
    [ensureEngine],
  );

  const handleDemo = useCallback(async () => {
    setError(null);
    try {
      const eng = await ensureEngine();
      await eng.load(DEMO_TRACK_URL);
      setTrackName('Demo Track');
      setHasTrack(true);
      await eng.play();
      setIsPlaying(true);
    } catch (err) {
      console.error(err);
      setError('Demo track not found. Drop an audio file at public/demo.mp3.');
    }
  }, [ensureEngine]);

  const handlePlayPause = useCallback(async () => {
    const eng = engineRef.current;
    if (!eng || !hasTrack) return;
    if (eng.isPlaying) {
      eng.pause();
      setIsPlaying(false);
    } else {
      await eng.play();
      setIsPlaying(true);
    }
  }, [hasTrack]);

  const handleVolume = useCallback((v: number) => {
    setVolume(v);
    engineRef.current?.setVolume(v);
  }, []);

  return (
    <main
      className="relative h-dvh w-screen overflow-hidden grain-overlay"
      style={{ background: theme.backgroundColor }}
    >
      {/* Canvas — fills viewport, behind everything */}
      <div className="absolute inset-0 z-0">
        <WaveformCanvas
          engineRef={engineRef}
          theme={theme}
          isPlaying={isPlaying}
        />
      </div>

      {/* TOP BAR */}
      <header className="pointer-events-none fixed top-0 left-0 right-0 z-20 flex items-start justify-between px-5 py-5 sm:px-8 sm:py-6">
        <div className="flex items-center gap-3">
          <span
            className="block h-2 w-2"
            style={{
              backgroundColor: theme.swatch,
              boxShadow: `0 0 8px ${theme.swatch}`,
            }}
            aria-hidden="true"
          />
          <span className="font-syne text-[15px] font-extrabold tracking-[0.25em] text-white">
            WAVEFORM
          </span>
        </div>
      </header>

      {!hasTrack && <EmptyState themeSwatch={theme.swatch} />}

      {error && (
        <div className="pointer-events-none fixed left-1/2 top-24 z-30 -translate-x-1/2 transform">
          <div className="pointer-events-auto border border-red-500/40 bg-black/80 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-red-200 backdrop-blur-sm">
            {error}
          </div>
        </div>
      )}

      <BottomControls
        engineRef={engineRef}
        hasTrack={hasTrack}
        trackName={trackName}
        volume={volume}
        themeId={themeId}
        themeSwatch={theme.swatch}
        onPlayPause={handlePlayPause}
        onUpload={handleUpload}
        onDemo={handleDemo}
        onVolumeChange={handleVolume}
        onThemeChange={setThemeId}
        onPlayingChange={setIsPlaying}
      />
    </main>
  );
}

function prettifyName(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .trim();
}
