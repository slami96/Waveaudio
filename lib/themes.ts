import * as THREE from 'three';

export interface Theme {
  id: string;
  name: string;
  sphereColor: THREE.Color;
  glowColor: THREE.Color;
  backgroundColor: string;
  particleColor: THREE.Color;
  swatch: string; // hex for UI dot
}

export const THEMES: readonly Theme[] = [
  {
    id: 'sunset',
    name: 'Mountain Sunset',
    sphereColor: new THREE.Color('#E8A050'),
    glowColor: new THREE.Color('#FF6030'),
    backgroundColor: '#080808',
    particleColor: new THREE.Color('#FF8040'),
    swatch: '#FF6030',
  },
  {
    id: 'ice',
    name: 'Alpine Ice',
    sphereColor: new THREE.Color('#40C0E0'),
    glowColor: new THREE.Color('#0080FF'),
    backgroundColor: '#050810',
    particleColor: new THREE.Color('#60D0FF'),
    swatch: '#0080FF',
  },
  {
    id: 'void',
    name: 'Void',
    sphereColor: new THREE.Color('#9060FF'),
    glowColor: new THREE.Color('#FF40C0'),
    backgroundColor: '#080808',
    particleColor: new THREE.Color('#C080FF'),
    swatch: '#FF40C0',
  },
] as const;

export const DEFAULT_THEME_ID = 'sunset';

export function getTheme(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}
