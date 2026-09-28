import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dependencies = path.join(root, 'source/node_modules');
const { build } = await import(pathToFileURL(path.join(dependencies, 'vite/dist/node/index.js')).href);
const { default: react } = await import(pathToFileURL(path.join(dependencies, '@vitejs/plugin-react/dist/index.js')).href);
const { default: tailwindcss } = await import(pathToFileURL(path.join(dependencies, '@tailwindcss/vite/dist/index.mjs')).href);
const check = spawnSync('cmd.exe', ['/d', '/c', 'source\\node_modules\\.bin\\tsc.cmd --noEmit -p source/tsconfig.json'], { cwd: root, stdio: 'inherit' });
if (check.status) process.exit(check.status);
await build({ configFile: false, root: path.join(root, 'source'),
  plugins: [react(), tailwindcss()], resolve: { alias: { '@': path.join(root, 'source/src') } },
  define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{"NODE_ENV":"production"}', global: 'window' },
  build: { outDir: path.join(root, 'chrome/content/assets'), emptyOutDir: false,
    lib: { entry: path.join(root, 'source/src/main.tsx'), name: 'MindFlowApp', formats: ['iife'],
      fileName: () => 'app.iife.js', cssFileName: 'mindflow' } } });
for (const file of ['bootstrap.js', 'chrome/content/scripts/index.js', 'chrome/content/scripts/preferences.js', 'chrome/content/assets/app.iife.js']) {
  const result = spawnSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'inherit' });
  if (result.status) process.exit(result.status);
}
console.log('Local typecheck, production bundle and syntax checks passed.');
