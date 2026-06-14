const { app, BrowserWindow, ipcMain, dialog, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { io } = require('socket.io-client');
const NetworkDiscovery = require('../../shared-lib/utils/network-discovery');

let mainWindow;
let networkDiscovery;
let securityLog = [];
let serverInfo;
let socket;
let isExamActive = false;
let autoSaveInterval;

function createWindow() {
    // Get primary display size for fullscreen
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    mainWindow = new BrowserWindow({
        width: width,
        height: height,
        x: 0,
        y: 0,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: true,
            allowRunningInsecureContent: false,
            enableRemoteModule: false,
            nodeIntegrationInWorker: false,
            nodeIntegrationInSubFrames: false,
            spellcheck: false,
            enableWebSQL: false,
            v8CacheOptions: 'code'
        },
        icon: path.join(__dirname, '../../assets/icon.png'),
        title: 'Army Exam Candidate - Secure Browser',
        fullscreen: true,
        kiosk: true,
        resizable: false,
        minimizable: false,
        maximizable: false,
        closable: false,
        alwaysOnTop: true,
        backgroundColor: '#1a202c',
        show: false,
        titleBarStyle: 'hidden',
        frame: false
    });

    // Enhanced security measures
    mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
        const allowedUrls = ['exam-page.html', 'index.html', 'loading.html', 'result-page.html', 'test-result.html'];
        const isAllowed = allowedUrls.some(url => navigationUrl.endsWith(url));
        
        if (!isAllowed) {
            console.warn('Blocked navigation attempt:', navigationUrl);
            event.preventDefault();
            logSecurityEvent({
                type: 'NAVIGATION_BLOCKED',
                details: `Attempted navigation to: ${navigationUrl}`,
                severity: 'HIGH'
            });
        }
    });

    mainWindow.webContents.setWindowOpenHandler(() => {
        logSecurityEvent({
            type: 'WINDOW_CREATION_BLOCKED',
            details: 'Attempt to create new window blocked',
            severity: 'HIGH'
        });
        return { action: 'deny' };
    });

    // Prevent new window creation
    mainWindow.webContents.on('new-window', (event, navigationUrl) => {
        console.warn('New window creation blocked:', navigationUrl);
        event.preventDefault();
    });

    // Load the initial login page
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

    // Enhanced CSP headers
    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [
                    "default-src 'self'; " +
                    "script-src 'self' 'unsafe-inline'; " +
                    "style-src 'self' 'unsafe-inline'; " +
                    "img-src 'self' data:; " +
                    "connect-src 'self' ws: wss: http: https:; " +
                    "font-src 'self'; " +
                    "object-src 'none'; " +
                    "media-src 'self'; " +
                    "frame-src 'none'"
                ]
            }
        });
    });

    // Development mode only - disable in production
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }

    // Show window when ready to prevent flash
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        mainWindow.focus();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
        cleanupResources();
    });

    // Enhanced keyboard shortcut blocking
    mainWindow.webContents.on('before-input-event', (event, input) => {
        const blockedShortcuts = [
            'F1', 'F3', 'F4', 'F5', 'F7', 'F11', 'F12', 
            'Ctrl+R', 'Ctrl+Shift+R', 'Ctrl+Shift+I', 'Ctrl+Shift+C',
            'Ctrl+U', 'Alt+Tab', 'Ctrl+Tab', 'Alt+F4', 'Ctrl+W',
            'Ctrl+N', 'Ctrl+T', 'Ctrl+Shift+N', 'Ctrl+H',
            'Alt+Left', 'Alt+Right', 'Alt+D', 'Ctrl+L'
        ];

        const isBlocked = blockedShortcuts.includes(input.key) || 
                         (input.control && input.shift && ['I', 'C', 'J'].includes(input.key)) ||
                         (input.alt && input.key === 'F4');

        if (isBlocked) {
            event.preventDefault();
            logSecurityEvent({
                type: 'KEYBOARD_SHORTCUT_BLOCKED',
                details: `Blocked shortcut: ${input.key} (ctrl: ${input.control}, shift: ${input.shift}, alt: ${input.alt})`,
                severity: 'MEDIUM'
            });
        }
    });

    // Prevent drag and drop
    mainWindow.webContents.on('will-attach-webview', (event) => {
        event.preventDefault();
    });

    // Create necessary directories
    createDirectories();
}

