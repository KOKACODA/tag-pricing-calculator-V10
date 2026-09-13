const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const license = require('./license');

let mainWin = null;
let actWin = null;

function createMainWindow() {
  mainWin = new BrowserWindow({
    width: 1280,
    height: 860,
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false }
  });
  mainWin.loadFile(path.join(__dirname, 'app', 'index.html'));
  mainWin.on('closed', () => { mainWin = null; });
}

function createActivationWindow() {
  actWin = new BrowserWindow({
    width: 540,
    height: 620,
    resizable: false,
    autoHideMenuBar: true,
    title: 'KOKALabel 报价系统 - 产品激活',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  actWin.loadFile(path.join(__dirname, 'activation.html'));
  actWin.setMenuBarVisibility(false);
  actWin.on('closed', () => { actWin = null; });
}

function boot() {
  // 授权总开关：enabled=false（后端未就绪阶段）跳过授权，直接进主界面
  if (!license.isEnabled()) {
    createMainWindow();
    return;
  }
  const st = license.checkStatus();
  if (st.status === 'active') {
    createMainWindow();
  } else {
    createActivationWindow();
  }
}

app.whenReady().then(() => {
  ipcMain.handle('license:status', () => {
    const st = license.checkStatus();
    return { status: st.status, expiresAt: st.expiresAt || null, customer: st.customer || null, reason: st.reason || null };
  });
  ipcMain.handle('license:activate', async (e, key) => license.activateKey(key));
  ipcMain.handle('license:opened', () => {
    // 激活成功：关激活窗，开主窗
    if (actWin) { actWin.close(); actWin = null; }
    createMainWindow();
    return true;
  });
  ipcMain.handle('license:exit', () => app.quit());

  boot();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) boot();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
