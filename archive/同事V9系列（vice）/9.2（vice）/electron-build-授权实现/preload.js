// preload：暴露最小化授权 API 给激活窗口
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('licenseAPI', {
  activate: (key) => ipcRenderer.invoke('license:activate', key),
  status: () => ipcRenderer.invoke('license:status'),
  confirmOpened: () => ipcRenderer.invoke('license:opened'),
  exit: () => ipcRenderer.invoke('license:exit')
});
