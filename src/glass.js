// glass.js: raw WebGL2. 픽셀 버퍼를 텍스처로 올리고 프래그먼트 셰이더 한 장으로
// 유리 베젤, 장면, 굴절 렌즈 손잡이를 그린다. 좌표 단위는 CSS px, 원점은 캔버스 중앙, y는 위쪽.

const VERT = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;

uniform vec2 uSize;        // 캔버스 크기 (CSS px)
uniform float uDpr;
uniform float uA;          // 캡슐 중심선 반길이
uniform float uR;          // 베젤 바깥 반지름
uniform float uRi;         // 장면이 보이는 안쪽 반지름
uniform vec3 uKnob;        // 손잡이 x, y, 반지름
uniform vec2 uStretch;     // 속도에 따른 늘어남
uniform float uPress;
uniform float uFocus;
uniform float uT;
uniform vec3 uPage;
uniform sampler2D uTex;
uniform vec2 uTexSize;
uniform float uScale;      // 텍셀 하나가 차지하는 화면 픽셀 수
uniform float uVel;        // 손잡이 속도(-1~1)

out vec4 outColor;

const float PI = 3.14159265;

float sdSpine(vec2 p) { p.x -= clamp(p.x, -uA, uA); return length(p); }
vec2 spineDir(vec2 p) {
  vec2 q = vec2(p.x - clamp(p.x, -uA, uA), p.y);
  float l = length(q);
  return l > 1e-4 ? q / l : vec2(0.0, 1.0);
}
vec2 sceneUV(vec2 p) {
  return vec2((p.x + uA + uRi) / (2.0 * (uA + uRi)), 0.5 - p.y / (2.0 * uRi));
}
// 픽셀 경계는 또렷하게, 가장자리만 한 화면 픽셀 폭으로 부드럽게
vec3 scenePix(vec2 p, float scale) {
  vec2 t = clamp(sceneUV(p), 0.0, 1.0) * uTexSize;
  vec2 i = floor(t), f = fract(t);
  float k = max(scale, 1.0);
  f = clamp(f * k, 0.0, 0.5) + clamp((f - 1.0) * k + 0.5, 0.0, 0.5);
  return textureLod(uTex, (i + f) / uTexSize, 0.0).rgb;
}
vec3 sceneBlur(vec2 p, float lod) {
  return textureLod(uTex, clamp(sceneUV(p), 0.03, 0.97), lod).rgb;
}