function createDirectories() {
    const directories = [
        path.join(__dirname, '../security_logs'),
        path.join(__dirname, '../auto_save'),
        path.join(__dirname, '../recovery_data')
    ];

    directories.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });
}

function cleanupResources() {
    // Clear auto-save interval
    if (autoSaveInterval) {
        clearInterval(autoSaveInterval);
        autoSaveInterval = null;
    }

    // Disconnect socket
    if (socket) {
        socket.disconnect();
        socket = null;
    }

    // Stop network discovery
    if (networkDiscovery) {
        networkDiscovery.stopBroadcasting();
        networkDiscovery = null;
    }

    isExamActive = false;
}

function logSecurityEvent(securityEvent) {
    securityEvent.timestamp = new Date().toISOString();
    securityEvent.sessionId = mainWindow ? mainWindow.webContents.id : 'unknown';
    securityLog.push(securityEvent);
    
    // Log to file for invigilator review
    try {
        const logDir = path.join(__dirname, '../security_logs/');
        const logPath = path.join(logDir, `security_${Date.now()}.json`);
        fs.writeFileSync(logPath, JSON.stringify(securityEvent, null, 2));
        
        // Also append to main security log
        const mainLogPath = path.join(logDir, 'security_main.log');
        fs.appendFileSync(mainLogPath, JSON.stringify(securityEvent) + '\n');
    } catch (error) {
        console.error('Failed to write security log:', error);
    }
    
    return { success: true };
}

