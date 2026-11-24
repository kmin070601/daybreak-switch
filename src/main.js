// main.js: 페이지 배선. 제목 픽셀 글꼴, 슬라이더, 소리, 저장.

import { createSwitch } from './switch.js';
import { createAudio } from './audio.js';
import { createScene, W, H } from './scene.js';
import { connectDesktop } from './desktop.js';

const STORE = 'daybreak-switch:vol';
const $ = (id) => document.getElementById(id);

// 제목 전용 픽셀 글꼴. 9행(위 7행 + 내려쓰는 2행)
const GLYPHS = {
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  a: ['.....', '.....', '.###.', '....#', '.####', '#...#', '.####'],
  y: ['.....', '.....', '#...#', '#...#', '#...#', '#...#', '.####', '....#', '.###.'],
  b: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '####.'],
  r: ['.....', '.....', '#.##.', '##..#', '#....', '#....', '#....'],
  e: ['.....', '.....', '.###.', '#...#', '#####', '#....', '.###.'],
  k: ['#....', '#....', '#..#.', '#.#..', '##...', '#.#..', '#..#.'],
  w: ['.....', '.....', '#...#', '#...#', '#.#.#', '#.#.#', '.#.#.'],
  i: ['.#.', '...', '##.', '.#.', '.#.', '.#.', '###'],
  t: ['.#...', '.#...', '####.', '.#...', '.#...', '.#..#', '..##.'],
  c: ['.....', '.....', '.###.', '#....', '#....', '#...#', '.###.'],
  h: ['#....', '#....', '#.##.', '##..#', '#...#', '#...#', '#...#'],
  ' ': ['...'],
};

function pixelTitle(el, text) {
  let x = 0, rects = '';
  for (const ch of text) {
    const g = GLYPHS[ch];
    if (!g) continue;
    for (let j = 0; j < g.length; j++)
      for (let i = 0; i < g[j].length; i++)
        if (g[j][i] === '#') rects += `<rect x="${x + i}" y="${j}" width="1.02" height="1.02"/>`;
    x += g[0].length + 1;
  }
  el.innerHTML = `<svg viewBox="0 0 ${x - 1} 9" aria-hidden="true" shape-rendering="crispEdges">${rects}</svg>`;
}

// 개발용: index.html#scene=0,0.5,1 로 열면 픽셀 버퍼만 크게 보여 준다
// #scene=0.6;z=6;x=110 처럼 쓰면 6배로 키워 x=110 열부터 보여 준다
function debugScene(arg) {
  const [list, ...rest] = arg.split(';');
  const o = Object.fromEntries(rest.map((kv) => kv.split('=')));
  const ts = list.split(',').map(Number).filter((v) => !Number.isNaN(v));
  const scene = createScene();
  const c = document.createElement('canvas');
  c.width = W; c.height = H * ts.length;
  c.style.cssText = o.z
    ? `display:block;width:${W * o.z}px;margin-left:${-(o.x || 0) * o.z}px;image-rendering:pixelated;background:#000`
    : 'display:block;width:100%;image-rendering:pixelated;background:#000';
  const g = c.getContext('2d');
  // 값은 볼륨(0~1). 실제 페이지와 같은 식으로 구슬 위치를 장면 좌표로 바꾼다
  ts.forEach((t, k) => g.putImageData(new ImageData(new Uint8ClampedArray(scene.render(32 + t * 320, 41.6, 1.3 + k)), W, H), 0, k * H));
  document.body.replaceChildren(c);
  document.body.style.cssText = 'margin:0;background:#000';
}

