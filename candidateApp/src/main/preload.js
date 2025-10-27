const { contextBridge, ipcRenderer } = require('electron');

// Security: Validate IPC channels
const validChannels = {
    invoke: [
        'discover-servers',
        'candidate-login', 
        'submit-exam',
        'submit-answer',
        'auto-save-answers',
        'log-security-event',
        'get-app-version',
        'get-questions',
        'get-security-status',
        'request-auto-save'
    ],
    on: [
        'exam-start',
        'exam-data',
        'exam-stopped', 
        'server-disconnected',
        'request-auto-save'
    ],
    send: [
        'close-app',
        'emergency-exit'
    ]
};

// Security: Create safe handlers
const createSafeInvoke = (channel) => {
    return (...args) => {
        if (validChannels.invoke.includes(channel)) {
            return ipcRenderer.invoke(channel, ...args);
        }
        throw new Error(`Invalid IPC channel: ${channel}`);
    };
};

const createSafeOn = (channel) => {
    return (callback) => {
        if (validChannels.on.includes(channel)) {
            return ipcRenderer.on(channel, (event, ...args) => callback(...args));
        }
        throw new Error(`Invalid IPC channel: ${channel}`);
    };
};

const createSafeSend = (channel) => {
    return (...args) => {
        if (validChannels.send.includes(channel)) {
            return ipcRenderer.send(channel, ...args);
        }
        throw new Error(`Invalid IPC channel: ${channel}`);
    };
};

// Enhanced logging function
const createLogger = (context) => {
    return {
        info: (message, data) => {
            console.log(`[${context}] ${message}`, data || '');
        },
        warn: (message, data) => {
            console.warn(`[${context}] ${message}`, data || '');
        },
        error: (message, error) => {
            console.error(`[${context}] ${message}`, error || '');
            // Auto-log errors as security events
            if (error) {
                safeLogSecurityEvent({
                    type: 'RENDERER_ERROR',
                    details: `${context}: ${message}`,
                    severity: 'MEDIUM',
                    error: error.message || String(error)
                });
            }
        }
    };
};

// Safe security event logging with validation
const safeLogSecurityEvent = (event) => {
    const validEventTypes = [
        'NAVIGATION_ATTEMPT',
        'KEYBOARD_SHORTCUT',
        'WINDOW_FOCUS_CHANGE',
        'NETWORK_STATUS_CHANGE',
        'EXAM_ACTIVITY',
        'RENDERER_ERROR',
        'AUTO_SAVE',
        'ANSWER_SUBMISSION',
        'SESSION_TIMEOUT'
    ];

    const validSeverities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'INFO'];

    // Validate event structure
    if (!event || typeof event !== 'object') {
        console.error('Invalid security event: must be an object');
        return;
    }

    if (!event.type || !validEventTypes.includes(event.type)) {
        console.error('Invalid security event type:', event.type);
        return;
    }

    if (!event.severity || !validSeverities.includes(event.severity)) {
        console.error('Invalid security event severity:', event.severity);
        return;
    }

    // Add timestamp and context
    const enhancedEvent = {
        ...event,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
    };

    try {
        return ipcRenderer.invoke('log-security-event', enhancedEvent);
    } catch (error) {
        console.error('Failed to log security event:', error);
    }
};

