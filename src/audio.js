// audio.js: Web Audio 합성. 샘플 파일 없음.
// 밤(귀뚜라미, 낮은 방 소리) → 아침(새소리, 밝은 화음)을 볼륨 값으로 크로스페이드한다.
// 브라우저 정책상 첫 사용자 입력 뒤에만 소리를 시작할 수 있다.

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const PENTA = [0, 2, 4, 7, 9];           // A 장조 5음계

export function createAudio() {
  let ctx = null, master, night, dawn, birds, analyser = null, scope = null;
  let volume = 0, sceneT = 0, lastPurr = -9, lastTick = 0, birdTimer = 0, noiseBuf = null, brownBuf = null;

  function makeNoise(brown) {
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let acc = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { acc = (acc + 0.02 * w) / 1.02; d[i] = acc * 3.5; } else d[i] = w;
    }
    return buf;
  }
  const loop = (buf) => {
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true; src.start();
    return src;
  };
  const osc = (type, freq) => {
    const o = ctx.createOscillator();
    o.type = type; o.frequency.value = freq; o.start();
    return o;
  };
  const gain = (v, dest) => {
    const g = ctx.createGain();
    g.gain.value = v;
    if (dest) g.connect(dest);
    return g;
  };

  function build() {
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -12; limiter.ratio.value = 8; limiter.attack.value = 0.003; limiter.release.value = 0.2;
    limiter.connect(ctx.destination);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    scope = new Float32Array(analyser.fftSize);
    limiter.connect(analyser);
    master = gain(0, limiter);
    night = gain(1, master);
    dawn = gain(0, master);
    birds = gain(0.9, master);
    noiseBuf = makeNoise(false);
    brownBuf = makeNoise(true);

    // 밤: 귀뚜라미. 높은 사인파를 빠른 떨림(31Hz)과 느린 묶음(0.8Hz)으로 두 번 잘라낸다
    const cricket = gain(0.1, night);
    const slow = gain(0, cricket);
    const fast = gain(0.5, slow);
    osc('sine', 4350).connect(fast);
    osc('sine', 4610).connect(fast);
    osc('sine', 31).connect(gain(0.5, fast.gain));
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) curve[i] = clamp(((i / 255) * 2 - 1 - 0.15) / 0.3, 0, 1);
    shaper.curve = curve;
    osc('sine', 0.8).connect(shaper);
    shaper.connect(slow.gain);

    // 밤: 낮게 깔리는 방 소리와 빈 5도 화음
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 170;
    loop(brownBuf).connect(lp);
    lp.connect(gain(0.9, night));
    const pad = gain(0.1, night);
    osc('sine', 110).connect(pad);
    osc('sine', 164.81).connect(pad);
    osc('sine', 0.11).connect(gain(0.035, pad.gain));

    // 아침: 밝은 장3화음과 공기 소리
    const padM = gain(0.055, dawn);
    for (const f of [220, 277.18, 329.63, 440]) osc('sine', f).connect(padM);
    osc('sine', 0.17).connect(gain(0.02, padM.gain));
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 2200;
    loop(noiseBuf).connect(hp);
    hp.connect(gain(0.022, dawn));

    birdTimer = window.setInterval(() => {
      if (!ctx || ctx.state !== 'running') return;
      const rate = smooth(0.4, 0.9, sceneT) * 0.55;
      if (Math.random() < rate) chirp(ctx.currentTime + Math.random() * 0.25);
    }, 300);
  }

  // 새소리: 빠르게 미끄러지는 짧은 사인파 몇 개
  function chirp(when) {
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : gain(1);
    if (pan.pan) pan.pan.value = Math.random() * 1.6 - 0.8;
    pan.connect(birds);
    const base = 2400 + Math.random() * 2200;
    const notes = 2 + Math.floor(Math.random() * 4);
    const loud = 0.07 + Math.random() * 0.08;
    for (let k = 0; k < notes; k++) {
      const t0 = when + k * (0.075 + Math.random() * 0.05);
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(base * (1 + Math.random() * 0.2), t0);
      o.frequency.exponentialRampToValueAtTime(base * (0.75 + Math.random() * 0.7), t0 + 0.06);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(loud, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.075);
      o.connect(g); g.connect(pan);
      o.start(t0); o.stop(t0 + 0.09);
    }
  }

  function apply() {
    if (!ctx) return;
    const now = ctx.currentTime;
    master.gain.setTargetAtTime(Math.pow(volume, 1.4) * 0.85, now, 0.03);
    // 밤과 아침 층을 등전력으로 교차시켜, 볼륨을 올리면 소리가 항상 커지게 한다
    const x = smooth(0.3, 0.75, sceneT) * Math.PI * 0.5;
    night.gain.setTargetAtTime(Math.cos(x), now, 0.08);
    dawn.gain.setTargetAtTime(Math.sin(x) * 1.9, now, 0.08);
  }

  return {
    get started() { return !!ctx && ctx.state === 'running'; },

    /** 사용자 입력 이벤트 안에서 불러야 한다. */
    start() {
      if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { ctx = new AC(); build(); apply(); } catch { ctx = null; }
    },
    setVolume(v) { volume = clamp(v, 0, 1); apply(); },
    setScene(t) {
      if (Math.abs(t - sceneT) < 0.002) return;
      sceneT = t; apply();
    },

    /** 눈금을 지날 때 나는 유리 구슬 소리. 위치가 높을수록 높은 음. */
    tick(v) {
      if (!ctx || ctx.state !== 'running') return;
      const now = ctx.currentTime;
      if (now - lastTick < 0.028) return;
      lastTick = now;
      const idx = Math.round(clamp(v, 0, 1) * 12);
      const f = 220 * Math.pow(2, (Math.floor(idx / 5) * 12 + PENTA[idx % 5]) / 12);
      for (const [mul, level, decay] of [[1, 0.2, 0.3], [3.01, 0.045, 0.09]]) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = f * mul;
        g.gain.setValueAtTime(level, now);
        g.gain.exponentialRampToValueAtTime(0.0001, now + decay);
        o.connect(g); g.connect(master);
        o.start(now); o.stop(now + decay + 0.02);
      }
    },

    /** 스탠드 스위치 딸깍 소리. */
    click() {
      if (!ctx || ctx.state !== 'running') return;
      const now = ctx.currentTime;
      const src = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = noiseBuf;
      hp.type = 'highpass'; hp.frequency.value = 1600;
      g.gain.setValueAtTime(0.22, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);
      src.connect(hp); hp.connect(g); g.connect(master);
      src.start(now, Math.random()); src.stop(now + 0.03);
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.frequency.setValueAtTime(170, now);
      o.frequency.exponentialRampToValueAtTime(90, now + 0.05);
      og.gain.setValueAtTime(0.25, now);
      og.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
      o.connect(og); og.connect(master);
      o.start(now); o.stop(now + 0.07);
    },

    /** 지금 나가는 소리의 크기(RMS, 0~1). 화면의 파형 아이콘이 이 값으로 움직인다. */
    level() {
      if (!analyser || ctx.state !== 'running') return 0;
      analyser.getFloatTimeDomainData(scope);
      let sum = 0;
      for (let i = 0; i < scope.length; i++) sum += scope[i] * scope[i];
      return Math.sqrt(sum / scope.length);
    },

    /** 고양이를 쓰다듬을 때 나는 골골 소리. 낮은 잡음을 초당 24번 떨게 한다. */
    purr() {
      if (!ctx || ctx.state !== 'running') return;
      const now = ctx.currentTime;
      if (now - lastPurr < 1.1) return;
      lastPurr = now;
      const src = ctx.createBufferSource(), lp = ctx.createBiquadFilter(), am = ctx.createGain(), env = ctx.createGain();
      const lfo = ctx.createOscillator(), depth = ctx.createGain();
      src.buffer = brownBuf; src.loop = true;
      lp.type = 'lowpass'; lp.frequency.value = 260;
      am.gain.value = 0.5; lfo.frequency.value = 24; depth.gain.value = 0.5;
      lfo.connect(depth); depth.connect(am.gain);
      env.gain.setValueAtTime(0.0001, now);
      env.gain.exponentialRampToValueAtTime(0.9, now + 0.25);
      env.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);
      src.connect(lp); lp.connect(am); am.connect(env); env.connect(master);
      src.start(now, Math.random()); lfo.start(now);
      src.stop(now + 1.6); lfo.stop(now + 1.6);
    },

    suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); },
    resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); },
    dispose() { window.clearInterval(birdTimer); if (ctx) ctx.close(); ctx = null; },
  };
}