function boot() {
  if (location.hash.startsWith('#scene')) { debugScene(location.hash.slice(7) || '0,0.25,0.5,0.6,0.75,1'); return; }

  pixelTitle($('title'), 'Daybreak Switch');

  const canvas = $('switch');
  const vol = $('vol'), room = $('room'), hint = $('hint');
  const root = document.documentElement;
  const audio = createAudio();
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let stored = 60;
  try {
    const raw = localStorage.getItem(STORE);
    if (raw !== null && !Number.isNaN(+raw)) stored = Math.min(100, Math.max(0, Math.round(+raw)));
  } catch { /* 저장소를 못 쓰는 환경에서는 기본값으로 시작 */ }
  const asked = new URLSearchParams(location.search).get('v');       // ?v=35 로 시작 값을 정할 수 있다
  const fixed = asked !== null && asked !== '' && !Number.isNaN(+asked);
  if (fixed) stored = Math.min(100, Math.max(0, Math.round(+asked)));

  let lastRoom = '', meter = 0, shown = -1;
  const wave = document.querySelector('.lede svg');

  let desktop = null;            // 데스크톱 앱에서만 채워진다. PC 시스템 볼륨과의 연결
  const sw = createSwitch(canvas, {
    value: 0,
    onGesture() {
      audio.start();
      audio.setVolume(sw.value / 100);
    },
    onInput(v) {
      vol.textContent = String(v).padStart(2, '0');
      audio.setVolume(v / 100);
      desktop?.push(v);
      try { localStorage.setItem(STORE, String(v)); } catch { /* 무시 */ }
    },
    onTick(v) { audio.tick(v / 100); },
    onLamp() { audio.click(); },
    onPet(what, kind) {
      // 들면 높은 음, 내려놓으면 낮은 음. 고양이를 쓰다듬으면 골골, 강아지는 맑은 음 하나
      if (what === 'grab') audio.tick(0.85);
      else if (what === 'drop') audio.tick(0.2);
      else if (kind === 'cat') audio.purr();
      else audio.tick(0.65);
    },
    onPage(page, accent) {
      root.style.setProperty('--page', `rgb(${page.join(' ')})`);
      root.style.setProperty('--accent', accent.join(' '));
    },
    onFrame(day, state) {
      audio.setScene(day);
      const text = `${state.clock} · ${state.pets}`;
      if (text !== lastRoom) { lastRoom = text; room.textContent = text; }
      const lv = Math.min(1, audio.level() * 9);
      meter += (lv - meter) * 0.25;
      if (Math.abs(meter - shown) > 0.01) { shown = meter; wave.style.setProperty('--lv', meter.toFixed(3)); }
    },
  });

  if (!sw) {
    document.body.classList.add('no-gl');
    return;
  }

  // 데스크톱 앱: 슬라이더가 곧 PC 볼륨이다. 창을 닫으면(트레이로 숨으면) 배경 소리를 멈춘다
  desktop = connectDesktop(sw, { onShown: () => audio.resume(), onHidden: () => audio.suspend() });
  if (desktop) {
    document.body.classList.add('is-desktop');
    $('foot-note').textContent = '이 슬라이더는 PC 볼륨과 연결되어 있습니다. 창을 닫아도 트레이에 남아 키보드 볼륨 키를 받고, 배경 소리는 이 창이 열려 있을 때만 납니다.';
    $('down').addEventListener('click', () => { audio.start(); sw.nudge(-10); });
    $('up').addEventListener('click', () => { audio.start(); sw.nudge(10); });
    window.daybreak = { switch: sw, audio };
    return;
  }

  // 첫 화면: 밤에서 저장된 볼륨까지 손잡이가 스스로 밀려온다 (?v= 로 값을 정했으면 바로 그 상태로)
  if (reduce || fixed) sw.setValue(stored, { jump: true });
  else window.setTimeout(() => sw.setValue(stored), 450);

  $('down').addEventListener('click', () => { audio.start(); sw.nudge(-10); });
  $('up').addEventListener('click', () => { audio.start(); sw.nudge(10); });

  window.daybreak = { switch: sw, audio };       // 데스크톱 앱과 디버깅에서 쓰는 손잡이

  document.addEventListener('visibilitychange', () => (document.hidden ? audio.suspend() : audio.resume()));
}

boot();