// 손잡이를 뺀 나머지 전부: 바닥 그림자, 번지는 빛, 베젤, 장면
vec3 world(vec2 p, float scale) {
  float aa = 1.0 / uDpr;
  float d = sdSpine(p);
  vec2 g = spineDir(p);
  vec2 sp = vec2(clamp(p.x, -uA, uA), 0.0);

  vec3 col = uPage;
  float ds = sdSpine(p + vec2(0.0, uR * 0.26));
  col *= 1.0 - 0.55 * smoothstep(uR * 1.7, uR * 0.75, ds);
  vec3 bleedFar = sceneBlur(sp + g * uRi * 0.6, 5.0);
  col += bleedFar * 0.4 * exp(-max(d - uR, 0.0) / (uR * 0.34));

  if (d < uR + aa) {
    // 장면
    vec3 sc = scenePix(p, scale);
    float e = uRi - d;
    float dTop = sdSpine(p + vec2(0.0, uRi * 0.16));
    sc *= 1.0 - 0.5 * smoothstep(uRi * 0.82, uRi * 1.06, dTop);     // 위쪽 베젤이 드리운 그늘
    sc *= 1.0 - 0.3 * smoothstep(uRi * 0.12, 0.0, e);               // 가장자리 접촉 그늘
    sc += vec3(0.05, 0.055, 0.08) * smoothstep(-0.2, 1.0, p.y / uRi) * smoothstep(0.0, uRi * 0.5, e);

    // 베젤: 둥근 유리관 단면
    float s = clamp((d - uRi) / (uR - uRi), 0.0, 1.0);
    vec3 n = normalize(vec3(g * -cos(PI * s), sin(PI * s) + 0.12));
    vec3 key = normalize(vec3(-0.22, 0.82, 0.52));
    vec3 fill = normalize(vec3(0.3, -0.8, 0.5));
    vec3 V = vec3(0.0, 0.0, 1.0);
    float ndl = max(dot(n, key), 0.0);
    float spec = pow(max(dot(n, normalize(key + V)), 0.0), 64.0);
    float specWide = pow(max(dot(n, normalize(key + V)), 0.0), 10.0);
    float specFill = pow(max(dot(n, normalize(fill + V)), 0.0), 26.0);
    float fres = pow(1.0 - clamp(n.z, 0.0, 1.0), 3.0);
    vec3 bleed = sceneBlur(sp + g * uRi * 0.72, 3.6);
    vec3 tint = mix(vec3(0.46, 0.48, 0.62), bleed * 1.15 + 0.06, 0.62);
    vec3 bz = tint * (0.3 + 0.62 * ndl);
    bz += specWide * 0.2 * (tint + 0.35);
    bz += spec * 1.05;
    bz += specFill * 0.6 * (bleed + 0.16);
    bz += fres * 0.12;
    bz += bleed * 0.55 * smoothstep(0.42, 0.0, s);
    vec3 thru = sceneBlur(sp + g * uRi * (1.0 - s * 0.7), 2.2);                 // 유리관 속으로 비쳐 보이는 장면
    bz = mix(bz, thru * 1.1 + 0.04, 0.3 * (1.0 - s) * (1.0 - s));                              // 장면 빛이 안쪽 면에 번짐
    bz += 0.3 * smoothstep(0.0, 0.05, s) * smoothstep(0.15, 0.06, s) * (0.35 + 0.65 * max(g.y, 0.0));
    bz *= 1.0 - 0.4 * smoothstep(0.82, 1.0, s);
    bz *= 1.0 - 0.3 * smoothstep(0.06, 0.0, s);

    vec3 inside = mix(sc, bz, smoothstep(-aa, aa, d - uRi));
    col = mix(inside, col, smoothstep(-aa, aa, d - uR));
  }

  // 키보드 포커스 고리
  float ring = smoothstep(1.4, 0.4, abs(d - uR - 6.0));
  col = mix(col, vec3(0.86, 0.9, 1.0), ring * uFocus * 0.9);
  return col;
}

vec3 spectrum(float w) {
  return vec3(clamp(1.0 - 2.0 * w, 0.0, 1.0), 1.0 - abs(2.0 * w - 1.0), clamp(2.0 * w - 1.0, 0.0, 1.0));
}

float smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

// 손잡이는 유리 위에 맺힌 큰 물방울이다. 표면장력으로 위아래 유리관을 타고 번져서 바에 붙어 있고,
// 움직이면 뒤쪽으로 물이 더 길게 끌려온다. 음수면 물 안쪽.
float liquid(vec2 p) {
  float Rk = uKnob.z * (1.0 - 0.035 * uPress);
  vec2 q = (p - uKnob.xy) / uStretch;
  float dK = (length(q) - Rk) * min(uStretch.x, uStretch.y);
  float d = sdSpine(p);
  float mid = 0.5 * (uR + uRi), hw = 0.5 * (uR - uRi);
  float ax = p.x - uKnob.x;
  float trailing = step(ax * uVel, 0.0) * abs(uVel);
  float reach = Rk * (1.12 + 1.1 * trailing);
  float taper = 1.0 - smoothstep(Rk * 0.35, reach, abs(ax));
  taper *= taper;
  float dF = abs(d - mid) - hw * 0.5 * taper + (1.0 - taper) * hw * 0.7;
  return smin(dK, dF, uR * 0.2);
}

