// switch.js: 슬라이더 컨트롤러. 입력(포인터, 휠, 키보드)을 받아 스프링으로 손잡이를 움직이고
// 픽셀 장면과 유리 셰이더를 매 프레임 그린다. 웹 페이지와 데스크톱 OSD가 같이 쓴다.

import { createScene, W, H } from './scene.js';
import { createGlass } from './glass.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// 캡슐 비율: 안쪽 창이 정확히 6:1(384×64 픽셀 버퍼)이 되도록 맞춘다
const INNER = 0.73;              // 안쪽 반지름 / 바깥 반지름
const SPINE = 5 * INNER;         // 중심선 반길이 / 바깥 반지름
const OUTER_W = 2 * SPINE + 2;   // 바깥 전체 폭 / 바깥 반지름

const PAGE = [[0, 12, 13, 23], [0.45, 22, 20, 36], [0.7, 36, 26, 42], [1, 44, 38, 52]];
const ACCENT = [[0, 150, 162, 255], [0.45, 196, 150, 240], [0.65, 255, 158, 150], [0.85, 255, 206, 140], [1, 255, 232, 176]];

function ramp(stops, t) {
  let i = 1;
  while (i < stops.length - 1 && t > stops[i][0]) i++;
  const a = stops[i - 1], b = stops[i];
  const u = clamp((t - a[0]) / (b[0] - a[0]), 0, 1);
  return [1, 2, 3].map((k) => Math.round(a[k] + (b[k] - a[k]) * u));
}

