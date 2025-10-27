// Added global error handler
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  app.quit();
});

// Added path logging
const htmlPath = path.join(__dirname, '../renderer/index.html');
console.log('Attempting to load:', htmlPath);