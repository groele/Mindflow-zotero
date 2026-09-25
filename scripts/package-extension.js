// MindFlow Chrome Extension Web Store Packaging Utility
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const ROOT_DIR = process.cwd();
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const ZIP_OUT_DIR = path.join(ROOT_DIR, 'dist-zip');

console.log('📦 --- MindFlow Chrome Extension 打包工具 ---');

// 1. Check dist directory
if (!fs.existsSync(DIST_DIR)) {
  console.error('❌ 错误: dist 目录不存在，请先执行 npm run build');
  process.exit(1);
}

// 2. Read and validate manifest.json
const manifestPath = path.join(DIST_DIR, 'manifest.json');
if (!fs.existsSync(manifestPath)) {
  console.error('❌ 错误: dist/manifest.json 不存在！');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const version = manifest.version;
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('❌ 错误: manifest.json 缺少有效的版本号');
  process.exit(1);
}
console.log(`✓ 检测到构建产物版本: v${version}`);
console.log(`✓ 扩展名称: ${manifest.name}`);
console.log(`✓ 默认语言: ${manifest.default_locale}`);

// 3. Verify essential files
const requiredFiles = [
  'manifest.json',
  'background.js',
  'index.html',
  'sidepanel.html',
  'popup.html',
  'icons/icon128.png',
  '_locales/zh_CN/messages.json',
  '_locales/en/messages.json',
];

for (const req of requiredFiles) {
  const p = path.join(DIST_DIR, req);
  if (!fs.existsSync(p)) {
    console.error(`❌ 错误: 缺少必要上架文件: ${req}`);
    process.exit(1);
  }
}
console.log('✓ 所有 Chrome Web Store 必备文件校验通过');

// 4. Ensure zip output directory exists
if (!fs.existsSync(ZIP_OUT_DIR)) {
  fs.mkdirSync(ZIP_OUT_DIR, { recursive: true });
}

const zipFileName = `mindflow-v${version}-webstore.zip`;
const zipFilePath = path.join(ZIP_OUT_DIR, zipFileName);

// Delete old zip if exists
if (fs.existsSync(zipFilePath)) {
  fs.unlinkSync(zipFilePath);
}

console.log(`\n⏳ 正在生成 Chrome Web Store 上架专用 ZIP 包: ${zipFileName}...`);

try {
  if (process.platform === 'win32') {
    // Windows PowerShell Compress-Archive
    const psCmd = `powershell -NoProfile -Command "Compress-Archive -Path '${DIST_DIR}\\*' -DestinationPath '${zipFilePath}' -Force"`;
    execSync(psCmd, { stdio: 'inherit' });
  } else {
    // Unix/Linux/macOS zip
    execSync(`cd "${DIST_DIR}" && zip -r "${zipFilePath}" .`, { stdio: 'inherit' });
  }

  const stat = fs.statSync(zipFilePath);
  const sizeKB = (stat.size / 1024).toFixed(1);

  console.log(`\n🎉 打包完成！`);
  console.log(`📁 产物路径: ${zipFilePath}`);
  console.log(`📊 压缩包大小: ${sizeKB} KB`);
  console.log(`\n🚀 下一步操作建议:`);
  console.log(`1. 打开 Chrome Web Store 开发者后台: https://chrome.google.com/webstore/devconsole`);
  console.log(`2. 点击「上传新内容」，选择该 zip 文件`);
  console.log(`3. 填写 docs/STORE_LISTING.md 中的应用描述与隐私权政策`);
  console.log(`4. 提交审核即可上线！`);
} catch (err) {
  console.error('❌ 打包失败:', err);
  process.exit(1);
}