export function createSwitch(canvas, opts = {}) {
  const scene = createScene();
  const glass = createGlass(canvas, W, H);
  if (!glass) return null;

  const fill = opts.fill ?? 0.9;            // 캔버스 폭 중 캡슐이 차지하는 비율
  const vroom = opts.vroom ?? 1.9;          // 캡슐 높이 대비 캔버스 높이
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const geo = { width: 1, height: 1, dpr: 1, a: 1, R: 1, r: 1, knobR: 1 };
  const s = {
    value: clamp(Math.round(opts.value ?? 0), 0, 100),
    target: 0, pos: 0, vel: 0,
    press: 0, pressTarget: 0, focus: 0, focusTarget: 0,
    dragging: false, grab: 0,
  };
  s.target = s.pos = s.value / 100;

  function layout() {
    const rect = canvas.getBoundingClientRect();
    geo.width = Math.max(1, rect.width);
    geo.height = Math.max(1, rect.height);
    geo.dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.round(geo.width * geo.dpr);
    canvas.height = Math.round(geo.height * geo.dpr);
    geo.R = Math.min((geo.width * fill) / OUTER_W, geo.height / (2 * vroom));
    geo.r = geo.R * INNER;
    geo.a = geo.R * SPINE;
    geo.knobR = geo.R * 0.95;
    dirty = true;
  }

  const knobX = (pos) => -geo.a + 2 * geo.a * pos;
  const local = (e) => {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left - rect.width / 2, y: rect.height / 2 - (e.clientY - rect.top) };
  };
  const sdSpine = (x, y) => Math.hypot(x - clamp(x, -geo.a, geo.a), y);

  function setTarget(v01, { tick = true } = {}) {
    s.target = clamp(v01, 0, 1);
    const next = Math.round(s.target * 100);
    if (next === s.value) return;
    const prev = s.value;
    s.value = next;
    canvas.setAttribute('aria-valuenow', String(next));
    canvas.setAttribute('aria-valuetext', `${next}%`);
    opts.onInput?.(next);
    if (tick && (Math.floor(next / 2) !== Math.floor(prev / 2) || next === 0 || next === 100)) opts.onTick?.(next);
  }

  // ---------- 입력 ----------
  // 구슬이 가장 먼저 잡히고, 그다음이 동물, 마지막이 트랙이다
  const pets = scene.pets;
  const toScene = (x, y) => ({
    sx: ((x + geo.a + geo.r) / (2 * (geo.a + geo.r))) * W,
    sy: (0.5 - y / (2 * geo.r)) * H,
    inside: sdSpine(x, y) < geo.r,
  });
  let hold = null;        // 동물을 누르고 있는 중: { pet, x0, y0, sx, sy, grabbed }
  let hover = null;       // 마우스가 올라가 있는 동물과 직전 위치

  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const { x, y } = local(e);
    const kx = knobX(s.pos);
    const onKnob = Math.hypot(x - kx, y) < geo.knobR * 1.12;
    if (!onKnob) {
      const q = toScene(x, y);
      const pet = q.inside ? pets.hit(q.sx, q.sy) : null;
      if (pet) {
        canvas.setPointerCapture(e.pointerId);
        hold = { pet, x0: x, y0: y, sx: q.sx, sy: q.sy, grabbed: false };
        canvas.style.cursor = 'grabbing';
        opts.onGesture?.();
        e.preventDefault();
        return;
      }
    }
    if (!onKnob && sdSpine(x, y) > geo.R * 1.08) return;
    canvas.setPointerCapture(e.pointerId);
    s.dragging = true;
    s.pressTarget = 1;
    s.grab = onKnob ? x - kx : 0;
    canvas.style.cursor = 'grabbing';
    opts.onGesture?.();
    setTarget((x - s.grab + geo.a) / (2 * geo.a));
    canvas.focus({ preventScroll: true });
  });
  canvas.addEventListener('pointermove', (e) => {
    const { x, y } = local(e);
    if (hold) {
      // 조금이라도 끌면 들어 올린 것, 그대로 떼면 쓰다듬은 것
      const q = toScene(x, y);
      if (!hold.grabbed && Math.hypot(x - hold.x0, y - hold.y0) > 3) {
        hold.grabbed = true;
        pets.grab(hold.pet, hold.sx, hold.sy);
        opts.onPet?.('grab', hold.pet.kind);
      }
      if (hold.grabbed) pets.dragTo(hold.pet, q.sx, q.sy);
      return;
    }
    if (s.dragging) {
      setTarget((x - s.grab + geo.a) / (2 * geo.a));
      return;
    }
    const over = Math.hypot(x - knobX(s.pos), y) < geo.knobR * 1.12;
    const q = toScene(x, y);
    const pet = !over && q.inside ? pets.hit(q.sx, q.sy) : null;
    if (pet && e.pointerType === 'mouse') {
      // 누르지 않고 위에서 문지르면 쓰다듬기
      if (hover && hover.pet === pet && pets.stroke(pet, Math.hypot(q.sx - hover.sx, q.sy - hover.sy))) opts.onPet?.('pet', pet.kind);
      hover = { pet, sx: q.sx, sy: q.sy };
    } else hover = null;
    canvas.style.cursor = over || pet ? 'grab' : sdSpine(x, y) < geo.R ? 'pointer' : '';
  });
  canvas.addEventListener('pointerleave', () => { hover = null; });
  const release = () => {
    if (hold) {
      const h = hold;
      hold = null;
      canvas.style.cursor = '';
      if (h.grabbed) { pets.drop(h.pet); opts.onPet?.('drop', h.pet.kind); }
      else if (pets.poke(h.pet)) opts.onPet?.('pet', h.pet.kind);
      return;
    }
    if (!s.dragging) return;
    s.dragging = false;
    s.pressTarget = 0;
    s.target = s.value / 100;            // 놓으면 정수 눈금에 맞춘다
    canvas.style.cursor = '';
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('lostpointercapture', release);

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const dir = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : -e.deltaY) > 0 ? 1 : -1;
    opts.onGesture?.();
    setTarget((s.value + dir * 2) / 100);
  }, { passive: false });

  canvas.addEventListener('keydown', (e) => {
    const big = e.shiftKey ? 10 : 1;
    const steps = {
      ArrowRight: big, ArrowUp: big, ArrowLeft: -big, ArrowDown: -big,
      PageUp: 10, PageDown: -10, Home: -100, End: 100,
    };
    const step = steps[e.key];
    if (step === undefined) return;
    e.preventDefault();
    opts.onGesture?.();
    setTarget((s.value + step) / 100);
  });
  canvas.addEventListener('focus', () => { s.focusTarget = canvas.matches(':focus-visible') ? 1 : 0; });
  canvas.addEventListener('blur', () => { s.focusTarget = 0; });

  // ---------- 그리기 ----------
  let dbg = null;                 // 개발용: 움직이는 순간의 모양을 멈춘 화면으로 보기 위한 값
  let dirty = true, last = 0, lastT = -1, lastTq = -1, lastLamp = null, lastPage = '', raf = 0;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const time = now / 1000;
    const dt = Math.min(0.05, last ? time - last : 0.016);
    last = time;

    if (reduce) {
      s.pos = s.target; s.vel = 0;
    } else {
      const k = s.dragging ? 560 : 210, zeta = s.dragging ? 0.88 : 0.62;
      const c = 2 * Math.sqrt(k) * zeta, h = dt / 4;
      for (let i = 0; i < 4; i++) {
        s.vel += (k * (s.target - s.pos) - c * s.vel) * h;
        s.pos += s.vel * h;
      }
      s.pos = clamp(s.pos, -0.02, 1.02);
    }
    s.press += (s.pressTarget - s.press) * Math.min(1, dt * 20);
    s.focus += (s.focusTarget - s.focus) * Math.min(1, dt * 16);

    const t = clamp(s.pos, 0, 1);

    // 장면 속 구슬 위치: 여기를 경계로 왼쪽은 밤, 오른쪽은 낮
    const kxNow = knobX(s.pos);
    const sceneSpan = 2 * (geo.a + geo.r);
    const knobPx = ((kxNow + geo.a + geo.r) / sceneSpan) * W, knobRPx = (geo.knobR / sceneSpan) * W;
    const tq = Math.floor(time * 12) / 12;          // 장면 애니메이션은 초당 12장
    let pixels = null;
    if (dirty || Math.abs(t - lastT) > 1e-5 || tq !== lastTq) {
      pixels = scene.render(knobPx, knobRPx, tq);
      lastT = t; lastTq = tq; dirty = false;
      if (lastLamp !== null && lastLamp !== scene.state.lamp) opts.onLamp?.(scene.state.lamp);
      lastLamp = scene.state.lamp;
    }

    const day = scene.state.day;                                   // 화면에서 낮이 차지하는 비율
    const page = ramp(PAGE, day);
    const key = page.join(',');
    if (key !== lastPage) { lastPage = key; opts.onPage?.(page, ramp(ACCENT, day)); }
    opts.onFrame?.(day, scene.state);

    const st = dbg ? Math.abs(dbg.vel) * 0.2 : clamp(Math.abs(s.vel) * 0.085, 0, 0.2);
    glass.draw(pixels, {
      width: geo.width, height: geo.height, dpr: geo.dpr,
      a: geo.a, R: geo.R, r: geo.r,
      knobX: knobX(s.pos), knobY: 0, knobR: geo.knobR,
      stretchX: 1 + st, stretchY: 1 - st * 0.5,
      press: s.press, focus: s.focus, t, page,
      vel: dbg ? dbg.vel : reduce ? 0 : clamp(s.vel * 0.6, -1, 1),
    });
  }

  const ro = new ResizeObserver(layout);
  ro.observe(canvas);
  layout();
  raf = requestAnimationFrame(frame);

  return {
    get value() { return s.value; },
    scene,
    /** 값(0~100)을 바꾼다. 스프링이 따라가며 장면도 함께 변한다. */
    setValue(v, { tick = false, jump = false } = {}) {
      setTarget(clamp(v, 0, 100) / 100, { tick });
      if (jump) { s.pos = s.target; s.vel = 0; }
    },
    nudge(delta) { setTarget((s.value + delta) / 100); },
    /** 개발용. { vel: -1~1 } 을 주면 그 속도로 움직이는 순간의 모양을 고정해 그린다. null이면 해제. */
    debug(o) { dbg = o; },
    destroy() { cancelAnimationFrame(raf); ro.disconnect(); },
  };
}