// Enhanced IPC Handlers for Phase 3
ipcMain.handle('discover-servers', async () => {
    try {
        console.log('Starting server discovery...');
        networkDiscovery = new NetworkDiscovery();
        const server = await networkDiscovery.discoverServer(10000); // 10 second timeout
        
        if (server) {
            serverInfo = server;
            console.log('Server discovered:', server);
            
            // Test server connection
            try {
                const healthResponse = await fetch(`http://${server.ip}:${server.port}/api/health`);
                if (healthResponse.ok) {
                    const healthData = await healthResponse.json();
                    console.log('Server health check passed:', healthData);
                }
            } catch (healthError) {
                console.warn('Server health check failed:', healthError.message);
            }
            
            return { success: true, server };
        } else {
            return { success: false, error: 'No exam servers found on the network' };
        }
    } catch (error) {
        console.error('Server discovery failed:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('candidate-login', async (event, loginData) => {
    try {
        console.log('Candidate login attempt:', loginData.armyNumber);
        
        if (!loginData.armyNumber || !loginData.serverInfo) {
            return { 
                success: false, 
                error: 'Invalid login data. Army number and server information are required.' 
            };
        }

        // Validate army number format (support both old and new formats)
        const oldPattern = /^[A-Z]{2}\d{6}[A-Z]?$/;
        const newPattern = /^\d+[A-Z]$/;
        const isValid = oldPattern.test(loginData.armyNumber) || newPattern.test(loginData.armyNumber);
        
        if (!isValid) {
            return { 
                success: false, 
                error: 'Invalid Army Number format. Expected format: JC543031A or 145699Z' 
            };
        }

        // Make API call to server for validation
        const response = await fetch(`http://${loginData.serverInfo.ip}:${loginData.serverInfo.port}/api/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                armyNumber: loginData.armyNumber,
                password: '' // No password required for candidates
            }),
            timeout: 10000 // 10 second timeout
        });
        
        if (!response.ok) {
            throw new Error(`Server responded with status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success && result.role === 'candidate') {
            console.log('Candidate login successful:', result.candidate.name);
            
            // Establish WebSocket connection after successful login
            await setupWebSocketConnection(loginData.serverInfo, result.candidate);
            
            // Log successful login
            logSecurityEvent({
                type: 'CANDIDATE_LOGIN_SUCCESS',
                details: `Candidate ${result.candidate.name} (${loginData.armyNumber}) logged in successfully`,
                severity: 'INFO',
                candidate: result.candidate
            });
            
            return result;
        } else {
            console.log('Login failed:', result.error);
            
            logSecurityEvent({
                type: 'CANDIDATE_LOGIN_FAILED',
                details: `Failed login attempt for army number: ${loginData.armyNumber}`,
                severity: 'MEDIUM',
                error: result.error
            });
            
            return result;
        }
    } catch (error) {
        console.error('Login error:', error);
        
        logSecurityEvent({
            type: 'LOGIN_ERROR',
            details: `Error during login process: ${error.message}`,
            severity: 'HIGH',
            error: error.message
        });
        
        return { 
            success: false, 
            error: `Login failed: ${error.message}` 
        };
    }
});

async function setupWebSocketConnection(serverInfo, candidate) {
    try {
        // Disconnect existing socket if any
        if (socket) {
            socket.disconnect();
        }

        const socketUrl = `http://${serverInfo.ip}:${serverInfo.port}`;
        console.log('Connecting to WebSocket:', socketUrl);
        
        socket = io(socketUrl, {
            timeout: 10000,
            reconnectionAttempts: 3,
            reconnectionDelay: 1000
        });

        socket.on('connect', () => {
            console.log('Connected to server via WebSocket');
            
            socket.emit('candidate-join', { 
                candidateId: candidate.armyNumber,
                candidateData: candidate 
            });

            logSecurityEvent({
                type: 'WEBSOCKET_CONNECTED',
                details: 'Successfully connected to exam server via WebSocket',
                severity: 'INFO'
            });
        });

        socket.on('exam-start', (examData) => {
            console.log('Exam start event received from server');
            isExamActive = true;
            
            // Start auto-save functionality
            startAutoSave();
            
            mainWindow.webContents.send('exam-start', examData);
            
            logSecurityEvent({
                type: 'EXAM_STARTED',
                details: 'Exam started remotely by invigilator',
                severity: 'INFO',
                examData: {
                    questionCount: examData.questions?.length,
                    duration: examData.duration
                }
            });
        });

        socket.on('exam-data', (examData) => {
            console.log('Exam data received via WebSocket');
            mainWindow.webContents.send('exam-data', examData);
        });

        socket.on('exam-stopped', (data) => {
            console.log('Exam stopped event received');
            isExamActive = false;
            cleanupResources();
            
            mainWindow.webContents.send('exam-stopped', data);
            
            logSecurityEvent({
                type: 'EXAM_STOPPED',
                details: 'Exam stopped remotely by invigilator',
                severity: 'INFO'
            });
        });

        socket.on('disconnect', (reason) => {
            console.log('Disconnected from server WebSocket:', reason);
            isExamActive = false;
            
            logSecurityEvent({
                type: 'WEBSOCKET_DISCONNECTED',
                details: `Disconnected from server: ${reason}`,
                severity: 'HIGH'
            });
            
            // Notify renderer
            mainWindow.webContents.send('server-disconnected', { reason });
        });

        socket.on('connect_error', (error) => {
            console.error('WebSocket connection error:', error);
            
            logSecurityEvent({
                type: 'WEBSOCKET_CONNECTION_ERROR',
                details: `Failed to connect to server: ${error.message}`,
                severity: 'HIGH'
            });
        });

    } catch (error) {
        console.error('WebSocket setup failed:', error);
        throw error;
    }
}

function startAutoSave() {
    // Clear existing interval
    if (autoSaveInterval) {
        clearInterval(autoSaveInterval);
    }

    // Auto-save every 30 seconds
    autoSaveInterval = setInterval(() => {
        if (mainWindow && isExamActive) {
            mainWindow.webContents.send('request-auto-save');
        }
    }, 30000);
}

ipcMain.handle('submit-answer', async (event, { candidateId, questionId, answer, timestamp }) => {
    try {
        if (!socket || !socket.connected) {
            return { success: false, error: 'Not connected to exam server' };
        }

        socket.emit('answer-submit', {
            candidateId: candidateId,
            questionId: questionId,
            answer: answer,
            timestamp: timestamp || new Date()
        });

        return { success: true };
    } catch (error) {
        console.error('Error submitting answer:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('submit-exam', async (event, { examData, serverInfo: clientServerInfo }) => {
    try {
        console.log('Submitting exam data...');
        
        if (!clientServerInfo) {
            return { success: false, error: 'Server information is not available' };
        }

        // Ensure we have the required data
        if (!examData || !examData.armyNumber) {
            return { success: false, error: 'Missing exam data or army number for submission' };
        }

        if (!examData.answers || !Array.isArray(examData.answers)) {
            return { success: false, error: 'Missing or invalid answers data for submission' };
        }

        const response = await fetch(`http://${clientServerInfo.ip}:${clientServerInfo.port}/api/submit-exam`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(examData),
            timeout: 15000 // 15 second timeout for submission
        });

        if (!response.ok) {
            throw new Error(`Server responded with status: ${response.status}`);
        }

        const result = await response.json();
        
        if (result.success) {
            console.log('Exam submitted successfully');
            isExamActive = false;
            cleanupResources();
            
            logSecurityEvent({
                type: 'EXAM_SUBMITTED',
                details: `Exam submitted successfully for ${examData.armyNumber}`,
                severity: 'INFO',
                answersCount: examData.answers ? examData.answers.length : 0
            });
        }
        
        return result;
    } catch (error) {
        console.error('Exam submission error:', error);
        
        logSecurityEvent({
            type: 'EXAM_SUBMISSION_ERROR',
            details: `Failed to submit exam: ${error.message}`,
            severity: 'HIGH'
        });
        
        return { success: false, error: `Submission failed: ${error.message}` };
    }
});

ipcMain.handle('log-security-event', (event, securityEvent) => {
    return logSecurityEvent(securityEvent);
});

ipcMain.handle('auto-save-answers', (event, answers) => {
    try {
        const saveDir = path.join(__dirname, '../auto_save/');
        const savePath = path.join(saveDir, `autosave_${Date.now()}.json`);
        
        const saveData = {
            answers: answers,
            timestamp: new Date().toISOString(),
            candidate: answers.candidateId || 'unknown'
        };
        
        fs.writeFileSync(savePath, JSON.stringify(saveData, null, 2));
        
        // Keep only last 10 auto-save files
        const files = fs.readdirSync(saveDir)
            .filter(f => f.startsWith('autosave_'))
            .sort()
            .reverse();
            
        if (files.length > 10) {
            files.slice(10).forEach(file => {
                fs.unlinkSync(path.join(saveDir, file));
            });
        }
        
        return { success: true };
    } catch (error) {
        console.error('Auto-save error:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('get-security-status', () => {
    return {
        isExamActive: isExamActive,
        isConnected: socket ? socket.connected : false,
        securityEventsCount: securityLog.length,
        serverInfo: serverInfo
    };
});

ipcMain.on('close-app', () => {
    console.log('Closing application by user request');
    
    // Enable closing for successful submission
    if (mainWindow) {
        mainWindow.setClosable(true);
        mainWindow.setKiosk(false);
        mainWindow.setFullScreen(false);
    }
    
    cleanupResources();
    
    // Force quit the application
    setTimeout(() => {
        app.exit(0);
    }, 1000);
});

ipcMain.on('emergency-exit', () => {
    console.log('Emergency exit requested');
    
    logSecurityEvent({
        type: 'EMERGENCY_EXIT',
        details: 'Application closed via emergency exit',
        severity: 'HIGH'
    });
    
    cleanupResources();
    app.exit(0);
});

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    console.log('Another instance is running - quitting');
    app.quit();
} else {
    app.on('second-instance', () => {
        console.log('Second instance attempted - focusing existing window');
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
            
            logSecurityEvent({
                type: 'MULTIPLE_INSTANCE_BLOCKED',
                details: 'Attempt to start second instance blocked',
                severity: 'HIGH'
            });
        }
    });
}

// Optimize Electron for faster startup
app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('no-sandbox');

// Application event handlers
app.whenReady().then(() => {
    console.log('Candidate application starting...');
    createWindow();
});

app.on('window-all-closed', () => {
    console.log('All windows closed - application quitting');
    cleanupResources();
    
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

app.on('before-quit', (event) => {
    console.log('Application quitting initiated');
    
    if (isExamActive) {
        // Prevent quitting during active exam without confirmation
        event.preventDefault();
        
        dialog.showMessageBox(mainWindow, {
            type: 'warning',
            title: 'Exam in Progress',
            message: 'An exam is currently in progress. Are you sure you want to quit?',
            detail: 'Quitting during an exam may result in lost work and security violations.',
            buttons: ['Cancel', 'Quit Anyway'],
            defaultId: 0,
            cancelId: 0
        }).then((result) => {
            if (result.response === 1) {
                logSecurityEvent({
                    type: 'FORCED_QUIT_DURING_EXAM',
                    details: 'User forced quit during active exam',
                    severity: 'CRITICAL'
                });
                cleanupResources();
                app.exit(0);
            }
        });
    }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    
    logSecurityEvent({
        type: 'UNCAUGHT_EXCEPTION',
        details: `Application crash: ${error.message}`,
        severity: 'CRITICAL',
        stack: error.stack
    });
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    
    logSecurityEvent({
        type: 'UNHANDLED_REJECTION',
        details: `Unhandled promise rejection: ${reason}`,
        severity: 'HIGH'
    });
});

console.log('Candidate main process initialized');