/**
 * Sphere fragment shader — SIMPLE version.
 *
 * Diffuse + ambient give the orb form. A Fresnel rim glow pulses with bass and
 * the beat. Treble adds a sparkle on the specular highlight. A short flash on
 * each beat. Nothing fancy — clean and readable.
 */
export const sphereFragmentShader = /* glsl */ `
uniform vec3  uColor;
uniform vec3  uGlowColor;
uniform float uBass;
uniform float uTreble;
uniform float uBeat;

varying vec3 vNormal;
varying vec3 vViewDir;

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(vViewDir);
  vec3 L = normalize(vec3(0.4, 0.7, 0.6));

  float diff = clamp(dot(N, L), 0.0, 1.0);
  float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 2.0);
  vec3  H    = normalize(L + V);
  float spec = pow(clamp(dot(N, H), 0.0, 1.0), 24.0);

  vec3 color = uColor * (0.30 + diff * 0.80);
  color += uGlowColor * fres * (0.55 + uBass * 1.3 + uBeat * 1.0); // rim pulse
  color += vec3(1.0) * spec * (0.20 + uTreble * 1.2);             // treble sparkle
  color *= (0.95 + uBeat * 0.40);                                 // beat flash

  gl_FragColor = vec4(color, 1.0);
}
`;
