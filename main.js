const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const axios = require('axios'); // 引入axios用于API请求

let mainWindow;

// 创建窗口
const createWindow = () => {
  // 获取屏幕尺寸
  const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize;
  
  // 计算窗口位置，在右上角
  const windowWidth = 180; // 窗口内容宽度
  const windowHeight = 140; // 窗口高度
  const windowX = screenWidth - windowWidth - 20; // 距离右边20px

  mainWindow = new BrowserWindow({
    width: windowWidth,                    // 小巧的窗口尺寸
    height: windowHeight,                  // 小巧的窗口高度
    x: windowX,                    // 固定到右侧
    y: 20,                         // 距离顶部20px
    transparent: true,             // 设置窗口透明
    frame: false,                  // 无边框窗口
    alwaysOnTop: true,             // 窗口总在最前
    resizable: false,              // 不可调整大小
    skipTaskbar: true,             // 跳过任务栏显示
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    hasShadow: false,              // 去掉阴影，更贴合桌面
    // 允许通过 webkit-app-region 在无边框窗口中拖动
    movable: true,
    minimizable: false,            // 不可最小化
    maximizable: false,            // 不可最大化
    icon: path.join(__dirname, 'icon.png') // 如果有图标文件的话
  });

  mainWindow.loadFile('index.html');
  
  // 仅在未打包（开发）环境自动打开开发者工具，便于调试
  if (!app.isPackaged) {
    try {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    } catch (e) {
      console.warn('无法打开 DevTools:', e && e.message);
    }
  }
};

// 获取金价的真实函数 — 使用新的京东接口：POST https://ms.jr.jd.com/gw/generic/hj/h5/m/latestPrice?reqData=%7B%7D
const getGoldPrice = async () => {
  try {
    const url = 'https://ms.jr.jd.com/gw/generic/hj/h5/m/latestPrice?reqData=%7B%7D';
    const response = await axios.post(url, {}, {
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json'
      }
    });

    const data = response.data;
    // 检查新的返回结构
    if (data && data.resultData && data.resultData.status === 'SUCCESS' && data.resultData.datas) {
      const d = data.resultData.datas;
      const price = Number(d.price);
      const name = d.productSku || '黄金';
      const raise = d.upAndDownAmt || '';
      const raisePercent = d.upAndDownRate || '';
      const timeMs = Number(d.time) || Date.now();
      const dateObj = new Date(timeMs);
      const dateTimeStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth()+1).padStart(2,'0')}-${String(dateObj.getDate()).padStart(2,'0')} ${String(dateObj.getHours()).padStart(2,'0')}:${String(dateObj.getMinutes()).padStart(2,'0')}:${String(dateObj.getSeconds()).padStart(2,'0')}`;

      const parsed = {
        'jd_simple_quote': {
          symbol: d.productSku || 'P005',
          raw: JSON.stringify(d),
          values: [isNaN(price) ? d.price : price, `${raise}(${raisePercent})`, name],
          date: dateTimeStr,
          name: name
        }
      };

      const updateTime = new Date().toLocaleTimeString('zh-CN', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      return { parsed, raw: JSON.stringify(d), updateTime };
    } else {
      console.error('新API返回错误:', data);
      return null;
    }
  } catch (error) {
    console.error('获取金价数据失败:', error && error.message);
    return null;
  }
};

// 定时向渲染进程发送金价数据
const sendGoldPrice = async () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    const priceData = await getGoldPrice();
    if (priceData) {
      mainWindow.webContents.send('gold-price-update', priceData);
    } else {
      // 发送空数据表示获取失败
      mainWindow.webContents.send('gold-price-update', null);
    }
  }
};

// 解析来自 hq_str_* 形式的文本（例如 `var hq_str_hf_XAU = "...";`）
// 返回一个以变量名为键的对象，值包含原始 CSV、分割后的数组、可能的日期和名称字段
function parseHqStrVars(text) {
  const re = /var\s+(hq_str_[A-Za-z0-9_]+)\s*=\s*"([^"]*)";?/g;
  const out = {};
  let m;
  while ((m = re.exec(text)) !== null) {
    const varName = m[1];
    const csv = m[2];
    const parts = csv.split(',').map((s) => {
      if (s === '') return null;
      const n = Number(s);
      return Number.isNaN(n) ? s : n;
    });

    // 更稳健地查找日期（格式 YYYY-MM-DD），然后根据日期位置提取名称
    let date = null;
    let name = null;
    const dateIndex = parts.findIndex(p => typeof p === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p));
    if (dateIndex !== -1) {
      date = parts[dateIndex];
      // 名称通常在日期之后，如果没有则尝试日期之前
      if (dateIndex + 1 < parts.length && typeof parts[dateIndex + 1] === 'string') {
        name = parts[dateIndex + 1];
      } else if (dateIndex - 1 >= 0 && typeof parts[dateIndex - 1] === 'string') {
        name = parts[dateIndex - 1];
      }
    } else {
      // 回退到以前的策略（倒数第二、最后）
      const len = parts.length;
      date = len >= 2 ? parts[len - 2] : null;
      name = len >= 1 ? parts[len - 1] : null;
    }

    out[varName] = { symbol: varName, raw: csv, values: parts, date, name };
  }
  return out;
}

// 应用准备就绪后创建窗口
app.whenReady().then(async () => {
  createWindow();
  
  // 立即获取一次数据
  await sendGoldPrice();
  
  // 启动定时器每3秒获取一次金价数据
  setInterval(sendGoldPrice, 3000);
});

// 当所有窗口关闭时退出应用（macOS除外）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// 处理渲染进程的同步请求
ipcMain.handle('get-gold-price', async () => {
  return await getGoldPrice();
});

// 调试：仅在未打包（开发）环境调用示例解析输出
if (!app.isPackaged) {
  const sample = `var hq_str_gds_AUTD = "1083.50,0,1083.00,1083.50,1093.80,1069.28,15:30:05,1085.93,1089.96,57076,6.00,1.00,2026-01-22,黄金延期";
var hq_str_hf_GC = "4836.550,,4836.000,4836.500,4841.100,4772.700,16:02:34,4837.500,4836.200,0,2,3,2026-01-22,纽约黄金,0";
var hq_str_hf_XAU = "4834.51,4831.010,4834.51,4834.86,4838.82,4772.39,16:02:00,4831.01,4832.91,0,0,0,2026-01-22,伦敦金（现货黄金）";`;

  const parsed = parseHqStrVars(sample);
  console.log('parseHqStrVars 示例输出:', parsed);
}

// IPC 回退：主进程处理手动拖动请求（用于没有 remote 的 Electron 环境）
const dragState = new WeakMap();

ipcMain.handle('manual-drag-start', (event, { screenX, screenY }) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return false;
    const pos = win.getPosition();
    dragState.set(win, { mouseX: screenX, mouseY: screenY, winX: pos[0], winY: pos[1] });
    return true;
  } catch (err) {
    console.error('manual-drag-start error', err);
    return false;
  }
});

ipcMain.handle('manual-drag-move', (event, { screenX, screenY }) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return false;
    const s = dragState.get(win);
    if (!s) return false;
    const dx = screenX - s.mouseX;
    const dy = screenY - s.mouseY;
    win.setPosition(Math.round(s.winX + dx), Math.round(s.winY + dy));
    return true;
  } catch (err) {
    console.error('manual-drag-move error', err);
    return false;
  }
});

ipcMain.handle('manual-drag-end', (event) => {
  try {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return false;
    dragState.delete(win);
    return true;
  } catch (err) {
    console.error('manual-drag-end error', err);
    return false;
  }
});