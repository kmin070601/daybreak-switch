// index.html + style.css + src/*.js 를 파일 하나(dist/daybreak-switch.html)로 합친다.
// 합친 파일은 서버 없이 더블클릭으로 열린다. 의존성 없음.
//   node tools/bundle.mjs
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('..', import.meta.url);
const read = (p) => readFile(new URL(p, root), 'utf8');

// 의존 순서대로. 모듈마다 즉시 실행 함수로 감싸 이름이 서로 부딪히지 않게 한다
const order = ['pets', 'scene', 'glass', 'switch', 'audio', 'desktop', 'main'];
let js = '';
for (const name of order) {
  let src = await read(`src/${name}.js`);
  const exported = [];
  src = src.replace(/^import\s*\{([^}]+)\}\s*from\s*'\.\/(\w+)\.js';\s*$/gm, (_, names, from) => `const {${names}} = __${from};`);
  src = src.replace(/^export\s+(const|function)\s+(\w+)/gm, (_, kind, id) => { exported.push(id); return `${kind} ${id}`; });
  if (/^\s*(import|export)\s/m.test(src)) throw new Error(`${name}.js: 처리하지 못한 import/export가 남았다`);
  js += `const __${name} = (() => {\n${src}\nreturn { ${exported.join(', ')} };\n})();\n`;
}

let html = await read('index.html');
const css = await read('style.css');
const swap = (from, to) => {
  if (!html.includes(from)) throw new Error(`index.html에서 찾지 못함: ${from}`);
  html = html.replace(from, () => to);
};
swap('<link rel="stylesheet" href="style.css">', `<style>\n${css}</style>`);
swap('<script type="module" src="src/main.js"></script>', `<script>\n(() => {\n'use strict';\n${js}})();\n</script>`);

await mkdir(new URL('dist/', root), { recursive: true });
const out = new URL('dist/daybreak-switch.html', root);
await writeFile(out, html);
console.log(`${fileURLToPath(out)}  ${(Buffer.byteLength(html) / 1024).toFixed(1)} KB`);
