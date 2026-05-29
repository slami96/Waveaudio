/**
 * Sphere fragment shader.
 *
 * Now that the vertex shader hands us a real per-pixel normal that follows the
 * displaced surface, we can light it like an actual 3D object:
 *   - diffuse + ambient    -> form and shadow in the valleys
 *   - tight specular        -> glints that sparkle with treble
 *   - Fresnel rim           -> glowing edge that pulses with bass / beats
 *   - crest tint            -> the raised peaks shift toward the glow colour and
 *                              are the bits that cross the (now tighter) bloom
 *                              threshold, so bloom kisses the peaks instead of
 *                              flooding the whole ball.
 */
export const sphereFragmentShader = /* glsl */ `
uniform vec3  uColor;
uniform vec3  uGlowColor;
uniform float uAudioLevel;
uniform float uBass;
uniform float uTreble;
uniform float uBeat;

varying vec3  vNormal;
varying vec3  vViewDir;
varying float vPeak;

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(vViewDir);

  // Key light (fixed direction, view-space-ish). Gives the surface form.
  vec3  L     = normalize(vec3(0.5, 0.7, 0.6));
  float diff  = clamp(dot(N, L), 0.0, 1.0);
  float ambient = 0.22;

  // Fresnel rim — meaningful now because N follows the displacement.
  float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 2.5);

  // Tight specular glints; treble makes them sparkle.
  vec3  H    = normalize(L + V);
  float spec = pow(clamp(dot(N, H), 0.0, 1.0), 40.0);

  // Shaded base colour.
  vec3 base = uColor * (ambient + diff * 0.95);

  // Raised crests shift toward the glow colour (and read brighter).
  float crest = clamp(vPeak * 2.2, 0.0, 1.0);
  vec3 color = mix(base, uGlowColor, crest * 0.65 + uAudioLevel * 0.10);

  // Audio-reactive rim glow.
  color += uGlowColor * fres * (0.45 + uBass * 1.6 + uBeat * 1.1);

  // Specular pop.
  color += vec3(1.0) * spec * (0.25 + uTreble * 0.9);

  // Whole-surface flash on the beat.
  color *= (0.9 + uBeat * 0.45);

  gl_FragColor = vec4(color, 1.0);
}
`;