void main() {
  vec2 p = gl_FragCoord.xy / uDpr - 0.5 * uSize;
  float aa = 1.0 / uDpr;
  vec2 kc = uKnob.xy;
  float Rk = uKnob.z * (1.0 - 0.035 * uPress);
  float L = liquid(p);
  float dCap = sdSpine(p);

  vec3 col = world(p, uScale);

  // 물방울은 떠 있지 않고 유리에 닿아 있다. 멀리 떨어지는 그림자 대신 가장자리에 바짝 붙은 그늘만 둔다
  vec3 bleedK = sceneBlur(kc, 4.0);
  if (L > 0.0 && L < Rk * 0.5) {
    float Ls = liquid(p + vec2(0.0, Rk * 0.05));
    col *= 1.0 - 0.4 * smoothstep(Rk * 0.2, 0.0, Ls);
    col += bleedK * exp(-L / (Rk * 0.12)) * (0.06 + 0.2 * uPress);
  }

  if (L < aa) {
    float eps = max(aa, 0.75);
    vec2 gL = vec2(liquid(p + vec2(eps, 0.0)) - L, liquid(p + vec2(0.0, eps)) - L);
    float gl = length(gL);
    vec2 dir = gl > 1e-5 ? gL / gl : vec2(0.0);                 // 가장 가까운 물 가장자리 쪽
    vec2 q = (p - kc) / uStretch;
    float body = smoothstep(0.03, -0.08, (length(q) - Rk) / Rk); // 큰 물방울 본체인지, 번진 얇은 물인지
    float S = mix(0.25 * (uR - uRi), Rk, body);                 // 그 자리 물의 두께 기준. 번진 물은 얇다
    float rc = clamp(1.0 + L / S, 0.0, 1.0);                    // 0 한가운데(가장 두꺼움) → 1 가장자리
    float z = sqrt(max(1.0 - rc * rc, 0.0));

    // 굴절: 가운데는 확대, 가장자리는 크게 압축. 파장마다 굴절량을 달리해 색수차를 만든다
    const int N = 9;
    const float M0 = 0.56;
    vec3 acc = vec3(0.0), wsum = vec3(0.0);
    for (int i = 0; i < N; i++) {
      float w = float(i) / float(N - 1);
      float f = rc * (M0 + (1.0 - M0) * pow(rc, 2.8)) * (1.0 + (w - 0.5) * mix(0.04, 0.2, body) * rc * rc);
      vec2 src = p - dir * (rc - f) * S;
      vec3 sw = spectrum(w);
      acc += world(src, uScale * max(rc / max(f, 1e-3), 1.0)) * sw;
      wsum += sw;
    }
    vec3 lens = acc / wsum;

    lens *= vec3(0.95, 0.97, 1.0);
    lens *= 1.0 - 0.3 * smoothstep(0.8, 1.0, rc) * body;                                  // 두꺼운 물 가장자리는 어둡다
    lens *= 1.0 - 0.16 * smoothstep(0.86, 1.0, rc) * (1.0 - body);
    lens += bleedK * 0.42 * smoothstep(0.5, 0.96, rc) * smoothstep(0.1, 0.9, -dir.y) * body; // 아래쪽에 모이는 빛

    // 프레넬 테두리. 물이라 비눗방울보다 무지개는 옅게
    float fr = pow(1.0 - z, 3.0);
    float ang = atan(dir.y, dir.x);
    vec3 iri = 0.56 + 0.44 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + ang * 0.16 + rc * 0.9 + uT * 0.8));
    lens += fr * mix(vec3(0.82), iri, 0.5 * body) * 0.52 * (0.3 + 0.7 * body);

    // 하이라이트: 왼쪽 위 창문 반사, 테두리를 따라 도는 초승달, 오른쪽 아래 작은 점
    vec2 u = q / Rk;
    vec2 h1 = u - vec2(-0.36, 0.46);
    h1 = vec2(h1.x * 0.82 + h1.y * 0.57, -h1.x * 0.57 + h1.y * 0.82);
    h1.y += h1.x * h1.x * 0.9;
    float win = 1.0 - smoothstep(0.55, 1.0, length(h1 * vec2(4.2, 9.5)));
    lens += (win * 0.78 + exp(-(h1.x * h1.x * 9.0 + h1.y * h1.y * 30.0)) * 0.12) * body;
    float cres = smoothstep(0.7, 0.85, rc) * smoothstep(0.97, 0.88, rc) * smoothstep(0.3, 0.92, dot(dir, normalize(vec2(-0.5, 0.86))));
    lens += cres * 0.5 * body;
    float cres2 = smoothstep(0.76, 0.88, rc) * smoothstep(0.98, 0.9, rc) * smoothstep(0.55, 0.98, dot(dir, normalize(vec2(0.62, -0.78))));
    lens += cres2 * (bleedK + 0.25) * 0.5 * body;
    vec2 h2 = u - vec2(0.44, -0.5);
    lens += exp(-dot(h2, h2) * 70.0) * 0.32 * body;

    // 번진 얇은 물은 볼록한 띠라서 빛을 받는 쪽에 가는 반짝임이 생긴다
    vec3 n3 = normalize(vec3(dir * rc * 1.4, z + 0.25));
    float glint = pow(max(dot(n3, normalize(vec3(-0.22, 0.82, 0.52) + vec3(0.0, 0.0, 1.0))), 0.0), 40.0);
    lens += glint * 0.7 * (1.0 - body);

    col = mix(col, lens, smoothstep(aa, -aa, L));
  }

  // 캔버스 가장자리로 갈수록 투명해져 페이지 배경과 이어진다
  float cov = 1.0 - smoothstep(uR * 0.4, uR * 0.88, dCap - uR);
  vec2 edge = 0.5 * uSize - abs(p);
  cov *= smoothstep(0.0, uR * 0.3, min(edge.x, edge.y));
  cov = max(cov, smoothstep(Rk * 0.3, 0.0, L));
  outColor = vec4(col * cov, cov);
}`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`shader compile failed: ${log}`);
  }
  return sh;
}

export function createGlass(canvas, texW, texH) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false });
  if (!gl) return null;

  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(`program link failed: ${gl.getProgramInfoLog(prog)}`);
  gl.useProgram(prog);

  const U = {};
  for (const name of ['uSize', 'uDpr', 'uA', 'uR', 'uRi', 'uKnob', 'uStretch', 'uPress', 'uFocus', 'uT', 'uPage', 'uTex', 'uTexSize', 'uScale', 'uVel'])
    U[name] = gl.getUniformLocation(prog, name);

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  const tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, texW, texH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.uniform1i(U.uTex, 0);
  gl.uniform2f(U.uTexSize, texW, texH);

  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.BLEND);
  gl.clearColor(0, 0, 0, 0);

  let lost = false;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; });
  canvas.addEventListener('webglcontextrestored', () => location.reload());

  function draw(pixels, s) {
    if (lost) return;
    gl.viewport(0, 0, canvas.width, canvas.height);
    if (pixels) {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, texW, texH, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      gl.generateMipmap(gl.TEXTURE_2D);
    }
    gl.uniform2f(U.uSize, s.width, s.height);
    gl.uniform1f(U.uDpr, s.dpr);
    gl.uniform1f(U.uA, s.a);
    gl.uniform1f(U.uR, s.R);
    gl.uniform1f(U.uRi, s.r);
    gl.uniform3f(U.uKnob, s.knobX, s.knobY, s.knobR);
    gl.uniform2f(U.uStretch, s.stretchX, s.stretchY);
    gl.uniform1f(U.uPress, s.press);
    gl.uniform1f(U.uFocus, s.focus);
    gl.uniform1f(U.uT, s.t);
    gl.uniform1f(U.uVel, s.vel);
    gl.uniform3f(U.uPage, s.page[0] / 255, s.page[1] / 255, s.page[2] / 255);
    gl.uniform1f(U.uScale, (2 * (s.a + s.r) * s.dpr) / texW);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  return { draw };
}
