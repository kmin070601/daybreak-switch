// scene.js: 2D 픽셀 버퍼에 침실 단면을 그린다.
// 정적 요소(벽, 가구)는 한 번만 알베도 버퍼에 그리고, 매 프레임 조명과 하늘, 고양이, 시계를 합성한다.
// 열마다 "지역 시간"이 따로 있다. 구슬(손잡이)을 경계로 한쪽은 밤, 반대쪽은 낮이고, 구슬 안에서 시간이 빠르게 넘어간다.

import { createPets } from './pets.js';

export const W = 384;
export const H = 64;

const FLOOR = 49;        // 바닥이 시작되는 행
const DAY_ON_RIGHT = true; // 구슬 오른쪽이 낮, 왼쪽이 밤. false로 바꾸면 반대가 된다
const LAMP_X = 212;

// 종류(kind): 0 일반, 1 왼쪽 창 하늘, 2 오른쪽 창 하늘, 3 스탠드 갓, 4 자체 발광, 6 꼬마전구, 7 동물(커튼보다 앞)
const K_SKY_L = 1, K_SKY_R = 2, K_SHADE = 3, K_EMIT = 4, K_BULB = 6, K_PET = 7;

const WIN_L = { x0: 70, y0: 8, x1: 145, y1: 35 };   // 유리 안쪽 영역(포함)
const WIN_R = { x0: 264, y0: 7, x1: 337, y1: 36 };

const BAYER = [
  [0 / 16, 8 / 16, 2 / 16, 10 / 16],
  [12 / 16, 4 / 16, 14 / 16, 6 / 16],
  [3 / 16, 11 / 16, 1 / 16, 9 / 16],
  [15 / 16, 7 / 16, 13 / 16, 5 / 16],
];

const AMBIENT = [
  [0.0, 0.2, 0.22, 0.42], [0.4, 0.32, 0.3, 0.54], [0.6, 0.76, 0.56, 0.66],
  [0.8, 1.0, 0.84, 0.7], [1.0, 1.0, 0.98, 0.94],
];
const SKY_TOP = [
  [0.0, 8, 10, 36], [0.35, 22, 20, 66], [0.55, 62, 52, 132], [0.75, 104, 124, 206], [1.0, 112, 176, 242],
];
const SKY_HOR = [
  [0.0, 26, 28, 78], [0.35, 84, 52, 124], [0.55, 244, 128, 108], [0.75, 255, 196, 124], [1.0, 214, 234, 250],
];
const CLOUD = [
  [0.0, 30, 32, 74], [0.4, 78, 60, 122], [0.6, 255, 150, 140], [0.8, 255, 216, 176], [1.0, 255, 255, 255],
];
const BUILD_NEAR = [
  [0.0, 14, 16, 44], [0.45, 44, 36, 84], [0.65, 112, 72, 104], [0.82, 140, 112, 132], [1.0, 124, 146, 184],
];
const SUN = [[0.0, 255, 110, 84], [0.6, 255, 128, 92], [0.8, 255, 204, 124], [1.0, 255, 250, 226]];

const DIGITS = [
  '111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001',
  '111100111001111', '111100111101111', '111001001001001', '111101111101111', '111101111001111',
];

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const hash = (x, y) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

