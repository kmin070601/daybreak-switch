// 데스크톱 앱(Tauri)에 넣을 화면 파일을 desktop-dist/로 모은다.
import { cp, mkdir, rm } from 'node:fs/promises';

const root = new URL('..', import.meta.url);
const out = new URL('desktop-dist/', root);
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const f of ['index.html', 'osd.html', 'style.css']) await cp(new URL(f, root), new URL(f, out));
await cp(new URL('src/', root), new URL('src/', out), { recursive: true });
console.log('desktop-dist ready');
