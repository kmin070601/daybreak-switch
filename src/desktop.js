// desktop.js: Tauri 데스크톱 앱 안에서만 동작한다. 슬라이더 값을 PC 시스템 볼륨과 잇는다.
// 웹 페이지에서는 window.__TAURI__가 없으므로 아무 일도 하지 않는다.

export function connectDesktop(sw, { fromOsd = false, onShown, onHidden } = {}) {
  const T = window.__TAURI__;
  if (!T) return null;
  const { invoke } = T.core, { listen } = T.event;
  let applying = false, lastLocal = -1e9, userAt = -1e9;

  // 안전장치: 사람이 방금 직접 조작했을 때만 PC 볼륨을 바꾼다. 화면이 스스로 움직여서 볼륨이 바뀌는 일은 없다
  const touched = () => { userAt = performance.now(); };
  for (const type of ['pointerdown', 'keydown', 'wheel', 'click']) window.addEventListener(type, touched, true);
  window.addEventListener('pointermove', (e) => { if (e.buttons) touched(); }, true);

  const apply = (v, jump = false) => {
    applying = true;
    sw.setValue(v.value, { jump });
    applying = false;
  };
  invoke('get_volume').then((v) => apply(v, true));
  // 직접 끌고 있는 동안에는 시스템에서 되돌아온 값으로 구슬이 떨리지 않게 잠깐 무시한다
  listen('volume', (e) => { if (performance.now() - lastLocal > 350) apply(e.payload); });
  if (onShown) listen(fromOsd ? 'osd-shown' : 'main-shown', onShown);
  if (onHidden) listen(fromOsd ? 'osd-hidden' : 'main-hidden', onHidden);

  return {
    /** 사용자가 슬라이더를 움직였을 때 시스템 볼륨에 반영한다. */
    push(value) {
      if (applying || performance.now() - userAt > 1500) return;
      lastLocal = performance.now();
      invoke('set_volume', { value, fromOsd });
    },
  };
}
