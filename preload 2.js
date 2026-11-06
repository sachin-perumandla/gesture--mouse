const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('mouseAPI', {
  move:       (x, y) => ipcRenderer.send('mouse:move', x, y),
  click:      () => ipcRenderer.send('mouse:click'),
  rightClick: () => ipcRenderer.send('mouse:rightClick'),
  down:       () => ipcRenderer.send('mouse:down'),
  up:         () => ipcRenderer.send('mouse:up'),
  scroll:     (dy) => ipcRenderer.send('mouse:scroll', dy),
  onTogglePause: (cb) => ipcRenderer.on('control:toggle-pause', () => cb())
});
