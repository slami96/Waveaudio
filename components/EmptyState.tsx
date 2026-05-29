'use client';

interface EmptyStateProps {
  themeSwatch: string;
}

export function EmptyState({ themeSwatch }: EmptyStateProps) {
  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col items-center justify-center text-center px-4">
      <div
        className="font-mono text-[10px] uppercase tracking-[0.4em] mb-4"
        style={{ color: themeSwatch }}
      >
        ◆ awaiting signal
      </div>
      <h2 className="font-syne text-[clamp(3.5rem,12vw,9rem)] font-extrabold tracking-tighter leading-none text-white">
        DROP A TRACK
      </h2>
      <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-white/40 mt-4">
        or click <span className="text-white/70">upload</span> /{' '}
        <span className="text-white/70">try demo</span> below
      </p>
    </div>
  );
}
