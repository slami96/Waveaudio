'use client';

import { useRef } from 'react';
import { ThemeSelector } from './ThemeSelector';
import { useAudioProgress } from '@/lib/useAudioProgress';
import type { AudioEngine } from '@/lib/audioEngine';

interface BottomControlsProps {
  engineRef: React.RefObject<AudioEngine | null>;
  hasTrack: boolean;
  trackName: string;
  volume: number;
  themeId: string;
  themeSwatch: string;
  onPlayPause: () => void;
  onUpload: (file: File) => void;
  onDemo: () => void;
  onVolumeChange: (v: number) => void;
  onThemeChange: (id: string) => void;
  onPlayingChange: (playing: boolean) => void;
}

export function BottomControls(props: BottomControlsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    engineRef,
    hasTrack,
    trackName,
    volume,
    themeId,
    themeSwatch,
    onPlayPause,
    onUpload,
    onDemo,
    onVolumeChange,
    onThemeChange,
    onPlayingChange,
  } = props;

  // Polling lives HERE, so only BottomControls re-renders every 200ms —
  // the WebGL Canvas in the parent stays stable.
  const { currentTime, duration, isPlaying } = useAudioProgress(
    engineRef,
    onPlayingChange,
  );

  const handleSeek = (t: number) => {
    engineRef.current?.seek(t);
  };

  return (
    <div className="pointer-events-none fixed bottom-0 left-0 right-0 z-20 px-4 pb-4 sm:px-6 sm:pb-6">
      <div
        className="pointer-events-auto mx-auto max-w-6xl bg-black/45 backdrop-blur-xl border border-white/10"
        style={{ boxShadow: '0 30px 80px -20px rgba(0,0,0,0.6)' }}
      >
        <SeekBar
          currentTime={currentTime}
          duration={duration}
          onSeek={handleSeek}
          accentColor={themeSwatch}
          disabled={!hasTrack}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-4 py-3 sm:px-5 sm:py-4">
          {/* LEFT */}
          <div className="flex items-center gap-2 md:justify-start justify-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/mpeg,audio/wav,audio/ogg,audio/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onUpload(file);
                e.target.value = '';
              }}
            />
            <ControlButton
              onClick={() => fileInputRef.current?.click()}
              label="Upload"
              icon={<UploadIcon />}
            />
            <ControlButton
              onClick={onDemo}
              label="Try Demo"
              variant="outline"
              accentColor={themeSwatch}
            />
          </div>

          {/* CENTER */}
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={onPlayPause}
              disabled={!hasTrack}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="flex h-11 w-11 shrink-0 items-center justify-center border border-white/20 bg-white/5 text-white transition hover:bg-white/15 hover:border-white/40 disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-white/40"
              style={hasTrack ? { boxShadow: `0 0 24px ${themeSwatch}40` } : undefined}
            >
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>
            <div className="min-w-0 flex-1 text-center md:text-left">
              <div
                className="truncate font-syne text-[15px] font-bold uppercase tracking-wider text-white"
                title={trackName || 'No track loaded'}
              >
                {trackName || '—'}
              </div>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="flex items-center gap-4 md:justify-end justify-center">
            <div className="flex items-center gap-2 flex-1 md:flex-none md:w-32 max-w-[8rem]">
              <VolumeIcon level={volume} />
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                aria-label="Volume"
                className="w-full"
                style={{ accentColor: themeSwatch }}
              />
            </div>
            <div className="h-6 w-px bg-white/10" aria-hidden="true" />
            <ThemeSelector currentThemeId={themeId} onSelect={onThemeChange} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SeekBar({
  currentTime,
  duration,
  onSeek,
  accentColor,
  disabled,
}: {
  currentTime: number;
  duration: number;
  onSeek: (t: number) => void;
  accentColor: string;
  disabled: boolean;
}) {
  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
  return (
    <div className="relative h-[3px] w-full overflow-hidden bg-white/5">
      <div
        className="absolute inset-y-0 left-0 transition-[width] duration-100 ease-linear"
        style={{
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${accentColor}80, ${accentColor})`,
          boxShadow: `0 0 10px ${accentColor}`,
        }}
      />
      <input
        type="range"
        min={0}
        max={duration || 100}
        step={0.01}
        value={currentTime}
        onChange={(e) => onSeek(parseFloat(e.target.value))}
        disabled={disabled}
        aria-label="Seek"
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
    </div>
  );
}

function ControlButton({
  onClick,
  label,
  icon,
  variant = 'solid',
  accentColor,
}: {
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
  variant?: 'solid' | 'outline';
  accentColor?: string;
}) {
  const base =
    'inline-flex items-center gap-1.5 px-3.5 h-9 font-mono text-[10px] uppercase tracking-[0.2em] transition focus:outline-none focus:ring-1 focus:ring-white/40';
  if (variant === 'outline') {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${base} border hover:bg-white/10`}
        style={{
          borderColor: accentColor ?? 'rgba(255,255,255,0.3)',
          color: accentColor,
        }}
      >
        {icon}
        {label}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} border border-white/15 bg-white/5 text-white hover:bg-white/15 hover:border-white/30`}
    >
      {icon}
      {label}
    </button>
  );
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/* ─── Icons ────────────────────────────────────────────────────────────── */

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
      <path d="M3 1.5v11l9-5.5z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
      <rect x="3" y="2" width="3" height="10" />
      <rect x="8" y="2" width="3" height="10" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M6 9V2M6 2L3 5M6 2l3 3M2 10h8" strokeLinecap="square" />
    </svg>
  );
}

function VolumeIcon({ level }: { level: number }) {
  const muted = level === 0;
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/60 shrink-0" aria-hidden="true">
      <path d="M2 5h2l3-2v8L4 9H2z" fill="currentColor" />
      {!muted && level < 0.6 && <path d="M9 5.5c.8.5 1.2 1.2 1.2 2s-.4 1.5-1.2 2" />}
      {!muted && level >= 0.6 && (
        <>
          <path d="M9 5.5c.8.5 1.2 1.2 1.2 2s-.4 1.5-1.2 2" />
          <path d="M10.5 4c1.3.8 2 2 2 3.5s-.7 2.7-2 3.5" />
        </>
      )}
      {muted && <path d="M9.5 5.5l3 3M12.5 5.5l-3 3" />}
    </svg>
  );
}
