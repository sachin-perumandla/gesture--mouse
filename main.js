const {
  app, BrowserWindow, Tray, Menu, nativeImage, globalShortcut, ipcMain,
  screen, session, systemPreferences, protocol, dialog, shell
} = require('electron');
const path = require('path');
const fs = require('fs');

// Serve the UI from app:// so ES modules, fetch() and wasm all work (file:// is unreliable for these).
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }
]);
// Keep tracking alive while the window is hidden (menu-bar mode).
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');

const RENDERER = path.join(__dirname, 'renderer');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.wasm': 'application/wasm', '.json': 'application/json', '.png': 'image/png',
  '.task': 'application/octet-stream'
};
const CURSOR_SCALE = Number(process.env.CURSOR_SCALE) || 1; // only if the cursor can't reach the screen edges

let win = null, tray = null, nut = null, quitting = false;

function loadNut() {
  try {
    nut = require('@nut-tree-fork/nut-js');
    nut.mouse.config.autoDelayMs = 0; // the default delay makes the cursor laggy
  } catch (e) {
    console.error('nut-js missing. Run ./setup.sh', e.message);
  }
}

async function ensureAccessibility() {
  if (process.platform !== 'darwin') return;
  if (systemPreferences.isTrustedAccessibilityClient(false)) return;
  systemPreferences.isTrustedAccessibilityClient(true); // adds the app to the Accessibility list
  const { response } = await dialog.showMessageBox({
    type: 'info', buttons: ['Open Settings', 'Later'], defaultId: 0,
    message: 'Accessibility access is needed',
    detail: 'Turn on Gesture Mouse (or Electron / Terminal when running with npm start) under Privacy & Security → Accessibility, then restart the app.'
  });
  if (response === 0) shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');
}

function togglePause() { if (win) win.webContents.send('control:toggle-pause'); }

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'iconTemplate.png'));
  tray = new Tray(icon);
  tray.setToolTip('Gesture Mouse');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show window', click: () => win && win.show() },
    { label: 'Pause / resume gestures', accelerator: 'CommandOrControl+Shift+G', click: togglePause },
    { type: 'separator' },
    { label: 'Quit Gesture Mouse', click: () => { quitting = true; app.quit(); } }
  ]));
}

function createWindow() {
  win = new BrowserWindow({
    width: 1100, height: 820, title: 'Gesture Mouse',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, backgroundThrottling: false }
  });
  win.loadURL('app://local/index.html');
  win.on('close', (e) => { if (!quitting) { e.preventDefault(); win.hide(); } }); // keep running in the menu bar
}

// ---- mouse control (renderer sends 0..1 screen fractions) ----
const guard = (fn) => (...a) => { if (nut) Promise.resolve(fn(...a)).catch(() => {}); };

ipcMain.on('mouse:move', guard((_e, fx, fy) => {
  const { width, height } = screen.getPrimaryDisplay().bounds;
  return nut.mouse.setPosition(new nut.Point(
    Math.round(fx * (width - 1) * CURSOR_SCALE), Math.round(fy * (height - 1) * CURSOR_SCALE)));
}));
ipcMain.on('mouse:click',      guard(() => nut.mouse.click(nut.Button.LEFT)));
ipcMain.on('mouse:rightClick', guard(() => nut.mouse.click(nut.Button.RIGHT)));
ipcMain.on('mouse:down',       guard(() => nut.mouse.pressButton(nut.Button.LEFT)));
ipcMain.on('mouse:up',         guard(() => nut.mouse.releaseButton(nut.Button.LEFT)));
ipcMain.on('mouse:scroll',     guard((_e, dy) => {
  if (!dy) return;
  return dy > 0 ? nut.mouse.scrollDown(dy) : nut.mouse.scrollUp(-dy);
}));

app.whenReady().then(async () => {
  protocol.handle('app', async (req) => {
    const rel = decodeURIComponent(new URL(req.url).pathname);
    const file = path.normalize(path.join(RENDERER, rel === '/' ? 'index.html' : rel));
    if (!file.startsWith(RENDERER)) return new Response('forbidden', { status: 403 });
    try {
      const buf = await fs.promises.readFile(file);
      return new Response(buf, { headers: { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' } });
    } catch { return new Response('not found', { status: 404 }); }
  });

  session.defaultSession.setPermissionRequestHandler((_wc, perm, cb) => cb(perm === 'media'));
  session.defaultSession.setPermissionCheckHandler((_wc, perm) => perm === 'media');

  loadNut();
  if (process.platform === 'darwin') await systemPreferences.askForMediaAccess('camera');
  createWindow();
  createTray();
  globalShortcut.register('CommandOrControl+Shift+G', togglePause); // kill switch if the cursor misbehaves
  ensureAccessibility();
});

app.on('activate', () => win && win.show());
app.on('before-quit', () => { quitting = true; });
app.on('will-quit', () => globalShortcut.unregisterAll());
