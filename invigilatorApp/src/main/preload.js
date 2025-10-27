const { contextBridge, ipcRenderer } = require('electron');

// Security: Define valid IPC channels
const validChannels = {
    invoke: [
        'upload-users-file',
        'upload-questions-file',
        'get-uploaded-data',
        'clear-uploaded-data',
        'calculate-results',
        'export-results',
        'export-results-word',
        'export-results-csv',
        'export-results-table',
        'export-results-with-data',
        'start-exam',
        'start-server',
        'stop-server',
        'get-server-status',
        'get-app-version',
        'ping',
        'get-answers'
    ],
    on: [
        'server-status-update',
        'file-upload-progress',
        'candidate-joined',
        'candidate-left',
        'answer-update',
        'exam-started',
        'exam-stopped',
        'security-alert'
    ],
    send: [
        'close-app',
        'emergency-stop'
    ]
};

// Security: Create safe handlers
const createSafeInvoke = (channel) => {
    return (...args) => {
        if (validChannels.invoke.includes(channel)) {
            return ipcRenderer.invoke(channel, ...args);
        }
        console.error(`Blocked invalid IPC invoke channel: ${channel}`);
        throw new Error(`Invalid IPC channel: ${channel}`);
    };
};

const createSafeOn = (channel) => {
    return (callback) => {
        if (validChannels.on.includes(channel)) {
            const wrappedCallback = (event, ...args) => {
                try {
                    callback(...args);
                } catch (error) {
                    console.error(`Error in ${channel} callback:`, error);
                }
            };
            ipcRenderer.on(channel, wrappedCallback);
            
            // Return cleanup function
            return () => ipcRenderer.removeListener(channel, wrappedCallback);
        }
        console.error(`Blocked invalid IPC on channel: ${channel}`);
        throw new Error(`Invalid IPC channel: ${channel}`);
    };
};

const createSafeSend = (channel) => {
    return (...args) => {
        if (validChannels.send.includes(channel)) {
            return ipcRenderer.send(channel, ...args);
        }
        console.error(`Blocked invalid IPC send channel: ${channel}`);
        throw new Error(`Invalid IPC channel: ${channel}`);
    };
};

// Enhanced logging utility
const createLogger = (context) => {
    return {
        info: (message, data) => {
            console.log(`[INVIGILATOR-${context}] ${message}`, data || '');
        },
        warn: (message, data) => {
            console.warn(`[INVIGILATOR-${context}] ${message}`, data || '');
        },
        error: (message, error) => {
            console.error(`[INVIGILATOR-${context}] ${message}`, error || '');
        }
    };
};

