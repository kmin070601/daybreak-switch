// 앱 아이콘 원본(1024px PNG)을 코드로 그린다. 의존성 없음. 결과는 src-tauri/icons/source.png
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const N = 1024, px = Buffer.alloc(N * N * 4);
const mix = (a, b, t) => a + (b - a) * t;
const sm = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const rr = (x, y, cx, cy, hw, hh, r) => { const dx = Math.max(Math.abs(x - cx) - hw + r, 0), dy = Math.max(Math.abs(y - cy) - hh + r, 0); return Math.hypot(dx, dy) - r; };
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  const i = (y * N + x) * 4;
  let c = [18, 18, 34], a = 1 - sm(-2, 2, rr(x, y, 512, 512, 470, 470, 210));
  const cap = rr(x, y, 512, 512, 380, 150, 150), inner = rr(x, y, 512, 512, 340, 110, 110);
  if (cap < 0) c = [150, 150, 190].map((v) => v * (0.75 + 0.25 * sm(120, -150, y - 512)));
  if (inner < 0) { const t = sm(250, 720, x); c = [mix(22, 255, t), mix(26, 176, t), mix(84, 120, t)]; }
  const d = Math.hypot(x - 560, y - 512);
  if (d < 168) { const t = d / 168; c = [mix(255, 190, t * t), mix(236, 170, t * t), mix(214, 240, t * t)]; if (Math.hypot(x - 505, y - 450) < 44) c = [255, 255, 255]; }
  px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = Math.round(a * 255);
}
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const v of b) c = crcT[(c ^ v) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc(td)); return Buffer.concat([len, td, cr]); };
const raw = Buffer.alloc(N * (N * 4 + 1));
for (let y = 0; y < N; y++) px.copy(raw, y * (N * 4 + 1) + 1, y * N * 4, (y + 1) * N * 4);
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(N, 0); ihdr.writeUInt32BE(N, 4); ihdr[8] = 8; ihdr[9] = 6;
writeFileSync(new URL('../src-tauri/icons/source.png', import.meta.url), Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log('icon source written');
