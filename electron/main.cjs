const { app, BrowserWindow, globalShortcut, ipcMain, clipboard } = require('electron');
const path = require('path');
const { exec } = require('child_process');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 650,
    height: 450,
    show: true, // Show on start so user knows it works
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: false, // Taskbar eke pennannam mulin
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  const startUrl = process.env.NODE_ENV === 'development' 
    ? 'http://localhost:5173' 
    : `file://${path.join(__dirname, '../dist/index.html')}`;

  mainWindow.loadURL(startUrl);

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('blur', () => {
    // Hide on blur only if not in dev mode maybe? 
    // Actually user might want it to stay until they Esc
    // mainWindow.hide(); 
  });
}


app.whenReady().then(() => {
  createWindow();

  // Global Shortcut: Alt+Space
  globalShortcut.register('Alt+Space', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Clipboard Polling (Pure JS, no compiler needed)
  let lastText = clipboard.readText();
  setInterval(() => {
    const currentText = clipboard.readText();
    if (currentText !== lastText) {
      lastText = currentText;
      mainWindow.webContents.send('clipboard-changed', currentText);
    }
  }, 500);
});

ipcMain.on('hide-window', () => {
  mainWindow.hide();
});

ipcMain.on('smart-paste', () => {
  // Use PowerShell to trigger Ctrl+V (works on Windows without native modules)
  const psScript = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')`;
  exec(`powershell.exe -Command "${psScript}"`, (error) => {
    if (error) console.error('Paste error:', error);
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
