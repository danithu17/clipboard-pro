const { app, BrowserWindow, globalShortcut, ipcMain, clipboard, Tray, Menu } = require('electron');
const path = require('path');
const { exec } = require('child_process');

let mainWindow;
let tray;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 700,
    x: 1520, // Position on the right like Win+V
    y: 100,
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
}

function createTray() {
  // Simple tray icon placeholder
  tray = new Tray(clipboard.readImage()); 
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open AI Clipboard', click: () => { mainWindow.show(); mainWindow.focus(); } },
    { type: 'separator' },
    { label: 'Exit', click: () => app.quit() }
  ]);
  tray.setToolTip('AI Smart Clipboard');
  tray.setContextMenu(contextMenu);
}

app.whenReady().then(() => {
  createWindow();

  globalShortcut.register('Alt+Space', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Clipboard Polling for Text, Images, and Files
  let lastText = clipboard.readText();
  let lastImage = '';
  
  setInterval(() => {
    // Check for Text
    const currentText = clipboard.readText();
    if (currentText && currentText !== lastText) {
      lastText = currentText;
      mainWindow.webContents.send('clipboard-changed', { type: 'text', content: currentText });
    }

    // Check for Image
    const img = clipboard.readImage();
    if (!img.isEmpty()) {
      const currentImage = img.toDataURL();
      if (currentImage !== lastImage) {
        lastImage = currentImage;
        mainWindow.webContents.send('clipboard-changed', { type: 'image', content: currentImage });
      }
    }
  }, 1000);
});

ipcMain.on('hide-window', () => {
  mainWindow.hide();
});

ipcMain.on('smart-paste', () => {
  mainWindow.hide();
  setTimeout(() => {
    const psScript = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')`;
    exec(`powershell.exe -Command "${psScript}"`, (error) => {
      if (error) console.error('Paste error:', error);
    });
  }, 300);
});

ipcMain.on('copy-to-clipboard', (_event, { type, content }) => {
  if (type === 'text') {
    clipboard.writeText(content);
  } else if (type === 'image') {
    const nativeImg = require('electron').nativeImage.createFromDataURL(content);
    clipboard.writeImage(nativeImg);
  }
});


app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