// Enhanced API with better error handling and logging
const electronAPI = {
    // File Operations - Enhanced with logging
    uploadUsersFile: async () => {
        const logger = createLogger('FILE_UPLOAD');
        logger.info('Starting users file upload');
        
        try {
            const result = await createSafeInvoke('upload-users-file')();
            
            if (result.success) {
                logger.info('Users file uploaded successfully', {
                    usersCount: result.usersCount,
                    filePath: result.filePath
                });
            } else {
                logger.warn('Users file upload failed', { error: result.error });
            }
            
            return result;
        } catch (error) {
            logger.error('Users file upload error', error);
            throw error;
        }
    },

    uploadQuestionsFile: async () => {
        const logger = createLogger('FILE_UPLOAD');
        logger.info('Starting questions file upload');
        
        try {
            const result = await createSafeInvoke('upload-questions-file')();
            
            if (result.success) {
                logger.info('Questions file uploaded successfully', {
                    questionsCount: result.questionsCount,
                    totalMarks: result.totalMarks
                });
            } else {
                logger.warn('Questions file upload failed', { error: result.error });
            }
            
            return result;
        } catch (error) {
            logger.error('Questions file upload error', error);
            throw error;
        }
    },

    getUploadedData: async () => {
        try {
            const result = await createSafeInvoke('get-uploaded-data')();
            return result;
        } catch (error) {
            console.error('Error getting uploaded data:', error);
            throw error;
        }
    },

    clearUploadedData: async () => {
        const logger = createLogger('DATA_MANAGEMENT');
        logger.info('Clearing uploaded data');
        
        try {
            const result = await createSafeInvoke('clear-uploaded-data')();
            logger.info('Uploaded data cleared successfully');
            return result;
        } catch (error) {
            logger.error('Error clearing uploaded data', error);
            throw error;
        }
    },

    // Results Operations - Enhanced with fixed export functionality
    calculateResults: async (answers = []) => {
        const logger = createLogger('RESULTS');
        logger.info('Calculating results', { answersCount: answers.length });
        
        try {
            const result = await createSafeInvoke('calculate-results')(answers);
            
            if (result.success) {
                logger.info('Results calculated successfully', {
                    totalCandidates: result.totalCandidates,
                    averageScore: result.summary?.averageScore
                });
            } else {
                logger.error('Results calculation failed', { error: result.error });
            }
            
            return result;
        } catch (error) {
            logger.error('Results calculation error', error);
            throw error;
        }
    },

    // Fixed Export Results - Now includes complete candidate data
    exportResults: async (results = []) => {
        const logger = createLogger('EXPORT');
        logger.info('Exporting results', { resultsCount: results.length });
        
        try {
            const result = await createSafeInvoke('export-results')(results);
            
            if (result.success) {
                logger.info('Results exported successfully', {
                    filePath: result.filePath,
                    resultsCount: result.resultsCount,
                    format: 'HTML'
                });
            } else {
                logger.error('Results export failed', { error: result.error });
            }
            
            return result;
        } catch (error) {
            logger.error('Results export error', error);
            throw error;
        }
    },

    // New CSV Export Functionality
    exportResultsCSV: async () => {
        const logger = createLogger('EXPORT');
        logger.info('Exporting results as CSV');
        
        try {
            const result = await createSafeInvoke('export-results-csv')();
            
            if (result.success) {
                logger.info('CSV results exported successfully', {
                    filePath: result.filePath,
                    format: 'CSV'
                });
            } else {
                logger.error('CSV export failed', { error: result.error });
            }
            
            return result;
        } catch (error) {
            logger.error('CSV export error', error);
            throw error;
        }
    },

    exportResultsWord: async (results = []) => {
        const logger = createLogger('EXPORT');
        logger.info('Exporting results to Word', { resultsCount: results.length });
        
        try {
            const result = await createSafeInvoke('export-results-word')(results);
            
            if (result.success) {
                logger.info('Word document exported successfully', {
                    filePath: result.filePath,
                    resultsCount: result.resultsCount
                });
            } else {
                logger.error('Word export failed', { error: result.error });
            }
            
            return result;
        } catch (error) {
            logger.error('Word export error', error);
            throw error;
        }
    },

    exportResultsTable: async (tableData) => {
        const logger = createLogger('EXPORT');
        logger.info('Exporting results table');
        
        try {
            const result = await createSafeInvoke('export-results-table')(tableData);
            return result;
        } catch (error) {
            logger.error('Table export error', error);
            throw error;
        }
    },

    exportResultsWithData: async (examData) => {
        const logger = createLogger('EXPORT');
        logger.info('Exporting results with provided data');
        
        try {
            const result = await createSafeInvoke('export-results-with-data')(examData);
            return result;
        } catch (error) {
            logger.error('Data export error', error);
            throw error;
        }
    },

    // Exam Operations
    startExam: async (examData) => {
        const logger = createLogger('EXAM');
        logger.info('Starting exam', {
            duration: examData.duration,
            questionCount: examData.questions?.length
        });
        
        try {
            const result = await createSafeInvoke('start-exam')(examData);
            
            if (result.success) {
                logger.info('Exam started successfully');
            } else {
                logger.error('Failed to start exam', { error: result.error });
            }
            
            return result;
        } catch (error) {
            logger.error('Exam start error', error);
            throw error;
        }
    },

    // Server Operations
    startServer: async (port = 9611) => {
        const logger = createLogger('SERVER');
        logger.info('Starting server', { port });
        
        try {
            const result = await createSafeInvoke('start-server')(port);
            
            if (result.success) {
                logger.info('Server started successfully', { port: result.port });
            } else {
                logger.error('Server start failed', { error: result.error });
            }
            
            return result;
        } catch (error) {
            logger.error('Server start error', error);
            throw error;
        }
    },

    stopServer: async () => {
        const logger = createLogger('SERVER');
        logger.info('Stopping server');
        
        try {
            const result = await createSafeInvoke('stop-server')();
            
            if (result.success) {
                logger.info('Server stopped successfully');
            } else {
                logger.error('Server stop failed', { error: result.error });
            }
            
            return result;
        } catch (error) {
            logger.error('Server stop error', error);
            throw error;
        }
    },

    getServerStatus: async () => {
        try {
            const result = await createSafeInvoke('get-server-status')();
            return result;
        } catch (error) {
            console.error('Error getting server status:', error);
            throw error;
        }
    },

    // Get candidate answers
    getAnswers: async () => {
        try {
            const result = await createSafeInvoke('get-answers')();
            return result;
        } catch (error) {
            console.error('Error getting answers:', error);
            throw error;
        }
    },

    // App Info
    getAppVersion: async () => {
        try {
            const result = await createSafeInvoke('get-app-version')();
            return result;
        } catch (error) {
            console.error('Error getting app version:', error);
            throw error;
        }
    },

    // Debug methods
    ping: async () => {
        try {
            const result = await createSafeInvoke('ping')();
            return result;
        } catch (error) {
            console.error('Ping error:', error);
            throw error;
        }
    },

    // Event Listeners with proper cleanup
    onServerStatusUpdate: createSafeOn('server-status-update'),
    onFileUploadProgress: createSafeOn('file-upload-progress'),
    onCandidateJoined: createSafeOn('candidate-joined'),
    onCandidateLeft: createSafeOn('candidate-left'),
    onAnswerUpdate: createSafeOn('answer-update'),
    onExamStarted: createSafeOn('exam-started'),
    onExamStopped: createSafeOn('exam-stopped'),
    onSecurityAlert: createSafeOn('security-alert'),

    // Application Control
    closeApp: createSafeSend('close-app'),
    emergencyStop: createSafeSend('emergency-stop'),

    // Utility Methods
    getPlatformInfo: () => {
        return {
            platform: process.platform,
            arch: process.arch,
            electronVersion: process.versions.electron,
            chromeVersion: process.versions.chrome
        };
    },

    // Data Validation Helpers
    validateArmyNumber: (armyNumber) => {
        const pattern = /^[A-Z]{2}\d{6}[A-Z]?$/;
        return pattern.test(armyNumber);
    },

    // Export Data Formatters
    formatResultsForExport: (results) => {
        return results.map(result => ({
            armyNumber: result.armyNumber,
            name: result.name,
            rank: result.rank,
            unit: result.unit,
            score: result.score,
            totalQuestions: result.totalQuestions,
            percentage: result.percentage,
            status: result.status,
            submittedAt: result.submittedAt
        }));
    }
};

