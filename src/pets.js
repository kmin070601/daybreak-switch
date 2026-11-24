// pets.js: 고양이와 강아지. 둘 다 볼륨 값과 무관하게 스스로 움직인다.
// 규칙은 하나뿐이다. 서 있는 자리가 밤이 되면 그 자리에서 자고, 다시 낮이 되면 그 자리에서 깬다.
// 몸통·머리·다리·꼬리를 따로 그려서 조합하므로 같은 자세에서도 고개, 귀, 꼬리가 따로 움직인다.

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

const CAT = { W: [246, 242, 236], w: [218, 210, 212], O: [236, 150, 72], K: [78, 60, 64], p: [240, 150, 160], e: [46, 38, 48] };
const CAT_SHUT = { ...CAT, e: [150, 128, 136] };
const DOG = { T: [218, 152, 88], t: [176, 112, 62], C: [250, 232, 206], N: [50, 40, 42], e: [50, 40, 42], L: [214, 70, 70], R: [240, 120, 132], Y: [250, 210, 90] };
const DOG_SHUT = { ...DOG, e: [140, 92, 54] };

// ----- 고양이 부품 (모두 오른쪽을 보는 기준) -----
const C_TORSO = [
  '..OOOO..........',
  'WWOOOOOWWW......',
  'WWWOOOWWWWWWW...',
  'WWWWWWWWWWWWWW..',
  'WWWKKWWWWWWWWW..',
  'wWWKKWWWWWWWw...',
];
const C_HEAD = ['.K..O.', '.KW.OO', 'WWWWWW', 'WeWWeW', 'WWWpWW'];
const C_FACE = ['.K....O.', '.KW..OO.', 'WWWWWWWW', 'WWeWWWeW', 'WWWWpWWW', '.WWWWWW.'];
const C_SITBODY = [
  '....OOWWWWW...',
  '...OOOOWWWWW..',
  '..WOOOOWWWWW..',
  '..WWWWWKKWWW..',
  '.WWWWWWKKKWW..',
  '.WWWWWWWKWWW..',
  '.WWWWWWWWWWW..',
  '.WWWWWWW.WWW..',
  '....WWWW..WW..',
];
const C_LIE = [
  '.....OOOO...........',
  '...WWOOOOOWW........',
  '.WWWWWOOOWWWWWWWWW..',
  'WWWWWWWWKKWWWWWWW...',
  'WWWWWWWKKKKWWWWWW...',
  'KWWWWWWWKKWWWWWWWWW.',
  'KKKKKKWWWWWWW..WWWW.',
];
const C_LOAF = [
  '............K..O..',
  '............KW.OO.',
  '...OOOOO...WWWWWW.',
  '.WWOOOOOWWWWeWWeW.',
  'WWWWOOOWWWWWWWpWW.',
  'WWWWWWWKKWWWWWWWW.',
  'KWWWWWKKKWWWWWWW..',
  'KKWWWWWWWWWWWWW...',
];
const C_SLEEP = [
  '......OOOO..........',
  '...WWOOOOOWWW..K.O..',
  '.WWWWWOOOWWWWWKWWO..',
  'WWWWWWWWKKWWWWWWWWW.',
  'WWWWWWWKKKKWWWeWWeW.',
  'KWWWWWWWKKWWWWWWpWW.',
  'KKKKKKWWWWWWWWWWWW..',
];
const C_BOW = [
  'K.....................',
  'KK...OOOO.............',
  '.K.WWOOOOOW...........',
  '.KWWWWOOOWWWW.........',
  '..WWWWWWWWWWWWW..K..O.',
  '..WWWKKWWWWWWWWW.KW.OO',
  '..WWWKKW..WWWWWWWWWWWW',
  '..WWW......WWWWWWeWWeW',
  '..WW..........WWWWWpWW',
  '.WWW........WWWWWWWWW.',
  '.WW.......WWWWWW......',
];

// ----- 강아지 부품 -----
const D_TORSO = [
  '..TTTTTTTTTT....',
  '.TTTTTTTTTTTTT..',
  'TTTTTTTTTTTTTT..',
  'TTTTTTTTTTTTTC..',
  'TTCCCCCCCTTCCC..',
  '.CCCCCCCCCCCC...',
];
const D_HEAD = ['.t...t..', 'tTt.tTt.', 'TTTTTTT.', 'TeTTTeTC', 'TTTCCCCN', '.TCCCCC.'];
const D_SITBODY = [
  '....TLLLL...',
  '...TTTCCC...',
  '..TTTTCCC...',
  '.TTTTTCCCC..',
  'TTTTTTCCCC..',
  'TTTTTTTCCT..',
  'TTTTTTTCCT..',
  'TTTTTT.TCT..',
  'TTCCCC.CCC..',
];
const D_LIE = [
  '..TTTTTTTT.....',
  '.TTTTTTTTTTT...',
  'TTTTTTTTTTTTTT.',
  'TTTTTTTTTTTTTCC',
  'tTTTTCCCCTTCCCC',
  'ttCCCC..CCCCCCC',
];
const D_BOW = [
  '..TTTTT..............',
  '.TTTTTTTT............',
  '.TTTTTTTTTT..........',
  '.TTTTTTTTTTTT........',
  '.TTCTTTTTTTTTT.......',
  '.TT.CCTTTTTTTTT......',
  '.TT...CCCTTTTTTT.....',
  '.TT......CCCTTTTT....',
  '.CC.........CCCCCCCC.',
];

