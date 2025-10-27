class ProductionLogger {
    constructor() {
        this.logLevel = process.env.NODE_ENV === 'development' ? 'debug' : 'info';
    }

    log(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            data,
            app: 'army-exam-app'
        };

        // In production, only log info and above
        if (this.shouldLog(level)) {
            console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`, data || '');
            
            // Write to file in production
            if (process.env.NODE_ENV === 'production') {
                this.writeToFile(logEntry);
            }
        }
    }

    shouldLog(level) {
        const levels = ['error', 'warn', 'info', 'debug'];
        const currentLevelIndex = levels.indexOf(this.logLevel);
        const messageLevelIndex = levels.indexOf(level);
        
        return messageLevelIndex <= currentLevelIndex;
    }

    writeToFile(logEntry) {
        // This would write to a log file in production
        const fs = require('fs');
        const path = require('path');
        
        const logDir = path.join(__dirname, '../../logs');
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        
        const logFile = path.join(logDir, `exam-app-${new Date().toISOString().split('T')[0]}.log`);
        fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
    }

    info(message, data = null) {
        this.log('info', message, data);
    }

    warn(message, data = null) {
        this.log('warn', message, data);
    }

    error(message, data = null) {
        this.log('error', message, data);
    }

    debug(message, data = null) {
        this.log('debug', message, data);
    }
}

module.exports = ProductionLogger;