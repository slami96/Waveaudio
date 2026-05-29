# WAVEFORM

An audio-reactive 3D visualizer. Upload a track, hit play, and a noise-displaced sphere blooms and pulses to the music in real time.

Built as a portfolio piece for Adam Slamen.

![WAVEFORM](https://img.shields.io/badge/Next.js-15-black) ![React 19](https://img.shields.io/badge/React-19-61dafb) ![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6) ![R3F](https://img.shields.io/badge/R3F-9-orange) ![GLSL](https://img.shields.io/badge/GLSL-shaders-blue)

---

## What this demonstrates

- **React Three Fiber 9** declarative WebGL scene graph
- **Custom GLSL shaders** — vertex displacement using Simplex 3D noise + Fresnel rim glow in the fragment shader
- **Web Audio API** — `AudioContext` + `AnalyserNode` FFT, split into bass / mid / treble bands every frame
- **Post-processing** — `UnrealBloom` reactive to bass via direct effect reference
- **TypeScript strict mode** end-to-end
- **Next.js 15 App Router** with proper client-component boundaries and dynamic SSR-disabled imports for the WebGL canvas

## How the visual works

**Vertex shader** (`shaders/sphere.vert.ts`)
Each of the sphere's ~16,000 vertices is displaced along its own normal by 3D Simplex noise. The displacement amount is a weighted sum of bass / mid / treble bands, so loud passages distort the geometry more dramatically. Two octaves of noise are layered for organic detail.

**Fragment shader** (`shaders/sphere.frag.ts`)
A Schlick-style Fresnel approximation (`pow(1 - dot(normal, viewDir), 3.0)`) produces a rim glow that brightens with bass. The fragment color mixes the base sphere color and the glow color based on Fresnel + the vertex noise value + the overall audio level.

**Audio pipeline** (`lib/audioEngine.ts`)
`HTMLAudioElement` → `MediaElementAudioSourceNode` → `AnalyserNode` → `GainNode` → destination. FFT size is 512 (256 usable bins). Each frame the bins are split into three bands, averaged, normalised to 0–1, and exponentially smoothed before being passed as shader uniforms.

The `AudioContext` is lazily created on the first play-button click to satisfy browser autoplay policies.

## Project structure

```
app/
  layout.tsx              fonts (Syne + JetBrains Mono), metadata
  page.tsx                main page, orchestrates audio engine + UI
  globals.css             tailwind, fonts, film grain overlay
components/
  WaveformCanvas.tsx      <Canvas> + post-processing (client component)
  AudioSphere.tsx         the sphere mesh and reactive shader uniforms
  ParticleField.tsx       drifting background particles
  BottomControls.tsx      play/pause, upload, demo, seek, volume, themes
  ThemeSelector.tsx       the three colored theme dots
  EmptyState.tsx          "DROP A TRACK" prompt
lib/
  audioEngine.ts          Web Audio API wrapper
  themes.ts               three color theme presets
  constants.ts            FFT config, particle counts, distortion defaults
shaders/
  sphere.vert.ts          vertex shader (with full Simplex 3D noise)
  sphere.frag.ts          fragment shader (Fresnel + color mix)
public/
  demo.mp3                <-- drop your demo track here
```

## Run locally

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>. Upload an MP3/WAV/OGG file and hit play.

> **For the "Try Demo" button to work**, drop an audio file at `public/demo.mp3`. Anything works — a short royalty-free track from [Pixabay Music](https://pixabay.com/music/) or [Free Music Archive](https://freemusicarchive.org/) is ideal. Aim for something with strong bass hits and dynamic range so the visualizer has something to react to.

## Deploy to Vercel

1. Push the repo to GitHub.
2. On [vercel.com](https://vercel.com), import the repository.
3. Vercel detects Next.js automatically — accept the defaults and deploy.

That's it. No environment variables, no build configuration tweaks.

## Supported audio formats

| Format | Chrome | Firefox | Safari |
| ------ | ------ | ------- | ------ |
| MP3    | ✓      | ✓       | ✓      |
| WAV    | ✓      | ✓       | ✓      |
| OGG    | ✓      | ✓       | ✗      |
| FLAC   | ✓      | ✓       | ✓      |

If you intend the demo to work in Safari, use `demo.mp3` (not `.ogg`).

## Themes

Three presets, switchable with the colored dots in the bottom-right:

- **Mountain Sunset** — amber sphere, orange-red glow
- **Alpine Ice** — cyan sphere, electric-blue glow
- **Void** — violet sphere, magenta glow

## Performance

- Desktop: 128×128 sphere segments (~16k verts), 700 particles, target 60fps
- Mobile (≤768px): segments drop to 64×64 (~4k verts), same particle count, target 60fps
- `dpr` capped at `[1, 2]` to avoid retina-display fillrate cliffs
- Bloom uses mipmap blur for cheaper large-radius glow

## Credits

- Simplex 3D noise — Ashima Arts (public domain), [ashima/webgl-noise](https://github.com/ashima/webgl-noise)
- Built with [React Three Fiber](https://r3f.docs.pmnd.rs/) and [postprocessing](https://github.com/pmndrs/postprocessing)

Built by **Adam Slamen** — Creative Developer.
