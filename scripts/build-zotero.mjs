/**
 * MindFlow for Zotero - Packaging Pipeline
 * Builds React app as a self-contained IIFE bundle for Gecko (Zotero 7+),
 * avoids CORS/ES-module restrictions in chrome:// URLs,
 * structures Zotero 7 addon, validates syntax, and packages .xpi
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { build as viteBuild } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const zoteroSrc = path.join(projectRoot, 'zotero');
const zoteroStaging = path.join(projectRoot, 'dist-zotero');
const contentDir = path.join(zoteroStaging, 'chrome', 'content');
const assetsDir = path.join(contentDir, 'assets');

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function main() {
  console.log('🧹 [1/5] Preparing Zotero addon staging directory...');
  if (fs.existsSync(zoteroStaging)) {
    fs.rmSync(zoteroStaging, { recursive: true, force: true });
  }
  fs.mkdirSync(zoteroStaging, { recursive: true });

  // 1. Copy core Zotero root files
  fs.copyFileSync(path.join(zoteroSrc, 'manifest.json'), path.join(zoteroStaging, 'manifest.json'));
  fs.copyFileSync(path.join(zoteroSrc, 'bootstrap.js'), path.join(zoteroStaging, 'bootstrap.js'));
  fs.copyFileSync(path.join(zoteroSrc, 'prefs.js'), path.join(zoteroStaging, 'prefs.js'));
  fs.copyFileSync(path.join(zoteroSrc, 'chrome.manifest'), path.join(zoteroStaging, 'chrome.manifest'));

  // 2. Copy locales & chrome files (icons, runtime scripts)
  copyDirRecursive(path.join(zoteroSrc, 'locale'), path.join(zoteroStaging, 'locale'));
  copyDirRecursive(path.join(zoteroSrc, 'chrome'), path.join(zoteroStaging, 'chrome'));

  console.log('🚀 [2/5] Building dedicated standalone bundle for Zotero 7 (Gecko IIFE)...');
  // Type check first
  execSync('npx tsc --noEmit', { cwd: projectRoot, stdio: 'inherit' });

  // Build classic IIFE bundle to bypass Gecko chrome:// CORS and module restrictions
  await viteBuild({
    configFile: false,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(projectRoot, 'src'),
      },
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
      'process.env': JSON.stringify({ NODE_ENV: 'production' }),
      'global': 'window',
    },
    build: {
      outDir: assetsDir,
      emptyOutDir: true,
      lib: {
        entry: path.resolve(projectRoot, 'src/main.tsx'),
        name: 'MindFlowApp',
        formats: ['iife'],
        fileName: () => 'app.iife.js',
        cssFileName: 'mindflow',
      },
    },
  });

  // Post-process app.iife.js to eliminate any lingering process.env references
  const iifePath = path.join(assetsDir, 'app.iife.js');
  if (fs.existsSync(iifePath)) {
    let iifeCode = fs.readFileSync(iifePath, 'utf-8');
    iifeCode = iifeCode.replace(/process\.env\.NODE_ENV/g, '"production"');
    iifeCode = iifeCode.replace(/process\.env/g, '({NODE_ENV:"production"})');
    fs.writeFileSync(iifePath, iifeCode, 'utf-8');
    console.log('✅ Sanitized process.env references in app.iife.js');
  }

  // Generate compatible index.html for Zotero chrome:// context
  const htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="icons/mindflow.svg" />
    <title>MindFlow 思维导图与学术研读工作区</title>
    <style>
      html, body {
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
        overflow: hidden;
        background-color: #f8fafc;
      }
      #root {
        width: 100%;
        height: 100%;
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        overflow: hidden;
      }
    </style>
    <link rel="stylesheet" href="./assets/mindflow.css" />
    <script>
      // 1. Browser/Gecko Environment Polyfills
      window.process = window.process || { env: { NODE_ENV: 'production' } };
      window.global = window.global || window;

      // 2. Global Error Logging & Visual Feedback
      window.addEventListener('error', function(e) {
        console.error('[MindFlow Global Error]', e.error || e.message, e.filename, e.lineno);
        var root = document.getElementById('root');
        if (root && (!root.children || root.children.length === 0)) {
          root.innerHTML = '<div style="padding:24px;color:#b91c1c;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;"><h3>⚠️ MindFlow 启动异常</h3><p style="color:#64748b;font-size:13px;">脚本执行发生错误，详细信息如下：</p><pre style="white-space:pre-wrap;background:#fef2f2;border:1px solid #fecaca;padding:12px;border-radius:6px;font-size:12px;color:#b91c1c;">' + (e.error ? (e.error.stack || e.error.message) : e.message) + '</pre></div>';
        }
      });
      window.addEventListener('unhandledrejection', function(e) {
        console.error('[MindFlow Unhandled Rejection]', e.reason);
      });

      // 3. Immediately bind Zotero instance from window.arguments if available
      try {
        if (window.arguments && window.arguments[0] && window.arguments[0].Zotero) {
          window.Zotero = window.arguments[0].Zotero;
        }
      } catch (e) {
        console.warn('[MindFlow] Note on Zotero arguments:', e);
      }
    </script>
  </head>
  <body class="bg-slate-50 text-slate-900 antialiased overflow-hidden select-none">
    <div id="root"></div>
    <script src="./assets/app.iife.js"></script>
  </body>
</html>
`;
  fs.writeFileSync(path.join(contentDir, 'index.html'), htmlContent, 'utf-8');

  console.log('🔍 [3/5] Validating JavaScript syntax...');
  execSync(`node --check "${path.join(zoteroStaging, 'bootstrap.js')}"`, { stdio: 'inherit' });
  execSync(`node --check "${path.join(zoteroStaging, 'chrome', 'content', 'scripts', 'index.js')}"`, { stdio: 'inherit' });
  execSync(`node --check "${path.join(zoteroStaging, 'chrome', 'content', 'scripts', 'preferences.js')}"`, { stdio: 'inherit' });

  console.log('📦 [4/5] Packaging into Zotero .xpi archive...');
  const psScriptPath = path.join(projectRoot, 'scripts', 'build-zotero.ps1');
  execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${psScriptPath}"`, { stdio: 'inherit' });

  console.log('✨ [5/5] Build complete! Zotero addon ready at dist-zotero/ and dist-zip/mindflow-zotero-1.0.0.xpi');
}

main().catch((err) => {
  console.error('❌ Build failed:', err);
  process.exit(1);
});
