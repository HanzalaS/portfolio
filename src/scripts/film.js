// The particle film: a laptop that dissolves into light and lands as a phone in an open hand.
// Loaded only after the page is readable. Returns false (and the CSS glow stays) if WebGL isn't available.
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Euler,
  MathUtils,
  Matrix3,
  Matrix4,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  Sphere,
  Vector3,
  WebGLRenderer,
} from 'three';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;
// Hand the main thread back between set-up steps so no single task blocks input for long.
const yieldNow = () => (globalThis.scheduler?.yield ? globalThis.scheduler.yield() : new Promise((r) => setTimeout(r, 0)));

export async function initFilm({ canvas, film, about, contact, reduce, coarse, onLost = () => {}, onRestored = () => {} }) {
  await yieldNow();
  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  } catch {
    return false;
  }
  if (!renderer || !renderer.getContext()) return false;
  // A context lost while the film is still setting up ends set-up; the CSS fallback stays.
  const lostEarly = new Promise((r) => canvas.addEventListener('webglcontextlost', () => r('lost'), { once: true }));
  await yieldNow();

  // The brand palette lives in CSS; the film reads it so colours stay in one place.
  const css = getComputedStyle(document.documentElement);
  const rgb = (name, fallback) => {
    const m = css.getPropertyValue(name).match(/\d+(\.\d+)?/g);
    return m && m.length >= 3 ? m.slice(0, 3).map(Number) : fallback;
  };
  const A = rgb('--a-rgb', [60, 240, 180]);
  const A2 = rgb('--a2-rgb', [184, 255, 226]);
  const B = rgb('--b-rgb', [157, 123, 255]);
  const B2 = rgb('--b2-rgb', [210, 196, 255]);
  const v3 = (c) => new Vector3(c[0] / 255, c[1] / 255, c[2] / 255);
  const mixc = (c, d, t) => c.map((x, i) => Math.round(x + (d[i] - x) * t));
  const hot = mixc(A2, [255, 255, 255], 0.75);

  const DPR = Math.min(window.devicePixelRatio || 1, 1.75);
  renderer.setPixelRatio(DPR);
  renderer.setClearColor(0x05060a, 1); // matches --bg

  // Fewer particles on phones and on machines with little memory.
  const lowMem = typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 4;
  const small = window.innerWidth < 760 || coarse;
  const N = small ? 7000 : lowMem ? 10000 : 16000;

  /* seeded random, so the shapes are the same on every visit */
  let seed = 20261113;
  function R() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function superE(w, h, n, t) {
    const c = Math.cos(t);
    const s = Math.sin(t);
    const e = 2 / n;
    return [(Math.sign(c) * Math.pow(Math.abs(c), e) * w) / 2, (Math.sign(s) * Math.pow(Math.abs(s), e) * h) / 2];
  }
  function unit() {
    const u = R() * 2 - 1;
    const a = R() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    return [s * Math.cos(a), s * Math.sin(a), u];
  }
  function capsule(a, b, r) {
    const t = R();
    const d = unit();
    return [lerp(a[0], b[0], t) + d[0] * r, lerp(a[1], b[1], t) + d[1] * r, lerp(a[2], b[2], t) + d[2] * r];
  }
  function rectPerim(w, h) {
    let q = R() * 2 * (w + h);
    if (q < w) return [q - w / 2, -h / 2];
    q -= w;
    if (q < h) return [w / 2, q - h / 2];
    q -= h;
    if (q < w) return [w / 2 - q, h / 2];
    q -= w;
    return [-w / 2, h / 2 - q];
  }

  /* ---- shape 0: laptop ---- */
  let lapAnchor;
  function laptop() {
    const P = new Float32Array(N * 3);
    const G = new Float32Array(N);
    const A = 0.22;
    const cA = Math.cos(A);
    const sA = Math.sin(A);
    const HZ = -1.35;
    const tilt = 0.34;
    const yaw = -0.5;
    const ct = Math.cos(tilt);
    const st = Math.sin(tilt);
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const lid = (sx, sh, dz) => [sx, sh * cA + dz * sA, HZ - sh * sA + dz * cA];
    const xf = (p) => {
      const x = p[0];
      const y = p[1] - 1.1;
      const z = p[2] + 0.3;
      const y2 = y * ct - z * st;
      const z2 = y * st + z * ct;
      return [x * cy + z2 * sy, y2, -x * sy + z2 * cy];
    };
    const els = [
      [0.05, 0.95, 0.87, 0.93],
      [0.05, 0.25, 0.08, 0.8],
      [0.29, 0.95, 0.47, 0.8],
      [0.29, 0.5, 0.08, 0.4],
      [0.52, 0.73, 0.08, 0.4],
      [0.75, 0.95, 0.08, 0.4],
    ];
    const inEl = (u, v) => els.some((e) => u > e[0] && u < e[1] && v > e[2] && v < e[3]);
    const SW = 3.72;
    const SH = 2.4;
    const S0 = 0.15;
    for (let i = 0; i < N; i++) {
      const r = R();
      let p;
      let g;
      let e;
      let u;
      let v;
      if (r < 0.12) {
        e = superE(4.0, 2.7, 12, R() * Math.PI * 2);
        p = lid(e[0], e[1] + 1.35, (R() - 0.5) * 0.04);
        g = 0.75 + R() * 0.3;
      } else if (r < 0.34) {
        u = R();
        v = R();
        p = lid((u - 0.5) * SW, S0 + v * SH, 0.01);
        g = inEl(u, v) ? 0.36 + R() * 0.12 : 0.1 + R() * 0.08;
      } else if (r < 0.46) {
        const el = els[Math.floor(R() * els.length)];
        const rp = rectPerim(el[1] - el[0], el[3] - el[2]);
        u = (el[0] + el[1]) / 2 + rp[0];
        v = (el[2] + el[3]) / 2 + rp[1];
        p = lid((u - 0.5) * SW, S0 + v * SH, 0.012);
        g = 0.85 + R() * 0.35;
      } else if (r < 0.52) {
        p = lid((R() - 0.5) * 4.6, R() * 3.0, 0.12 + R() * 0.7);
        g = 0.04 + R() * 0.08;
      } else if (r < 0.61) {
        e = superE(4.1, 2.7, 12, R() * Math.PI * 2);
        const bot = R() < 0.3;
        p = [e[0], bot ? -0.08 : 0, e[1]];
        g = bot ? 0.3 : 0.75;
      } else if (r < 0.83) {
        const c = Math.floor(R() * 13);
        const row = Math.floor(R() * 5);
        const kx = -1.74 + c * 0.29;
        const kz = -1.15 + row * 0.27;
        const q = rectPerim(0.2, 0.2);
        p = [kx + q[0], 0.02, kz + q[1]];
        g = 0.42 + R() * 0.22;
      } else if (r < 0.88) {
        e = superE(1.3, 0.75, 8, R() * Math.PI * 2);
        p = [e[0], 0.01, 0.82 + e[1]];
        g = 0.5;
      } else {
        p = [(R() - 0.5) * 4.0, 0, (R() - 0.5) * 2.6];
        g = 0.06 + R() * 0.08;
      }
      p = xf(p);
      P[i * 3] = p[0];
      P[i * 3 + 1] = p[1];
      P[i * 3 + 2] = p[2];
      G[i] = g;
    }
    lapAnchor = xf(lid(0, 1.35, 0.1));
    return { p: P, g: G };
  }

  /* ---- shape 1: the stream (animated in the shader) ---- */
  function stream() {
    const P = new Float32Array(N * 3);
    const G = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      P[i * 3] = R();
      P[i * 3 + 1] = R() * Math.PI * 2;
      P[i * 3 + 2] = 0.15 + Math.sqrt(R()) * 0.95;
      G[i] = 0.24 + Math.pow(R(), 3) * 1.05;
    }
    return { p: P, g: G };
  }

  /* ---- shape 2: a phone in an open hand ---- */
  let phoneAnchor;
  function phoneHand() {
    const P = new Float32Array(N * 3);
    const G = new Float32Array(N);
    const PC = [0, 0.55, 0.35];
    const pr = -0.06;
    const cr = Math.cos(pr);
    const sr = Math.sin(pr);
    const ry = -0.3;
    const cy = Math.cos(ry);
    const sy = Math.sin(ry);
    const ph = (x, y, z) => [PC[0] + x * cr - y * sr, PC[1] + x * sr + y * cr, PC[2] + z];
    const xf = (p) => {
      const x = p[0];
      const y = p[1] + 0.3;
      const z = p[2];
      return [x * cy + z * sy, y, -x * sy + z * cy];
    };
    const W = 1.55;
    const H = 3.1;
    const fingers = [0.62, 0.2, -0.22, -0.6];
    for (let i = 0; i < N; i++) {
      const r = R();
      let p;
      let g;
      let e;
      if (r < 0.11) {
        e = superE(W, H, 7, R() * Math.PI * 2);
        p = ph(e[0], e[1], 0.08);
        g = 0.95 + R() * 0.25;
      } else if (r < 0.15) {
        e = superE(W, H, 7, R() * Math.PI * 2);
        p = ph(e[0], e[1], -0.08);
        g = 0.3;
      } else if (r < 0.18) {
        e = superE(W, H, 7, R() * Math.PI * 2);
        p = ph(e[0], e[1], (R() - 0.5) * 0.16);
        g = 0.4;
      } else if (r < 0.3) {
        p = ph((R() - 0.5) * 1.38, (R() - 0.5) * 2.9, 0.085);
        g = 0.1 + R() * 0.1;
      } else if (r < 0.39) {
        const a = R() * Math.PI * 2;
        const rad = 0.42 + (R() - 0.5) * 0.05;
        p = ph(Math.sin(a) * rad, 0.72 + Math.cos(a) * rad, 0.09);
        g = a < Math.PI * 1.5 ? 1.0 + R() * 0.25 : 0.3;
      } else if (r < 0.47) {
        const bi = Math.floor(R() * 3);
        const lens = [1.1, 0.78, 0.94];
        const by = [-0.05, -0.33, -0.61][bi];
        p = ph(-0.55 + R() * lens[bi], by + (R() - 0.5) * 0.1, 0.09);
        g = bi === 0 ? 0.75 : 0.5;
      } else if (r < 0.51) {
        const bp = rectPerim(1.0, 0.24);
        p = ph(bp[0], -1.12 + bp[1], 0.09);
        g = 0.9;
      } else if (r < 0.52) {
        p = ph((R() - 0.5) * 0.34, 1.4 + (R() - 0.5) * 0.06, 0.09);
        g = 0.6;
      } else if (r < 0.66) {
        const d = unit();
        p = [0.1 + d[0] * 0.92, -0.75 + d[1] * 0.88, -0.32 + d[2] * 0.28];
        g = 10.42 + R() * 0.14;
      } else if (r < 0.78) {
        const t = R();
        const c0 = [0.15, -1.45, -0.4];
        const c1 = [0.6, -4.8, -0.5];
        const rr = lerp(0.5, 0.6, t);
        const dd = unit();
        p = [
          lerp(c0[0], c1[0], t) + dd[0] * rr,
          lerp(c0[1], c1[1], t) + dd[1] * rr * 0.4,
          lerp(c0[2], c1[2], t) + dd[2] * rr * 0.7,
        ];
        g = 10.04 + 0.42 * Math.pow(1 - t, 1.3);
      } else if (r < 0.86) {
        p =
          R() < 0.55
            ? capsule([-0.55, -1.15, -0.1], [-0.98, -0.5, 0.15], 0.19)
            : capsule([-0.98, -0.5, 0.15], [-0.74, 0.08, 0.5], 0.155);
        g = 10.5 + R() * 0.14;
      } else {
        const yb = fingers[Math.floor(R() * 4)];
        p =
          R() < 0.5
            ? capsule([0.72, yb, -0.38], [1.08, yb + 0.06, -0.05], 0.13)
            : capsule([1.08, yb + 0.06, -0.05], [0.8, yb + 0.14, 0.24], 0.12);
        g = 10.5 + R() * 0.14;
      }
      p = xf(p);
      P[i * 3] = p[0];
      P[i * 3 + 1] = p[1];
      P[i * 3 + 2] = p[2];
      G[i] = g;
    }
    phoneAnchor = xf(ph(0, 0.3, 0.1));
    return { p: P, g: G };
  }

  /* ---- shape 3: a calm field of light behind the sections ---- */
  function field() {
    const P = new Float32Array(N * 3);
    const G = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      P[i * 3] = (R() - 0.5) * 26;
      P[i * 3 + 1] = (R() - 0.5) * 15;
      P[i * 3 + 2] = -12 + R() * 13;
      G[i] = 0.05 + Math.pow(R(), 5) * 0.6;
    }
    return { p: P, g: G };
  }

  /* ---- shape 4: "hello." sampled from the type ---- */
  function hello() {
    const P = new Float32Array(N * 3);
    const G = new Float32Array(N);
    const cw = 1200;
    const ch = 420;
    const cv = document.createElement('canvas');
    cv.width = cw;
    cv.height = ch;
    const x = cv.getContext('2d');
    const pts = [];
    if (x) {
      x.fillStyle = '#fff';
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.font = 'italic 360px "Instrument Serif", Georgia, serif';
      x.fillText('hello.', cw / 2, ch / 2 + 6);
      const data = x.getImageData(0, 0, cw, ch).data;
      for (let yy = 0; yy < ch; yy += 3) for (let xx = 0; xx < cw; xx += 3) if (data[(yy * cw + xx) * 4 + 3] > 128) pts.push(xx, yy);
    }
    const n = pts.length / 2;
    for (let i = 0; i < N; i++) {
      if (!n) {
        P[i * 3] = (R() - 0.5) * 8;
        P[i * 3 + 1] = (R() - 0.5) * 2;
        P[i * 3 + 2] = 0;
        G[i] = 0.3;
        continue;
      }
      const k = Math.floor(R() * n);
      const px = pts[k * 2] + (R() - 0.5) * 3;
      const py = pts[k * 2 + 1] + (R() - 0.5) * 3;
      P[i * 3] = ((px - cw / 2) / cw) * 9;
      P[i * 3 + 1] = (-(py - ch / 2) / cw) * 9;
      P[i * 3 + 2] = (R() - 0.5) * 0.25;
      G[i] = 0.3 + R() * R() * 0.85;
    }
    return { p: P, g: G };
  }

  const S0 = laptop();
  const S1 = stream();
  await yieldNow();
  const S2 = phoneHand();
  const S3 = field();
  await yieldNow();
  const S4 = hello();
  const rnd = new Float32Array(N * 4);
  const glow = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    rnd[i * 4] = R();
    rnd[i * 4 + 1] = R();
    rnd[i * 4 + 2] = 0.6 + R() * R() * 1.5;
    rnd[i * 4 + 3] = S4.g[i];
    glow[i * 4] = S0.g[i];
    glow[i * 4 + 1] = S1.g[i];
    glow[i * 4 + 2] = S2.g[i];
    glow[i * 4 + 3] = S3.g[i];
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(S0.p, 3));
  geo.setAttribute('p1', new BufferAttribute(S1.p, 3));
  geo.setAttribute('p2', new BufferAttribute(S2.p, 3));
  geo.setAttribute('p3', new BufferAttribute(S3.p, 3));
  geo.setAttribute('p4', new BufferAttribute(S4.p, 3));
  geo.setAttribute('aRnd', new BufferAttribute(rnd, 4));
  geo.setAttribute('aGlow', new BufferAttribute(glow, 4));
  geo.boundingSphere = new Sphere(new Vector3(), 100);

  // Re-sample "hello." once the serif has loaded, so the particles take its real shape.
  document.fonts?.load?.('italic 360px "Instrument Serif"').then(() => {
    const T = hello();
    geo.attributes.p4.array.set(T.p);
    geo.attributes.p4.needsUpdate = true;
    for (let j = 0; j < N; j++) rnd[j * 4 + 3] = T.g[j];
    geo.attributes.aRnd.needsUpdate = true;
  }, () => {});

  const U = {
    uTime: { value: 0 },
    uSeg: { value: 0 },
    uFrac: { value: 0 },
    uScA: { value: 1 },
    uScB: { value: 1 },
    uOffA: { value: new Vector3() },
    uOffB: { value: new Vector3() },
    uRot: { value: new Matrix3() },
    uPx: { value: DPR * (small ? 2.8 : 2.6) },
    uMouse: { value: new Vector3(99, 99, 0) },
    uMouseStr: { value: 0 },
    uPulseO: { value: new Vector3() },
    uPulseT: { value: -1 },
    uReduced: { value: reduce ? 1 : 0 },
    uAlpha: { value: 1 },
    uWarm: { value: v3(A) },
    uWarm2: { value: v3(A2) },
    uCool: { value: v3(B) },
    uHot: { value: v3(hot) },
    uHand: { value: v3(mixc(A, A2, 0.5)) },
  };

  const vert = /* glsl */ `
    attribute vec3 p1; attribute vec3 p2; attribute vec3 p3; attribute vec3 p4;
    attribute vec4 aRnd; attribute vec4 aGlow;
    uniform float uTime; uniform float uSeg; uniform float uFrac;
    uniform float uScA; uniform float uScB; uniform vec3 uOffA; uniform vec3 uOffB;
    uniform mat3 uRot; uniform float uPx; uniform vec3 uMouse; uniform float uMouseStr;
    uniform vec3 uPulseO; uniform float uPulseT; uniform float uReduced; uniform float uAlpha;
    uniform vec3 uWarm; uniform vec3 uWarm2; uniform vec3 uCool; uniform vec3 uHot; uniform vec3 uHand;
    varying vec3 vColor; varying float vAlpha;
    #define WARM uWarm
    #define COOL uCool
    #define HOT uHot
    #define HAND uHand
    vec3 rawShape(float s){
      if (s < 0.5) return position;
      if (s < 1.5) return p1;
      if (s < 2.5) return p2;
      if (s < 3.5) return p3;
      return p4;
    }
    float glowOf(float s){
      if (s < 0.5) return aGlow.x;
      if (s < 1.5) return aGlow.y;
      if (s < 2.5) return aGlow.z > 5.0 ? aGlow.z - 10.0 : aGlow.z;
      if (s < 3.5) return aGlow.w;
      return aRnd.w;
    }
    void animShape(float s, vec3 q, float t, out vec3 pos, out float fade, out vec3 tint){
      fade = 1.0;
      if (s < 0.5) { pos = q; tint = WARM; }
      else if (s < 1.5) {
        float x = (fract(q.x + t * 0.03) - 0.5) * 16.0;
        float ang = q.y + t * 0.5 + x * 0.4;
        float r = q.z * (0.45 + 0.3 * sin(x * 0.55 + t * 0.4));
        pos = vec3(x, sin(x * 0.42 + t * 0.35) * 0.85, cos(x * 0.27 - t * 0.2) * 1.1) + vec3(0.0, cos(ang) * r, sin(ang) * r);
        fade = smoothstep(8.0, 5.0, abs(x));
        tint = mix(WARM, COOL, smoothstep(-5.0, 5.0, x));
      }
      else if (s < 2.5) { pos = q; tint = aGlow.z > 5.0 ? HAND : COOL; }
      else if (s < 3.5) {
        pos = q + vec3(sin(t * 0.08 + q.y * 0.35) * 0.5, cos(t * 0.06 + q.x * 0.3) * 0.35, 0.0);
        tint = mix(WARM, COOL, step(0.45, aRnd.y));
      }
      else { pos = q; tint = mix(WARM, uWarm2, aRnd.y); }
    }
    void main(){
      float t = uTime;
      float sA = uSeg; float sB = uSeg + 1.0;
      float lt = clamp((uFrac - aRnd.x * 0.35) / 0.65, 0.0, 1.0);
      lt = lt * lt * (3.0 - 2.0 * lt);
      vec3 a; vec3 b; float fa; float fb; vec3 ta; vec3 tb;
      animShape(sA, rawShape(sA), t, a, fa, ta);
      animShape(sB, rawShape(sB), t, b, fb, tb);
      a = uRot * (a * uScA) + uOffA;
      b = uRot * (b * uScB) + uOffB;
      float tr = sin(3.14159 * lt) * (1.0 - uReduced);
      vec3 n = vec3(sin(a.y * 1.7 + aRnd.y * 12.0 + t * 0.8), sin(b.x * 1.3 + aRnd.x * 9.0 - t * 0.6), cos(a.x * 1.1 + b.y * 0.9 + aRnd.y * 7.0));
      vec3 pos = mix(a, b, lt) + n * tr * 1.2 + vec3(0.0, tr * 0.5 * (aRnd.y - 0.3), 0.0);
      pos += (1.0 - uReduced) * 0.018 * vec3(sin(t * 1.3 + aRnd.x * 40.0), cos(t * 1.1 + aRnd.y * 40.0), sin(t * 0.9 + aRnd.x * 20.0));
      vec2 dm = pos.xy - uMouse.xy;
      float dist = length(dm);
      vec2 dir = dm / (dist + 0.0001);
      float f = uMouseStr * exp(-dist * dist * 1.3);
      pos.xy += dir * f * 0.55 + vec2(-dir.y, dir.x) * f * 0.42;
      pos.z += f * 0.7;
      float band = 0.0;
      if (uPulseT >= 0.0) {
        vec2 dp = pos.xy - uPulseO.xy; float pd = length(dp);
        float rr = uPulseT * 5.5;
        band = exp(-(pd - rr) * (pd - rr) * 2.2) * exp(-uPulseT * 1.1);
        pos.xy += dp / (pd + 0.0001) * band * 0.45;
        pos.z += band * 0.4;
      }
      vec4 mv = modelViewMatrix * vec4(pos, 1.0);
      gl_Position = projectionMatrix * mv;
      float g = mix(glowOf(sA), glowOf(sB), lt) + tr * 0.12 + f * 0.7 + band * 0.9;
      gl_PointSize = aRnd.z * uPx * (0.6 + g * 0.8) * (10.0 / max(0.5, -mv.z));
      vec3 tint = mix(ta, tb, lt);
      vColor = mix(tint, HOT, clamp(g * g * 0.55, 0.0, 1.0));
      vAlpha = clamp(0.15 + g * 0.9, 0.0, 1.3) * mix(fa, fb, lt) * uAlpha;
    }`;

  const frag = /* glsl */ `
    varying vec3 vColor; varying float vAlpha;
    void main(){
      vec2 c = gl_PointCoord - 0.5; float d = length(c);
      if (d > 0.5) discard;
      float a = smoothstep(0.5, 0.0, d); a = a * a * 0.75 + smoothstep(0.16, 0.0, d) * 0.5;
      gl_FragColor = vec4(vColor, a * vAlpha);
    }`;

  const mat = new ShaderMaterial({
    uniforms: U,
    vertexShader: vert,
    fragmentShader: frag,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
  });
  const points = new Points(geo, mat);
  points.frustumCulled = false;
  const scene = new Scene();
  scene.add(points);
  const camera = new PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 10);

  // Release the GPU context and buffers if the film can't run, so nothing lingers.
  const fail = () => {
    geo.dispose();
    mat.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    return false;
  };

  /* shader compile check: fail soft to the CSS fallback */
  // compileAsync lets the GPU compile in parallel (KHR_parallel_shader_compile) instead of stalling the page;
  // the link status is read only once the program is ready, so that read no longer waits on the GPU.
  try {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    await yieldNow();
    if ((await Promise.race([renderer.compileAsync(scene, camera), lostEarly])) === 'lost') return fail();
    const gl = renderer.getContext();
    const progs = renderer.info.programs;
    if (progs && progs.length) {
      const prog = progs[progs.length - 1].program;
      if (prog && !gl.getProgramParameter(prog, gl.LINK_STATUS)) return fail();
    }
  } catch {
    return fail();
  }

  // Phones drop the GPU context when backgrounded; show the CSS fallback until it comes back.
  let lost = false;
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    lost = true;
    onLost();
  });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false;
    dirty = true;
    onRestored();
  });

  /* ---- layout per breakpoint ---- */
  let offs = [];
  let scs = [];
  const V = (x, y, z) => new Vector3(x, y, z);
  function layout() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const asp = w / h;
    camera.aspect = asp;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    const visH = 2 * 10 * Math.tan(MathUtils.degToRad(17.5));
    const visW = visH * asp;
    if (asp > 1.05) {
      const sh = Math.min(visW * 0.24, 2.7);
      offs = [V(sh, -0.15, 0), V(0, 0.1, 0), V(sh * 0.95, -0.4, 0), V(0, 0, 0), V(0, 1.35, 0)];
      scs = [Math.min(1, visW / 10.6), Math.max(1, visW / 12), Math.min(0.74, visH / 8.4), 1, Math.min(1, visW / 9.5)];
    } else {
      offs = [V(0, 1.85, 0), V(0, 0.9, 0), V(0, 0.95, 0), V(0, 0, 0), V(0, 1.2, 0)];
      scs = [Math.min(0.75, visW / 6.4), 0.6, Math.min(0.7, visW / 4.6), 1, Math.min(0.9, visW / 8.6)];
    }
  }

  /* ---- scroll -> morph keyframes ---- */
  let keys = [
    [0, 0],
    [1, 0],
  ];
  const absTop = (el) => el.getBoundingClientRect().top + window.scrollY;
  function computeKeys() {
    const vh = window.innerHeight;
    const f = absTop(film);
    const fl = film.offsetHeight - vh;
    const ab = about ? absTop(about) : f + fl + vh;
    const ft = contact ? absTop(contact) : document.documentElement.scrollHeight;
    const max = Math.max(1, document.documentElement.scrollHeight - vh);
    keys = [
      [0, 0],
      [f, 0],
      [f + fl * 0.2, 0],
      [f + fl * 0.5, 1],
      [f + fl * 0.86, 2],
      [f + fl + vh * 0.15, 2],
      [ab + vh * 0.6, 3],
      [Math.min(ft - vh * 0.55, max - 2), 3],
      [max, 4],
    ];
    for (let k = 1; k < keys.length; k++) if (keys[k][0] <= keys[k - 1][0]) keys[k][0] = keys[k - 1][0] + 1;
  }
  function morphAt(y) {
    if (y <= keys[0][0]) return keys[0][1];
    for (let k = 1; k < keys.length; k++) {
      if (y <= keys[k][0]) {
        const a = keys[k - 1];
        const b = keys[k];
        return lerp(a[1], b[1], (y - a[0]) / (b[0] - a[0]));
      }
    }
    return keys[keys.length - 1][1];
  }

  /* ---- pointer ---- */
  const ptr = { x: 0, y: 0, sx: 0, sy: 0, last: -1e9, inside: false };
  const mouseW = new Vector3(99, 99, 0);
  const mouseTarget = new Vector3(99, 99, 0);
  const tmp = new Vector3();
  function toWorld(nx, ny, out) {
    tmp.set(nx, ny, 0.5).unproject(camera).sub(camera.position).normalize();
    const d = -camera.position.z / tmp.z;
    out.copy(camera.position).addScaledVector(tmp, d);
    return out;
  }
  function setPtr(cx, cy) {
    ptr.x = (cx / window.innerWidth) * 2 - 1;
    ptr.y = -((cy / window.innerHeight) * 2 - 1);
    ptr.last = performance.now();
    ptr.inside = true;
  }
  let pulseStart = -1;
  if (!reduce) {
    window.addEventListener('pointermove', (e) => e.pointerType !== 'touch' && setPtr(e.clientX, e.clientY), { passive: true });
    window.addEventListener('touchstart', (e) => e.touches[0] && setPtr(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
    window.addEventListener('touchmove', (e) => e.touches[0] && setPtr(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
    document.addEventListener('mouseleave', () => (ptr.inside = false));
    const pulse = (e) => {
      if (e.target.closest?.('a,button,input,textarea')) return;
      setPtr(e.clientX, e.clientY);
      toWorld(ptr.x, ptr.y, U.uPulseO.value);
      pulseStart = performance.now();
    };
    // Mouse and pen pulse on press. Touch pulses only on a tap, never at the start of a scroll.
    let down = null;
    window.addEventListener(
      'pointerdown',
      (e) => {
        if (e.pointerType === 'touch') down = { x: e.clientX, y: e.clientY, t: performance.now() };
        else pulse(e);
      },
      { passive: true },
    );
    window.addEventListener(
      'pointerup',
      (e) => {
        if (e.pointerType !== 'touch' || !down) return;
        const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
        if (moved < 10 && performance.now() - down.t < 300) pulse(e);
        down = null;
      },
      { passive: true },
    );
  }

  /* ---- bloom: a soft spill of light behind the current shape ---- */
  const bloom = document.getElementById('bloom');
  const BL = [
    { c: A, o: 0.62, s: 1.0 },
    { c: mixc(A, B, 0.5), o: 0.16, s: 1.5 },
    { c: B, o: 0.5, s: 0.85 },
    { c: mixc(B, B2, 0.3), o: 0.05, s: 1.6 },
    { c: mixc(A, A2, 0.3), o: 0.2, s: 1.3 },
  ];
  const anchors = [lapAnchor, [0, 0, 0], phoneAnchor, [0, 0, 0], [0, 0, 0]];
  const aA = new Vector3();
  const aB = new Vector3();
  const anchorWorld = (i, out) => {
    const a = anchors[i];
    return out.set(a[0], a[1], a[2]).multiplyScalar(scs[i]).applyMatrix3(U.uRot.value).add(offs[i]);
  };

  /* ---- loop ---- */
  let M = 0;
  let shownM = 0;
  let fadeStart = -1e9;
  let mStr = 0;
  const m4 = new Matrix4();
  const eul = new Euler();
  const camZ = [9.6, 8.6, 9.3, 10.4, 10];

  let dirty = true;
  let lastBloom = '';
  function onResize() {
    layout();
    computeKeys();
    dirty = true;
  }
  let rT;
  window.addEventListener('resize', () => {
    clearTimeout(rT);
    rT = setTimeout(onResize, 120);
  });
  window.addEventListener('load', computeKeys);
  document.fonts?.ready?.then(computeKeys);
  layout();
  computeKeys();
  M = morphAt(window.scrollY);
  shownM = Math.round(M);

  function frame(now) {
    try {
      step(now);
      requestAnimationFrame(frame);
    } catch {
      // Something went wrong mid-film: stop drawing and let the CSS fallback take over.
      onLost();
    }
  }

  function step(now) {
    if (lost) return;
    const t = reduce ? 0 : now * 0.001;
    const target = morphAt(window.scrollY);

    if (reduce) {
      const snap = Math.round(target);
      if (snap !== shownM) {
        shownM = snap;
        fadeStart = now;
      }
      M = shownM;
      U.uAlpha.value = clamp((now - fadeStart) / 600, 0, 1);
      // With reduced motion the scene is still: only redraw while a cross-fade runs or after a change.
      if (now - fadeStart > 650 && !dirty) return;
      dirty = false;
    } else {
      M += (target - M) * 0.075;
      if (Math.abs(target - M) < 0.0004) M = target;
    }
    M = clamp(M, 0, 4);
    const seg = Math.min(3, Math.floor(M));
    const frac = M - seg;

    ptr.sx += (ptr.x - ptr.sx) * 0.05;
    ptr.sy += (ptr.y - ptr.sy) * 0.05;
    const active = !reduce && ptr.inside && now - ptr.last < 2600;
    mStr += ((active ? 1 : 0) - mStr) * 0.05;

    const cz = lerp(camZ[seg], camZ[seg + 1], sstep(0, 1, frac));
    camera.position.set(reduce ? 0 : ptr.sx * 0.35, reduce ? 0 : ptr.sy * 0.2, cz);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();

    const yaw = reduce ? 0 : Math.sin(t * 0.13) * 0.1 + ptr.sx * 0.14;
    const pitch = reduce ? 0 : -ptr.sy * 0.08 + Math.sin(t * 0.09) * 0.03;
    eul.set(pitch, yaw, 0);
    m4.makeRotationFromEuler(eul);
    U.uRot.value.setFromMatrix4(m4);

    U.uTime.value = t;
    U.uSeg.value = seg;
    U.uFrac.value = frac;
    U.uScA.value = scs[seg];
    U.uScB.value = scs[seg + 1];
    U.uOffA.value.copy(offs[seg]);
    U.uOffB.value.copy(offs[seg + 1]);

    if (!reduce) {
      toWorld(ptr.x, ptr.y, mouseTarget);
      mouseW.lerp(mouseTarget, 0.12);
      U.uMouse.value.copy(mouseW);
      U.uMouseStr.value = mStr;
      const pt = pulseStart < 0 ? -1 : (now - pulseStart) / 1000;
      U.uPulseT.value = pt > 4 ? -1 : pt;
    }

    if (bloom) {
      const e = sstep(0.15, 0.85, frac);
      anchorWorld(seg, aA);
      anchorWorld(seg + 1, aB);
      aA.lerp(aB, e).project(camera);
      const bx = (aA.x * 0.5 + 0.5) * window.innerWidth;
      const by = (-aA.y * 0.5 + 0.5) * window.innerHeight;
      const A = BL[seg];
      const B = BL[seg + 1];
      const base = (Math.min(window.innerWidth, window.innerHeight) * 0.9) / 400;
      const sc = lerp(A.s * scs[seg], B.s * scs[seg + 1], e) * base;
      const flick = reduce ? 1 : 0.93 + 0.07 * Math.sin(t * 1.7) * Math.sin(t * 0.63);
      const tf = `translate3d(${bx.toFixed(0)}px,${by.toFixed(0)}px,0) scale(${sc.toFixed(2)})`;
      const op = (lerp(A.o, B.o, e) * flick * U.uAlpha.value).toFixed(2);
      const bc = `${Math.round(lerp(A.c[0], B.c[0], e))},${Math.round(lerp(A.c[1], B.c[1], e))},${Math.round(lerp(A.c[2], B.c[2], e))}`;
      // Only touch the DOM when the light actually changed.
      const key = tf + op + bc;
      if (key !== lastBloom) {
        lastBloom = key;
        bloom.style.transform = tf;
        bloom.style.opacity = op;
        bloom.style.setProperty('--bc', bc);
      }
    }

    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
  return true;
}