// Enhanced API with better error handling and logging
const electronAPI = {
    // Server Discovery & Connection
    discoverServers: createSafeInvoke('discover-servers'),
    
    // Authentication
    candidateLogin: async (loginData) => {
        const logger = createLogger('AUTH');
        logger.info('Login attempt', { armyNumber: loginData.armyNumber });
        
        try {
            // Validate login data
            if (!loginData.armyNumber || !loginData.serverInfo) {
                throw new Error('Army number and server information are required');
            }

            const result = await createSafeInvoke('candidate-login')(loginData);
            
            if (result.success) {
                logger.info('Login successful', { 
                    candidate: result.candidate?.name,
                    role: result.role 
                });
                
                safeLogSecurityEvent({
                    type: 'LOGIN_SUCCESS',
                    details: `Candidate ${result.candidate.name} logged in`,
                    severity: 'INFO',
                    candidateId: loginData.armyNumber
                });
            } else {
                logger.warn('Login failed', { error: result.error });
                
                safeLogSecurityEvent({
                    type: 'LOGIN_FAILED',
                    details: `Failed login attempt for ${loginData.armyNumber}`,
                    severity: 'MEDIUM',
                    error: result.error
                });
            }
            
            return result;
        } catch (error) {
            logger.error('Login error', error);
            throw error;
        }
    },

    // Exam Management
    submitExam: async (examData) => {
        const logger = createLogger('EXAM_SUBMISSION');
        logger.info('Submitting exam', { 
            candidate: examData.armyNumber,
            answersCount: examData.answers?.length 
        });

        try {
            const result = await createSafeInvoke('submit-exam')(examData);
            
            if (result.success) {
                logger.info('Exam submitted successfully');
                
                safeLogSecurityEvent({
                    type: 'EXAM_SUBMITTED',
                    details: `Exam submitted with ${examData.answers ? examData.answers.length : 0} answers`,
                    severity: 'INFO',
                    candidateId: examData.armyNumber
                });
            } else {
                logger.error('Exam submission failed', result.error);
                
                safeLogSecurityEvent({
                    type: 'EXAM_SUBMISSION_FAILED',
                    details: `Failed to submit exam: ${result.error}`,
                    severity: 'HIGH',
                    candidateId: examData.armyNumber
                });
            }
            
            return result;
        } catch (error) {
            logger.error('Exam submission error', error);
            throw error;
        }
    },

    // Real-time Answer Submission
    submitAnswer: async (answerData) => {
        const logger = createLogger('ANSWER_SUBMISSION');
        
        try {
            const result = await createSafeInvoke('submit-answer')(answerData);
            
            safeLogSecurityEvent({
                type: 'ANSWER_SUBMITTED',
                details: `Answer submitted for question ${answerData.questionId}`,
                severity: 'LOW',
                candidateId: answerData.candidateId,
                questionId: answerData.questionId
            });
            
            return result;
        } catch (error) {
            logger.error('Answer submission error', error);
            throw error;
        }
    },

    // Auto-save functionality
    autoSaveAnswers: async (answers) => {
        const logger = createLogger('AUTO_SAVE');
        
        try {
            const result = await createSafeInvoke('auto-save-answers')(answers);
            
            if (result.success) {
                safeLogSecurityEvent({
                    type: 'AUTO_SAVE_COMPLETED',
                    details: `Auto-saved ${answers && typeof answers === 'object' ? Object.keys(answers).length : 0} answers`,
                    severity: 'LOW'
                });
            }
            
            return result;
        } catch (error) {
            logger.error('Auto-save error', error);
            // Don't throw for auto-save errors to prevent breaking the app
            return { success: false, error: error.message };
        }
    },

    // Security & Monitoring
    logSecurityEvent: safeLogSecurityEvent,

    getSecurityStatus: createSafeInvoke('get-security-status'),

    // Application Info
    getAppVersion: createSafeInvoke('get-app-version'),

    // Questions Management
    getQuestions: createSafeInvoke('get-questions'),

    // Event Listeners
    onExamStart: createSafeOn('exam-start'),
    onExamData: createSafeOn('exam-data'),
    onExamStopped: createSafeOn('exam-stopped'),
    onServerDisconnected: createSafeOn('server-disconnected'),
    onAutoSaveRequest: createSafeOn('request-auto-save'),

    // Application Control
    closeApp: createSafeSend('close-app'),
    emergencyExit: createSafeSend('emergency-exit'),

    // Utility Functions
    getPlatformInfo: () => {
        return {
            platform: process.platform,
            arch: process.arch,
            versions: process.versions
        };
    },

    // Session Management
    getSessionInfo: () => {
        return {
            sessionStart: new Date().toISOString(),
            pageUrl: window.location.href,
            referrer: document.referrer
        };
    }
};