// Expose the enhanced API to the renderer
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Additional utilities for the renderer
contextBridge.exposeInMainWorld('appUtils', {
    // Format file size for display
    formatFileSize: (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    // Format date for display
    formatDate: (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    },

    // Calculate time remaining
    calculateTimeRemaining: (startTime, durationMinutes) => {
        const start = new Date(startTime);
        const end = new Date(start.getTime() + durationMinutes * 60000);
        const now = new Date();
        const remaining = end - now;
        
        if (remaining <= 0) return '00:00:00';
        
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    },

    // Generate unique ID
    generateId: () => {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
});

// Initialize when the preload script loads
window.addEventListener('DOMContentLoaded', () => {
    console.log('Invigilator preload script initialized with enhanced security and export functionality');
    
    // Log initialization
    if (window.electronAPI) {
        window.electronAPI.ping().then(result => {
            console.log('IPC communication test:', result);
        }).catch(error => {
            console.error('IPC communication test failed:', error);
        });
    }
});

// Handle unload events
window.addEventListener('beforeunload', () => {
    console.log('Invigilator app unloading');
});

// Export for testing in development
if (process.env.NODE_ENV === 'development') {
    contextBridge.exposeInMainWorld('__INVIGILATOR_DEBUG__', {
        electronAPI: electronAPI,
        appUtils: window.appUtils
    });
}

console.log('Enhanced invigilator preload script loaded successfully');