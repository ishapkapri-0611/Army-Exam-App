// ... existing code ...

// Only register if handler doesn't exist
if (!ipcMain.listenerCount('upload-users-file')) {
    ipcMain.handle('upload-users-file', async () => {
        try {
            logger.info('Users file upload requested');
            // ... rest of handler code ...
        } catch (error) {
            // ... error handling ...
        }
    });
}

// ... existing code ...