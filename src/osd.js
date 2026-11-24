// osd.js: 볼륨 키를 눌렀을 때 화면 아래에 잠깐 뜨는 작은 창. 배경 소리는 만들지 않는다.
import { createSwitch } from './switch.js';
import { connectDesktop } from './desktop.js';

let link = null;
const sw = createSwitch(document.getElementById('switch'), {
  value: 0, fill: 0.95, vroom: 1.2,
  onInput(v) { link?.push(v); },
});
if (sw) link = connectDesktop(sw, { fromOsd: true });