// Expose the API to the renderer
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Additional security measures
contextBridge.exposeInMainWorld('securityAPI', {
    // Block access to dangerous APIs
    blockDangerousAPIs: () => {
        // Override or remove dangerous window APIs
        const dangerousProps = [
            'open',
            'openDatabase',
            'showDirectoryPicker',
            'showOpenFilePicker',
            'showSaveFilePicker'
        ];

        dangerousProps.forEach(prop => {
            if (prop in window) {
                window[prop] = undefined;
                console.warn(`Blocked dangerous API: ${prop}`);
            }
        });

        // Prevent opening new windows
        window.open = () => {
            safeLogSecurityEvent({
                type: 'WINDOW_OPEN_BLOCKED',
                details: 'Attempt to open new window blocked',
                severity: 'HIGH'
            });
            return null;
        };

        // Prevent alert/confirm/prompt in production
        if (process.env.NODE_ENV !== 'development') {
            window.alert = (msg) => {
                console.warn('Alert blocked:', msg);
                safeLogSecurityEvent({
                    type: 'ALERT_BLOCKED',
                    details: `Alert attempt: ${msg}`,
                    severity: 'MEDIUM'
                });
            };

            window.confirm = (msg) => {
                console.warn('Confirm blocked:', msg);
                safeLogSecurityEvent({
                    type: 'CONFIRM_BLOCKED',
                    details: `Confirm attempt: ${msg}`,
                    severity: 'MEDIUM'
                });
                return false;
            };

            window.prompt = (msg) => {
                console.warn('Prompt blocked:', msg);
                safeLogSecurityEvent({
                    type: 'PROMPT_BLOCKED',
                    details: `Prompt attempt: ${msg}`,
                    severity: 'MEDIUM'
                });
                return null;
            };
        }
    },

    // Monitor user activity
    startActivityMonitoring: () => {
        let lastActivity = Date.now();
        const activityTimeout = 30000; // 30 seconds

        const activityEvents = [
            'mousemove', 'keydown', 'click', 'scroll', 'touchstart'
        ];

        const updateActivity = () => {
            lastActivity = Date.now();
        };

        activityEvents.forEach(event => {
            document.addEventListener(event, updateActivity, { passive: true });
        });

        // Check for inactivity
        setInterval(() => {
            const inactiveTime = Date.now() - lastActivity;
            if (inactiveTime > activityTimeout) {
                safeLogSecurityEvent({
                    type: 'USER_INACTIVITY',
                    details: `User inactive for ${Math.round(inactiveTime / 1000)} seconds`,
                    severity: 'LOW'
                });
            }
        }, 10000); // Check every 10 seconds
    },

    // Detect context menu attempts (right-click)
    blockContextMenu: () => {
        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            safeLogSecurityEvent({
                type: 'CONTEXT_MENU_BLOCKED',
                details: 'Right-click context menu blocked',
                severity: 'MEDIUM'
            });
            return false;
        });
    },

    // Detect developer tools attempts
    detectDevTools: () => {
        if (process.env.NODE_ENV !== 'development') {
            const element = new Image();
            Object.defineProperty(element, 'id', {
                get: function() {
                    safeLogSecurityEvent({
                        type: 'DEVTOOLS_DETECTED',
                        details: 'Developer tools detection triggered',
                        severity: 'HIGH'
                    });
                }
            });
            console.log('%c', element);
        }
    }
});

// Initialize security measures when the preload script loads
window.addEventListener('DOMContentLoaded', () => {
    console.log('Preload script initialized with enhanced security');
    
    // Initialize security APIs
    if (window.securityAPI) {
        window.securityAPI.blockDangerousAPIs();
        window.securityAPI.startActivityMonitoring();
        window.securityAPI.blockContextMenu();
        window.securityAPI.detectDevTools();
    }

    // Log page load
    safeLogSecurityEvent({
        type: 'PAGE_LOAD',
        details: `Page loaded: ${window.location.href}`,
        severity: 'INFO'
    });
});

// Handle unload events
window.addEventListener('beforeunload', (event) => {
    safeLogSecurityEvent({
        type: 'PAGE_UNLOAD',
        details: 'Page is being unloaded/navigated away',
        severity: 'MEDIUM'
    });
});

// Export for testing purposes
if (process.env.NODE_ENV === 'development') {
    contextBridge.exposeInMainWorld('__DEBUG__', {
        electronAPI: electronAPI,
        securityAPI: window.securityAPI
    });
}

console.log('Enhanced preload script loaded successfully');