const EMOTES = {
  heart: { rows: ['.#.#.', '#####', '.###.', '..#..'], color: [255, 120, 150] },
  '!': { rows: ['#', '#', '#', '.', '#'], color: [255, 220, 90] },
  '?': { rows: ['###', '..#', '.#.', '...', '.#.'], color: [226, 230, 255] },
  note: { rows: ['.##', '.#.', '##.', '##.'], color: [160, 220, 255] },
};

const CAT_TEXT = {
  sit: '앉아서 쉬는 중', loaf: '식빵 굽는 중', groom: '세수 중', walk: '산책 중', run: '달리는 중', stand: '두리번',
  crouch: '폴짝', air: '폴짝', land: '폴짝', arch: '깜짝', boop: '코 인사', peek: '내려다보는 중', swat: '냥펀치',
  doze: '꾸벅꾸벅', sleep: '자는 중', rise: '눈뜸', yawn: '하품', stretch: '기지개', stretch2: '기지개',
  held: '들려 있는 중', fall: '내려오는 중', pet: '쓰다듬 받는 중',
};
const DOG_TEXT = {
  sit: '헥헥', lie: '엎드려 쉬는 중', walk: '산책 중', run: '달리는 중', sniff: '킁킁', stand: '두리번',
  bow: '놀자고 조르는 중', bark: '멍!', lookup: '올려다보는 중', boop: '코 인사',
  doze: '꾸벅꾸벅', sleep: '자는 중', rise: '눈뜸', yawn: '하품', stretch: '기지개', stretch2: '털 털기',
  crouch: '폴짝', air: '폴짝', land: '착지', held: '들려 있는 중', fall: '내려오는 중', pet: '쓰다듬 받는 중',
};
const INTER_TEXT = { boop: '둘이 코 인사 중', chase: '둘이 잡기 놀이 중', bedtease: '침대 위아래로 실랑이 중', together: '둘이 나란히 앉아 있는 중' };

