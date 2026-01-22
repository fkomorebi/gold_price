const { ipcRenderer, shell, remote } = require('electron');

// 更新金价数据显示
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function updateGoldDisplay(priceData) {
  const container = document.getElementById('gold-data-container');
  const timeDiv = document.getElementById('update-time');

  if (!priceData) {
    container.innerHTML = '<div class="loading">获取失败</div>';
    timeDiv.textContent = '';
    return;
  }

  // 如果主进程返回了解析后的 hq_str_* 对象，优先渲染它
  if (priceData.parsed && typeof priceData.parsed === 'object') {
    const parsed = priceData.parsed;
    let goldHtml = '';
    for (const key of Object.keys(parsed)) {
      const item = parsed[key];
      const name = item.name || item.symbol || key;
      // 从 values 中挑选第一个数字作为显示价格，回退到第一个非空值
      let displayPrice = '-';
      if (Array.isArray(item.values)) {
        for (const v of item.values) {
          if (typeof v === 'number') { displayPrice = v; break; }
        }
        if (displayPrice === '-' && item.values.length > 0) {
          const v = item.values.find(x => x != null);
          displayPrice = v != null ? v : '-';
        }
      }

      goldHtml += `
        <div class="gold-item">
          <span class="gold-name">${escapeHtml(name)}</span>
          <span class="gold-price">${escapeHtml(displayPrice)}</span>
        </div>
      `;
    }

    container.innerHTML = goldHtml || '<div class="loading">无可显示数据</div>';
    timeDiv.textContent = priceData.updateTime || '';
    return;
  }

  // 回退：兼容旧数据结构（如果存在）
  let goldHtml = '';

  try {
    if (priceData.bankGoldBar && priceData.bankGoldBar.length > 0) {
      const firstBank = priceData.bankGoldBar[0];
      goldHtml += `
        <div class="gold-item">
          <span class="gold-name">${escapeHtml((firstBank.bank || '').substring(0,4))}</span>
          <span class="gold-price">¥${escapeHtml(firstBank.price)}</span>
        </div>
      `;
    }

    if (priceData.preciousMetal && priceData.preciousMetal.length > 0) {
      const firstBrand = priceData.preciousMetal[0];
      if (firstBrand.bullion_price && firstBrand.bullion_price !== "-") {
        goldHtml += `
          <div class="gold-item">
            <span class="gold-name">${escapeHtml(firstBrand.brand)}</span>
            <span class="gold-price">¥${escapeHtml(firstBrand.bullion_price)}</span>
          </div>
        `;
      }
    }

    if (priceData.goldRecycle && priceData.goldRecycle.length > 0) {
      const firstRecycle = priceData.goldRecycle[0];
      goldHtml += `
        <div class="gold-item">
          <span class="gold-name">回收</span>
          <span class="gold-price">¥${escapeHtml(firstRecycle.recycle_price)}</span>
        </div>
      `;
    }
  } catch (e) {
    // 忽略渲染错误，显示原始文本
    goldHtml = `<div class="loading">渲染数据错误</div>`;
  }

  container.innerHTML = goldHtml || '<div class="loading">无可显示数据</div>';
  timeDiv.textContent = priceData.updateTime || '';
}

// 监听主进程发送的金价数据更新
ipcRenderer.on('gold-price-update', (event, priceData) => {
  updateGoldDisplay(priceData);
});

// 防止在可拖动的展示区选中文本：在非交互区的 mousedown 时临时禁用选择，mouseup 时恢复
(function enableDragSelectionFix() {
  let previousUserSelect = '';

  function disableSelection() {
    try {
      previousUserSelect = document.body.style.userSelect || '';
      document.body.style.userSelect = 'none';
      document.body.style.webkitUserSelect = 'none';
    } catch (e) {}
  }

  function restoreSelection() {
    try {
      document.body.style.userSelect = previousUserSelect || '';
      document.body.style.webkitUserSelect = '';
    } catch (e) {}
  }

  // 在非交互区（没有 .no-drag 的祖先）进行处理
  function isInteractive(el) {
    return el && el.closest && el.closest('.no-drag');
  }

  document.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return; // 仅响应左键
    if (isInteractive(e.target)) return;
    disableSelection();
  }, true);

  document.addEventListener('mouseup', () => {
    restoreSelection();
  }, true);

  // 阻止 selectstart 与 dragstart 在非交互区触发选中或拖动图片等
  document.addEventListener('selectstart', (e) => {
    if (!isInteractive(e.target)) e.preventDefault();
  }, true);

  document.addEventListener('dragstart', (e) => {
    if (!isInteractive(e.target)) e.preventDefault();
  }, true);

  // 触控设备支持
  document.addEventListener('touchstart', (e) => {
    const el = e.target;
    if (isInteractive(el)) return;
    disableSelection();
  }, { passive: true });

  document.addEventListener('touchend', () => {
    restoreSelection();
  });
})();

