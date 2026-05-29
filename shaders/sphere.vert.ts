/**
 * Sphere vertex shader — SIMPLE version.
 *
 * Two LOW-frequency noise waves give a smooth, fluid wobble (no high-frequency
 * micro-detail, so it does NOT look like rock). The deformation amplitude is
 * near-zero when quiet and swells hard with bass + the beat pulse, so the orb
 * is a near-smooth sphere at rest and visibly blooms on every kick.
 *
 * Normals are recomputed from the displaced surface so it stays lit and 3D —
 * but at this low frequency that reads as a smooth blob, not a stone.
 *
 * Includes the full public-domain Ashima Simplex 3D noise (snoise).
 * Source: https://github.com/ashima/webgl-noise (MIT/PD)
 */
export const sphereVertexShader = /* glsl */ `
// ====== Ashima Simplex 3D Noise ======
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
// ====== /Ashima Simplex 3D Noise ======

uniform float uTime;
uniform float uBass;
uniform float uBeat;
uniform float uDistortion;

varying vec3 vNormal;
varying vec3 vViewDir;

float displace(vec3 dir) {
  // Two LOW-frequency octaves only -> smooth, fluid wobble.
  float shape = snoise(dir * 1.3 + uTime * 0.20)
              + snoise(dir * 2.6 - uTime * 0.15) * 0.35;
  // Near-flat when quiet; swells with bass and snaps on the beat.
  float amp = 0.03 + uBass * 0.38 + uBeat * 0.35;
  return shape * amp * uDistortion;
}

void main() {
  vec3  dir    = normalize(position);
  float radius = length(position);

  float d0 = displace(dir);
  vec3  p0 = position + dir * d0;

  // Recompute normal from two displaced neighbours. Larger eps = smoother.
  vec3 up        = abs(dir.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3 tangent   = normalize(cross(up, dir));
  vec3 bitangent = cross(dir, tangent);
  float eps = 0.04;
  vec3 dirA = normalize(dir + tangent * eps);
  vec3 dirB = normalize(dir + bitangent * eps);
  vec3 pA = dirA * radius + dirA * displace(dirA);
  vec3 pB = dirB * radius + dirB * displace(dirB);
  vec3 newNormal = normalize(cross(pA - p0, pB - p0));
  if (dot(newNormal, dir) < 0.0) newNormal = -newNormal;

  vec4 worldPos = modelMatrix * vec4(p0, 1.0);
  vNormal  = normalize(mat3(modelMatrix) * newNormal);
  vViewDir = normalize(cameraPosition - worldPos.xyz);

  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;