export function createPets({ px, ltAt, rnd, K_PET, K_EMIT }) {
  const FLOOR_CAT = 57, FLOOR_DOG = 60, BED_Y = 38, BED_X0 = 116, BED_X1 = 178, X0 = 66, X1 = 316;

  const make = (kind, x, y) => ({
    kind, x, y, dir: 1, bed: false, air: false,
    life: 'awake', lifeT: 0,          // awake → doze → sleep → rise → yawn → stretch → stretch2 → awake
    mode: 'sit', modeT: 0, phase: 0,  // 지금 그리는 자세와 그 자세가 된 뒤 흐른 시간
    script: [], inter: null, flags: {}, emote: null, seed: rnd() * 10,
    held: false, fall: null, vx: 0, sway: 0, gx: 0, gy: 0, rub: 0,   // 사람 손과의 상호작용
  });
  const cat = make('cat', 150, BED_Y); cat.bed = true;
  const dog = make('dog', 252, FLOOR_DOG);
  const pets = [cat, dog];

  const setMode = (p, m) => { if (p.mode !== m) { p.mode = m; p.modeT = 0; } };
  const setLife = (p, l) => { p.life = l; p.lifeT = 0; setMode(p, l); };
  const floorY = (p) => (p.kind === 'cat' ? FLOOR_CAT : FLOOR_DOG);

  // ----- 행동 대본: 한 줄씩 순서대로 실행한다 -----
  const walk = (x, o = {}) => ({ do: 'walk', x, ...o });
  const pose = (mode, time) => ({ do: 'pose', mode, time });
  const jump = (up) => ({ do: 'jump', up });
  const emote = (type) => ({ do: 'emote', type });
  const face = (dir) => ({ do: 'face', dir });
  const mark = (key) => ({ do: 'mark', key });
  const wait = (cond, max, mode) => ({ do: 'wait', cond, max, mode });
  const END = { do: 'end' };

  function release(p) {                    // 상호작용 중이었다면 상대를 놓아준다
    if (p.inter) {
      const o = p.inter.other;
      if (o.inter && o.life === 'awake') o.script = [emote('?'), pose(o.kind === 'cat' ? 'sit' : 'stand', 1.4)];
      o.inter = null;
    }
    p.inter = null; p.script = []; p.flags = {};
  }

  function auto(p, zone) {
    const lo = Math.max(X0, zone.lo + 8), hi = Math.min(X1, zone.hi - 8), r = rnd();
    const at = (a, b) => a + rnd() * (b - a);
    p.flags = {};
    if (p.kind === 'cat') {
      if (hi - lo < 26) { p.script = [pose('sit', at(1.5, 3))]; return; }
      if (r < 0.16) { p.script = [pose('sit', at(2, 4.5))]; if (rnd() < 0.3) p.dir = -p.dir; return; }
      if (r < 0.3) { p.script = [pose('loaf', at(3, 6))]; return; }
      if (r < 0.46) { p.script = [pose('groom', at(3, 5))]; return; }
      const bedLo = Math.max(BED_X0, lo), bedHi = Math.min(BED_X1, hi), bedOk = bedHi - bedLo > 10;
      if (p.bed) {
        if (bedOk && rnd() < 0.35) p.script = [walk(at(bedLo, bedHi)), pose(rnd() < 0.5 ? 'loaf' : 'sit', at(2, 4))];
        else p.script = [jump(false), walk(at(lo, hi)), pose('stand', at(0.6, 1.4))];      } else if (bedOk && rnd() < 0.32) p.script = [walk(at(bedLo, bedHi)), jump(true), pose(rnd() < 0.5 ? 'loaf' : 'sit', at(2, 4))];
      else p.script = [walk(at(lo, hi)), pose('stand', at(0.6, 1.4))];
      return;
    }
    if (p.bed) { p.script = [pose('sit', at(1.2, 2.5)), jump(false)]; return; }        // 침대에 올려놓으면 잠깐 앉았다가 내려간다
    if (hi - lo < 26) { p.script = [pose('sit', at(1.5, 3))]; return; }
    if (r < 0.2) p.script = [pose('sit', at(2, 4.5))];
    else if (r < 0.36) p.script = [pose('lie', at(3, 6))];
    else if (r < 0.56) p.script = [walk(clamp(p.x + at(-46, 46), lo, hi), { sniff: true }), pose('stand', at(0.5, 1.2))];
    else p.script = [walk(at(lo, hi)), pose(rnd() < 0.5 ? 'sit' : 'stand', at(1, 2.2))];
  }

  function begin(p, st) {
    if (st.do === 'walk') { p.dir = st.x >= p.x ? 1 : -1; setMode(p, st.run ? 'run' : st.sniff ? 'sniff' : 'walk'); }
    else if (st.do === 'pose') { st.left = st.time; setMode(p, st.mode); p.modeT = 0; }
    else if (st.do === 'jump') { st.t = 0; st.y0 = p.y; st.y1 = st.up ? BED_Y : floorY(p); setMode(p, 'crouch'); }
    else if (st.do === 'wait') { st.left = st.max; if (st.mode) setMode(p, st.mode); }
  }

  // 한 줄을 dt만큼 진행한다. 끝났으면 true, 대본을 버렸으면 'cancel'
  function advance(p, st, dt) {
    switch (st.do) {
      case 'walk': {
        if (ltAt(st.x) < 0.5) { release(p); return 'cancel'; }     // 가려던 곳이 밤이 되면 그만둔다
        const speed = st.run ? 46 : st.sniff ? 8 : p.kind === 'cat' ? 15 : 17;
        const dx = st.x - p.x, step = speed * dt;
        p.phase += dt * (st.run ? 21 : st.sniff ? 6 : 10);
        if (Math.abs(dx) <= step) { p.x = st.x; return true; }
        p.dir = dx > 0 ? 1 : -1; p.x += p.dir * step;
        return false;
      }
      case 'pose': st.left -= dt; return st.left <= 0;
      case 'jump': {
        st.t += dt;
        if (st.t < 0.3) setMode(p, 'crouch');                       // 엉덩이를 씰룩이며 웅크린다
        else if (st.t < 0.72) {
          const u = (st.t - 0.3) / 0.42;
          p.air = true; setMode(p, 'air');
          p.y = st.y0 + (st.y1 - st.y0) * u - Math.sin(Math.PI * u) * 6;
        } else if (st.t < 0.88) { p.air = false; p.y = st.y1; p.bed = st.up; setMode(p, 'land'); }
        else { p.air = false; p.y = st.y1; p.bed = st.up; return true; }
        return false;
      }
      case 'wait': st.left -= dt; return st.cond() || st.left <= 0;
      case 'emote': p.emote = { type: st.type, t: 0 }; return true;
      case 'face': p.dir = st.dir; return true;
      case 'mark': p.flags[st.key] = true; return true;
      case 'end': p.inter = null; return true;
      default: return true;
    }
  }

  function runScript(p, dt, zone) {
    for (let guard = 0; guard < 8; guard++) {
      const st = p.script[0];
      if (!st) { p.inter = null; auto(p, zone); continue; }
      if (!st.started) { st.started = true; begin(p, st); }
      const res = advance(p, st, dt);
      if (res === 'cancel' || res === false) return;
      p.script.shift();
    }
  }

  const RISE = ['rise', 'yawn', 'stretch', 'stretch2'], RISE_T = { rise: 0.5, yawn: 0.8, stretch: 0.9, stretch2: 0.7 };

  function stepPet(p, dt, zone) {
    p.modeT += dt; p.lifeT += dt;
    if (p.emote && (p.emote.t += dt) > 1.5) p.emote = null;
    p.rub = Math.max(0, p.rub - dt * 14);
    if (p.held) {                                                   // 손에 들려 있다. 움직임에 따라 다리가 뒤로 쏠린다
      p.sway += (clamp(-p.vx * 1.2, -2.5, 2.5) - p.sway) * 0.35;
      p.vx *= 0.6;
      return;
    }
    if (p.fall) {                                                   // 놓으면 침대나 바닥으로 떨어져 착지한다
      p.fall.vy += 260 * dt; p.y += p.fall.vy * dt; p.sway *= 0.8;
      if (p.y >= p.fall.y1) {
        p.y = p.fall.y1; p.bed = p.fall.bed; p.fall = null; p.air = false;
        p.script = [pose('land', 0.2), pose(p.kind === 'cat' ? 'sit' : 'stand', 0.9)];
      }
      return;
    }
    const lt = ltAt(p.x), night = lt < 0.45, day = lt > 0.55;
    if (p.life === 'awake') {
      if (night && !p.air) { release(p); setLife(p, 'doze'); return; }   // 걷던 중이든 놀던 중이든 그 자리에서 존다
      runScript(p, dt, zone);
    } else if (p.life === 'doze') {
      if (day) { p.life = 'awake'; p.script = [pose(p.kind === 'cat' ? 'sit' : 'stand', 1)]; }
      else if (p.lifeT > 0.7) setLife(p, 'sleep');
    } else if (p.life === 'sleep') {
      if (day) setLife(p, 'rise');
    } else if (night) setLife(p, 'doze');
    else if (p.lifeT > RISE_T[p.life]) {
      const next = RISE[RISE.indexOf(p.life) + 1];
      if (next) setLife(p, next);
      else { p.life = 'awake'; p.script = []; setMode(p, 'stand'); }
    }
  }

  // ----- 둘이 같이 하는 행동 -----
  let cool = 5 + rnd() * 4;

  function direct(dt, zone) {
    cool -= dt;
    if (cool > 0) return;
    const free = (p) => p.life === 'awake' && !p.inter && !p.air && ltAt(p.x) > 0.6;
    if (!free(cat) || !free(dog) || dog.bed) { cool = 4; return; }               // 막 깬 직후에는 바로 놀지 않는다
    const lo = Math.max(X0, zone.lo + 10), hi = Math.min(X1, zone.hi - 10);
    if (hi - lo < 44) { cool = 3; return; }
    cool = 14 + rnd() * 14;                                          // 대부분의 시간은 각자 논다
    const s = cat.x >= dog.x ? 1 : -1;                               // 고양이가 강아지의 오른쪽(1)인지 왼쪽(-1)인지
    const start = (name, cs, ds) => {
      cat.inter = { other: dog, name }; dog.inter = { other: cat, name };
      cat.flags = {}; dog.flags = {};
      cat.script = [...cs, END]; dog.script = [...ds, END];
    };
    const r = rnd();

    if (cat.bed) {
      if (r < 0.45) { cool = 5; return; }
      // 강아지가 침대 밑으로 와서 올려다보며 짖고, 고양이는 내려다보다가 냥펀치를 날린다
      const dx = clamp(cat.x - s * 13, lo, hi);
      if (Math.abs(dx - (cat.x - s * 13)) > 6) { cool = 3; return; }
      start('bedtease',
        [wait(() => dog.flags.here, 9, 'sit'), face(-s), pose('peek', 1.2), pose('swat', 1.8), mark('swat'), pose('loaf', 3)],
        [walk(dx), face(s), mark('here'), pose('lookup', 0.8), emote('!'), pose('bark', 0.9), wait(() => cat.flags.swat, 4, 'lookup'), pose('bow', 1.4), pose('sit', 2.5)]);
    } else if (r < 0.38) {
      // 서로 다가가서 코를 맞댄다
      const mid = clamp((cat.x + dog.x) / 2, lo + 12, hi - 12);
      start('boop',
        [walk(clamp(mid + s * 9, lo, hi)), face(-s), mark('ready'), wait(() => dog.flags.ready, 6, 'stand'), emote('heart'), pose('boop', 1.9), pose('sit', 1.6)],
        [walk(clamp(mid - s * 11, lo, hi)), face(s), mark('ready'), wait(() => cat.flags.ready, 6, 'stand'), pose('boop', 1.9), pose('sit', 2.4)]);
    } else if (r < 0.74) {
      // 강아지가 놀자고 엎드리면 고양이가 깜짝 놀라 달아나고, 강아지가 쫓아간다. 침대가 낮이면 고양이는 침대 위로 피한다
      if (Math.abs(cat.x - dog.x) < 30) { cool = 2; return; }          // 너무 붙어 있으면 쫓을 거리가 안 나온다
      const bedLo = Math.max(BED_X0, lo), bedHi = Math.min(BED_X1, hi);
      const bx = clamp(cat.x + s * 26, bedLo, bedHi);
      const up = bedHi - bedLo > 8 && (bx - cat.x) * s > -4;            // 침대가 강아지 반대쪽에 있을 때만 침대로 피한다
      const ex = up ? bx : s > 0 ? hi : lo;
      if (!up && Math.abs(ex - cat.x) < 24) { cool = 2; return; }
      const stop = clamp(ex - Math.sign(ex - dog.x || 1) * (up ? 12 : 24), lo, hi);
      const back = ex >= stop ? -1 : 1;                              // 다 도망친 뒤 강아지 쪽을 돌아본다
      start('chase',
        [face(-s), pose('stand', 0.5), emote('!'), pose('arch', 0.8), mark('go'), walk(ex, { run: true }),
          ...(up ? [jump(true), face(back), pose('sit', 1.2), pose('groom', 3)] : [face(back), pose('sit', 1), pose('groom', 2.5)])],
        [face(s), pose('bow', 1.1), wait(() => cat.flags.go, 3, 'bow'), walk(stop, { run: true }), face(-back),
          pose(up ? 'lookup' : 'stand', 0.4), emote('!'), pose('bark', 0.9), pose('sit', 3)]);
    } else {
      // 강아지가 고양이 옆에 와서 나란히 앉는다
      const tx = clamp(cat.x - s * 17, lo, hi);
      if (Math.abs(tx - (cat.x - s * 17)) > 6) { cool = 3; return; }
      start('together',
        [pose('sit', 0.8), wait(() => dog.flags.here, 9, 'sit'), emote('note'), pose('sit', 5)],
        [walk(tx), face(cat.dir), mark('here'), emote('heart'), pose('sit', 5.4)]);
    }
  }

  // ----- 그리기 -----
  function painter(p) {
    const f = p.dir < 0, bx = Math.round(p.x), by = Math.round(p.y);
    const dot = (dx, dy, c, k = K_PET) => px(bx + (f ? -dx : dx), by + dy, c, k);
    const blit = (rows, pal, ox, oy, mirror = false) => {
      for (let j = 0; j < rows.length; j++) {
        const row = rows[j], w = row.length;
        for (let i = 0; i < w; i++) {
          const c = pal[row[mirror ? w - 1 - i : i]];
          if (c) dot(ox + i, oy + j, c);
        }
      }
    };
    return { dot, blit, bx, by };
  }

  // 다리 네 개. 걷기는 대각선 두 다리가 같이 나가고, 달리기는 앞다리끼리 뒷다리끼리 모은다
  function legs(dot, p, o, xs, rows, near, farC, nearC, footC) {
    xs.forEach((lx, n) => {
      const far = n === 1 || n === 2;
      if (far === near) return;
      const off = far ? Math.PI : 0;
      let s = 0, lift = 0;
      if (o.legs === 'walk') { s = Math.sin(p.phase + off) * 1.6; lift = Math.cos(p.phase + off) > 0.35 ? 1 : 0; }
      else if (o.legs === 'run') { const a = p.phase + (n < 2 ? 2.2 : 0); s = Math.sin(a) * 2.8; lift = Math.cos(a) > 0 ? 1 : 0; }
      else if (o.legs === 'air') s = n < 2 ? -2.6 : 2.6;
      else if (o.legs === 'dangle') s = p.sway + (o.kick ? Math.sin(o.kick + n * 1.7) * 0.8 : 0);
      for (let j = 0; j < rows; j++) {
        const fr = rows > 1 ? j / (rows - 1) : 1, last = j === rows - 1;
        const x = lx + Math.round(s * fr), y = -(rows - 1) + j - (last ? lift : 0);
        const c = last && footC ? footC : far ? farC : nearC;
        dot(x, y, c); dot(x + 1, y, c);
      }
    });
  }

  function zzz(p, time, headX, topY) {
    const sx = p.dir < 0 ? -1 : 1, bx = Math.round(p.x) + sx * headX, by = Math.round(p.y) + topY;
    const z = (x, y, big) => {
      const c = [198, 204, 255], n = big ? 4 : 3;
      for (let i = 0; i < n; i++) { px(x + i, y, c, K_EMIT); px(x + i, y + n - 1, c, K_EMIT); px(x + n - 1 - i, y + i, c, K_EMIT); }
    };
    const ph = (time * 0.45 + p.seed) % 1, ph2 = (ph + 0.5) % 1;
    if (ph < 0.85) z(bx + sx * ph * 3, by - 3 - ph * 7, false);
    if (ph2 < 0.85) z(bx + sx * (3 + ph2 * 4), by - 6 - ph2 * 8, true);
  }

  function drawCat(p, time) {
    const { dot, blit } = painter(p);
    const m = p.mode, t = p.modeT;
    const blink = (time + p.seed) % 4.3 < 0.17;
    const eyes = (closed) => (closed || blink ? CAT_SHUT : CAT);
    const twitch = (time + p.seed * 3) % 5.1 < 0.17;              // 가끔 귀를 쫑긋
    const TAILS = {
      a: [[0, 0], [-1, -1], [-1, -2], [-1, -3], [0, -4]], b: [[0, 0], [-1, -1], [-2, -2], [-2, -3], [-1, -4]],
      up: [[0, 0], [0, -1], [0, -2], [0, -3], [1, -4]], low: [[0, 0], [-1, 0], [-2, 0], [-3, -1]],
      puff: [[0, 0], [0, -1], [0, -2], [0, -3], [0, -4], [-1, -1], [-1, -2], [-1, -3], [1, -2], [1, -3]],
    };

    // 옆모습: 걷기, 달리기, 점프, 서기, 등 세우기
    const side = (o = {}) => {
      const rows = 3 + (o.lift || 0), top = -(rows + 5) + (o.bob || 0);
      const tail = o.tail || (Math.sin(time * 3 + p.seed) > 0 ? 'a' : 'b');
      for (const [dx, dy] of TAILS[tail]) dot(-10 + dx, top + 1 + dy, CAT.K);
      legs(dot, p, o, [-8, -5, 1, 3], rows, false, CAT.w, CAT.W);
      blit(C_TORSO, CAT, -9, top);
      if (o.hump) for (let i = -6; i <= 1; i++) dot(i, top - 1, i < -1 ? CAT.O : CAT.W);
      legs(dot, p, o, [-8, -5, 1, 3], rows, true, CAT.w, CAT.W);
      const hx = 3 + (o.hx || 0), hy = top - 1 + (o.hy || 0);
      blit(C_HEAD, o.shut ? CAT_SHUT : eyes(false), hx, hy);
      if (twitch) dot(hx + 1, hy - 1, CAT.K);
    };

    // 엎드린 자세: 졸기, 눈뜨기, 하품, 내려다보기, 냥펀치
    const lying = (o = {}) => {
      blit(C_LIE, CAT, -10, -6);
      const hx = 3 + (o.hx || 0), hy = -9 + (o.hy || 0);
      blit(C_HEAD, o.shut ? CAT_SHUT : eyes(false), hx, hy);
      if (o.mouth) { dot(hx + 3, hy + 5, CAT.p); dot(hx + 2, hy + 5, [196, 84, 104]); }
      if (twitch) dot(hx + 1, hy - 1, CAT.K);
    };

    // 앉은 자세: 꼬리 살랑, 고개 돌리기, 세수
    const sitting = (o = {}) => {
      const fr = [0, 1, 2, 1][Math.floor((time * 3 + p.seed) % 4)];
      const TA = [
        [[-7, -4], [-7, -3], [-7, -2], [-6, -1], [-5, 0], [-4, 0]],
        [[-8, -2], [-8, -1], [-7, 0], [-6, 0], [-5, 0], [-4, 0]],
        [[-9, -1], [-8, 0], [-7, 0], [-6, 0], [-5, 0], [-4, 0]],
      ];
      for (const [dx, dy] of TA[fr]) dot(dx, dy, CAT.K);
      blit(C_SITBODY, CAT, -7, -8);
      const look = o.look ?? (time * 0.5 + p.seed) % 7 > 5.7;      // 가끔 뒤를 돌아본다
      const hx = -2 + (look ? -1 : 0), hy = -14 + (o.hy || 0);
      blit(C_FACE, o.shut ? CAT_SHUT : eyes(false), hx, hy, look);
      if (twitch) dot(hx + (look ? 6 : 1), hy - 1, look ? CAT.O : CAT.K);
    };

    if (m === 'sleep') {
      const inhale = (time + p.seed) % 3.2 < 1.6;
      blit(inhale ? C_SLEEP : ['....................', ...C_SLEEP.slice(1)], CAT_SHUT, -10, -6);
      if (twitch) dot(5, -6, CAT.K);
      if ((time + p.seed) % 6.3 < 0.25) dot(-11, -1, CAT.K);        // 꼬리 끝이 한 번 까딱
      zzz(p, time, 10, -7);
    } else if (m === 'doze') lying({ shut: true, hy: (t * 2.4) % 1 < 0.5 ? 0 : 1 });
    else if (m === 'rise') lying({ hy: t < 0.2 ? 1 : 0 });
    else if (m === 'yawn') lying({ shut: true, hy: -1, mouth: t > 0.15 && t < 0.65 });
    else if (m === 'stretch') blit(C_BOW, CAT_SHUT, -11, -10);
    else if (m === 'stretch2') side({ lift: 1, hump: true, tail: 'up', shut: true, hy: 1 });
    else if (m === 'peek') lying({ hx: 2, hy: 2 });
    else if (m === 'swat') {
      lying({ hx: 2, hy: 2 });
      const ext = Math.floor(t * 5) % 2;                             // 앞발을 침대 아래로 휘두른다
      dot(8, 1, CAT.W); dot(8, 2, CAT.W);
      if (ext) { dot(8, 3, CAT.W); dot(9, 3, CAT.W); } else dot(9, 2, CAT.W);
    } else if (m === 'loaf') {
      blit(C_LOAF, (time + p.seed) % 6 < 1.3 ? CAT_SHUT : eyes(false), -9, -7);
      if (twitch) dot(4, -8, CAT.K);
      if ((time + p.seed) % 4.1 < 0.3) dot(-10, -1, CAT.K);
    } else if (m === 'groom') {
      const wash = t % 3.2 > 1.8;                                    // 앞발을 핥다가, 그 발로 얼굴을 닦는다
      const beat = Math.floor(t * 4) % 2;
      sitting({ shut: true, look: false, hy: wash ? 0 : beat });
      if (wash) { dot(4, beat ? -12 : -11, CAT.W); dot(5, beat ? -12 : -11, CAT.W); dot(5, -10, CAT.W); dot(5, -9, CAT.W); }
      else { dot(4, -8, CAT.W); dot(5, -8, CAT.W); dot(5, -7, CAT.W); if (beat) dot(3, -8, CAT.p); }
    } else if (m === 'walk') side({ legs: 'walk', bob: Math.sin(p.phase * 2) > 0 ? 1 : 0 });
    else if (m === 'run') side({ legs: 'run', bob: Math.sin(p.phase) > 0 ? 1 : 0, tail: 'low', hx: 1 });
    else if (m === 'crouch') side({ lift: -1, tail: Math.floor(t * 12) % 2 ? 'a' : 'b', hy: 1 });
    else if (m === 'air') side({ legs: 'air', tail: 'low' });
    else if (m === 'land') side({ lift: -1, tail: 'up', hy: 1 });
    else if (m === 'arch') side({ lift: 2, hump: true, tail: 'puff', hy: 2 });
    else if (m === 'boop') side({ hx: 1, tail: Math.floor(t * 8) % 2 ? 'up' : 'a' });
    else if (m === 'stand') side({ hy: (time * 0.7 + p.seed) % 3 < 0.5 ? -1 : 0 });
    else if (m === 'held' || m === 'fall') {
      const sleepy = ltAt(p.x) < 0.45;                               // 밤 쪽에서 들면 눈을 감고 축 늘어진다
      side({ lift: 1, legs: 'dangle', kick: sleepy ? 0 : time * 7, tail: 'low', hy: -1, shut: sleepy });
    } else if (m === 'pet') sitting({ shut: true, look: false, hy: Math.floor(t * 3) % 2 ? -1 : 0 });   // 손에 머리를 민다
    else sitting();
  }

  function drawDog(p, time) {
    const { dot, blit } = painter(p);
    const m = p.mode, t = p.modeT;
    const blink = (time + p.seed) % 3.7 < 0.16;
    const pant = Math.floor(time * 4 + p.seed) % 2;

    const head = (ox, oy, o = {}) => {
      blit(D_HEAD, o.shut || blink ? DOG_SHUT : DOG, ox, oy);
      if (o.mouth) { dot(ox + 6, oy + 5, DOG.N); dot(ox + 5, oy + 5, DOG.R); }
      else if (o.tongue) { dot(ox + 5, oy + 5, DOG.R); if (o.tongue > 1 || pant) dot(ox + 5, oy + 6, DOG.R); }
    };
    // 등 위로 말린 꼬리. 기분이 좋을수록 빨리 흔든다
    const tail = (bx, by, speed, back) => {
      const F = [
        [[0, 0], [0, -1], [1, -2], [2, -2]],
        [[0, 0], [-1, -1], [-1, -2], [0, -3]],
        [[0, 0], [-1, 0], [-2, -1], [-2, -2]],
      ];
      const f = back ? [[0, 0], [-1, 0], [-2, 0], [-3, -1]] : F[[0, 1, 2, 1][Math.floor(time * speed + p.seed) % 4]];
      f.forEach(([dx, dy], i) => dot(bx + dx, by + dy, i === f.length - 1 ? DOG.C : DOG.T));
    };

    const side = (o = {}) => {
      const rows = 4 + (o.lift || 0), top = -(rows + 5) + (o.bob || 0), sx = o.dx || 0;
      tail(-10 + sx, top, o.wag ?? 3, o.tailBack);
      legs(dot, p, o, [-8, -5, 2, 4], rows, false, DOG.t, DOG.T, DOG.C);
      blit(D_TORSO, DOG, -9 + sx, top);
      legs(dot, p, o, [-8, -5, 2, 4], rows, true, DOG.t, DOG.T, DOG.C);
      const hx = 2 + sx + (o.hx || 0), hy = top - 5 + (o.hy || 0);
      if (!o.hy || o.hy < 2) { dot(3 + sx, top + 1, DOG.L); dot(4 + sx, top + 1, DOG.L); dot(5 + sx, top + 1, DOG.L); dot(4 + sx, top + 2, DOG.Y); }
      head(hx, hy, o);
    };

    const lie = (o = {}) => {
      const f = Math.floor(time * (o.wag ?? 2) + p.seed) % 2;
      dot(-11, f ? -2 : -1, DOG.T); dot(-12, f ? -3 : -1, DOG.C);
      blit(D_LIE, DOG, -10, -5);
      if (o.breath) for (let i = -7; i <= -2; i++) dot(i, -6, DOG.T);
      head(1, o.low ? -7 : -11 + (o.hy || 0), o);
    };

    const bow = (o = {}) => {
      tail(-9, -9, o.wag ?? 10);
      blit(D_BOW, DOG, -10, -8);
      head(4, -8, o);
    };

    if (m === 'sleep') {
      lie({ low: true, shut: true, wag: 0, breath: (time + p.seed) % 3 < 1.5 });
      if ((time + p.seed) % 5.5 < 0.4 && Math.floor(time * 8) % 2) dot(4, -1, DOG.C);   // 꿈꾸며 발을 움찔
      zzz(p, time, 8, -8);
    } else if (m === 'doze') lie({ shut: true, wag: 0, hy: (t * 2.2) % 1 < 0.5 ? 0 : 2 });
    else if (m === 'rise') lie({ wag: 3 });
    else if (m === 'yawn') lie({ shut: true, hy: -1, mouth: t > 0.15 && t < 0.65, wag: 0 });
    else if (m === 'stretch') bow({ shut: true, wag: 2 });
    else if (m === 'stretch2') side({ dx: Math.floor(t * 14) % 2 ? 1 : -1, shut: true, wag: 12 });   // 온몸을 턴다
    else if (m === 'lie') lie({ tongue: 1, wag: 2 });
    else if (m === 'bow') bow({ tongue: 2, wag: 12 });
    else if (m === 'bark') side({ hy: -1, mouth: (t * 4) % 1 < 0.6, wag: 10 });
    else if (m === 'lookup') side({ hy: -2, hx: -1, wag: 9, tongue: 1 });
    else if (m === 'boop') side({ hx: 1, wag: 14 });
    else if (m === 'sniff') side({ legs: 'walk', hy: 4, hx: 2, wag: 4 });
    else if (m === 'walk') side({ legs: 'walk', bob: Math.sin(p.phase * 2) > 0 ? 1 : 0, wag: 5, tongue: 1 });
    else if (m === 'run') side({ legs: 'run', bob: Math.sin(p.phase) > 0 ? 1 : 0, tailBack: true, tongue: 2, hx: 1 });
    else if (m === 'stand') side({ wag: 4, tongue: 1, hy: (time * 0.6 + p.seed) % 3.5 < 0.6 ? -1 : 0 });
    else if (m === 'held' || m === 'fall') {
      const sleepy = ltAt(p.x) < 0.45;
      side({ lift: 1, legs: 'dangle', kick: sleepy ? 0 : time * 8, wag: sleepy ? 0 : 9, shut: sleepy, tongue: sleepy ? 0 : 1 });
    } else if (m === 'crouch' || m === 'land') side({ lift: -1, wag: 6 });
    else if (m === 'air') side({ legs: 'air', tailBack: true });
    else {
      // 앉아서 헥헥. 가끔 고개를 갸웃한다. 쓰다듬으면 눈을 감고 꼬리를 마구 흔든다
      const happy = m === 'pet';
      const f = Math.floor(time * (happy ? 14 : 6) + p.seed) % 3;
      [[[-7, 0], [-8, 0], [-9, -1]], [[-7, 0], [-8, -1], [-9, -2]], [[-7, -1], [-8, -2], [-8, -3]]][f]
        .forEach(([dx, dy], i) => dot(dx, dy, i === 2 ? DOG.C : DOG.T));
      blit(D_SITBODY, DOG, -6, -8);
      const tilt = happy ? Math.floor(t * 3) % 2 : (time * 0.4 + p.seed) % 6 > 5 ? 1 : 0;
      head(-2 + tilt, -14 + tilt, { tongue: happy ? 2 : 1, shut: happy });
    }
  }

  function drawEmote(p) {
    const e = EMOTES[p.emote.type], u = p.emote.t / 1.5;
    if (u > 0.85 && Math.floor(p.emote.t * 14) % 2) return;         // 사라지기 직전에 깜박인다
    const low = ['sleep', 'doze', 'rise', 'yawn', 'lie', 'loaf', 'peek', 'swat'].includes(p.mode);
    const x0 = Math.round(p.x) + p.dir * (p.kind === 'cat' ? 4 : 6) - (e.rows[0].length >> 1);
    const y0 = Math.round(p.y) - (low ? 12 : 17) - e.rows.length - Math.round(u * 4);
    e.rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') px(x0 + i, y0 + j, e.color, K_EMIT); });
  }

  // ----- 사람 손: 잡아서 옮기기, 쓰다듬기 -----
  const LOW = new Set(['sleep', 'doze', 'rise', 'yawn', 'lie', 'loaf', 'peek', 'swat', 'stretch']);

  function petNow(p) {
    if (p.held || p.fall || p.air) return false;
    if (p.life !== 'awake') {                                       // 자는 동안에는 깨지 않고 하트만 띄운다
      if (p.emote) return false;
      p.emote = { type: 'heart', t: 0 };
      return true;
    }
    const st = p.script[0];
    if (st && st.do === 'pose' && st.mode === 'pet') {              // 계속 쓰다듬으면 계속 좋아한다
      st.left = 1.3;
      if (!p.emote) p.emote = { type: 'heart', t: 0 };
      return true;
    }
    release(p);
    p.script = [emote('heart'), pose('pet', 1.5)];
    return true;
  }

  return {
    cat, dog,
    /** 장면 좌표 (sx, sy)에 있는 동물. 없으면 null. 앞에 있는 동물이 먼저 잡힌다. */
    hit(sx, sy) {
      for (const p of [...pets].sort((a, b) => b.y - a.y)) {
        const w = p.kind === 'cat' ? 11 : 13, h = LOW.has(p.mode) ? 10 : 16;
        if (Math.abs(sx - p.x) <= w && sy <= p.y + 2 && sy >= p.y - h) return p;
      }
      return null;
    },
    grab(p, sx, sy) {
      release(p);
      p.life = 'awake'; p.lifeT = 0; p.script = [];
      p.held = true; p.air = true; p.fall = null; p.vx = 0; p.sway = 0;
      p.gx = p.x - sx; p.gy = p.y - sy;
      setMode(p, 'held');
      const o = p === cat ? dog : cat;                               // 남은 한 마리가 깜짝 놀라 쳐다본다
      if (o.life === 'awake' && !o.inter && !o.air) {
        o.dir = p.x >= o.x ? 1 : -1;
        o.script = [emote('!'), pose(o.kind === 'dog' ? 'lookup' : 'stand', 2.4)];
      }
    },
    dragTo(p, sx, sy) {
      if (!p.held) return;
      const nx = clamp(sx + p.gx, 46, 338), ny = clamp(sy + p.gy, 18, floorY(p));
      p.vx = nx - p.x; p.x = nx; p.y = ny;
    },
    drop(p) {
      if (!p.held) return;
      p.held = false;
      const onBed = p.x >= BED_X0 && p.x <= BED_X1 && p.y <= BED_Y + 3;   // 침대 위에서 놓으면 침대에, 아니면 바닥에 내려앉는다
      p.x = clamp(p.x, onBed ? BED_X0 : X0, onBed ? BED_X1 : X1);
      p.fall = { vy: 0, y1: onBed ? BED_Y : floorY(p), bed: onBed };
      if (p.y > p.fall.y1) p.y = p.fall.y1;
      setMode(p, 'fall');
    },
    /** 마우스로 문지른 거리(장면 px)를 쌓는다. 충분히 문지르면 쓰다듬은 것으로 친다. */
    stroke(p, dist) {
      p.rub += dist;
      if (p.rub < 26) return false;
      p.rub = 0;
      return petNow(p);
    },
    poke: petNow,
    update(dt, zone) {
      direct(dt, zone);
      for (const p of pets) stepPet(p, dt, zone);
    },
    draw(time) {
      for (const p of [...pets].sort((a, b) => a.y - b.y)) (p.kind === 'cat' ? drawCat : drawDog)(p, time);
      for (const p of pets) if (p.emote) drawEmote(p);
    },
    label() {
      if (cat.inter) return INTER_TEXT[cat.inter.name];
      return `고양이 ${CAT_TEXT[cat.mode] || ''} · 강아지 ${DOG_TEXT[dog.mode] || ''}`;
    },
  };
}