function ramp(stops, t, out, o) {
  let i = 1;
  while (i < stops.length - 1 && t > stops[i][0]) i++;
  const a = stops[i - 1], b = stops[i];
  const u = clamp((t - a[0]) / (b[0] - a[0]), 0, 1);
  out[o] = a[1] + (b[1] - a[1]) * u;
  out[o + 1] = a[2] + (b[2] - a[2]) * u;
  out[o + 2] = a[3] + (b[3] - a[3]) * u;
}

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createScene() {
  const n = W * H;
  const alb0 = new Uint8Array(n * 3), kind0 = new Uint8Array(n), over = new Uint8Array(n);
  const alb = new Uint8Array(n * 3), kind = new Uint8Array(n);
  const lampI = new Float32Array(n), shaft = new Float32Array(n), shaftWin = new Uint8Array(n);
  const data = new Uint8ClampedArray(n * 4);

  const LT = new Float32Array(W);
  const amb = new Float32Array(W * 3), skyT = new Float32Array(W * 3), skyH = new Float32Array(W * 3);
  const cloudC = new Float32Array(W * 3), bldC = new Float32Array(W * 3);
  const bNear = new Uint8Array(W), bFar = new Uint8Array(W), bStart = new Int16Array(W);
  const tmp = new Float32Array(3);

  let A = alb0, K = kind0, front = false;   // front: 커튼보다 앞에 놓이는 물건을 그리는 중

  const px = (x, y, c, k = 0) => {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = y * W + x;
    A[i * 3] = c[0]; A[i * 3 + 1] = c[1]; A[i * 3 + 2] = c[2];
    K[i] = k;
    if (front) over[i] = 0;
  };
  const rect = (x, y, w, h, c, k = 0) => {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, c, k);
  };
  const sprite = (x, y, rows, pal, k = 0, flip = false) => {
    for (let j = 0; j < rows.length; j++) {
      const row = rows[j];
      for (let i = 0; i < row.length; i++) {
        const c = pal[row[i]];
        if (c) px(x + (flip ? row.length - 1 - i : i), y + j, c, k);
      }
    }
  };
  const line = (x0, y0, x1, y1, c) => {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let s = 0; s <= steps; s++) px(Math.round(x0 + ((x1 - x0) * s) / steps), Math.round(y0 + ((y1 - y0) * s) / steps), c);
  };
  const ellipse = (cx, cy, rx, ry, c) => {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / rx, dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) px(x, y, c);
      }
  };
  const shade = (c, f) => [clamp(c[0] * f, 0, 255), clamp(c[1] * f, 0, 255), clamp(c[2] * f, 0, 255)];

  // ---------- 정적 장면 ----------
  const WOOD = [128, 86, 68], WOOD_D = [94, 62, 54], WOOD_L = [160, 112, 84];
  const FRAME = [236, 232, 242];

  function leaf(cx, cy, rx, ry) {
    ellipse(cx, cy, rx, ry, [70, 156, 88]);
    for (let x = Math.ceil(cx - rx); x <= Math.floor(cx + rx); x++) {
      const yb = Math.round(cy + ry * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2)));
      px(x, yb, [46, 116, 74]);
    }
    px(cx - rx * 0.4, cy - ry * 0.5, [146, 212, 122]);
    px(cx - rx * 0.4 + 1, cy - ry * 0.5, [120, 196, 110]);
  }

  function windowAt(win, bars, skyKind) {
    const { x0, y0, x1, y1 } = win;
    rect(x0 - 2, y0 - 2, x1 - x0 + 5, y1 - y0 + 5, FRAME);
    rect(x0, y0, x1 - x0 + 1, y1 - y0 + 1, [0, 0, 0], skyKind);
    const paneW = (x1 - x0 + 1) / (bars + 1);
    for (let b = 1; b <= bars; b++) {
      const bx = Math.round(x0 + paneW * b) - 1;
      rect(bx, y0, 2, y1 - y0 + 1, FRAME);
      rect(bx + 1, y0, 1, y1 - y0 + 1, shade(FRAME, 0.84));
    }
    rect(x0, y0, x1 - x0 + 1, 1, shade(FRAME, 0.72));                 // 창틀 안쪽 그늘
    rect(x0 - 4, y1 + 3, x1 - x0 + 9, 2, [246, 243, 250]);            // 창턱
    rect(x0 - 3, y1 + 5, x1 - x0 + 7, 1, [150, 134, 168]);
  }

  function buildings(win, seed) {
    const r = rng(seed);
    let x = win.x0;
    while (x <= win.x1) {
      const w = 5 + Math.floor(r() * 7), h = 4 + Math.floor(r() * 8);
      for (let i = 0; i < w && x + i <= win.x1; i++) { bNear[x + i] = h; bStart[x + i] = x; }
      if (r() < 0.3 && x + 2 <= win.x1) bNear[x + 2] = h + 3;          // 안테나
      x += w + (r() < 0.25 ? 1 + Math.floor(r() * 3) : 0);
    }
    x = win.x0;
    while (x <= win.x1) {
      const w = 8 + Math.floor(r() * 10), h = 8 + Math.floor(r() * 7);
      for (let i = 0; i < w && x + i <= win.x1; i++) bFar[x + i] = h;
      x += w;
    }
  }

  function build() {
    const r = rng(62);

    // 벽, 몰딩, 바닥
    rect(0, 0, W, FLOOR, [192, 180, 206]);
    for (let x = 5; x < W; x += 12) rect(x, 3, 1, 42, [180, 168, 196]);
    rect(0, 0, W, 2, [146, 132, 166]);
    rect(0, 2, W, 1, [168, 154, 186]);
    rect(0, 45, W, 1, [216, 206, 226]);
    rect(0, 46, W, 3, [134, 114, 144]);
    rect(0, FLOOR, W, H - FLOOR, [178, 126, 90]);
    rect(0, FLOOR, W, 1, [150, 102, 76]);
    for (let j = 0; j < 3; j++) {
      const y = FLOOR + 4 + j * 5;
      rect(0, y, W, 1, [154, 106, 78]);
      for (let x = (j * 17) % 30; x < W; x += 30) rect(x, y - 4, 1, 4, [160, 110, 80]);
    }

    // 창문
    windowAt(WIN_L, 2, K_SKY_L);
    windowAt(WIN_R, 1, K_SKY_R);
    buildings(WIN_L, 7);
    buildings(WIN_R, 21);

    // 천장 꼬마전구 줄
    const bulbs = [[255, 214, 120], [255, 150, 170], [150, 220, 255], [200, 255, 170]];
    let bi = 0;
    for (let x = 58; x <= 258; x++) {
      const u = ((x - 58) % 50) / 50;
      const y = 3 + Math.round(Math.sin(u * Math.PI) * 2.4);
      px(x, y, [88, 76, 100]);
      if ((x - 58) % 10 === 5) { px(x, y + 1, bulbs[bi % 4], K_BULB); px(x, y + 2, bulbs[bi % 4], K_BULB); bi++; }
    }

    // 책장
    rect(14, 8, 42, 41, WOOD_D);
    rect(14, 8, 42, 2, WOOD); rect(14, 8, 42, 1, WOOD_L);
    rect(14, 8, 2, 41, WOOD); rect(54, 8, 2, 41, WOOD);
    for (const y of [20, 32, 44]) { rect(14, y, 42, 2, WOOD); rect(16, y, 38, 1, WOOD_L); }
    rect(14, 47, 42, 2, WOOD);
    const spines = [[204, 84, 84], [84, 140, 204], [232, 184, 76], [110, 172, 116], [164, 114, 196], [234, 232, 224], [70, 78, 122], [232, 132, 96]];
    for (const yb of [19, 31, 43]) {
      let x = 17;
      while (x < 52) {
        if (r() < 0.1) { x += 2; continue; }
        const w = 2 + (r() < 0.35 ? 1 : 0), h = 6 + Math.floor(r() * 4);
        const c = spines[Math.floor(r() * spines.length)];
        rect(x, yb - h + 1, w, h, c);
        rect(x, yb - h + 1, 1, h, shade(c, 0.78));
        rect(x, yb - h + 3, w, 1, shade(c, 1.25));
        x += w;
      }
    }
    rect(20, 4, 7, 4, [92, 112, 164]); rect(21, 5, 5, 1, [140, 160, 210]);     // 상자
    rect(30, 6, 11, 2, [204, 84, 84]); rect(31, 4, 9, 2, [232, 184, 76]);       // 눕힌 책

    // 책장 위 화분과 늘어진 덩굴
    rect(45, 3, 9, 5, [198, 114, 86]); rect(44, 3, 11, 1, [220, 136, 102]);
    for (let v = 0; v < 3; v++) {
      const x0 = 50 + v * 4, len = 24 - v * 5, ph = v * 2.1;
      for (let j = 0; j < len; j++) {
        const x = Math.round(x0 + Math.sin(j * 0.45 + ph) * 1.6), y = 5 + j;
        px(x, y, [50, 112, 72]);
        if (j % 3 === 1) { const s = (j / 3) % 2 < 1 ? -1 : 1; px(x + s, y, [84, 168, 96]); px(x + s * 2, y, [124, 204, 116]); px(x + s, y + 1, [60, 136, 82]); }
      }
    }
    leaf(47, 2, 3, 1.6); leaf(52, 1, 3, 1.6);

    // 침대
    rect(70, 30, 5, 22, WOOD); rect(70, 30, 1, 22, WOOD_L); rect(69, 29, 7, 2, WOOD_L);
    rect(75, 41, 123, 7, [234, 228, 240]);
    rect(73, 47, 127, 3, WOOD); rect(73, 47, 127, 1, WOOD_L);
    rect(75, 50, 3, 3, WOOD_D); rect(195, 50, 3, 3, WOOD_D);
    rect(198, 36, 4, 16, WOOD); rect(198, 36, 1, 16, WOOD_L); rect(197, 35, 6, 2, WOOD_L);
    const BLANKET = [152, 134, 208];
    rect(104, 39, 94, 9, BLANKET);
    rect(104, 39, 94, 1, [186, 172, 232]);
    rect(104, 40, 3, 8, [206, 196, 240]);                                       // 접힌 끝
    for (let x = 110; x < 196; x += 7) for (let y = 42; y < 48; y += 3) px(x + ((y / 3) % 2) * 3, y, [126, 108, 186]);
    rect(104, 47, 94, 1, [124, 106, 180]);
    rect(78, 35, 23, 6, [226, 230, 252]);
    rect(79, 35, 21, 1, [250, 250, 255]);
    rect(78, 40, 23, 1, [168, 166, 206]);
    px(78, 35, [192, 180, 206]); px(100, 35, [192, 180, 206]);
    rect(84, 37, 10, 1, [204, 208, 238]);

    // 러그와 슬리퍼
    ellipse(152, 57, 36, 3.6, [96, 126, 156]);
    ellipse(152, 57, 33, 2.7, [124, 156, 180]);
    for (let x = 124; x <= 180; x += 8) px(x, 57, [226, 214, 190]);
    rect(92, 52, 5, 2, [238, 150, 164]); rect(99, 53, 5, 2, [238, 150, 164]);

    // 스탠드
    rect(207, 51, 12, 2, [72, 68, 88]); rect(208, 51, 10, 1, [102, 98, 120]);
    rect(212, 24, 1, 27, [100, 96, 116]); rect(213, 24, 1, 27, [64, 60, 80]);
    for (let j = 0; j < 8; j++) {
      const hw = 5 + Math.round((j * 4) / 7);
      rect(212 - hw, 16 + j, hw * 2 + 2, 1, j === 7 ? [226, 196, 140] : [250, 226, 170], K_SHADE);
    }

    // 협탁, 시계, 머그잔
    rect(222, 40, 27, 12, WOOD); rect(221, 38, 29, 2, WOOD_L); rect(221, 40, 29, 1, WOOD_D);
    rect(224, 42, 23, 1, WOOD_D); rect(224, 46, 23, 1, WOOD_D);
    px(235, 44, [236, 204, 124]); px(236, 44, [236, 204, 124]); px(235, 48, [236, 204, 124]); px(236, 48, [236, 204, 124]);
    rect(223, 52, 2, 1, WOOD_D); rect(246, 52, 2, 1, WOOD_D);
    rect(224, 30, 21, 8, [44, 42, 58]); rect(224, 30, 21, 1, [78, 74, 98]);
    rect(225, 31, 19, 6, [22, 20, 30]);

    // 벽 액자
    rect(224, 9, 22, 16, FRAME); rect(224, 24, 22, 1, shade(FRAME, 0.8));
    rect(226, 11, 18, 12, [84, 104, 170]);
    rect(226, 19, 18, 4, [70, 132, 122]);
    for (let j = 0; j < 5; j++) rect(231 - j, 14 + j, 1 + j * 2, 1, [226, 232, 244]);
    for (let j = 0; j < 4; j++) rect(239 - j, 16 + j, 1 + j * 2, 1, [190, 200, 226]);
    rect(240, 12, 2, 2, [255, 214, 130]);

    // 커튼 봉과 커튼(over 버퍼)
    rect(254, 2, 94, 1, [84, 74, 96]);
    px(253, 2, [236, 204, 124]); px(348, 2, [236, 204, 124]);
    for (let y = 3; y <= 46; y++) {
      for (let x = 256; x <= 265; x++) over[y * W + x] = 2;                     // 묶어 둔 왼쪽 커튼
      const flare = y > 38 ? Math.round((y - 38) * 0.4) : 0;
      for (let x = 318 - flare; x <= 346; x++) over[y * W + x] = 1;             // 비치는 오른쪽 커튼
    }

    // 책상과 화분 (커튼 앞)
    front = true;
    rect(330, 43, 48, 2, WOOD_L); rect(330, 45, 48, 1, WOOD_D);
    rect(333, 46, 2, 7, WOOD); rect(372, 46, 2, 7, WOOD);
    rect(346, 36, 11, 7, [198, 114, 86]); rect(345, 35, 13, 2, [222, 138, 104]); rect(346, 41, 11, 1, [170, 92, 72]);
    const stems = [[-11, 12, 4.2], [-5, 18, 4.4], [2, 21, 4.6], [9, 15, 4.2], [14, 9, 3.6], [-14, 5, 3.4]];
    for (const [dx, dy] of stems) line(351, 35, 351 + dx, 35 - dy, [54, 116, 74]);
    for (const [dx, dy, rr] of stems) leaf(351 + dx, 35 - dy, rr, rr * 0.62);
    rect(361, 40, 9, 3, [84, 140, 204]); rect(362, 38, 8, 2, [234, 232, 224]);
    front = false;

    // 조명 맵: 스탠드 빛 웅덩이(디더로 단계 구분), 아침 햇살이 바닥에 떨어지는 띠
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, dx = x - (LAMP_X + 0.5), dy = y - 25;
      let v = 1 / (1 + (dx * dx + dy * dy * 1.7) / (24 * 24));
      if (dy < -2) v *= 0.55;
      v = Math.max(0, v - 0.05) / 0.95;
      lampI[i] = Math.floor(v * 6 + BAYER[y & 3][x & 3]) / 6;
      if (y >= FLOOR) {
        const xs = x + (y - 37) * 1.5;                       // 햇살이 창에서 왼쪽 아래로 비스듬히 떨어진다
        const right = (xs > 266 && xs < 298) || (xs > 304 && xs < 334);
        const left = (xs > 72 && xs < 93) || (xs > 98 && xs < 118) || (xs > 123 && xs < 143);
        if (right || left) { shaft[i] = (x + y) % 2 === 0 || y < FLOOR + 9 ? 1 : 0.6; shaftWin[i] = right ? 2 : 1; }
      }
    }
  }
  build();

  // ---------- 매 프레임 ----------
  const state = { lamp: true, clock: '', pets: '', day: 0 };
  let lampLevel = 1, lastTime = -1;
  const rnd = rng(2062);

  function drawClock(lt, time) {
    const minutes = Math.round(150 + lt * 330);           // 밤 02:30 ↔ 아침 08:00. 구슬이 지나가면 숫자가 빠르게 돈다
    const hh = Math.floor(minutes / 60), mm = minutes % 60;
    const text = String(hh).padStart(2, '0') + String(mm).padStart(2, '0');
    state.clock = `${text.slice(0, 2)}:${text.slice(2)}`;
    const col = [255, 178, 84];
    const xs = [226, 230, 236, 240];
    for (let d = 0; d < 4; d++) {
      const g = DIGITS[+text[d]];
      for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (g[j * 3 + i] === '1') px(xs[d] + i, 32 + j, col, K_EMIT);
    }
    if (time % 1 < 0.5) { px(234, 33, col, K_EMIT); px(234, 35, col, K_EMIT); }
  }

  // 고양이와 강아지. 볼륨 값과 무관하게 스스로 움직이고, 서 있는 자리가 밤이 되면 그 자리에서 잔다
  const pets = createPets({ px, ltAt: (x) => LT[clamp(Math.round(x), 0, W - 1)], rnd, K_PET, K_EMIT });

  const sky = [null, { win: WIN_L }, { win: WIN_R }];

  /**
   * knobX: 구슬 중심의 장면 x좌표(px), knobR: 구슬 반지름(px).
   * 구슬 왼쪽은 밤, 오른쪽은 낮이고 구슬 안에서 시간이 빠르게 넘어간다.
   */
  function render(knobX, knobR, time) {
    const dt = lastTime < 0 ? 0 : clamp(time - lastTime, 0, 0.25);
    lastTime = time;

    alb.set(alb0); kind.set(kind0);
    A = alb; K = kind;

    const half = knobR * 0.82;
    let daySum = 0;
    for (let x = 0; x < W; x++) {
      let lt = smooth(knobX - half, knobX + half, x);
      if (!DAY_ON_RIGHT) lt = 1 - lt;
      LT[x] = lt; daySum += lt;
      ramp(AMBIENT, lt, amb, x * 3);
      ramp(SKY_TOP, lt, skyT, x * 3);
      ramp(SKY_HOR, lt, skyH, x * 3);
      ramp(CLOUD, lt, cloudC, x * 3);
      ramp(BUILD_NEAR, lt, bldC, x * 3);
    }
    state.day = daySum / W;

    drawClock(LT[234], time);
    const dayLo = DAY_ON_RIGHT ? knobX + half : 0, dayHi = DAY_ON_RIGHT ? W : knobX - half;
    pets.update(dt, { lo: dayLo, hi: dayHi });
    pets.draw(time);
    state.pets = pets.label();

    state.lamp = LT[LAMP_X] < 0.5;
    lampLevel += ((state.lamp ? 1 : 0) - lampLevel) * Math.min(1, dt * 14);

    for (let w = 1; w <= 2; w++) {
      const s = sky[w], win = s.win, lw = LT[(win.x0 + win.x1) >> 1];
      s.moonX = win.x1 - 17; s.moonY = win.y0 + 5 + lw * 10;
      s.sunX = win.x0 + 20; s.sunY = win.y1 + 8 - smooth(0.4, 1.0, lw) * 26;
      ramp(SUN, lw, tmp, 0);
      s.sunR = tmp[0]; s.sunG = tmp[1]; s.sunB = tmp[2];
      s.glow = smooth(0.4, 0.62, lw) * (1 - smooth(0.9, 1.0, lw) * 0.45);
      s.beam = smooth(0.66, 0.95, lw);
    }
    const drift = time * 0.9;

    for (let y = 0; y < H; y++) {
      const by = BAYER[y & 3];
      for (let x = 0; x < W; x++) {
        const i = y * W + x, i3 = i * 3, x3 = x * 3, k = kind[i];
        const lt = LT[x];
        let r, g, b;

        if (k === K_SKY_L || k === K_SKY_R) {
          const s = sky[k], win = s.win;
          const v = (y - win.y0) / (win.y1 - win.y0);
          let vq = clamp(Math.floor(v * 9 + by[x & 3]) / 9, 0, 1);
          vq *= vq;
          r = skyT[x3] + (skyH[x3] - skyT[x3]) * vq;
          g = skyT[x3 + 1] + (skyH[x3 + 1] - skyT[x3 + 1]) * vq;
          b = skyT[x3 + 2] + (skyH[x3 + 2] - skyT[x3 + 2]) * vq;

          const starA = 1 - smooth(0.25, 0.6, lt);
          if (starA > 0) {
            const h = hash(x, y);
            if (h < 0.04) {
              const tw = 0.55 + 0.45 * Math.sin(time * (1.2 + h * 50) + h * 900);
              const st = (h < 0.01 ? 235 : 130) * starA * tw;
              r += st; g += st; b += st;
            }
          }

          // 달은 그 열이 밤일 때, 해는 낮일 때만 보인다
          const moonA = 1 - smooth(0.4, 0.75, lt);
          if (moonA > 0) {
            const d1 = Math.hypot(x - s.moonX, y - s.moonY), d2 = Math.hypot(x - s.moonX - 2.2, y - s.moonY + 1.2);
            if (d1 < 4.3 && d2 > 3.7) { r += (244 - r) * moonA; g += (240 - g) * moonA; b += (214 - b) * moonA; }
            else if (d1 < 9) { const gl = (1 - d1 / 9) * 26 * moonA * (by[x & 3] > 0.4 ? 1 : 0.5); r += gl; g += gl; b += gl * 1.3; }
          }
          const sunA = smooth(0.45, 0.75, lt);
          if (sunA > 0) {
            const d = Math.hypot(x - s.sunX, y - s.sunY);
            if (d < 5.2) { r += (s.sunR - r) * sunA; g += (s.sunG - g) * sunA; b += (s.sunB - b) * sunA; }
            else {
              const gl = (Math.floor((s.glow / (1 + (d / 9) ** 2)) * 5 + by[x & 3]) / 5) * sunA;
              r += s.sunR * gl * 0.55; g += s.sunG * gl * 0.42; b += s.sunB * gl * 0.3;
            }
          }

          // 구름: 창마다 두세 개가 천천히 흘러간다
          const ww = win.x1 - win.x0 + 30;
          for (let c = 0; c < 3; c++) {
            const len = 16 + c * 5, cy = win.y0 + 5 + c * 6 + (k === K_SKY_R ? 2 : 0);
            const cx = win.x0 - 24 + ((c * 41 + drift * (0.6 + c * 0.25) + (k === K_SKY_R ? 17 : 0)) % ww);
            const ry = y - cy;
            if (ry < 0 || ry > 2) continue;
            const a0 = ry === 0 ? cx + 4 : ry === 1 ? cx : cx + 3;
            const a1 = ry === 0 ? cx + len - 5 : ry === 1 ? cx + len : cx + len - 7;
            if (x >= a0 && x <= a1) {
              const ca = 0.35 + 0.6 * smooth(0.3, 0.7, lt);
              const sh = ry === 2 ? 0.86 : 1;
              r += (cloudC[x3] * sh - r) * ca; g += (cloudC[x3 + 1] * sh - g) * ca; b += (cloudC[x3 + 2] * sh - b) * ca;
            }
          }

          // 건물: 먼 줄은 하늘빛에 섞이고, 가까운 줄은 밤에 창불이 켜진다
          const yb = win.y1 - y;
          if (yb < bNear[x]) {
            r = bldC[x3]; g = bldC[x3 + 1]; b = bldC[x3 + 2];
            const lx = x - bStart[x], ly = bNear[x] - yb;
            if (lx % 3 === 1 && ly % 3 === 2) {
              const h = hash(x * 3.1, yb * 7.3);
              if (h > 0.42 && h > lt * 1.5 + 0.1) { r = 255; g = 214; b = 132; }
            }
          } else if (yb < bFar[x]) {
            r = r * 0.45 + bldC[x3] * 0.55 + 10; g = g * 0.45 + bldC[x3 + 1] * 0.55 + 10; b = b * 0.45 + bldC[x3 + 2] * 0.55 + 16;
          }

          const gx = x - win.x0 + (y - win.y0);                 // 유리에 비친 사선 반사
          if (gx === 9 || gx === 10 || gx === 14) { r += 12; g += 12; b += 16; }
        } else {
          const ar = alb[i3], ag = alb[i3 + 1], ab = alb[i3 + 2];
          if (k === K_EMIT) {
            r = ar; g = ag; b = ab;
          } else {
            const L = lampI[i] * lampLevel * (1 - 0.8 * lt);     // 스탠드 빛은 낮인 쪽으로는 거의 넘어가지 않는다
            let lr = amb[x3] + 1.05 * L, lg = amb[x3 + 1] + 0.76 * L, lb = amb[x3 + 2] + 0.42 * L;
            const sw = shaftWin[i];
            if (sw) {
              const sb = shaft[i] * sky[sw].beam * smooth(0.55, 0.9, lt);
              lr += 0.5 * sb; lg += 0.36 * sb; lb += 0.16 * sb;
            }
            r = ar * lr; g = ag * lg; b = ab * lb;
            if (k === K_SHADE) {
              r += (255 - r) * lampLevel; g += (236 - g) * lampLevel; b += (176 - b) * lampLevel;
            } else if (k === K_BULB) {
              const night = 1 - smooth(0.4, 0.62, lt);
              const tw = 0.75 + 0.25 * Math.sin(time * 2.3 + x * 1.7);
              r += (ar - r) * night * tw + 40 * night; g += (ag - g) * night * tw + 30 * night; b += (ab - b) * night * tw + 20 * night;
            }
          }
        }

        const ov = over[i];
        if (ov && k !== K_PET) {
          const sway = Math.sin(time * 0.7 + y * 0.09) * 0.7;
          const fold = 0.8 + 0.2 * Math.sin(x * 1.15 + sway);
          const cr = 250 * fold * (amb[x3] * 0.42 + (skyH[x3] / 255) * 0.66);
          const cg = 246 * fold * (amb[x3 + 1] * 0.42 + (skyH[x3 + 1] / 255) * 0.66);
          const cb = 252 * fold * (amb[x3 + 2] * 0.42 + (skyH[x3 + 2] / 255) * 0.66);
          const a = ov === 1 ? 0.6 : 0.93;
          r += (cr - r) * a; g += (cg - g) * a; b += (cb - b) * a;
          if (ov === 2 && (y === 30 || y === 31)) { r = 214 * amb[x3] + 20; g = 150 * amb[x3 + 1] + 10; b = 168 * amb[x3 + 2] + 10; }
        }

        const o = i * 4;
        data[o] = r; data[o + 1] = g; data[o + 2] = b; data[o + 3] = 255;
      }
    }
    return data;
  }

  return { width: W, height: H, data, render, state, pets };
}
