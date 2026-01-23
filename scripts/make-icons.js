const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const src = path.join(repoRoot, 'assets', 'logo.png');
const outDir = path.join(repoRoot, 'build', 'icons');

function ensureDir(d){
  if(!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

ensureDir(outDir);

if(!fs.existsSync(src)){
  console.error('源文件不存在:', src);
  process.exit(1);
}

const png = fs.readFileSync(src);

// 把原始 PNG 拷贝为通用文件（Linux/其它可用）
fs.writeFileSync(path.join(outDir, 'icon.png'), png);
fs.writeFileSync(path.join(outDir, 'icon_512.png'), png);

console.log('已生成: build/icons/icon.png, icon_512.png');

// 尝试使用 png2icons 生成 icns 和 ico（如果已安装）
try{
  const png2icons = require('png2icons');
  // 生成 icns
  if(typeof png2icons.createICNS === 'function'){
    const icns = png2icons.createICNS(png, png2icons.BICUBIC, false, 0);
    fs.writeFileSync(path.join(outDir, 'icon.icns'), icns);
    console.log('已生成: build/icons/icon.icns');
  }
  // 生成 ico（尝试常见方法名）
  let icoBuf = null;
  if(typeof png2icons.convertToICO === 'function'){
    icoBuf = png2icons.convertToICO(png, png2icons.BICUBIC);
  } else if(typeof png2icons.createICO === 'function'){
    icoBuf = png2icons.createICO(png, png2icons.BICUBIC);
  } else if(typeof png2icons.PNG2ICO === 'function'){
    icoBuf = png2icons.PNG2ICO(png);
  }
  if(icoBuf){
    fs.writeFileSync(path.join(outDir, 'icon.ico'), icoBuf);
    console.log('已生成: build/icons/icon.ico');
  } else {
    console.log('png2icons 已安装，但未能找到生成 ico 的接口，跳过 ico。');
  }
}catch(e){
  console.log('未安装或无法使用 png2icons，跳过 icns/ico 的自动生成。');
  console.log('运行下列命令以安装依赖并生成完整图标：');
  console.log('\n  pnpm add -D png2icons\n  pnpm run make-icons\n');
}

console.log('\n完成：图标文件位于 build/icons/，请在 electron-builder 配置中指向这些文件（Windows 使用 icon.ico，mac 使用 icon.icns，Linux 使用 PNG）。');
