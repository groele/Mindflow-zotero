import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { writeFile } from 'node:fs/promises';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dependencies = path.join(root, 'source/node_modules');
const { build } = await import(pathToFileURL(path.join(dependencies, 'vite/dist/node/index.js')).href);
const { default: react } = await import(pathToFileURL(path.join(dependencies, '@vitejs/plugin-react/dist/index.js')).href);
const outDir = path.join(root, 'tests/modal-fixture');
await build({ configFile: false, root: path.join(root, 'source'), plugins: [react()],
  resolve: { alias: { '@': path.join(root, 'source/src') } },
  define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{"NODE_ENV":"production"}', global: 'window' },
  build: { outDir, emptyOutDir: false, lib: {
    entry: path.join(root, 'source/tests/modal-focus-fixture.tsx'), name: 'MindFlowModalTest',
    formats: ['iife'], fileName: () => 'modal-test.iife.js' } } });
await writeFile(path.join(outDir, 'modal-test.html'), '<!doctype html><html><head><meta charset="UTF-8"><link rel="stylesheet" href="assets/mindflow.css"></head><body><div id="root"></div><script src="assets/modal-test.iife.js"></script></body></html>');
