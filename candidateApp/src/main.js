const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  app.quit();
});

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  const htmlPath = path.join(__dirname, 'renderer/index.html');
console.log('[DEBUG] HTML Path Verification:', htmlPath);
try {
  if (!fs.existsSync(htmlPath)) {
    throw new Error('HTML file does not exist at specified path');
  }
  console.log('[SUCCESS] HTML file verified');
  
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Window content loaded successfully');
    mainWindow.show();
  });
  
  console.log('Initiating file load sequence');
  mainWindow.loadFile(htmlPath);
} catch (error) {
  console.error('FATAL INIT ERROR:', error);
  app.quit();
}

mainWindow.loadFile(htmlPath).catch(err => {
    console.error('Failed to load HTML:', err);
    app.quit();
  });

  // Open dev tools initially for debugging
  mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});