'use client';

import { THEMES } from '@/lib/themes';

interface ThemeSelectorProps {
  currentThemeId: string;
  onSelect: (id: string) => void;
}

export function ThemeSelector({ currentThemeId, onSelect }: ThemeSelectorProps) {
  return (
    <div className="flex items-center gap-2.5" role="group" aria-label="Color theme">
      {THEMES.map((theme) => {
        const isActive = theme.id === currentThemeId;
        return (
          <button
            key={theme.id}
            type="button"
            onClick={() => onSelect(theme.id)}
            aria-label={`Switch to ${theme.name} theme`}
            aria-pressed={isActive}
            title={theme.name}
            className="group relative w-3.5 h-3.5 cursor-pointer transition-transform hover:scale-125 focus:outline-none focus:ring-1 focus:ring-white/40 focus:ring-offset-2 focus:ring-offset-black"
            style={{
              backgroundColor: theme.swatch,
              boxShadow: isActive
                ? `0 0 12px ${theme.swatch}, 0 0 24px ${theme.swatch}80`
                : 'none',
            }}
          >
            {isActive && (
              <span
                className="absolute -inset-1.5 border border-white/30"
                aria-hidden="true"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