// 后备：如果 CSS 的 -webkit-app-region 在当前平台不工作，使用手动拖动窗口的方式
;(function enableManualWindowDragFallback() {
  const { remote: remoteModule, ipcRenderer } = require('electron');
  let currentWindow = null;
  try {
    currentWindow = remoteModule && remoteModule.getCurrentWindow && remoteModule.getCurrentWindow();
  } catch (e) {
    currentWindow = null;
  }

  let dragging = false;
  let startMouse = { x: 0, y: 0 };
  let startWin = { x: 0, y: 0 };

  function isInteractive(el) {
    return el && el.closest && el.closest('.no-drag');
  }

  function useRemote() {
    return !!(currentWindow && typeof currentWindow.setPosition === 'function');
  }

  function onMouseMoveRemote(e) {
    if (!dragging) return;
    try {
      const dx = e.screenX - startMouse.x;
      const dy = e.screenY - startMouse.y;
      currentWindow.setPosition(Math.round(startWin.x + dx), Math.round(startWin.y + dy));
    } catch (err) {
      console.error('remote setPosition error', err);
    }
  }

  function onMouseUpRemote() {
    if (!dragging) return;
    dragging = false;
    window.removeEventListener('mousemove', onMouseMoveRemote, true);
    window.removeEventListener('mouseup', onMouseUpRemote, true);
  }

  function onMouseMoveIpc(e) {
    if (!dragging) return;
    ipcRenderer.invoke('manual-drag-move', { screenX: e.screenX, screenY: e.screenY }).catch(() => {});
  }

  function onMouseUpIpc() {
    if (!dragging) return;
    dragging = false;
    window.removeEventListener('mousemove', onMouseMoveIpc, true);
    window.removeEventListener('mouseup', onMouseUpIpc, true);
    ipcRenderer.invoke('manual-drag-end').catch(() => {});
  }

  document.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return; // 仅左键
    if (isInteractive(e.target)) return;
    dragging = true;
    startMouse = { x: e.screenX, y: e.screenY };

    if (useRemote()) {
      try {
        const pos = currentWindow.getPosition();
        startWin = { x: pos[0], y: pos[1] };
        window.addEventListener('mousemove', onMouseMoveRemote, true);
        window.addEventListener('mouseup', onMouseUpRemote, true);
        console.debug('manual drag using remote started', startMouse, startWin);
      } catch (err) {
        dragging = false;
        console.error('failed to start remote drag', err);
      }
    } else {
      // 使用 IPC 回退到主进程移动窗口
      ipcRenderer.invoke('manual-drag-start', { screenX: e.screenX, screenY: e.screenY }).catch(() => {});
      window.addEventListener('mousemove', onMouseMoveIpc, true);
      window.addEventListener('mouseup', onMouseUpIpc, true);
      console.debug('manual drag using ipc started', startMouse);
    }
  }, true);
})();

// 添加右键菜单功能
const { Menu, MenuItem } = remote;

// 创建上下文菜单
const contextMenu = new Menu();
contextMenu.append(new MenuItem({
  label: '退出',
  click: () => {
    remote.app.quit();
  }
}));

// 显示上下文菜单
document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  contextMenu.popup({ x: e.x, y: e.y });
});

// 确保渲染端也有一致的 no-drag 定义（header 在 HTML/CSS 中负责拖动）
const style = document.createElement('style');
style.textContent = `
  .no-drag, a, button, input, textarea { -webkit-app-region: no-drag; }
`;
document.head.appendChild(style);

// 点击链接时在外部浏览器打开
document.addEventListener('click', (e) => {
  if (e.target.tagName === 'A') {
    e.preventDefault();
    shell.openExternal(e.target.href);
  }
});

// 防止拖拽操作
document.addEventListener('dragstart', (e) => {
  e.preventDefault();
});