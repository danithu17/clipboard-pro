const { app, BrowserWindow, globalShortcut, ipcMain, clipboard, Tray, Menu } = require('electron');
const path = require('path');
const { exec } = require('child_process');

let mainWindow;
let tray;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 650,
    height: 600, // Increased height for more results
    show: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: false,
    movable: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  const startUrl = process.env.NODE_ENV === 'development' 
    ? 'http://localhost:5173' 
    : `file://${path.join(__dirname, '../dist/index.html')}`;

  mainWindow.loadURL(startUrl);

  mainWindow.on('blur', () => {
    // We keep it open so user can copy/paste easily, 
    // but we can hide it via Esc or manual button
  });
}

function createTray() {
  // Simple tray icon (using a placeholder if no icon exists)
  tray = new Tray(electronClipboard.readImage()); // Temporary trick to create a tray if no icon
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show AI Clipboard', click: () => mainWindow.show() },
    { type: 'separator' },
    { label: 'Exit', click: () => app.quit() }
  ]);
  tray.setToolTip('AI Smart Clipboard');
  tray.setContextMenu(contextMenu);
  
  tray.on('click', () => {
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
  });
}

app.whenReady().then(() => {
  createWindow();
  // createTray(); // Enable if you have an icon file

  globalShortcut.register('Alt+Space', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Clipboard Polling
  let lastText = clipboard.readText();
  setInterval(() => {
    const currentText = clipboard.readText();
    if (currentText && currentText !== lastText) {
      lastText = currentText;
      if (mainWindow) mainWindow.webContents.send('clipboard-changed', currentText);
    }
  }, 1000);
});

ipcMain.on('hide-window', () => {
  mainWindow.hide();
});

ipcMain.on('smart-paste', () => {
  // Hide window first to return focus to the previous app
  mainWindow.hide();
  
  // Wait a bit for the previous window to regain focus
  setTimeout(() => {
    const psScript = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')`;
    exec(`powershell.exe -Command "${psScript}"`, (error) => {
      if (error) console.error('Paste error:', error);
    });
  }, 300);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

