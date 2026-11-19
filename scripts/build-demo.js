// Сборка демо: одна HTML-страница со всей логикой (core + web) и демо-данными в браузере.
// dist/leadmeet-demo.html — фрагмент для публикации как Artifact; dist/leadmeet-demo-standalone.html — открыть локально.
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist');
fs.mkdirSync(out, { recursive: true });

const res = await build({
  entryPoints: [path.join(root, 'web/main-demo.js')], bundle: true, format: 'iife', minify: true, write: false,
  target: ['es2022'], legalComments: 'none', charset: 'utf8',
});
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = fs.readFileSync(path.join(root, 'web/style.css'), 'utf8') + '\nbody::before{content:"";position:fixed;inset:0 0 auto;height:env(safe-area-inset-top,0px);z-index:10;background:var(--bg)}\n';
const head = `<title>LEADMEET OS</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>${css}</style>`;
const bodyHtml = `<div id="app"><div style="padding:40px">Загрузка LEADMEET OS…</div></div>\n<script>${js}</script>`;
fs.writeFileSync(path.join(out, 'leadmeet-demo.html'), head + '\n' + bodyHtml + '\n');
fs.writeFileSync(path.join(out, 'leadmeet-demo-standalone.html'), `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">${head}</head><body>${bodyHtml}</body></html>`);
console.log('demo built:', Math.round(fs.statSync(path.join(out, 'leadmeet-demo.html')).size / 1024) + ' KB');
